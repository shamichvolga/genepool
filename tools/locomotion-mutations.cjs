// Can small inherited changes to the existing motor genes produce useful gaits?
// Anatomy genes, food, energy capacity and physics are left unchanged.
"use strict";

const fs = require("fs");
const path = require("path");
const { createSimulation } = require("./headless.cjs");

const ROOT = path.join(__dirname, "..");
const INPUT = path.join(ROOT, "analysis", "founder-genomes");
const OUT = path.join(ROOT, "analysis", "locomotion-lab");
const COUNT = Number(arg("mutations", "32"));
const STEPS = Number(arg("steps", "1200"));
fs.mkdirSync(OUT, { recursive: true });

function arg(name, fallback) {
    const i = process.argv.indexOf("--" + name);
    return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
function makeRandom(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const OVERRIDES = {
    INITIAL_NUM_SWIMBOTS: 0, INITIAL_NUM_FOODBITS: 0,
    MAX_SWIMBOTS: 10, MAX_FOODBITS: 20,
    OBSTACLE_ENABLED: false, CURRENTS_ENABLED: false, RUDDER_ENABLED: false,
};
const MOTOR_GENES = [0];
for (let c = 0; c < 4; c++) {
    const base = 2 + c * 27;
    for (let offset = 10; offset <= 17; offset++) MOTOR_GENES.push(base + offset);
}

function mutate(genes, random) {
    const copy = genes.slice();
    const changes = [];
    const n = 1 + Math.floor(random() * 3);
    for (let k = 0; k < n; k++) {
        const gene = MOTOR_GENES[Math.floor(random() * MOTOR_GENES.length)];
        const before = copy[gene];
        const delta = (random() < 0.5 ? -1 : 1) * (1 + Math.floor(random() * 64));
        copy[gene] = Math.max(0, Math.min(255, before + delta));
        if (copy[gene] !== before) changes.push([gene, before, copy[gene]]);
    }
    return { genes: copy, changes };
}

function probe(genes) {
    const run = createSimulation(1701, OVERRIDES, ROOT);
    const s = run.sandbox;
    run.genePool.createNewSwimbotWithGenes(genes);
    const bot = run.genePool.getSwimbotAt(0);
    const st = s.sharedState(), b = 0;
    const center = new s.Vector2D();
    center.setXY((s.POOL_LEFT + s.POOL_RIGHT) / 2, (s.POOL_TOP + s.POOL_BOTTOM) / 2);
    bot.setPosition(center);
    bot.setVelocity(new s.Vector2D());
    st.bots[b + s.B_ENERGY] = 1e6;
    st.bots[b + s.B_GOAL_X] = st.bots[b + s.B_FOCUS_X] = 1;
    st.bots[b + s.B_GOAL_Y] = st.bots[b + s.B_FOCUS_Y] = 0;
    st.bots[b + s.B_EFFORT] = 1;
    st.bots[b + s.B_SPIN] = 0;
    const startX = st.bots[b + s.B_POS_X], startY = st.bots[b + s.B_POS_Y];
    let previousX = startX, previousY = startY, pathLength = 0;
    for (let step = 0; step < STEPS; step++) {
        s.physicsPartA(0, st);
        const x = st.bots[b + s.B_POS_X], y = st.bots[b + s.B_POS_Y];
        pathLength += Math.hypot(x - previousX, y - previousY);
        previousX = x; previousY = y;
    }
    const dx = previousX - startX, dy = previousY - startY;
    return {
        path: pathLength,
        net: Math.hypot(dx, dy),
        advance: dx,
        alignment: pathLength > 0 ? dx / pathLength : 0,
        energyPerDistance: pathLength > 0 ? (1e6 - st.bots[b + s.B_ENERGY]) / pathLength : null,
    };
}

const results = [];
for (const [index, file] of fs.readdirSync(INPUT).filter(f => f.endsWith(".json")).sort().entries()) {
    const genes = JSON.parse(fs.readFileSync(path.join(INPUT, file), "utf8")).genes;
    const random = makeRandom(0x51f15e + index * 7919);
    const baseline = probe(genes);
    let bestMobility = { genes, changes: [], measure: baseline };
    let bestDirection = bestMobility;
    for (let k = 0; k < COUNT; k++) {
        const variant = mutate(genes, random);
        const measure = probe(variant.genes);
        const candidate = { genes: variant.genes, changes: variant.changes, measure };
        if (measure.net > bestMobility.measure.net) bestMobility = candidate;
        if (measure.advance > bestDirection.measure.advance) bestDirection = candidate;
    }
    const record = { name: file.replace(/_genes\.json$/, ""), baseline, bestMobility, bestDirection };
    results.push(record);
    console.log(`${record.name}: base net=${baseline.net.toFixed(1)} advance=${baseline.advance.toFixed(1)}; ` +
        `mutant net=${bestMobility.measure.net.toFixed(1)} advance=${bestDirection.measure.advance.toFixed(1)}; ` +
        `changes=${bestDirection.changes.map(c => c.join(":")).join(",")}`);
}
fs.writeFileSync(path.join(OUT, "mutations.json"), JSON.stringify({ count: COUNT, steps: STEPS, results }, null, 2) + "\n");
console.log("Wrote " + path.join(OUT, "mutations.json"));
