#!/bin/bash
# 19.10: everything now (ideas 1-7, diseases, the cannibal gene) / without diseases; seeds 111-113, 100 000 steps; 4 h cap
cd "$(dirname "$0")/.."
run(){ timeout 14400 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 100000 --every 5000 --out tools/results/d12-$1-$2 --set "$3" > tools/results/d12-$1-$2.log 2>&1; }
for s in 111 112 113; do
  run all       $s "" &
  run nodisease $s "DISEASE_ENABLED=false" &
done
wait
