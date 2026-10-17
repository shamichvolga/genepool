#!/bin/bash
# Night 2 (17.10): plant genes, limbs. Control = the new defaults (plant genes on, deference on), same code, same batch.
# ctl, no plant genes, filter feeding, limb spines, both; seeds 31-33, 200 000 steps; 9 h cap
cd "$(dirname "$0")/.."
run(){ timeout 32400 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 200000 --every 10000 --out tools/results/n2-$1-$2 --set "$3" > tools/results/n2-$1-$2.log 2>&1; }
for s in 31 32 33; do
  run ctl          $s "" &
  run noplantgenes $s "PLANT_EVOLUTION_ENABLED=false" &
  run filter       $s "FILTER_FEEDING_ENABLED=true" &
  run spines       $s "LIMB_SPINES_ENABLED=true" &
  run limbs        $s "FILTER_FEEDING_ENABLED=true,LIMB_SPINES_ENABLED=true" &
done
wait
