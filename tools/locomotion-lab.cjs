// Locomotion diagnostics for real founder genomes. By default this tool only
// measures the current model; --set "NAME=value" runs an explicit experiment.
//
//   node tools/locomotion-lab.cjs --steps 40000
//
// motion: fixed focus, direct physics calls, large diagnostic energy reserve;
// forage: one ordinary mortal swimbot, one plant at a time, no assistance.
"use strict";

const fs = require("fs");
const path = require("path");
const { createSimulation } = require("./headless.cjs");

const PROJECT_ROOT = path.join(__dirname, "..");
const ROOT = path.resolve(arg("root", PROJECT_ROOT));
const INPUT = path.join(PROJECT_ROOT, "analysis", "founder-genomes");
const OUT = path.join(PROJECT_ROOT, "analysis", "locomotion-lab");
const OUTPUT = arg("output", "founders.json");
const RANDOM_COUNT = Number(arg("random-count", "0"));
const RANDOM_SEED = Number(arg("random-seed", "8128"));
const MIN_PARTS = Number(arg("min-parts", "10"));
const MAX_PARTS_FILTER = Number(arg("max-parts", "16"));
const STEPS = Number(arg("steps", "40000"));
const MOTION_STEPS = Number(arg("motion-steps", "1200"));
const OVERRIDES = {};
for (const kv of (arg("set", "") || "").split(",").filter(Boolean)) {
    const [key, value] = kv.split("=");
    OVERRIDES[key.trim()] = value.trim();
}
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

function settings() {
    return {
        INITIAL_NUM_SWIMBOTS: 0,
        INITIAL_NUM_FOODBITS: 0,
        MAX_SWIMBOTS: 10,
        MAX_FOODBITS: 100,
        MAX_FOODBITS_PER_TYPE: 50,
        MAX_MAXIMUM_AGE: 60000,
        ORIGINAL_FOOD_ENABLED: false,
        ENVIRONMENT_SEEDS_PER_PERIOD: 0,
        LOCAL_ENVIRONMENT_PLANT_GROWTH: false,
        FOOD_RANDOM_SEED_CHANCE: 0,
        PLANT_REGROW_CHANCE: 0,
        OBSTACLE_ENABLED: false,
        CURRENTS_ENABLED: false,
        RUDDER_ENABLED: false,
        ...OVERRIDES,
    };
}

function loadGenomes() {
    if (RANDOM_COUNT > 0) {
        // Use the actual random-world founder generator, including its ecology
        // genes and junk-DNA rules; only the anatomical size range is filtered.
        const poolSize = Math.max(600, RANDOM_COUNT * 12);
        const run = createSimulation(RANDOM_SEED, {
            ...settings(), INITIAL_NUM_SWIMBOTS: poolSize, MAX_SWIMBOTS: poolSize,
        }, ROOT);
        const genomes = [];
        for (const bot of run.genePool.getSwimbots()) {
            if (!bot.getAlive()) continue;
            const genotype = bot.getGenotype();
            const parts = new run.sandbox.Embryology().generatePhenotypeFromGenotype(genotype).numParts;
            if (parts >= MIN_PARTS && parts <= MAX_PARTS_FILTER) {
                genomes.push({ name: `random_${genomes.length}`, genes: genotype.getGenes().slice() });
                if (genomes.length === RANDOM_COUNT) break;
            }
        }
        if (genomes.length !== RANDOM_COUNT) throw new Error(`Only generated ${genomes.length} suitable founders`);
        return genomes;
    }
    return fs.readdirSync(INPUT).filter(f => f.endsWith(".json")).sort().map(file => {
        const data = JSON.parse(fs.readFileSync(path.join(INPUT, file), "utf8"));
        if (!Array.isArray(data.genes) || data.genes.length !== 256) throw new Error("Invalid genes: " + file);
        return { name: file.replace(/_genes\.json$/, ""), genes: data.genes };
    });
}

function create(run, genes) {
    run.genePool.createNewSwimbotWithGenes(genes);
    return run.genePool.getSwimbotAt(0);
}

function anatomy(run, bot) {
    const s = run.sandbox;
    const p = new s.Embryology().generatePhenotypeFromGenotype(bot.getGenotype());
    const children = new Array(p.numParts).fill(0);
    for (let i = 1; i < p.numParts; i++) if (p.parts[i].parent >= 0) children[p.parts[i].parent]++;
    let leaves = 0;
    const amps = [];
    for (let i = 2; i < p.numParts; i++) {
        if (children[i] === 0) leaves++;
        amps.push(Math.abs(p.parts[i].amp));
    }
    return {
        parts: p.numParts,
        mass: bot.getPhenotypeMass(),
        length: p.parts.slice(1, p.numParts).reduce((sum, part) => sum + part.length, 0),
        leaves,
        frequency: p.frequency,
        meanAbsAmplitude: amps.reduce((sum, value) => sum + value, 0) / amps.length,
    };
}

