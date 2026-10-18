#!/bin/bash
# Night 19.10: softened cannibalism. full (as before) / soft (default 0.4, 1500) / softer (0.2, 3000) / off,
# and soft with a doubled swimbot limit (the boom-bust swings); seeds 81-83, 250 000 steps; 11 h cap
cd "$(dirname "$0")/.."
run(){ timeout 39600 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 250000 --every 10000 --out tools/results/n7-$1-$2 --set "$3" > tools/results/n7-$1-$2.log 2>&1; }
for s in 81 82 83; do
  run full    $s "CANNIBAL_SUCCESS_SCALE=1,CANNIBAL_COOLDOWN=0" &
  run soft    $s "" &
  run softer  $s "CANNIBAL_SUCCESS_SCALE=0.2,CANNIBAL_COOLDOWN=3000" &
  run off     $s "YOUNG_CANNIBALISM_ENABLED=false,DESPERATE_CANNIBALISM_ENABLED=false,LIMBS_CATCH_YOUNG_ENABLED=false" &
  run softcap $s "MAX_SWIMBOTS=12000" &
done
wait
