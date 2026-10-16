#!/bin/bash
# Currents (CURRENTS_ENABLED) x 3 seeds, 120 000 steps, compared with r3-b0 of the same seeds (--at 120000); 2.5 h cap
cd "$(dirname "$0")/.."
run(){ timeout 9000 node --max-old-space-size=4000 tools/form-census.cjs --seed $2 --steps 120000 --every 10000 --out tools/results/r3-$1-$2 --set "$3" > tools/results/r3-$1-$2.log 2>&1; }
for s in 11 12 13; do run currents $s "CURRENTS_ENABLED=true" & done
wait
