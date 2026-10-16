#!/bin/bash
# Commission round 2: B0 (control, steering logged by pursuit-check separately) and B1 "size: income + cost", 5 seeds x 250 000 steps
cd "$(dirname "$0")/.."
B1="MASS_SCALED_STOMACH_ENABLED=true,BASAL_METABOLISM=0.000005,BODY_HYDRODYNAMICS_ENABLED=true,SIZE_SCALED_VISION_ENABLED=true,SIZE_SCALED_GRAB_ENABLED=true,PLANT_STAGES_ENABLED=true,SIZE_MATURITY_ENABLED=true,PREDATOR_GAPE_CURVE_ENABLED=true"
run(){ timeout 18000 node --max-old-space-size=5000 tools/form-census.cjs --seed $2 --steps 250000 --every 10000 --out tools/results/exp-$1-$2 --set "$3" > tools/results/exp-$1-$2.log 2>&1; }
for s in 11 12 13 14 15; do run b0 $s "" & run b1 $s "$B1" & done
wait
