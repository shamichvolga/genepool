//--------------------------------------------------------------------------------
// Fixed-genotype solitary viability test.
//
// One herbivore in a small pool, one plant at a time. Every new plant is placed
// FOOD_DISTANCE away from the swimbot (never at its mouth). No eternal flag,
// energy refill, teleportation, or automatic feeding is used.
//
//   node tools/viability50.cjs --steps 40000 --count 50 --label baseline
//--------------------------------------------------------------------------------
"use strict";

const fs = require("fs");
const path = require("path");
const { createSimulation } = require("./headless.cjs");

function arg(name, fallback) {
    const i = process.argv.indexOf("--" + name);
    return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "analysis", "viability50");
const STEPS = parseInt(arg("steps", "40000"), 10);
const COUNT = parseInt(arg("count", "50"), 10);
const START = parseInt(arg("start", "0"), 10);
const LABEL = arg("label", "run");
const SEED = parseInt(arg("seed", "730241"), 10);
const FOOD_DISTANCE = Number(arg("food-distance", "220"));
const POOL_SCALE = Number(arg("pool-scale", "0.25"));
const MAX_AGE = parseInt(arg("max-age", "45000"), 10);
const MIN_EATEN = parseInt(arg("min-eaten", "2"), 10);
const STOP_ON_DEATH = arg("stop-on-death", "true") !== "false";
const TRACE_EVERY = parseInt(arg("trace-every", "0"), 10);
const GENOTYPE_FILE = path.join(OUT, "genotypes.json");

fs.mkdirSync(OUT, { recursive: true });

const overrides = {
    INITIAL_NUM_SWIMBOTS: 0,
    INITIAL_NUM_FOODBITS: 0,
    WORLD_SCALE: POOL_SCALE,
    // Shared-state capacities must remain integers at fractional world scales.
    MAX_SWIMBOTS: 100,
    MAX_FOODBITS: 400,
    MAX_FOODBITS_PER_TYPE: 100,
    MAX_MAXIMUM_AGE: Math.max(60000, MAX_AGE),
    ORIGINAL_FOOD_ENABLED: false,
    ENVIRONMENT_SEEDS_PER_PERIOD: 0,
    LOCAL_ENVIRONMENT_PLANT_GROWTH: false,
    FOOD_RANDOM_SEED_CHANCE: 0,
    PLANT_REGROW_CHANCE: 0,
    OBSTACLE_ENABLED: false,
};
if (arg("rudder", "false") === "true") overrides.RUDDER_ENABLED = true;
if (arg("steer-by-swim", "false") === "true") overrides.STEER_BY_SWIM_DIRECTION_ENABLED = true;
if (arg("rudder-free", "false") === "true") overrides.RUDDER_COST_PER_DEGREE = 0;
if (arg("hydrodynamics", "false") === "true") overrides.BODY_HYDRODYNAMICS_ENABLED = true;
if (arg("directed-swim", "false") === "true") overrides.DIRECTED_SWIMMING_ENABLED = true;
if (process.argv.includes("--swim-cost")) overrides.ENERGY_USED_UP_SWIMMING = Number(arg("swim-cost", "0.01"));
if (process.argv.includes("--rudder-max")) overrides.RUDDER_MAX_TURN = Number(arg("rudder-max", "1.5"));
if (process.argv.includes("--angular-drag")) overrides.ANGULAR_WATER_DRAG = Number(arg("angular-drag", "0.08"));
if (process.argv.includes("--directed-speed")) overrides.DIRECTED_SWIM_SPEED = Number(arg("directed-speed", "0.45"));
if (process.argv.includes("--directed-response")) overrides.DIRECTED_SWIM_RESPONSE = Number(arg("directed-response", "0.04"));

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

function generateGenotypes() {
    const run = createSimulation(SEED, overrides, ROOT);
    const s = run.sandbox;
    const records = [];
    let attempts = 0;
    while (records.length < 50) {
        attempts++;
        if (attempts > 100000) throw new Error("Could not generate enough 10-16 part genotypes");
        const genotype = new s.Genotype();
        genotype.randomize();
        // This is a plant-foraging test, not a test of random carnivores.
        genotype.setGeneValue(129, 0);
        genotype.setGeneValue(130, 0);
        const phenotype = new s.Embryology().generatePhenotypeFromGenotype(genotype);
        if (phenotype.numParts < 10 || phenotype.numParts > 16) continue;
        const genes = [];
        for (let g = 0; g < s.NUM_GENES; g++) genes.push(genotype.getGeneValue(g));
        records.push({ id: records.length, genes, numParts: phenotype.numParts, mass: phenotype.mass });
    }
    const document = { seed: SEED, count: 50, minParts: 10, maxParts: 16, records };
    fs.writeFileSync(GENOTYPE_FILE, JSON.stringify(document, null, 2) + "\n");
    return records;
}

