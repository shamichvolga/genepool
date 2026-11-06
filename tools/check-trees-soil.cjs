// End-to-end checks for tree state, fruit energy, seed persistence and soil flow.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const overrides = {
    INITIAL_NUM_SWIMBOTS: "0", INITIAL_NUM_FOODBITS: "0",
    MAX_SWIMBOTS: "8", MAX_FOODBITS: "32",
    CLOSED_ENERGY_CYCLE_ENABLED: "true", PLANT_SIZE_ENABLED: "true",
    PLANT_FRUIT_PERIOD: "1", SOIL_NUTRIENT_DECAY_PER_STEP: "0",
    INITIAL_SOIL_NUTRIENT_PER_CELL: "0", SOIL_DIFFUSION_INTERVAL: "1",
};
const run = createSimulation( 913, overrides );
const sb = run.sandbox, pool = run.genePool, st = sb.sharedState();
const pos = new sb.Vector2D();
pos.setXY( sb.POOL_LEFT + 3000, sb.POOL_TOP + 3000 );
assert( pool.spawnPlant( pos, 0, 0, 0, false ), "test plant should spawn" );
const tree = pool.getFoodBitAt( 0 );
tree.setEnergy( 150 ); tree.setWood( 150 );
const energyBeforeFruit = pool.getTotalWorldEnergy();
st.foodFruitAt[0] = 0;
for ( let i = 0; i < 5; i++ ) { pool.simulateStep(); st.foodFruitAt[0] = sb.simClock.step; }
let fruits = 0;
for ( let f = 0; f < sb.MAX_FOODBITS; f++ ) { if ( st.liveFood[f] === 1 && st.foodFruit[f] === 1 ) fruits++; }
assert( fruits <= 3, "one crown may hold at most three fruits" );
assert( fruits > 0, "mature crown should produce fruit" );
assert.strictEqual( pool.getEcologyStats().trees, 1, "ecology diagnostics should count mature plant slots" );
assert.strictEqual( pool.getEcologyStats().fruits, fruits, "ecology diagnostics should count fruits" );
assert( Math.abs( pool.getTotalWorldEnergy() - energyBeforeFruit ) < 1e-5,
    "fruit energy is transferred from parent, not created" );

tree.setEnergy( 40 );
tree.setWood( 150 );
assert.strictEqual( sb.biteEnergy( 1, tree.getWood(), tree.getEnergy() ), 0,
    "small body cannot bite mature wood" );
assert( sb.biteEnergy( 100000, tree.getWood(), tree.getEnergy() ) > 0,
    "large body can bite mature wood" );
tree.setEnergy( tree.getEnergy() - 5 );
assert.strictEqual( tree.getWood(), 150, "wood ratchet survives partial bite" );
assert( tree.getAlive(), "partly eaten tree remains in its slot" );

// Starved trunk loses its historical biomass and eventually frees its slot.
tree.setEnergy( 0 ); tree.setWood( 150 );
const decaySteps = sb.WOOD_DECAY_STEPS + 5;
for ( let i = 0; i < decaySteps && tree.getAlive(); i++ ) pool.simulateStep();
assert( !tree.getAlive(), `starved trunk should free its food slot after wood decay (wood=${tree.getWood()}, energy=${tree.getEnergy()}, steps=${decaySteps})` );

assert( pool.spawnPlant( pos, 0, 0, 0, false ), "kill idempotency plant should spawn" );
const killOnce = pool.getFoodBitAt( 0 );
killOnce.setEnergy( 7 );
const atmosphereBeforeKill = sb.getAtmosphereEnergy();
killOnce.kill();
const atmosphereAfterKill = sb.getAtmosphereEnergy();
killOnce.kill();
assert( Math.abs( atmosphereAfterKill - atmosphereBeforeKill - 7 ) < 1e-6,
    "kill returns the remaining food energy exactly once" );
assert.strictEqual( sb.getAtmosphereEnergy(), atmosphereAfterKill,
    "a repeated kill cannot return energy a second time" );

// Soil diffusion conserves total mineral mass when decay is disabled.
const env = sb.environment;
env.returnMeatDetritusAt( pos.x, pos.y, 50 );
const soilBefore = env.getTotalSoilNutrient();
env.diffuseSoilNutrients();
assert( Math.abs( env.getTotalSoilNutrient() - soilBefore ) < 0.02,
    "diffusion conserves soil within Float32 tolerance" );

