#!/bin/bash
# 20.10: grazed plants grow back from roots: chance 0 (now) / 0.5 / 0.8; seeds 161-163, 150 000 steps; 12 h cap
cd "$(dirname "$0")/.."
run(){ timeout 43200 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 150000 --every 5000 --out tools/results/d18-$1-$2 --set "$3" > tools/results/d18-$1-$2.log 2>&1; }
for s in 161 162 163; do
  run r0  $s "" &
  run r50 $s "PLANT_REGROW_CHANCE=0.5" &
  run r80 $s "PLANT_REGROW_CHANCE=0.8" &
done
wait
