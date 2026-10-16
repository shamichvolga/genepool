#!/bin/bash
# B0 (control), B1 (size income + cost) x 5 seeds; crowd-aware choice and young cannibalism x 2 seeds; 250 000 steps, 4.2 h cap
cd "$(dirname "$0")/.."
B1="MASS_SCALED_STOMACH_ENABLED=true,BASAL_METABOLISM=0.000005,BODY_HYDRODYNAMICS_ENABLED=true,SIZE_SCALED_VISION_ENABLED=true,SIZE_SCALED_GRAB_ENABLED=true,PLANT_STAGES_ENABLED=true,SIZE_MATURITY_ENABLED=true,PREDATOR_GAPE_CURVE_ENABLED=true"
run(){ timeout 15000 node --max-old-space-size=4000 tools/form-census.cjs --seed $2 --steps 250000 --every 10000 --out tools/results/r3-$1-$2 --set "$3" > tools/results/r3-$1-$2.log 2>&1; }
for s in 11 12 13 14 15; do run b0 $s "" & run b1 $s "$B1" & done
for s in 11 12; do run crowd $s "CROWD_AWARE_FOOD_CHOICE_ENABLED=true" & run cannibal $s "YOUNG_CANNIBALISM_ENABLED=true" & done
wait
