import csv
import json
import statistics
import sys
from pathlib import Path

GROUPS = (("simple", 2, 5), ("medium", 6, 9), ("complex", 10, 16))


def read_csv(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def number(value):
    return float(value) if value else 0.0


def median(rows, key):
    values = [number(row[key]) for row in rows]
    return statistics.median(values) if values else None


def mean(rows, key):
    values = [number(row[key]) for row in rows]
    return statistics.mean(values) if values else None


def summarize(folder):
    root = Path(folder)
    deaths = read_csv(root / "deaths.csv")
    births = read_csv(root / "births.csv")
    census = read_csv(root / "census.csv")
    result = {"folder": str(root), "final": {}, "groups": {}}
    final = census[-1]
    alive = int(final["alive"])
    result["final"] = {
        "step": int(final["step"]),
        "alive": alive,
        "births": len(births),
        "deaths": len(deaths),
        "energy_median": number(final["energy_p50"]),
        "age_median": number(final["age_p50"]),
    }
    for name, low, high in GROUPS:
        born_deaths = [
            row for row in deaths
            if low <= int(row["parts"]) <= high and int(row["step"]) > int(row["age"])
        ]
        group_births = [row for row in births if low <= int(row["child_parts"]) <= high]
        complex_count = sum(int(final[f"parts_{parts}"]) for parts in range(low, high + 1))
        result["groups"][name] = {
            "alive": complex_count,
            "alive_share": complex_count / alive if alive else 0,
            "births": len(group_births),
            "birth_energy_median": median(group_births, "child_energy"),
            "born_deaths": len(born_deaths),
            "starvation_share": (
                sum(row["cause"] == "starvation" for row in born_deaths) / len(born_deaths)
                if born_deaths else None
            ),
            "death_age_median": median(born_deaths, "age"),
            "meals_mean": mean(born_deaths, "meals"),
            "children_mean": mean(born_deaths, "children"),
            "energy_at_birth_median": median(born_deaths, "energy_at_birth"),
            "given_to_children_mean": mean(born_deaths, "given_to_children"),
        }
    return result


print(json.dumps([summarize(folder) for folder in sys.argv[1:]], indent=2, ensure_ascii=False))
