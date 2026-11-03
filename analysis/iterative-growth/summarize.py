from pathlib import Path
import csv
import json
import statistics

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "tools" / "results" / "lab-iterative-growth"
rows = []
for directory in sorted(RESULTS.iterdir()):
    if not directory.is_dir():
        continue
    arm, seed_text = directory.name.split("-s")
    with (directory / "summary.json").open(encoding="utf-8") as handle:
        summary = json.load(handle)
    with (directory / "census.csv").open(encoding="utf-8", newline="") as handle:
        census = list(csv.DictReader(handle))[-1]
    rows.append({
        "arm": arm,
        "seed": int(seed_text),
        "alive": int(census["alive"]),
        "massP50": float(census["mass_p50"]),
        "births": int(summary["births"]),
        "deaths": int(summary["deaths"]),
        "starvationShare": summary["counters"]["starvationDeaths"] / summary["deaths"],
        "seconds": summary["secondsSoFar"],
    })

result = {}
for arm in ("ctl", "grow8", "grow16"):
    selected = [row for row in rows if row["arm"] == arm]
    result[arm] = {
        "runs": len(selected),
        **{
            key: statistics.mean(row[key] for row in selected)
            for key in ("alive", "massP50", "births", "deaths", "starvationShare", "seconds")
        },
    }

output = ROOT / "analysis" / "iterative-growth" / "world-summary.json"
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(result, ensure_ascii=False, indent=2))
