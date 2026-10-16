#!/bin/bash
# B1 crash, step 2: one switch on top of the default, 2 seeds, 40 000 steps; 1 h cap
cd "$(dirname "$0")/.."
run(){ timeout 3600 node --max-old-space-size=4000 tools/form-census.cjs --seed $2 --steps 40000 --every 5000 --out tools/results/ab-$1-$2 --set "$3" > tools/results/ab-$1-$2.log 2>&1; }
for s in 11 13; do
  run hydro     $s "BODY_HYDRODYNAMICS_ENABLED=true" &
  run sizesense $s "SIZE_SCALED_VISION_ENABLED=true,SIZE_SCALED_GRAB_ENABLED=true" &
  run basal     $s "BASAL_METABOLISM=0.000005" &
done
wait
