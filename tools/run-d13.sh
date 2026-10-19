#!/bin/bash
# 19-20.10: what makes the predator-prey swings so deep. base / weaker disease / meat rots fast / no weak prey / no carcasses / no disease;
# seeds 121-123, 60 000 steps; 5 h cap
cd "$(dirname "$0")/.."
run(){ timeout 18000 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 60000 --every 3000 --out tools/results/d13-$1-$2 --set "$3" > tools/results/d13-$1-$2.log 2>&1; }
for s in 121 122 123; do
  run base      $s "" &
  run weakdis   $s "DISEASE_DRAIN=0.008" &
  run meat2k    $s "MEAT_DECAY_TIME=2000" &
  run noweak    $s "WEAK_PREY_ENABLED=false" &
  run nocarcass $s "CARCASS_ENABLED=false,MEAT_DECAY_TIME=2000" &
  run nodisease $s "DISEASE_ENABLED=false" &
done
wait
