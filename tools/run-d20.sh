#!/bin/bash
# 20.10: diversity and viability of big bodies, current code; seeds 181-183, 40 000 steps
cd "$(dirname "$0")/.."
for s in 181 182 183; do
  timeout 7200 node --max-old-space-size=3500 tools/form-census.cjs --seed $s --steps 40000 --every 5000 --out tools/results/d20-now-$s > tools/results/d20-now-$s.log 2>&1 &
done
wait
