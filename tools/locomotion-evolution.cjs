// Evolution of the existing motor genes, selected by real foraging rather than
// distance travelled. Anatomy, physics, energy capacity and brain stay intact.
// Training and final holdout episodes use different food-placement seeds.
//
//   node tools/locomotion-evolution.cjs --random-count 12 --generations 6
//
"use strict";

const fs = require("fs");
const path = require("path");
const { createSimulation } = require("./headless.cjs");

const ROOT = path.resolve(arg("root", path.join(__dirname, "..")));
const OUT = path.join(ROOT, "analysis", "locomotion-lab");
const OUTPUT = arg("output", "evolution-forage.json");
const COUNT = Number(arg("random-count", "12"));
const MIN_PARTS = Number(arg("min-parts", "10"));
const MAX_PARTS = Number(arg("max-parts", "16"));
const SEED = Number(arg("seed", "8128"));
const GENERATIONS = Number(arg("generations", "6"));
const OFFSPRING = Number(arg("offspring", "6"));
const TRAIN_STEPS = Number(arg("steps", "6000"));
const TRAIN_TRIALS = Number(arg("trials", "2"));
const FINAL_STEPS = Number(arg("final-steps", "20000"));
const FINAL_TRIALS = Number(arg("final-trials", "4"));
const FOOD_DISTANCE = Number(arg("food-distance", "220"));
const FROM = arg("from", null);   // previous result: skip training, re-evaluate its descendants
const HOLDOUT_SALT = Number(arg("holdout-salt", "0x51f15e00"));
const LIFE_STAGE = arg("life-stage", "adult");   // adult or newborn
const INITIAL_ENERGY = arg("initial-energy", null);
if ( LIFE_STAGE !== "adult" && LIFE_STAGE !== "newborn" ) throw new Error("Unknown life stage");
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
        MAX_SWIMBOTS: 2,
        MAX_FOODBITS: 10,
        MAX_FOODBITS_PER_TYPE: 5,
        MAX_MAXIMUM_AGE: 60000,
        ORIGINAL_FOOD_ENABLED: false,
        ENVIRONMENT_SEEDS_PER_PERIOD: 0,
        LOCAL_ENVIRONMENT_PLANT_GROWTH: false,
        FOOD_RANDOM_SEED_CHANCE: 0,
        PLANT_REGROW_CHANCE: 0,
        OBSTACLE_ENABLED: false,
        CURRENTS_ENABLED: false,
        RUDDER_ENABLED: false,
    };
}

const MOTOR_GENES = [0];
for (let c = 0; c < 4; c++) {
    const base = 2 + c * 27;
    for (let offset = 10; offset <= 17; offset++) MOTOR_GENES.push(base + offset);
}

function loadFounders() {
    const poolSize = Math.max(600, COUNT * 16);
    const run = createSimulation(SEED, {
        ...settings(), INITIAL_NUM_SWIMBOTS: poolSize, MAX_SWIMBOTS: poolSize,
    }, ROOT);
    const founders = [];
    for (const bot of run.genePool.getSwimbots()) {
        if (!bot.getAlive() || bot.getPredatorLevel() > run.sandbox.PREDATOR_LEVEL_THRESHOLD) continue;
        const parts = bot.getNumParts();
        if (parts < MIN_PARTS || parts > MAX_PARTS) continue;
        const genes = bot.getGenotype().getGenes().slice();
        founders.push({ name: `random_${founders.length}`, genes, parts, mass: bot.getPhenotypeMass() });
        if (founders.length === COUNT) break;
    }
    if (founders.length !== COUNT) throw new Error(`Only generated ${founders.length} suitable herbivores`);
    return founders;
}

