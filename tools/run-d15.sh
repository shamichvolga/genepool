#!/bin/bash
# 20.10: the food pyramid. assimilation 1.0 (as before) / 0.4 (default) / 0.25 / 0.4 + predator interference;
# seeds 141-143, 200 000 steps; 14 h cap
cd "$(dirname "$0")/.."
run(){ timeout 50400 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 200000 --every 5000 --out tools/results/d15-$1-$2 --set "$3" > tools/results/d15-$1-$2.log 2>&1; }
for s in 141 142 143; do
  run a100    $s "MEAT_ASSIMILATION=1" &
  run a40     $s "" &
  run a25     $s "MEAT_ASSIMILATION=0.25" &
  run a40def  $s "PREDATOR_DEFERENCE_ENABLED=true" &
done
wait
