#!/bin/bash
# 20.10: long check, where the crash used to come (60-100k). current / + predator interference / no disease; seeds 131-133, 200 000 steps; 12 h cap
cd "$(dirname "$0")/.."
run(){ timeout 43200 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 200000 --every 5000 --out tools/results/d14-$1-$2 --set "$3" > tools/results/d14-$1-$2.log 2>&1; }
for s in 131 132 133; do
  run current   $s "" &
  run preddef   $s "PREDATOR_DEFERENCE_ENABLED=true" &
  run nodisease $s "DISEASE_ENABLED=false" &
done
wait