function mutate(genes, random) {
    const copy = genes.slice();
    const gene = MOTOR_GENES[Math.floor(random() * MOTOR_GENES.length)];
    const before = copy[gene];
    // Same amplitude distribution and wrap-around as Genotype.mutateGene, but
    // one motor gene per offspring to make this an accelerated search.
    const amplitude = Math.round(random() * random() * 256);
    const delta = random() < 0.5 ? -amplitude : amplitude;
    copy[gene] = (before + delta + 256) % 256;
    return { genes: copy, change: [gene, before, copy[gene]] };
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
        const x = p.x + Math.cos(angle) * FOOD_DISTANCE;
        const y = p.y + Math.sin(angle) * FOOD_DISTANCE;
        if (x > 30 && x < s.POOL_RIGHT - 30 && y > 30 && y < s.POOL_BOTTOM - 30) {
            const position = new s.Vector2D();
            position.setXY(x, y);
            food.setPosition(position);
            return slot;
        }
    }
    throw new Error("Could not place food");
}

function episode(genes, seed, steps) {
    const random = makeRandom(seed ^ 0x9e3779b9);
    const run = createSimulation(seed, settings(), ROOT);
    const s = run.sandbox, gp = run.genePool;
    gp.setMaximumSwimbotAge(Math.max(45000, steps + 5000));
    gp.createNewSwimbotWithGenes(genes);
    const bot = gp.getSwimbotAt(0);
    const initialEnergy = INITIAL_ENERGY === null
        ? ( LIFE_STAGE === "newborn" ? 50 : s.SWIMBOT_MAX_ENERGY * s.START_ENERGY_FACTOR )
        : Number(INITIAL_ENERGY);
    const st = s.sharedState();
    st.bots[s.B_ENERGY] = initialEnergy;
    if ( LIFE_STAGE === "newborn" )
    {
        st.bots[s.B_AGE] = 0;
        st.bots[s.B_GROWTH] = 0;
    }
    let foodSlot = spawnFood(run, bot, random);
    let minMouthDistance = Infinity;
    let survived = 0;
    for (let step = 1; step <= steps; step++) {
        gp.update();
        survived = step;
        const food = gp.getFoodBitAt(foodSlot);
        if (food.getAlive()) {
            const mouth = bot.getMouthPosition(), fp = food.getPosition();
            minMouthDistance = Math.min(minMouthDistance, Math.hypot(fp.x - mouth.x, fp.y - mouth.y));
        }
        if (bot.getAlive() && !food.getAlive()) foodSlot = spawnFood(run, bot, random);
        if (!bot.getAlive()) break;
    }
    return {
        seed,
        meals: bot.getNumFoodBitsEaten(),
        survived,
        alive: bot.getAlive(),
        finalEnergy: bot.getEnergy(),
        minMouthDistance: Number.isFinite(minMouthDistance) ? minMouthDistance : null,
    };
}

function summarize(episodes) {
    const validClosest = episodes.map(e => e.minMouthDistance).filter(Number.isFinite);
    return {
        meals: episodes.reduce((sum, e) => sum + e.meals, 0) / episodes.length,
        fedEpisodes: episodes.filter(e => e.meals > 0).length,
        survived: episodes.reduce((sum, e) => sum + e.survived, 0) / episodes.length,
        closest: validClosest.length ? validClosest.reduce((a, b) => a + b, 0) / validClosest.length : null,
        finalEnergy: episodes.reduce((sum, e) => sum + e.finalEnergy, 0) / episodes.length,
    };
}

function better(a, b) {
    if (!b) return true;
    if (a.meals !== b.meals) return a.meals > b.meals;
    if (a.fedEpisodes !== b.fedEpisodes) return a.fedEpisodes > b.fedEpisodes;
    if (a.closest !== b.closest) return (a.closest ?? Infinity) < (b.closest ?? Infinity);
    return a.survived > b.survived;
}

function evaluate(genes, seeds, steps) {
    const episodes = seeds.map(seed => episode(genes, seed, steps));
    return { ...summarize(episodes), episodes };
}

function trainingSeeds(lineage, generation) {
    return Array.from({ length: TRAIN_TRIALS }, (_, trial) =>
        (SEED + 100003 + lineage * 7919 + generation * 101 + trial * 10007) >>> 0);
}

function holdoutSeeds(lineage) {
    return Array.from({ length: FINAL_TRIALS }, (_, trial) =>
        (SEED ^ HOLDOUT_SALT ^ (lineage * 65599 + trial * 15485863)) >>> 0);
}

