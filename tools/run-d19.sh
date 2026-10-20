#!/bin/bash
# 20.10: bite anywhere along a part + big bodies store more energy; control = both off; seeds 171-173, 60 000 steps
cd "$(dirname "$0")/.."
run(){ timeout 7200 node --max-old-space-size=3500 tools/form-census.cjs --seed $2 --steps 60000 --every 5000 --out tools/results/d19-$1-$2 --set "$3" > tools/results/d19-$1-$2.log 2>&1; }
for s in 171 172 173; do
  run ctl  $s "BITE_ALONG_PARTS_ENABLED=false,BIG_BODY_STOMACH_ENABLED=false" &
  run new  $s "" &
done
wait
