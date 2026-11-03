from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent
DATA = (ROOT / "GenePool6.exe").read_bytes()


def u16(offset):
    return struct.unpack_from("<H", DATA, offset)[0]


def u32(offset):
    return struct.unpack_from("<I", DATA, offset)[0]


def pstring(offset):
    length = DATA[offset]
    return DATA[offset + 1:offset + 1 + length].decode("ascii", errors="replace")


pe = u32(0x3C)
coff = pe + 4
optional = coff + 20
optional_size = u16(coff + 16)
image_base = u32(optional + 28)
section_table = optional + optional_size
sections = []
for index in range(u16(coff + 2)):
    offset = section_table + index * 40
    name = DATA[offset:offset + 8].rstrip(b"\0").decode("ascii")
    virtual_size, rva, raw_size, raw_offset = struct.unpack_from("<IIII", DATA, offset + 8)
    sections.append({"name": name, "rva": rva, "raw": raw_offset, "size": raw_size, "vs": virtual_size})

last_raw_end = max(section["raw"] + section["size"] for section in sections)
base = DATA.find(b"NB11", last_raw_end)
if base < 0:
    raise RuntimeError("NB11 CodeView data not found")
directory = base + u32(base + 4)
header_size, entry_size, entry_count = struct.unpack_from("<HHI", DATA, directory)
if (header_size, entry_size) != (16, 12):
    raise RuntimeError(f"Unexpected CodeView directory layout: {header_size}, {entry_size}")

subsection_names = {
    0x120: "sstModule", 0x121: "sstTypes", 0x122: "sstPublic",
    0x123: "sstPublicSym", 0x124: "sstSymbols", 0x125: "sstAlignSym",
    0x126: "sstSrcLnSeg", 0x127: "sstSrcModule", 0x128: "sstLibraries",
    0x129: "sstGlobalSym", 0x12A: "sstGlobalPub", 0x12B: "sstGlobalTypes",
    0x12D: "sstSegMap", 0x12E: "sstSegName", 0x133: "sstFileIndex",
    0x134: "sstStaticSym",
}
entries = []
for index in range(entry_count):
    offset = directory + header_size + index * entry_size
    subsection, module, relative, size = struct.unpack_from("<HHII", DATA, offset)
    entries.append({"type": subsection, "module": module, "offset": base + relative, "size": size})

modules = {}
module_lines = []
for entry in entries:
    if entry["type"] != 0x120:
        continue
    start = entry["offset"]
    overlay, library, segment_count = struct.unpack_from("<HHH", DATA, start)
    style = DATA[start + 6:start + 8].decode("ascii", errors="replace")
    segments = {}
    for segment_index in range(segment_count):
        offset = start + 8 + segment_index * 12
        segment, padding, code_offset, code_size = struct.unpack_from("<HHII", DATA, offset)
        segments[segment] = {"offset": code_offset, "size": code_size}
    name_offset = start + 8 + segment_count * 12
    name = pstring(name_offset)
    modules[entry["module"]] = {"name": name, "segments": segments}
    module_lines.append(f"{entry['module']:3} {name:32} segments={segment_count:2} style={style}")
    for segment, info in segments.items():
        if info["size"]:
            module_lines.append(
                f"    seg={segment:2} RVA=0x{info['offset']:08x} size=0x{info['size']:x}"
            )

# Both the old (0x100f/0x1010) and newer (0x110f/0x1110) 32-bit
# procedure records use the PROCSYM32 layout in this VC6-era file.
proc_types = {0x100F: "S_LPROC32", 0x1010: "S_GPROC32", 0x110F: "S_LPROC32", 0x1110: "S_GPROC32"}
functions = []
symbol_counts = {}
for entry in entries:
    if entry["type"] not in (0x124, 0x125):
        continue
    start = entry["offset"]
    end = start + entry["size"]
    pos = start
    if u32(pos) == 1:  # Optional CodeView signature before aligned records.
        pos += 4
    while pos + 4 <= end:
        record_length, record_type = struct.unpack_from("<HH", DATA, pos)
        if record_length < 2 or pos + 2 + record_length > end:
            module_lines.append(f"Bad symbol record at 0x{pos:x}: length={record_length}, type=0x{record_type:x}")
            break
        symbol_counts[record_type] = symbol_counts.get(record_type, 0) + 1
        if record_type in proc_types:
            parent, block_end, next_proc, code_size, debug_start, debug_end, type_index = struct.unpack_from(
                "<IIIIIII", DATA, pos + 4
            )
            code_offset, segment = struct.unpack_from("<IH", DATA, pos + 32)
            flags = DATA[pos + 38]
            name = pstring(pos + 39)
            module = modules.get(entry["module"])
            segment_info = module["segments"].get(segment) if module else None
            rva = segment_info["offset"] + code_offset if segment_info else None
            functions.append({
                "name": name,
                "kind": proc_types[record_type],
                "module": module["name"] if module else f"module {entry['module']}",
                "module_index": entry["module"],
                "rva": rva,
                "va": image_base + rva if rva is not None else None,
                "size": code_size,
                "segment": segment,
                "offset": code_offset,
                "record": pos,
                "debug_start": debug_start,
                "debug_end": debug_end,
                "type_index": type_index,
                "flags": flags,
            })
        pos += 2 + record_length

