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


def median_present(rows, key):
    values = [number(row[key]) for row in rows if row[key]]
    return statistics.median(values) if values else None


def newborn_summary(rows):
    if not rows:
        return None
    looks = sum(int(row["looks"]) for row in rows)
    observed = sum(int(row["observed_steps"]) for row in rows)
    completed = [row for row in rows if row["end_reason"] != "run_end"]
    fed = [row for row in rows if int(row["meals"]) > 0]
    return {
        "count": len(rows),
        "birth_nearest_food_median": median_present(rows, "birth_nearest_food"),
        "birth_with_food_in_view_share": sum(int(row["birth_food_in_view"]) > 0 for row in rows) / len(rows),
        "look_food_share": sum(int(row["looks_with_food"]) for row in rows) / looks if looks else None,
        "seen_food_distance_median": median_present(rows, "seen_food_distance_mean"),
        "pursuit_step_share": sum(int(row["pursuit_steps"]) for row in rows) / observed if observed else None,
        "pursuit_distance_median": median_present(rows, "pursuit_distance_mean"),
        "pursuit_min_distance_median": median_present(rows, "pursuit_min_distance"),
        "fed_share": len(fed) / len(rows),
        "first_meal_age_median": median_present(fed, "first_meal_age"),
        "meals_mean": mean(rows, "meals"),
        "birth_energy_median": median(rows, "birth_energy"),
        "net_energy_spent_per_step": sum(number(row["net_energy_spent"]) for row in rows) / observed if observed else None,
        "survival_1000": sum(int(row["alive_at_end"]) for row in completed) / len(completed) if completed else None,
    }


def summarize(folder):
    root = Path(folder)
    deaths = read_csv(root / "deaths.csv")
    births = read_csv(root / "births.csv")
    census = read_csv(root / "census.csv")
    newborn_path = root / "newborns.csv"
    newborns = read_csv(newborn_path) if newborn_path.exists() else []
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
        group_newborns = [row for row in newborns if low <= int(row["parts"]) <= high]
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
            "newborns": newborn_summary(group_newborns),
        }
    return result


print(json.dumps([summarize(folder) for folder in sys.argv[1:]], indent=2, ensure_ascii=False))
