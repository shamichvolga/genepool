// Integration check: nutrients are matter, never animal energy; plant growth
// spends exactly the soil needed for the energy it receives.
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
        INITIAL_NUM_SWIMBOTS: "0", INITIAL_NUM_FOODBITS: "0",
        MAX_SWIMBOTS: "10", MAX_FOODBITS: "10",
        ...extraOverrides,
    });
}

function rotMeat( enabled )
{
    const run = makeRun( enabled );
    const sb = run.sandbox, p = new sb.Vector2D();
    p.setXY( sb.POOL_LEFT + 1000, sb.POOL_TOP + 1000 );
    const cell = sb.environment.plantCellIndex( p.x, p.y );
    run.genePool.spawnMeatFoodBits( p, 1 );
    for ( let step = 0; step <= sb.MEAT_DECAY_TIME; step++ ) run.genePool.simulateStep();
    return { run, cell };
}

const active = rotMeat( true );
assert.strictEqual( active.run.sandbox.simCounters.meatDecayEvents, 1 );
assert.strictEqual( active.run.sandbox.simCounters.nutrientsFromMeatDecay, 2.5,
    "50 energy of meat returns 2.5 nutrient units" );
assert.strictEqual( active.run.sandbox.environment.getSoilNutrientAtCell( active.cell ), 2.5 );

const off = rotMeat( false );
assert.strictEqual( off.run.sandbox.simCounters.nutrientsFromMeatDecay, 0,
    "disabled nutrient cycle returns zero" );

const run = makeRun( true );
const env = run.sandbox.environment;
const x = run.sandbox.POOL_LEFT + 500, y = run.sandbox.POOL_TOP + 500;
const cell = env.plantCellIndex( x, y );
env.returnMeatDetritusAt( x, y, 50 );
assert.strictEqual( env.takeSoilNutrientForGrowthAt( x, y, 50 ), 50,
    "2.5 soil funds 50 energy of growth at 0.05 nutrient per energy" );
assert( Math.abs( env.getSoilNutrientAtCell( cell )) < 1e-6 );

env.returnMeatDetritusAt( x, y, 0.5 ); // 0.025 nutrient: enough for 0.5 energy
assert( Math.abs( env.takeSoilNutrientForGrowthAt( x, y, 10 ) - 0.5 ) < 1e-5,
    "growth is capped by available soil" );
assert( Math.abs( env.getSoilNutrientAtCell( cell )) < 1e-6 );

const energyRun = makeRun( true, { INITIAL_NUM_SWIMBOTS: "1" } );
const energyBefore = energyRun.genePool.getSwimbotEnergy( 0 );
energyRun.sandbox.environment.returnMeatDetritusAt( x, y, 40 );
assert.strictEqual( energyRun.genePool.getSwimbotEnergy( 0 ), energyBefore,
    "soil nutrients do not grant swimbot energy directly" );

console.log( "nutrient-cycle regression passed: detritus, disabled cycle, exact growth funding, soil limit, and no direct energy path" );
