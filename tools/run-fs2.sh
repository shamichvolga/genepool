#!/bin/bash
# Series fs2 (24.10.2026): growing plants that also grow old and fall (PLANT_LIFESPAN),
# so the forest does not take every place for good (series fs: it did). 3 seeds, 60 000 steps.
#   c3  growing plants, lifespan 12 000
#   c4  c3 + the upkeep of a body (BASAL_METABOLISM)
#   c5  growing plants, lifespan 6 000
# The control is c0 of series fs: the code with PLANT_SIZE_ENABLED off is the same
# (checked: c0-check at 5000 steps equals fs-c0-1).
cd "$(dirname "$0")/.."
STEPS=${STEPS:-60000}
timeout 3000 node tools/food-size-census.cjs --seed 1 --steps 5000 --every 5000 --out tools/results/fs-c0-check > tools/results/fs-c0-check.log 2>&1 &
for seed in 1 2 3; do
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c3-$seed --set "PLANT_SIZE_ENABLED=true,PLANT_LIFESPAN=12000" > tools/results/fs-c3-$seed.log 2>&1 &
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c4-$seed --set "PLANT_SIZE_ENABLED=true,PLANT_LIFESPAN=12000,BASAL_METABOLISM=0.00003" > tools/results/fs-c4-$seed.log 2>&1 &
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c5-$seed --set "PLANT_SIZE_ENABLED=true,PLANT_LIFESPAN=6000" > tools/results/fs-c5-$seed.log 2>&1 &
done
wait
echo "series fs2 done"