function save(complete) {
    const total = results.length ? {
        baselineMeals: results.reduce((sum, r) => sum + r.holdout.baseline.meals, 0) / results.length,
        evolvedMeals: results.reduce((sum, r) => sum + r.holdout.evolved.meals, 0) / results.length,
        baselineFed: results.reduce((sum, r) => sum + r.holdout.baseline.fedEpisodes, 0),
        evolvedFed: results.reduce((sum, r) => sum + r.holdout.evolved.fedEpisodes, 0),
        baselineAlive: results.reduce((sum, r) => sum + r.holdout.baseline.episodes.filter(e => e.alive).length, 0),
        evolvedAlive: results.reduce((sum, r) => sum + r.holdout.evolved.episodes.filter(e => e.alive).length, 0),
    } : null;
    const document = {
        complete,
        settings: { seed: SEED, count: COUNT, minParts: MIN_PARTS, maxParts: MAX_PARTS,
            generations: GENERATIONS, offspring: OFFSPRING, trainSteps: TRAIN_STEPS,
            trainTrials: TRAIN_TRIALS, finalSteps: FINAL_STEPS, finalTrials: FINAL_TRIALS,
            foodDistance: FOOD_DISTANCE, from: FROM, holdoutSalt: HOLDOUT_SALT,
            lifeStage: LIFE_STAGE, initialEnergy: INITIAL_ENERGY },
        total, results,
    };
    fs.writeFileSync(path.join(OUT, OUTPUT), JSON.stringify(document, null, 2) + "\n");
    return document;
}

const previous = FROM ? JSON.parse(fs.readFileSync(path.resolve(ROOT, FROM), "utf8")) : null;
const founders = previous ? previous.results.map(r => ({
    name: r.name, genes: r.genes, parts: r.parts, mass: r.mass,
    evolvedGenes: r.evolvedGenes, changes: r.changes, priorHistory: r.history,
})) : loadFounders();
const results = [];
for (const [lineage, founder] of founders.entries()) {
    const random = makeRandom((SEED ^ 0x6d2b79f5 ^ lineage * 32452843) >>> 0);
    let current = { genes: founder.evolvedGenes || founder.genes, changes: founder.changes || [] };
    const history = founder.priorHistory || [];
    for (let generation = 0; !previous && generation <= GENERATIONS; generation++) {
        const seeds = trainingSeeds(lineage, generation);
        const candidates = [current];
        for (let child = 0; child < OFFSPRING; child++) {
            const variant = mutate(current.genes, random);
            candidates.push({ genes: variant.genes, changes: [...current.changes, variant.change] });
        }
        let best = null;
        for (const candidate of candidates) {
            const measure = evaluate(candidate.genes, seeds, TRAIN_STEPS);
            if (!best || better(measure, best.measure)) best = { ...candidate, measure };
        }
        current = { genes: best.genes, changes: best.changes };
        history.push({ generation, measure: best.measure, changes: current.changes });
        console.log(`${founder.name} g${generation}: meals=${best.measure.meals.toFixed(2)} ` +
            `fed=${best.measure.fedEpisodes}/${TRAIN_TRIALS} closest=${best.measure.closest?.toFixed(1)} ` +
            `life=${best.measure.survived.toFixed(0)}`);
    }
    const seeds = holdoutSeeds(lineage);
    const baseline = evaluate(founder.genes, seeds, FINAL_STEPS);
    const evolved = evaluate(current.genes, seeds, FINAL_STEPS);
    results.push({ ...founder, history, changes: current.changes, evolvedGenes: current.genes, holdout: { seeds, baseline, evolved } });
    console.log(`${founder.name} HOLDOUT: meals ${baseline.meals.toFixed(2)} -> ${evolved.meals.toFixed(2)}, ` +
        `fed ${baseline.fedEpisodes}/${FINAL_TRIALS} -> ${evolved.fedEpisodes}/${FINAL_TRIALS}, ` +
        `life ${baseline.survived.toFixed(0)} -> ${evolved.survived.toFixed(0)}`);
    save(false);
}

const document = save(true);
console.log("TOTAL " + JSON.stringify(document.total));
console.log("Wrote " + path.join(OUT, OUTPUT));
