// Checks temperature exchange direction, size scaling, convergence, and runtime state.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const simulation = createSimulation( 734, {
    INITIAL_NUM_SWIMBOTS: "40",
    INITIAL_NUM_FOODBITS: "100",
    MAX_SWIMBOTS: "80",
    MAX_FOODBITS: "200",
    BODY_TEMPERATURE_INERTIA_ENABLED: "true",
});
const advance = simulation.sandbox.advanceBodyTemperature;
assert.strictEqual( typeof advance, "function", "the bundled thermal exchange function should be available" );

const smallWarm = advance( 0.2, 0.8, 100, 2 );
const largeWarm = advance( 0.2, 0.8, 1000, 5 );
assert( smallWarm > 0.2 && smallWarm < 0.8, "warming should move body temperature toward, not past, the water temperature" );
assert( largeWarm > 0.2 && largeWarm < smallWarm, "larger and broader bodies should warm more slowly" );

const smallCold = advance( 0.8, 0.2, 100, 2 );
const largeCold = advance( 0.8, 0.2, 1000, 5 );
assert( smallCold < 0.8 && smallCold > 0.2, "cooling should move body temperature toward, not past, the water temperature" );
assert( largeCold > 0.2 && largeCold > smallCold, "larger and broader bodies should cool more slowly" );
assert.strictEqual( advance( 0.45, 0.45, 450, 3.5 ), 0.45, "equal body and water temperatures should remain equal" );

let converging = 0.2;
for ( let step = 0; step < 10000; step++ ) converging = advance( converging, 0.8, 450, 3.5 );
assert( Math.abs( converging - 0.8 ) < 1e-6, "body temperature should approach ambient without a permanent thermal bonus" );

for ( let step = 0; step < 500; step++ ) simulation.genePool.update();
const living = Array.from( simulation.genePool.getSwimbots() ).filter( bot => bot.getAlive() );
assert( living.length > 0, "the thermal runtime check should retain living swimbots" );
for ( const bot of living )
{
    assert( Number.isFinite( bot.getBodyTemperature() ), "body temperature should remain finite" );
    assert( Number.isFinite( bot.getAmbientTemperature() ), "ambient temperature should remain finite" );
    assert( bot.getBodyTemperature() >= 0 && bot.getBodyTemperature() <= 1, "body temperature should stay in the normalized range" );
}

console.log( "body-temperature regression passed: mass and breadth slow exchange, temperatures converge, runtime values remain finite" );
