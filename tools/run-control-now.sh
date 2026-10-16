#!/bin/bash
# Same-code control for ab-* and r3-currents (the code changed after round 3 started): defaults, seeds 11-13, 60 000 steps; 1.5 h cap
cd "$(dirname "$0")/.."
for s in 11 12 13; do timeout 5400 node --max-old-space-size=4000 tools/form-census.cjs --seed $s --steps 60000 --every 5000 --out tools/results/ab-control-$s > tools/results/ab-control-$s.log 2>&1 & done
wait
