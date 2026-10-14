// Confirms the optional mass-scaled maintenance cost is applied once per step.
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const common = {
    INITIAL_NUM_SWIMBOTS: "40",
    INITIAL_NUM_FOODBITS: "100",
    MAX_SWIMBOTS: "80",
    MAX_FOODBITS: "200",
};

function oneStep( overrides )
{
    const simulation = createSimulation( 814, Object.assign( {}, common, overrides ));
    simulation.genePool.update();
    return Array.from( simulation.genePool.getSwimbots() ).filter( bot => bot.getAlive() );
}

const baseline = oneStep( { BASAL_METABOLISM: "0" } );
const treatment = oneStep( { BASAL_METABOLISM: "0.000008" } );
assert.strictEqual( treatment.length, baseline.length, "one maintenance step should not alter population membership" );

const baseByIndex = new Map( baseline.map( bot => [ bot.getIndex(), bot ] ));
let checked = 0;
for ( const bot of treatment )
{
    const base = baseByIndex.get( bot.getIndex() );
    if ( !base ) continue;
    const expectedCost = 0.000008 * Math.pow( bot.getPhenotypeMass(), 0.75 );
    const observedCost = base.getEnergy() - bot.getEnergy();
    const maxEnergy = bot.getMaxEnergy();
    if ( base.getEnergy() < maxEnergy - expectedCost - 1e-6 && base.getEnergy() > expectedCost + 1e-6 )
    {
        assert( Math.abs( observedCost - expectedCost ) < 1e-6, "maintenance cost should follow mass^0.75 exactly once per step" );
        checked ++;
    }
}
assert( checked > 0, "the test should compare at least one unsaturated living swimbot" );

console.log( `basal-metabolism regression passed: mass-scaled maintenance is charged once (${checked} organisms checked)` );
