#!/bin/bash
# Night 1 (17.10): why predators do not recover in B1. Control in the same batch (same code).
# ctl, b1, b1 without maturation-by-mass, without basal, without gape curve; seeds 21-23, 250 000 steps; 8 h cap
cd "$(dirname "$0")/.."
BASE="BODY_HYDRODYNAMICS_ENABLED=true,SIZE_SCALED_VISION_ENABLED=true,SIZE_SCALED_GRAB_ENABLED=true,PLANT_STAGES_ENABLED=true,MASS_SCALED_STOMACH_ENABLED=true"
run(){ timeout 28800 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 250000 --every 10000 --out tools/results/n1-$1-$2 --set "$3" > tools/results/n1-$1-$2.log 2>&1; }
for s in 21 22 23; do
  run ctl       $s "" &
  run b1        $s "$BASE,BASAL_METABOLISM=0.000005,SIZE_MATURITY_ENABLED=true,PREDATOR_GAPE_CURVE_ENABLED=true" &
  run nomature  $s "$BASE,BASAL_METABOLISM=0.000005,PREDATOR_GAPE_CURVE_ENABLED=true" &
  run nobasal   $s "$BASE,SIZE_MATURITY_ENABLED=true,PREDATOR_GAPE_CURVE_ENABLED=true" &
  run nogape    $s "$BASE,BASAL_METABOLISM=0.000005,SIZE_MATURITY_ENABLED=true" &
done
wait
