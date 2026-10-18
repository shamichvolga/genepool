#!/bin/bash
# 18.10: the boom trap. "boom" = full start food everywhere + 300% energy; "fixed" = normal world food (gardens 10x denser) + 150% energy.
# seeds 61-63, 100 000 steps, default world; 3 h cap
cd "$(dirname "$0")/.."
run(){ timeout 10800 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 100000 --every 5000 --out tools/results/d5-$1-$2 --set "$3" > tools/results/d5-$1-$2.log 2>&1; }
for s in 61 62 63; do
  run boom  $s "START_FOOD_FILL=0.95,START_ENERGY_FACTOR=3" &
  run fixed $s "" &
done
wait
