// Regression check: non-physics drains must return their exact cost to the
// atmosphere when the closed energy cycle is enabled.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const run = createSimulation( 23, { CLOSED_ENERGY_CYCLE_ENABLED: "true", DISEASE_ENABLED: "true" } );
const sb = run.sandbox;
const st = sb.sharedState();
const alive = [];
for ( let s = 0; s < st.liveSwimbot.length; s++ )
{
    if ( st.liveSwimbot[s] === 1 ) alive.push( s );
}
assert( alive.length > 0, "the world must start with living swimbots" );

function assertDrainIsRecycled( label, action )
{
    const totalBefore = run.genePool.getTotalWorldEnergy();
    const atmosphereBefore = sb.getAtmosphereEnergy();
    const energyBefore = st.bots[ bot * sb.BOT_STRIDE + sb.B_ENERGY ];
    action();
    const energyAfter = st.bots[ bot * sb.BOT_STRIDE + sb.B_ENERGY ];
    const energyRemoved = energyBefore - energyAfter;
    const atmosphereAfter = sb.getAtmosphereEnergy();
    const totalAfter = run.genePool.getTotalWorldEnergy();

    assert( energyRemoved > 0, `${label} must remove energy in this fixture` );
    assert( Math.abs(( atmosphereAfter - atmosphereBefore ) - energyRemoved ) < 1e-6,
        `${label} must return the exact removed amount to the atmosphere` );
    assert( Math.abs( totalAfter - totalBefore ) < 1e-4,
        `${label} must preserve total world energy` );
}

const bot = alive.find( s => (( s + 1 ) & 3 ) !== 0 );
assert( bot !== undefined, "the fixture needs a swimbot that will not spread disease on step 1" );
const b = bot * sb.BOT_STRIDE, m = bot * sb.MIND_STRIDE;

// Force one sick step without triggering the every-fourth-step spread branch.
st.mind[ m + sb.M_DISEASE ] = 1;
st.mind[ m + sb.M_DISEASE_TIMER ] = 1000;
assertDrainIsRecycled( "disease drain", () => sb.updateDiseases( st, [ bot ], 1, 1 ));

// Make a known cold mismatch and avoid the periodic recalculation in decideStep.
st.params[ sb.PARAM_ENV_ACTIVE ] = 1;
st.mind[ m + sb.M_THERMAL_FIT ] = 0;
const fitPeriod = sb.THERMAL_FIT_UPDATE_PERIOD;
let age = 0;
while ((( age + 1 + st.mind[ m + sb.M_INDEX ]) % fitPeriod ) === 0) age ++;
st.bots[ b + sb.B_AGE ] = age;
assertDrainIsRecycled( "thermal mismatch drain", () => sb.decideStep( st, bot, 0 ));

console.log( "energy drains passed: disease and thermal mismatch losses return to the atmosphere" );
