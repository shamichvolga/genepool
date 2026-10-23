#!/bin/bash
# Series cur (24.10.2026): currents on everywhere. Does a reaction to the water evolve by itself?
#   k0  control: the swimbots do not feel the current (CURRENT_AWARENESS_ENABLED off)
#   k1  they feel it: brain senses born 0, the target-choice gene random in the founders
# Watch: the gene of those living in streams (does it move away from 0, and which way),
# and the brain's weights from the current senses (do they move away from 0).
cd "$(dirname "$0")/.."
STEPS=${STEPS:-60000}
for seed in 1 2 3; do
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/cur-k0-$seed --set "CURRENTS_ENABLED=true,CURRENT_AWARENESS_ENABLED=false" > tools/results/cur-k0-$seed.log 2>&1 &
  timeout 20000 node tools/food-size-census.cjs --seed $seed --steps $STEPS --every 5000 --out tools/results/cur-k1-$seed --set "CURRENTS_ENABLED=true" > tools/results/cur-k1-$seed.log 2>&1 &
done
wait
echo "series cur done"