// How the existing gait moves the body with a fixed focus. This is deliberately
// not a survival test: the large reserve merely prevents starvation during the
// measurement. No position, velocity, or goal-directed force is injected.
function motionProbe(genome, focusX, focusY) {
    const run = createSimulation(1701, settings(), ROOT);
    const s = run.sandbox;
    const bot = create(run, genome.genes);
    const st = s.sharedState();
    const b = 0;
    const position = new s.Vector2D();
    position.setXY((s.POOL_LEFT + s.POOL_RIGHT) / 2, (s.POOL_TOP + s.POOL_BOTTOM) / 2);
    bot.setPosition(position);
    bot.setVelocity(new s.Vector2D());
    st.bots[b + s.B_ENERGY] = 1e6;
    st.bots[b + s.B_GOAL_X] = st.bots[b + s.B_FOCUS_X] = focusX;
    st.bots[b + s.B_GOAL_Y] = st.bots[b + s.B_FOCUS_Y] = focusY;
    st.bots[b + s.B_EFFORT] = 1;
    st.bots[b + s.B_SPIN] = 0;

    const startX = st.bots[b + s.B_POS_X], startY = st.bots[b + s.B_POS_Y];
    let previousX = startX, previousY = startY;
    let pathLength = 0, spinSum = 0;
    for (let step = 0; step < MOTION_STEPS; step++) {
        s.physicsPartA(0, st);
        const x = st.bots[b + s.B_POS_X], y = st.bots[b + s.B_POS_Y];
        pathLength += Math.hypot(x - previousX, y - previousY);
        spinSum += Math.abs(st.bots[b + s.B_SPIN]);
        previousX = x; previousY = y;
    }
    const dx = previousX - startX, dy = previousY - startY;
    const net = Math.hypot(dx, dy);
    return {
        focusX, focusY,
        path: pathLength,
        net,
        straightness: pathLength > 0 ? net / pathLength : 0,
        goalAlignment: pathLength > 0 ? (dx * focusX + dy * focusY) / pathLength : 0,
        energyPerDistance: pathLength > 0 ? (1e6 - st.bots[b + s.B_ENERGY]) / pathLength : 0,
        meanAbsSpin: spinSum / MOTION_STEPS,
        finalSpeed: Math.hypot(st.bots[b + s.B_VEL_X], st.bots[b + s.B_VEL_Y]),
    };
}

function spawnFood(run, bot, random) {
    const gp = run.genePool, s = run.sandbox;
    const slot = gp.findLowestDeadFoodBitInArray(false);
    if (slot < 0) throw new Error("No free plant slot");
    const food = gp.getFoodBitAt(slot);
    food.initialize(slot);
    food.setType(0);
    food.setEnergy(s.DEFAULT_FOOD_BIT_ENERGY);
    const p = bot.getPosition();
    for (let attempt = 0; attempt < 80; attempt++) {
        const angle = attempt < 40 ? random() * Math.PI * 2 : (attempt - 40) * Math.PI / 20;
        const x = p.x + Math.cos(angle) * 220, y = p.y + Math.sin(angle) * 220;
        if (x > 30 && x < s.POOL_RIGHT - 30 && y > 30 && y < s.POOL_BOTTOM - 30) {
            const position = new s.Vector2D();
            position.setXY(x, y);
            food.setPosition(position);
            return slot;
        }
    }
    throw new Error("Could not place food");
}

function forageProbe(genome, index) {
    const seed = 9187 + index * 9973;
    const random = makeRandom(seed ^ 0x9e3779b9);
    const run = createSimulation(seed, settings(), ROOT);
    const s = run.sandbox, gp = run.genePool;
    gp.setMaximumSwimbotAge(45000);
    const bot = create(run, genome.genes);
    // Match a real random-world founder rather than the gene-import button,
    // which deliberately starts a loaded swimbot at the hunger threshold.
    const initialEnergy = s.SWIMBOT_MAX_ENERGY * s.START_ENERGY_FACTOR;
    s.sharedState().bots[s.B_ENERGY] = initialEnergy;
    let foodSlot = spawnFood(run, bot, random);
    let previousX = bot.getPosition().x, previousY = bot.getPosition().y;
    let path = 0, minMouthDistance = Infinity, survived = 0;
    for (let step = 1; step <= STEPS; step++) {
        gp.update();
        survived = step;
        const p = bot.getPosition();
        path += Math.hypot(p.x - previousX, p.y - previousY);
        previousX = p.x; previousY = p.y;
        const food = gp.getFoodBitAt(foodSlot);
        if (food.getAlive()) {
            const mouth = bot.getMouthPosition(), fp = food.getPosition();
            minMouthDistance = Math.min(minMouthDistance, Math.hypot(fp.x - mouth.x, fp.y - mouth.y));
        }
        if (bot.getAlive() && !food.getAlive()) foodSlot = spawnFood(run, bot, random);
        if (!bot.getAlive()) break;
    }
    return {
        alive: bot.getAlive(), survived, meals: bot.getNumFoodBitsEaten(), path,
        finalEnergy: bot.getEnergy(), initialEnergy,
        minMouthDistance: Number.isFinite(minMouthDistance) ? minMouthDistance : null,
        deathCause: bot.getDeathCause() || "",
    };
}

const results = loadGenomes().map((genome, index) => {
    const run = createSimulation(1000 + index, settings(), ROOT);
    const bot = create(run, genome.genes);
    const record = { name: genome.name, genes: genome.genes, anatomy: anatomy(run, bot) };
    record.motion = [motionProbe(genome, 1, 0), motionProbe(genome, 0, 1), motionProbe(genome, -1, 0)];
    record.forage = forageProbe(genome, index);
    const f = record.forage, a = record.anatomy;
    console.log(`${genome.name}: parts=${a.parts} mass=${a.mass.toFixed(0)} motionNet=${record.motion.map(m => m.net.toFixed(0)).join("/")} ` +
        `alignment=${record.motion.map(m => m.goalAlignment.toFixed(2)).join("/")} ` +
        `forage=${f.survived} steps, meals=${f.meals}, closest=${f.minMouthDistance === null ? "-" : f.minMouthDistance.toFixed(1)}, alive=${f.alive}`);
    return record;
});

const document = { steps: STEPS, motionSteps: MOTION_STEPS, randomCount: RANDOM_COUNT, randomSeed: RANDOM_SEED, results };
fs.writeFileSync(path.join(OUT, OUTPUT), JSON.stringify(document, null, 2) + "\n");
console.log("Wrote " + path.join(OUT, OUTPUT));
