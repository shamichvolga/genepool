// Regression check for the optional mass- and shape-dependent swimming model.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

function run( override )
{
    const settings = {
        INITIAL_NUM_SWIMBOTS: "40",
        INITIAL_NUM_FOODBITS: "100",
        MAX_SWIMBOTS: "80",
        MAX_FOODBITS: "200",
    };
    if ( override !== undefined ) settings.BODY_HYDRODYNAMICS_ENABLED = override ? "true" : "false";
    const simulation = createSimulation( 731, settings );
    for ( let step = 0; step < 250; step++ ) simulation.genePool.update();

    const state = Array.from( simulation.genePool.getSwimbots() )
        .filter( bot => bot.getAlive() )
        .map( bot => {
            const position = bot.getPosition();
            assert( Number.isFinite( bot.getEnergy() ), "energy should remain finite" );
            assert( Number.isFinite( bot.getSpeed() ), "speed should remain finite" );
            assert( Number.isFinite( position.x ) && Number.isFinite( position.y ), "position should remain finite" );
            return [ bot.getIndex(), bot.getEnergy(), position.x, position.y, bot.getSpeed() ]
                .map( value => Math.round( value * 1e9 ) / 1e9 );
        });
    assert( state.length > 0, "the regression run should retain living swimbots" );
    return state;
}

const implicitDefault = run( undefined );
const explicitDisabled = run( false );
const enabled = run( true );

assert.deepStrictEqual( explicitDisabled, implicitDefault, "disabled body physics must preserve default movement" );
assert.notDeepStrictEqual( enabled, implicitDefault, "enabled body physics should alter movement or energy" );

console.log( "body-physics regression passed: default unchanged, active mode changes finite movement and energy" );
