#!/bin/bash
# Which part of B1 starves the predators? B1 without one switch each, 2 seeds, 60 000 steps (the crash is at 10-30k); 1.5 h cap
cd "$(dirname "$0")/.."
B="BODY_HYDRODYNAMICS_ENABLED=true,SIZE_SCALED_VISION_ENABLED=true,SIZE_SCALED_GRAB_ENABLED=true,PLANT_STAGES_ENABLED=true"
run(){ timeout 5400 node --max-old-space-size=4000 tools/form-census.cjs --seed $2 --steps 60000 --every 5000 --out tools/results/ab-$1-$2 --set "$3" > tools/results/ab-$1-$2.log 2>&1; }
for s in 11 13; do
  run nogape    $s "$B,MASS_SCALED_STOMACH_ENABLED=true,BASAL_METABOLISM=0.000005,SIZE_MATURITY_ENABLED=true" &
  run nostomach $s "$B,BASAL_METABOLISM=0.000005,SIZE_MATURITY_ENABLED=true,PREDATOR_GAPE_CURVE_ENABLED=true" &
  run nomature  $s "$B,MASS_SCALED_STOMACH_ENABLED=true,BASAL_METABOLISM=0.000005,PREDATOR_GAPE_CURVE_ENABLED=true" &
done
wait
