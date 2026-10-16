#!/bin/bash
# Same-code control for r3-steer (the steering runs started on newer code than r3-b0): defaults, seeds 11-12, 250 000 steps; 4 h cap
cd "$(dirname "$0")/.."
for s in 11 12; do timeout 14400 node --max-old-space-size=4000 tools/form-census.cjs --seed $s --steps 250000 --every 10000 --out tools/results/r3-ctl-$s > tools/results/r3-ctl-$s.log 2>&1 & done
wait
