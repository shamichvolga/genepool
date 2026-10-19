#!/bin/bash
# 19.10: does the population (now both energy leaks closed) settle or die out? seeds 91-93, 150 000 steps; 4 h cap
cd "$(dirname "$0")/.."
for s in 91 92 93; do timeout 14400 node --max-old-space-size=3000 tools/form-census.cjs --seed $s --steps 150000 --every 5000 --out tools/results/d10-now-$s > tools/results/d10-now-$s.log 2>&1 & done
wait
