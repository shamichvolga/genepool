from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent
DATA = (ROOT / "GenePool6.exe").read_bytes()


def u16(offset):
    return struct.unpack_from("<H", DATA, offset)[0]


def u32(offset):
    return struct.unpack_from("<I", DATA, offset)[0]


def cstring(offset):
    end = DATA.find(b"\0", offset)
    return DATA[offset:end].decode("ascii", errors="replace")


pe = u32(0x3C)
assert DATA[pe:pe + 4] == b"PE\0\0"
coff = pe + 4
num_sections = u16(coff + 2)
timestamp = u32(coff + 4)
optional = coff + 20
optional_size = u16(coff + 16)
assert u16(optional) == 0x10B
entry_rva = u32(optional + 16)
image_base = u32(optional + 28)
dirs = optional + 96
section_table = optional + optional_size
sections = []
for index in range(num_sections):
    offset = section_table + index * 40
    name = DATA[offset:offset + 8].rstrip(b"\0").decode("ascii")
    virtual_size, virtual_address, raw_size, raw_offset = struct.unpack_from("<IIII", DATA, offset + 8)
    characteristics = u32(offset + 36)
    sections.append({
        "name": name,
        "va": virtual_address,
        "vs": virtual_size,
        "raw": raw_offset,
        "size": raw_size,
        "characteristics": characteristics,
    })


def rva_offset(rva):
    for section in sections:
        span = max(section["vs"], section["size"])
        if section["va"] <= rva < section["va"] + span:
            return section["raw"] + rva - section["va"]
    raise ValueError(f"Unmapped RVA {rva:08x}")


def section_at(offset):
    for section in sections:
        if section["raw"] <= offset < section["raw"] + section["size"]:
            return section["name"]
    return "overlay"


lines = [
    f"size={len(DATA)}",
    f"pe_offset=0x{pe:x}",
    f"timestamp=0x{timestamp:08x}",
    f"image_base=0x{image_base:08x}",
    f"entry_rva=0x{entry_rva:08x}",
    f"sections={num_sections}",
]
for section in sections:
    lines.append(
        f"{section['name']:8} RVA=0x{section['va']:08x} virtual={section['vs']:7} "
        f"raw=0x{section['raw']:06x} size={section['size']:7} flags=0x{section['characteristics']:08x}"
    )

imports = []
import_rva, import_size = struct.unpack_from("<II", DATA, dirs + 8)
lines.append(f"import_directory RVA=0x{import_rva:08x} size={import_size}")
if import_rva:
    descriptor = rva_offset(import_rva)
    while any(DATA[descriptor:descriptor + 20]):
        lookup_rva, stamp, chain, name_rva, iat_rva = struct.unpack_from("<IIIII", DATA, descriptor)
        dll = cstring(rva_offset(name_rva))
        functions = []
        lookup_offset = rva_offset(lookup_rva or iat_rva)
        while True:
            value = u32(lookup_offset)
            lookup_offset += 4
            if value == 0:
                break
            if value & 0x80000000:
                functions.append(f"ordinal:{value & 0xffff}")
            else:
                functions.append(cstring(rva_offset(value) + 2))
        imports.append((dll, functions))
        lines.append(f"{dll}: {len(functions)} imports")
        lines.extend(f"  {name}" for name in functions)
        descriptor += 20

resource_rva, resource_size = struct.unpack_from("<II", DATA, dirs + 16)
lines.append(f"resource_directory RVA=0x{resource_rva:08x} size={resource_size}")
(ROOT / "summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")

strings = []
for start, end in [(0, len(DATA))]:
    offset = start
    while offset < end:
        if 32 <= DATA[offset] <= 126:
            stop = offset
            while stop < end and 32 <= DATA[stop] <= 126:
                stop += 1
            if stop - offset >= 4:
                text = DATA[offset:stop].decode("ascii")
                strings.append(f"0x{offset:08x} {section_at(offset):8} ASCII {text}")
            offset = stop
        else:
            offset += 1

for offset in range(0, len(DATA) - 8, 2):
    if 32 <= DATA[offset] <= 126 and DATA[offset + 1] == 0:
        stop = offset
        chars = []
        while stop + 1 < len(DATA) and 32 <= DATA[stop] <= 126 and DATA[stop + 1] == 0:
            chars.append(DATA[stop])
            stop += 2
        if len(chars) >= 4:
            text = bytes(chars).decode("ascii")
            strings.append(f"0x{offset:08x} {section_at(offset):8} UTF16 {text}")

(ROOT / "strings.txt").write_text("\n".join(strings) + "\n", encoding="utf-8", newline="\n")
print(f"Parsed {num_sections} sections, {len(imports)} DLLs, {len(strings)} strings")
