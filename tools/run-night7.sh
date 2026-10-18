#!/bin/bash
# Night 19.10: cannibalism by "what fits in the mouth" (mass, not parts).
# mouth (1/3 of my mass, default) / narrow (0.15) / off; seeds 81-83, 250 000 steps; 11 h cap
cd "$(dirname "$0")/.."
run(){ timeout 39600 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 250000 --every 10000 --out tools/results/n7-$1-$2 --set "$3" > tools/results/n7-$1-$2.log 2>&1; }
for s in 81 82 83; do
  run mouth  $s "" &
  run narrow $s "CANNIBAL_PREY_MASS_SHARE=0.15" &
  run off    $s "YOUNG_CANNIBALISM_ENABLED=false,DESPERATE_CANNIBALISM_ENABLED=false,LIMBS_CATCH_YOUNG_ENABLED=false" &
done
wait