function loadGenotypes() {
    if (!fs.existsSync(GENOTYPE_FILE)) return generateGenotypes().slice(START, START + COUNT);
    const document = JSON.parse(fs.readFileSync(GENOTYPE_FILE, "utf8"));
    if (document.records.length < 50) return generateGenotypes().slice(START, START + COUNT);
    return document.records.slice(START, START + COUNT);
}

function spawnFood(run, bot, random) {
    const gp = run.genePool;
    const s = run.sandbox;
    let slot = gp.findLowestDeadFoodBitInArray(false);
    if (slot < 0) {
        let livePlants = 0;
        for (let f = 0; f < s.MAX_FOODBITS; f++) if (gp.getFoodBitAt(f).getAlive()) livePlants++;
        throw new Error(`No free plant slot: bots=${gp.getNumSwimbots()} food=${gp.getNumFoodBits()} live=${livePlants} eaten=${bot.getNumFoodBitsEaten()} clock=${s.simClock.step}`);
    }
    const food = gp.getFoodBitAt(slot);
    food.initialize(slot);
    food.setType(0);
    food.setEnergy(s.DEFAULT_FOOD_BIT_ENERGY);

    // Try random directions, then a deterministic spiral fallback near walls.
    const p = bot.getPosition();
    const margin = 30;
    const right = s.POOL_RIGHT - margin, bottom = s.POOL_BOTTOM - margin;
    for (let attempt = 0; attempt < 80; attempt++) {
        const angle = attempt < 40 ? random() * Math.PI * 2 : (attempt - 40) * Math.PI / 20;
        const v = new s.Vector2D();
        v.setXY(p.x + Math.cos(angle) * FOOD_DISTANCE,
                p.y + Math.sin(angle) * FOOD_DISTANCE);
        if (v.x >= margin && v.x <= right && v.y >= margin && v.y <= bottom) {
            food.setPosition(v);
            return slot;
        }
    }
    throw new Error("Could not place food at the required distance");
}

