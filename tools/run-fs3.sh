#!/bin/bash
# Series fs3 (24.10.2026): growing plants that grow old, with the usual seeding (series fs2: seeds only from
# grown plants starved the world). A new control: the gene "feel for the current" (5955f3f) moved the random numbers.
#   c0b  control (PLANT_SIZE_ENABLED off)
#   c6   growing plants, lifespan 12 000, every plant seeds
#   c7   c6 with softer trees (toughness 0.6: a middle body bites a tree)
cd "$(dirname "$0")/.."
STEPS=${STEPS:-60000}
for seed in 1 2 3; do
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c0b-$seed > tools/results/fs-c0b-$seed.log 2>&1 &
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c6-$seed --set "PLANT_SIZE_ENABLED=true,PLANT_LIFESPAN=12000,PLANT_SEEDS_BY_SIZE=false" > tools/results/fs-c6-$seed.log 2>&1 &
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/fs-c7-$seed --set "PLANT_SIZE_ENABLED=true,PLANT_LIFESPAN=12000,PLANT_SEEDS_BY_SIZE=false,PLANT_MAX_TOUGHNESS=0.6" > tools/results/fs-c7-$seed.log 2>&1 &
done
wait
echo "series fs3 done"