publics = []
for entry in entries:
    if entry["type"] != 0x12A:
        continue
    # OMFSymHash precedes the actual symbol records.
    symbol_size = u32(entry["offset"] + 4)
    pos = entry["offset"] + 16
    end = pos + symbol_size
    while pos + 4 <= end:
        record_length, record_type = struct.unpack_from("<HH", DATA, pos)
        if record_length < 2 or pos + 2 + record_length > end:
            raise RuntimeError(f"Bad public symbol at 0x{pos:x}")
        symbol_counts[record_type] = symbol_counts.get(record_type, 0) + 1
        if record_type in (0x1009, 0x110E):  # S_PUB32_ST / S_PUB32
            flags, code_offset, segment = struct.unpack_from("<IIH", DATA, pos + 4)
            if record_type == 0x1009:
                name = pstring(pos + 14)
            else:
                name_end = DATA.find(b"\0", pos + 14, pos + 2 + record_length)
                name = DATA[pos + 14:name_end].decode("ascii", errors="replace")
            if 1 <= segment <= len(sections):
                rva = sections[segment - 1]["rva"] + code_offset
            else:
                rva = None
            publics.append({
                "name": name, "segment": segment, "offset": code_offset,
                "rva": rva, "va": image_base + rva if rva is not None else None,
                "record": pos, "flags": flags,
            })
        pos += 2 + record_length

publics.sort(key=lambda item: (item["rva"] is None, item["rva"] or 0, item["name"]))
for index, public in enumerate(publics):
    public["size"] = 0
    if public["segment"] != 1 or public["rva"] is None:
        continue
    later_addresses = [
        other["rva"] for other in publics
        if other["segment"] == 1 and other["rva"] is not None and other["rva"] > public["rva"]
    ]
    next_rva = min(later_addresses) if later_addresses else sections[0]["rva"] + sections[0]["vs"]
    public["size"] = next_rva - public["rva"]

public_lines = ["name\tVA\tRVA\tnext_symbol_delta\tsegment\toffset\trecord"]
for public in publics:
    va = f"0x{public['va']:08x}" if public["va"] is not None else "?"
    rva = f"0x{public['rva']:08x}" if public["rva"] is not None else "?"
    public_lines.append(
        f"{public['name']}\t{va}\t{rva}\t0x{public['size']:x}\t{public['segment']}\t"
        f"0x{public['offset']:x}\t0x{public['record']:x}"
    )

functions.sort(key=lambda item: (item["rva"] is None, item["rva"] or 0, item["name"]))
function_lines = [
    "name\tkind\tmodule\tVA\tRVA\tsize\tsegment\toffset\trecord"
]
for function in functions:
    va = f"0x{function['va']:08x}" if function["va"] is not None else "?"
    rva = f"0x{function['rva']:08x}" if function["rva"] is not None else "?"
    function_lines.append(
        f"{function['name']}\t{function['kind']}\t{function['module']}\t{va}\t{rva}\t"
        f"0x{function['size']:x}\t{function['segment']}\t0x{function['offset']:x}\t0x{function['record']:x}"
    )

directory_lines = [
    f"base=0x{base:x}", f"directory=0x{directory:x}", f"entries={entry_count}",
]
for entry in entries:
    directory_lines.append(
        f"{subsection_names.get(entry['type'], 'unknown'):16} type=0x{entry['type']:04x} "
        f"module={entry['module']:3} file=0x{entry['offset']:08x} size=0x{entry['size']:x}"
    )
directory_lines.append("Symbol record counts:")
for record_type, count in sorted(symbol_counts.items()):
    directory_lines.append(f"  0x{record_type:04x}: {count}")

(ROOT / "codeview.txt").write_text("\n".join(directory_lines) + "\n", encoding="utf-8", newline="\n")
(ROOT / "modules.txt").write_text("\n".join(module_lines) + "\n", encoding="utf-8", newline="\n")
(ROOT / "functions.tsv").write_text("\n".join(function_lines) + "\n", encoding="utf-8", newline="\n")
(ROOT / "publics.tsv").write_text("\n".join(public_lines) + "\n", encoding="utf-8", newline="\n")
print(
    f"Parsed {len(entries)} subsections, {len(modules)} modules, "
    f"{len(functions)} procedure records, {len(publics)} public symbols"
)
