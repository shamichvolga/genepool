#!/bin/bash
# 20.10: diseases against one form taking over: a new disease every 20 000 steps (default) / every 5 000; assimilation 0.55; seeds 151-153, 200 000 steps; 14 h cap
cd "$(dirname "$0")/.."
run(){ timeout 50400 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 200000 --every 5000 --out tools/results/d17-$1-$2 --set "$3" > tools/results/d17-$1-$2.log 2>&1; }
for s in 151 152 153; do
  run dis20k $s "" &
  run dis5k  $s "DISEASE_SPAWN_PERIOD=5000" &
done
wait
