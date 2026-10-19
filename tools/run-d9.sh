#!/bin/bash
# 19.10: the explosion fixed (young body energy = grown part; growing costs energy).
# now (both fixes, cannibalism by mouth) / growth free / no cannibalism / as before today (both old); seeds 91-93, 40 000 steps; 2 h cap
cd "$(dirname "$0")/.."
run(){ timeout 7200 node --max-old-space-size=3000 tools/form-census.cjs --seed $2 --steps 40000 --every 2000 --out tools/results/d9-$1-$2 --set "$3" > tools/results/d9-$1-$2.log 2>&1; }
for s in 91 92 93; do
  run now        $s "" &
  run growfree   $s "GROWTH_COSTS_ENERGY_ENABLED=false" &
  run nocannibal $s "YOUNG_CANNIBALISM_ENABLED=false,DESPERATE_CANNIBALISM_ENABLED=false" &
done
wait
