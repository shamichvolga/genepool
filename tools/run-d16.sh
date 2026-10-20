#!/bin/bash
# 20.10: the middle of the food pyramid: assimilation 0.55 / 0.7; seeds 141-143 (as d15), 200 000 steps; 14 h cap
cd "$(dirname "$0")/.."
run(){ timeout 50400 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 200000 --every 5000 --out tools/results/d16-$1-$2 --set "$3" > tools/results/d16-$1-$2.log 2>&1; }
for s in 141 142 143; do
  run a55 $s "MEAT_ASSIMILATION=0.55" &
  run a70 $s "MEAT_ASSIMILATION=0.7" &
done
wait
