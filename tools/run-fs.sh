#!/bin/bash
# Series fs (22.10.2026): the plant size concept against its control, one commit, 3 seeds.
#   c0  control (PLANT_SIZE_ENABLED off)
#   c1  plants grow, bites, toughness against bite force
#   c2  c1 + the upkeep of a body (BASAL_METABOLISM x mass^0.75)
cd "$(dirname "$0")/.."
STEPS=${STEPS:-100000}
for seed in 1 2 3; do
  timeout 25000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c0-$seed > tools/results/fs-c0-$seed.log 2>&1 &
  timeout 25000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c1-$seed --set "PLANT_SIZE_ENABLED=true" > tools/results/fs-c1-$seed.log 2>&1 &
  timeout 25000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c2-$seed --set "PLANT_SIZE_ENABLED=true,BASAL_METABOLISM=0.00003" > tools/results/fs-c2-$seed.log 2>&1 &
done
wait
echo "series fs done"
