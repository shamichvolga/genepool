import csv, math, sys, glob, os
# snapshot effective number of forms (by number of parts) per census
pref = sys.argv[1]; steps = [int(x) for x in sys.argv[2].split(',')]
for d in sorted(glob.glob(pref + '*/census.csv')):
    rows = list(csv.DictReader(open(d)))
    out = []
    for st in steps:
        r = [x for x in rows if int(x['step']) // 1000 * 1000 == st]
        if not r: out.append('   -  '); continue
        r = r[0]
        c = [float(r['parts_%d' % k]) for k in range(2, 17)]
        n = sum(c)
        H = -sum(x/n*math.log(x/n) for x in c if x > 0)
        out.append('%5.2f/%4d' % (math.exp(H), int(float(r['alive']))))
    print(os.path.basename(os.path.dirname(d)).ljust(16), ' '.join(out))
