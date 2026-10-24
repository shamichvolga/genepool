#!/bin/bash
# Series pp (25.10): is the population cap the reason for one form?
# "low" = plants give less energy (DEFAULT_FOOD_BIT_ENERGY), so food, not the
# 6000 places, limits the population; "ctl" = the same code as it is.
# Both versions: this folder (old body) and ../GenePool Ось (axis body).
#   bash tools/run-pp.sh <low plant energy>
LOW=${1:-25}
STEPS=30000
cd "$(dirname "$0")/.."
MAIN=$(pwd)
AXIS="$MAIN/../GenePool Ось"
for seed in 1 2 3; do
    node tools/form-census.cjs --seed $seed --steps $STEPS --every 1000 --out tools/results/pp-old-ctl-s$seed > tools/results/pp-old-ctl-s$seed.log 2>&1 &
    node tools/form-census.cjs --seed $seed --steps $STEPS --every 1000 --out tools/results/pp-old-low-s$seed --set "DEFAULT_FOOD_BIT_ENERGY=$LOW" > tools/results/pp-old-low-s$seed.log 2>&1 &
    ( cd "$AXIS" && node tools/form-census.cjs --seed $seed --steps $STEPS --every 1000 --out "$MAIN/tools/results/pp-axis-ctl-s$seed" > "$MAIN/tools/results/pp-axis-ctl-s$seed.log" 2>&1 ) &
    ( cd "$AXIS" && node tools/form-census.cjs --seed $seed --steps $STEPS --every 1000 --out "$MAIN/tools/results/pp-axis-low-s$seed" --set "DEFAULT_FOOD_BIT_ENERGY=$LOW" > "$MAIN/tools/results/pp-axis-low-s$seed.log" 2>&1 ) &
done
wait
echo "all done"
