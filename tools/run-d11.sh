#!/bin/bash
# 19.10: coexistence ideas 1-7. all on / all off / all but patches / all but carcasses; seeds 101-103, 60 000 steps; 3 h cap
cd "$(dirname "$0")/.."
OFF="KIN_NOT_EATEN_ENABLED=false,ONLY_GROWN_EAT_YOUNG_ENABLED=false,WEAK_PREY_ENABLED=false,CARCASS_ENABLED=false,MEAT_DECAY_TIME=2000,SEARCH_IMAGE_LEARNING=0.3,SEARCH_IMAGE_GAIN=0.25,SIZE_ASSORTATIVE_MATING_ENABLED=false,LOCAL_ENVIRONMENT_PLANT_GROWTH=false"
run(){ timeout 10800 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 60000 --every 3000 --out tools/results/d11-$1-$2 --set "$3" > tools/results/d11-$1-$2.log 2>&1; }
for s in 101 102 103; do
  run all       $s "" &
  run none      $s "$OFF" &
  run nopatch   $s "LOCAL_ENVIRONMENT_PLANT_GROWTH=false" &
  run nocarcass $s "CARCASS_ENABLED=false,MEAT_DECAY_TIME=2000" &
done
wait
