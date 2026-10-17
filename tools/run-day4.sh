#!/bin/bash
# 17.10 after the restart: the current code (full start food, nursery, plain plants, deference) against
# "as before the night" and "with plant genes"; seeds 41-43, 120 000 steps; 4 h cap
cd "$(dirname "$0")/.."
run(){ timeout 14400 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 120000 --every 10000 --out tools/results/d4-$1-$2 --set "$3" > tools/results/d4-$1-$2.log 2>&1; }
for s in 41 42 43; do
  run now         $s "" &
  run beforenight $s "NURSERY_ENABLED=false,CROWD_AWARE_FOOD_CHOICE_ENABLED=false,START_FOOD_FILL=0.5,PLANT_ROT_ENABLED=true" &
  run plantgenes  $s "PLANT_EVOLUTION_ENABLED=true" &
done
wait