// Reading total soil for reports must not eagerly age/mutate every cell.
const agingRun = createSimulation( 915, { ...overrides, SOIL_NUTRIENT_DECAY_PER_STEP: "0.001", INITIAL_SOIL_NUTRIENT_PER_CELL: "10" } );
const agingEnv = agingRun.sandbox.environment;
agingEnv.setTime( 1000 );
const soilRawBefore = agingEnv.exportRaw();
const expectedSoil = soilRawBefore.soilNutrient.length * 10 * Math.exp( -1 );
const reportedSoil = agingEnv.getTotalSoilNutrient();
const soilRawAfter = agingEnv.exportRaw();
assert( Math.abs( reportedSoil - expectedSoil ) < 0.1, "total soil reports lazy decay at the current world time" );
assert.deepStrictEqual( Array.from( soilRawAfter.soilNutrient ), Array.from( soilRawBefore.soilNutrient ),
    "reporting soil total must not change nutrient values" );
assert.deepStrictEqual( Array.from( soilRawAfter.nutrientUpdatedAt ), Array.from( soilRawBefore.nutrientUpdatedAt ),
    "reporting soil total must not advance cell timestamps" );

// Binary world persistence includes food fields and the existing private seed slot.
const genotype = new sb.Genotype(); genotype.randomize();
pool.createNewSwimbotWithGenes( Array.from( genotype.getGenes() ));
const bot = pool.getSwimbots().find( b => b.getAlive() );
assert( bot, "test swimbot should be created" );
const priv = new Float64Array( bot.PRIVATE_STATE_SIZE );
bot.getPrivateState( priv, 0 ); priv[11] = sb.simClock.step + 900;
bot.setPrivateState( priv, 0 );
assert( pool.spawnPlant( pos, 0, 0, 0, false ), "save-state plant should spawn" );
const saveTree = pool.getFoodBitAt( 0 );
saveTree.setEnergy( 80 ); saveTree.setWood( 140 ); saveTree.setFruit( true ); saveTree.setNextFruitAt( sb.simClock.step + 25 );
const bytes = pool.saveWorld( false );
const loaded = createSimulation( 914, overrides );
assert( loaded.genePool.loadWorld( bytes ).ok, "binary world should load" );
const loadedSt = loaded.sandbox.sharedState();
assert.strictEqual( loadedSt.foodEnergy[0], 80 );
assert.strictEqual( loadedSt.foodWood[0], 140 );
assert.strictEqual( loadedSt.foodFruit[0], 1 );
assert.strictEqual( loadedSt.foodFruitAt[0], sb.simClock.step + 25 );
const loadedBot = loaded.genePool.getSwimbots().find( b => b.getAlive() );
assert( loadedBot && loadedBot.hasCarriedSeed(), "binary save/load keeps carried seed" );

// Legacy object save/load writes and restores the same ecology state too.
const legacy = pool.getPoolData();
const legacyRun = createSimulation( 915, overrides );
legacyRun.genePool.setPoolData( legacy );
const legacyState = legacyRun.sandbox.sharedState();
assert.strictEqual( legacyState.foodEnergy[0], 80 );
assert.strictEqual( legacyState.foodWood[0], 140 );
assert.strictEqual( legacyState.foodFruit[0], 1 );
assert.strictEqual( legacyState.foodFruitAt[0], sb.simClock.step + 25 );
const legacyBot = legacyRun.genePool.getSwimbots().find( b => b.getAlive() );
assert( legacyBot && legacyBot.hasCarriedSeed(), "legacy save/load keeps carried seed" );

const oldSave = JSON.parse( JSON.stringify( legacy ));
for ( const f of oldSave.foodBitArray ) { delete f.energy; delete f.wood; delete f.fruit; delete f.nextFruitAt; }
for ( const b of oldSave.swimbotArray ) { delete b.privateState; }
const oldRun = createSimulation( 916, overrides );
oldRun.genePool.setPoolData( oldSave );
for ( const f of oldRun.sandbox.sharedState().foodEnergy ) { assert( Number.isFinite( f ), "old saves must not create NaN energy" ); }

// A feeding swimbot can carry a cold seed and plant it after the gut delay.
const seedRun = createSimulation( 917, { ...overrides, PLANT_SEED_CARRY_CHANCE: "1", PLANT_SEED_GUT_MIN: "0", PLANT_SEED_GUT_MAX: "0", PLANT_MAX_TOUGHNESS: "0" } );
const seedSb = seedRun.sandbox, seedPool = seedRun.genePool;
seedPool.simulateStep();
const seedGenotype = new seedSb.Genotype(); seedGenotype.randomize();
seedPool.createNewSwimbotWithGenes( Array.from( seedGenotype.getGenes() ));
const seedBot = seedPool.getSwimbots().find( b => b.getAlive() );
assert( seedBot, "seed dispersal fixture needs a living swimbot" );
seedBot.setEnergy( 0 );
let seedPlantEnergy = 100;
const seedPlant = {
    getIndex: () => 0, getAge: () => 0, getWood: () => 2 * seedSb.WOOD_PER_FRUIT_TIER,
    getEnergy: () => seedPlantEnergy, getType: () => seedSb.PLANT_TYPE_COLD,
    setEnergy: energy => { seedPlantEnergy = energy; },
};
seedBot.filterFeed( seedPlant );
assert( seedBot.hasCarriedSeed(), "eating a mature cold plant should sometimes carry its seed" );
const coldPlantsBefore = seedPool.getNumFoodBitsOfType( seedSb.PLANT_TYPE_COLD );
assert( seedBot.updateCarriedSeed(), "a due carried seed should successfully plant" );
assert.strictEqual( seedPool.getNumFoodBitsOfType( seedSb.PLANT_TYPE_COLD ), coldPlantsBefore + 1,
    "a carried seed creates one cold plant" );
