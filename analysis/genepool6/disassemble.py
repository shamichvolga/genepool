from pathlib import Path
import csv
import math
import re
import struct
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "pylibs"))
import capstone
from capstone.x86 import X86_OP_IMM, X86_OP_MEM

DATA = (ROOT / "GenePool6.exe").read_bytes()
pe = struct.unpack_from("<I", DATA, 0x3C)[0]
coff = pe + 4
optional = coff + 20
section_table = optional + struct.unpack_from("<H", DATA, coff + 16)[0]
image_base = struct.unpack_from("<I", DATA, optional + 28)[0]
sections = []
for index in range(struct.unpack_from("<H", DATA, coff + 2)[0]):
    offset = section_table + index * 40
    name = DATA[offset:offset + 8].rstrip(b"\0").decode("ascii")
    virtual_size, rva, raw_size, raw_offset = struct.unpack_from("<IIII", DATA, offset + 8)
    sections.append({"name": name, "rva": rva, "raw": raw_offset, "size": raw_size, "vs": virtual_size})


def file_offset(rva):
    for section in sections:
        if section["rva"] <= rva < section["rva"] + section["size"]:
            return section["raw"] + rva - section["rva"]
    return None


def data_annotation(address):
    rva = address - image_base
    offset = file_offset(rva)
    if offset is None or offset + 8 > len(DATA):
        return ""
    u32 = struct.unpack_from("<I", DATA, offset)[0]
    f32 = struct.unpack_from("<f", DATA, offset)[0]
    f64 = struct.unpack_from("<d", DATA, offset)[0]
    values = [f"u32=0x{u32:08x}"]
    if math.isfinite(f32) and (f32 == 0 or 1e-20 < abs(f32) < 1e20):
        values.append(f"f32={f32:.12g}")
    if math.isfinite(f64) and (f64 == 0 or 1e-100 < abs(f64) < 1e100):
        values.append(f"f64={f64:.17g}")
    return "; " + ", ".join(values)


with (ROOT / "publics.tsv").open(encoding="utf-8") as handle:
    publics = list(csv.DictReader(handle, delimiter="\t"))
by_address = {}
for public in publics:
    if public["VA"] != "?":
        by_address.setdefault(int(public["VA"], 16), []).append(public["name"])

requested = sys.argv[1:] or [
    "generatePhenotypeFromGenotype", "growParts", "setAsOffspring", "mutateGene",
    "contributeToOffspring", "updatePhysics", "calculateFluidForces", "eat@Swimbot",
]
selected = [
    public for public in publics
    if public["segment"] == "1" and any(term in public["name"] for term in requested)
]
if not selected:
    raise SystemExit("No matching code symbols")

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
md.detail = True
output_dir = ROOT / "disassembly"
output_dir.mkdir(exist_ok=True)
for public in selected:
    va = int(public["VA"], 16)
    rva = int(public["RVA"], 16)
    size = int(public["next_symbol_delta"], 16)
    offset = file_offset(rva)
    code = DATA[offset:offset + size]
    lines = [f"; {public['name']}", f"; VA=0x{va:08x}, delta to next public=0x{size:x}"]
    for instruction in md.disasm(code, va):
        annotations = []
        for operand in instruction.operands:
            if operand.type == X86_OP_IMM and instruction.mnemonic in ("call", "jmp"):
                names = by_address.get(operand.imm)
                if names:
                    annotations.append(" ; " + " | ".join(names))
            elif operand.type == X86_OP_MEM and operand.mem.base == 0 and operand.mem.index == 0:
                address = operand.mem.disp
                names = by_address.get(address)
                if names:
                    annotations.append(" ; " + " | ".join(names))
                else:
                    annotations.append(data_annotation(address))
        lines.append(f"0x{instruction.address:08x}  {instruction.mnemonic:8} {instruction.op_str}{''.join(annotations)}")
    safe_name = re.sub(r"[^A-Za-z0-9_]+", "_", public["name"]).strip("_")[:100]
    path = output_dir / f"{va:08x}_{safe_name}.asm"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"{public['name']} -> {path.name} ({len(lines) - 2} instructions)")
