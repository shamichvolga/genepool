// Integration check: decayed meat returns matter, plant sprouts spend it,
// and the nutrient pool never grants animal energy directly.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

function makeRun( enabled, extraOverrides = {} )
{
    return createSimulation( 912, {
        NUTRIENT_CYCLE_ENABLED: enabled ? "true" : "false",
        INITIAL_SOIL_NUTRIENT_PER_CELL: "0",
        SOIL_NUTRIENT_DECAY_PER_STEP: "0",
        ENVIRONMENT_SEEDS_PER_PERIOD: "0",
        INITIAL_NUM_SWIMBOTS: "0",
        INITIAL_NUM_FOODBITS: "0",
        MAX_SWIMBOTS: "10",
        MAX_FOODBITS: "10",
        ...extraOverrides,
    });
}

function rotOneMeat( enabled )
{
    const run = makeRun( enabled );
    const sb = run.sandbox;
    const position = new sb.Vector2D();
    position.setXY( sb.POOL_LEFT + 1000, sb.POOL_TOP + 1000 );
    const cell = sb.environment.plantCellIndex( position.x, position.y );
    run.genePool.spawnMeatFoodBits( position, 1 );
    for ( let step = 0; step <= sb.MEAT_DECAY_TIME; step++ ) run.genePool.simulateStep();
    return { run, cell };
}

const active = rotOneMeat( true );
assert.strictEqual( active.run.sandbox.simCounters.meatDecayEvents, 1, "meat should rot exactly once" );
assert.strictEqual( active.run.sandbox.simCounters.nutrientsFromMeatDecay, 2.5, "50 energy units should return 2.5 nutrient units" );
assert.strictEqual( active.run.sandbox.environment.getSoilNutrientAtCell( active.cell ), 2.5, "detritus should return to the meat's plant cell" );

const disabled = rotOneMeat( false );
assert.strictEqual( disabled.run.sandbox.simCounters.meatDecayEvents, 1, "meat decay should still be counted in control mode" );
assert.strictEqual( disabled.run.sandbox.simCounters.nutrientsFromMeatDecay, 0, "disabled cycle must not return nutrients" );
assert.strictEqual( disabled.run.sandbox.environment.getSoilNutrientAtCell( disabled.cell ), 0, "disabled cycle must not add soil nutrients" );

const sproutTest = makeRun( true );
const env = sproutTest.sandbox.environment;
const cell = env.plantCellIndex( sproutTest.sandbox.POOL_LEFT + 500, sproutTest.sandbox.POOL_TOP + 500 );
const x = sproutTest.sandbox.POOL_LEFT + 500, y = sproutTest.sandbox.POOL_TOP + 500;
env.returnMeatDetritusAt( x, y, 40 );
assert.strictEqual( env.takeSoilNutrientForSproutAt( x, y ), true, "a funded sprout should establish" );
assert.strictEqual( env.getSoilNutrientAtCell( cell ), 1, "a sprout should spend one nutrient unit" );
assert.strictEqual( env.takeSoilNutrientForSproutAt( x, y ), true, "one nutrient unit should fund one more sprout" );
assert.strictEqual( env.takeSoilNutrientForSproutAt( x, y ), false, "a sprout without soil nutrients should fail" );
assert.strictEqual( sproutTest.sandbox.simCounters.nutrientsFromMeatDecay, 0, "direct nutrient checks do not alter simulation event counters" );

const energyTest = makeRun( true, { INITIAL_NUM_SWIMBOTS: "1" } );
const energyBefore = energyTest.genePool.getSwimbotEnergy( 0 );
assert( energyBefore > 0, "energy-path check needs a living swimbot" );
energyTest.sandbox.environment.returnMeatDetritusAt(
    energyTest.sandbox.POOL_LEFT + 500,
    energyTest.sandbox.POOL_TOP + 500,
    40
);
assert.strictEqual( energyTest.genePool.getSwimbotEnergy( 0 ), energyBefore, "soil nutrients must not directly grant swimbot energy" );

console.log( "nutrient-cycle regression passed: decay return, disabled control, one-unit uptake, and no direct energy path" );
