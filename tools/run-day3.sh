#!/bin/bash
# 17.10 day: why forms got poorer overnight, and the nursery. Same code, same batch.
# now (plants plain again, deference on, nursery on), no nursery, as before the night (no deference, no nursery),
# with plant genes as overnight; seeds 41-43, 120 000 steps; 4 h cap
cd "$(dirname "$0")/.."
run(){ timeout 14400 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 120000 --every 10000 --out tools/results/d3-$1-$2 --set "$3" > tools/results/d3-$1-$2.log 2>&1; }
for s in 41 42 43; do
  run now        $s "" &
  run nonursery  $s "NURSERY_ENABLED=false" &
  run beforenight $s "NURSERY_ENABLED=false,CROWD_AWARE_FOOD_CHOICE_ENABLED=false" &
  run plantgenes $s "NURSERY_ENABLED=false,PLANT_EVOLUTION_ENABLED=true" &
done
wait
