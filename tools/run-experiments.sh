#!/bin/bash
# 250 000-step runs of the form experiments, 2 seeds each, in parallel (4 h cap each)
cd "$(dirname "$0")/.."
run(){ timeout 14400 node --max-old-space-size=5000 tools/form-census.cjs --seed $2 --steps 250000 --every 10000 --out tools/results/exp-$1-$2 --set "$3" > tools/results/exp-$1-$2.log 2>&1; }
for s in 1 2; do
  run control $s "" &
  run economy $s "MASS_SCALED_STOMACH_ENABLED=true,BASAL_METABOLISM=0.000008,BODY_HYDRODYNAMICS_ENABLED=true" &
  run stages  $s "PLANT_STAGES_ENABLED=true" &
  run breeding $s "INHERITED_INVESTMENT_ENABLED=true,SIZE_MATURITY_ENABLED=true,SIZE_ASSORTATIVE_MATING_ENABLED=true" &
  run gape    $s "PREDATOR_GAPE_CURVE_ENABLED=true" &
done
wait
