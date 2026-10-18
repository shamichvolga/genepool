#!/bin/bash
# 18.10: d5 showed every body converging to 16 parts, one form 91-93%. Suspect: the new cannibalism rules reward more parts.
# all new rules / no cannibalism at all / only the 2+-parts desperate rule off; seeds 61-63, 60 000 steps; 3 h cap
cd "$(dirname "$0")/.."
run(){ timeout 10800 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 60000 --every 5000 --out tools/results/d6-$1-$2 --set "$3" > tools/results/d6-$1-$2.log 2>&1; }
for s in 61 62 63; do
  run ctl         $s "" &
  run nocannibal  $s "YOUNG_CANNIBALISM_ENABLED=false,DESPERATE_CANNIBALISM_ENABLED=false,LIMBS_CATCH_YOUNG_ENABLED=false" &
  run nodesperate $s "DESPERATE_CANNIBALISM_ENABLED=false" &
done
wait