function runOne(record) {
    const seed = SEED + record.id * 9973;
    const random = makeRandom(seed ^ 0x9e3779b9);
    const run = createSimulation(seed, overrides, ROOT);
    const gp = run.genePool;
    const s = run.sandbox;
    gp.setMaximumSwimbotAge(MAX_AGE);
    gp.createNewSwimbotWithGenes(record.genes);
    const bot = gp.getSwimbotAt(0);
    if (!bot.getAlive()) throw new Error("Test swimbot was not created");
    if (bot.getEternal()) throw new Error("Eternal mode is forbidden in this test");

    let foodSlot = spawnFood(run, bot, random);
    let previous = { x: bot.getPosition().x, y: bot.getPosition().y };
    let distance = 0;
    let survivedSteps = 0;
    let minEnergy = bot.getEnergy();
    let lastEaten = 0;
    let lastMealStep = 0;
    let maxSinceFood = 0;
    let minMouthDistance = Infinity;
    const stateSteps = {};
    const started = process.hrtime.bigint();

    for (let step = 1; step <= STEPS; step++) {
        gp.update();
        survivedSteps = step;
        const p = bot.getPosition();
        distance += Math.hypot(p.x - previous.x, p.y - previous.y);
        previous = { x: p.x, y: p.y };
        const food = gp.getFoodBitAt(foodSlot);
        if (food.getAlive()) {
            const mouth = bot.getMouthPosition();
            minMouthDistance = Math.min(minMouthDistance, Math.hypot(food.getPosition().x - mouth.x, food.getPosition().y - mouth.y));
        }
        const state = bot.getBrainState();
        stateSteps[state] = (stateSteps[state] || 0) + 1;
        if (TRACE_EVERY > 0 && step % TRACE_EVERY === 0) {
            const mouth = bot.getMouthPosition();
            const fp = food.getPosition();
            console.log(`TRACE id=${record.id + 1} step=${step} state=${state} goal=${bot.getDrives().length >= 0 ? "nn" : "?"} ` +
                `pos=${p.x.toFixed(0)},${p.y.toFixed(0)} mouth=${mouth.x.toFixed(0)},${mouth.y.toFixed(0)} ` +
                `food=${fp.x.toFixed(0)},${fp.y.toFixed(0)} mouthDist=${Math.hypot(fp.x - mouth.x, fp.y - mouth.y).toFixed(1)} ` +
                `speed=${bot.getSpeed().toFixed(3)} effort=${bot.getEffort().toFixed(3)} energy=${bot.getEnergy().toFixed(1)} eaten=${bot.getNumFoodBitsEaten()}`);
        }
        if (!bot.getAlive()) {
            if (STOP_ON_DEATH) break;
        } else {
            minEnergy = Math.min(minEnergy, bot.getEnergy());
            const eaten = bot.getNumFoodBitsEaten();
            if (eaten > lastEaten) {
                maxSinceFood = Math.max(maxSinceFood, step - lastMealStep);
                lastMealStep = step;
                lastEaten = eaten;
                foodSlot = spawnFood(run, bot, random);
            } else if (!gp.getFoodBitAt(foodSlot).getAlive()) {
                // A plant can disappear only through the normal eating path here.
                foodSlot = spawnFood(run, bot, random);
            }
        }
    }

    const alive = bot.getAlive();
    const eaten = bot.getNumFoodBitsEaten();
    const result = {
        id: record.id,
        numParts: bot.getNumParts(),
        mass: bot.getPhenotypeMass(),
        hungerThreshold: bot.getHungerThreshold(),
        alive,
        success: alive && survivedSteps === STEPS && eaten >= MIN_EATEN && distance >= FOOD_DISTANCE,
        survivedSteps,
        age: bot.getAge(),
        deathCause: bot.getDeathCause(),
        eaten,
        distance: Number(distance.toFixed(3)),
        finalEnergy: Number(bot.getEnergy().toFixed(6)),
        minEnergy: Number(minEnergy.toFixed(6)),
        minMouthDistance: Number(minMouthDistance.toFixed(3)),
        maxStepsBetweenMeals: Math.max(maxSinceFood, survivedSteps - lastMealStep),
        stateSteps,
        eternal: bot.getEternal(),
        elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
    };
    console.log(`${LABEL} ${String(record.id + 1).padStart(2)}/${COUNT}: ` +
        `${result.success ? "OK" : "FAIL"} parts=${result.numParts} alive=${alive} ` +
        `steps=${survivedSteps} eaten=${eaten} distance=${result.distance.toFixed(0)} ` +
        `energy=${result.finalEnergy.toFixed(1)} cause=${result.deathCause || "-"}`);
    return result;
}

const records = loadGenotypes();
const results = [];
for (const record of records) results.push(runOne(record));

const summary = {
    label: LABEL,
    seed: SEED,
    steps: STEPS,
    count: COUNT,
    poolScale: POOL_SCALE,
    foodDistance: FOOD_DISTANCE,
    maximumAge: MAX_AGE,
    minimumEaten: MIN_EATEN,
    successes: results.filter(r => r.success).length,
    living: results.filter(r => r.alive).length,
    deathCauses: results.reduce((a, r) => {
        const key = r.deathCause || (r.alive ? "alive" : "unknown");
        a[key] = (a[key] || 0) + 1;
        return a;
    }, {}),
    results,
};
fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(summary, null, 2) + "\n");
const header = "id,num_parts,mass,alive,success,survived_steps,age,death_cause,eaten,distance,final_energy,min_energy,eternal,elapsed_ms";
const lines = results.map(r => [r.id, r.numParts, r.mass, r.alive, r.success, r.survivedSteps, r.age,
    r.deathCause, r.eaten, r.distance, r.finalEnergy, r.minEnergy, r.eternal, r.elapsedMs.toFixed(2)].join(","));
fs.writeFileSync(path.join(OUT, `${LABEL}.csv`), header + "\n" + lines.join("\n") + "\n");
console.log(`SUMMARY ${LABEL}: ${summary.successes}/${COUNT} passed; ${summary.living}/${COUNT} alive; ` +
    `causes=${JSON.stringify(summary.deathCauses)}`);