assert( !seedBot.hasCarriedSeed(), "a planted seed leaves the carrier" );

// A small herbivore ignores a closer, unbitable tree when edible grass is visible.
const visionRun = createSimulation( 918, { ...overrides, INITIAL_NUM_SWIMBOTS: "1", VISION_WEIGHT_BY_BITE_EFFICIENCY: "true" } );
const visionSb = visionRun.sandbox, visionPool = visionRun.genePool, visionSt = visionSb.sharedState();
const visionBot = visionPool.getSwimbots().find( b => b.getAlive() );
assert( visionBot, "vision fixture needs a living swimbot" );
const visionIndex = visionBot.getIndex(), visionMind = visionIndex * visionSb.MIND_STRIDE;
const center = new visionSb.Vector2D(); center.setXY(( visionSb.POOL_LEFT + visionSb.POOL_RIGHT ) / 2, ( visionSb.POOL_TOP + visionSb.POOL_BOTTOM ) / 2 );
visionBot.setPosition( center );
visionSt.mass[ visionIndex ] = 1;
visionSt.predator[ visionIndex ] = 0;
visionSt.preferred[ visionIndex ] = visionSb.PLANT_TYPE_WARM;
visionSt.effWarm[ visionIndex ] = 1; visionSt.effCold[ visionIndex ] = 1;
visionSt.energy[ visionIndex ] = 20;
visionSt.botX[ visionIndex ] = center.x; visionSt.botY[ visionIndex ] = center.y;
visionSt.mouthX[ visionIndex ] = center.x; visionSt.mouthY[ visionIndex ] = center.y;
visionSt.mind[ visionMind + visionSb.M_VIEW_RADIUS ] = 1500;
visionSt.mind[ visionMind + visionSb.M_GRAB_RADIUS ] = 100;
visionSt.params[ visionSb.PARAM_ENV_ACTIVE ] = 1; visionSt.params[ visionSb.PARAM_FOOD_TYPES ] = 2;
visionSt.params[ visionSb.PARAM_OB_LENGTH ] = 0;
const treePos = new visionSb.Vector2D(); treePos.setXY( center.x + 150, center.y );
const grassPos = new visionSb.Vector2D(); grassPos.setXY( center.x + 300, center.y );
assert( visionPool.spawnPlant( treePos, visionSb.PLANT_TYPE_WARM, 0, 0, false ) );
assert( visionPool.spawnPlant( grassPos, visionSb.PLANT_TYPE_WARM, 1, 0, false ) );
const visionTree = visionPool.getFoodBitAt( 0 ); visionTree.setEnergy( 150 ); visionTree.setWood( 2 * visionSb.WOOD_PER_FRUIT_TIER );
const visionGrass = visionPool.getFoodBitAt( 1 ); visionGrass.setEnergy( 15 ); visionGrass.setWood( 0 );
const liveFood = [];
for ( let f = 0; f < visionSb.MAX_FOODBITS; f++ ) { if ( visionSt.liveFood[f] === 1 ) liveFood.push( f ); }
visionSt.foodAlive.set( visionSt.liveFood );
visionSt.foodGrid.build( liveFood, liveFood.length, visionSt.foodX, visionSt.foodY );
assert.strictEqual( visionSb.biteEnergy( 1, visionTree.getWood(), visionTree.getEnergy() ), 0,
    "vision fixture tree must be inaccessible to the small body" );
visionSb.perceive( visionIndex, visionSt, new visionSb.PerceptionScratch( visionSb.MAX_SWIMBOTS, visionSb.MAX_FOODBITS ));
assert.strictEqual( visionSt.seenFood[ visionIndex ], 1,
    "small herbivore should target the visible sprout instead of the closer mature tree" );

console.log( "tree-soil integration passed: wood ratchet, bite limits, decay, fruit cap/energy, seed dispersal, vision filter, diffusion and persistence" );
