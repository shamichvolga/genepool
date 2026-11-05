// Integration check for the closed energy cycle (concept stage 1):
// atmosphere + plants + meat + swimbots must stay constant over a long run.
// Any drift means some method forgot to return its change to the pool.
//
//   node tools/check-energy-conservation.cjs [steps] [seed]
"use strict";

const assert = require( "assert" );
const { createSimulation } = require( "./headless.cjs" );

const STEPS = parseInt( process.argv[2] || "50000", 10 );
const SEED  = parseInt( process.argv[3] || "913", 10 );

const run = createSimulation( SEED, { CLOSED_ENERGY_CYCLE_ENABLED: "true" } );
const initial = run.genePool.getTotalWorldEnergy();
assert( initial > 0, "the world must start with an energy endowment" );

let maxDrift = 0, maxDriftStep = 0, minAtmosphere = Infinity, lastAlive = 0;
for ( let step = 1; step <= STEPS; step++ )
{
    run.genePool.update();
    const atmosphere = run.sandbox.getAtmosphereEnergy();
    assert( atmosphere >= 0, `atmosphere went negative at step ${step}` );
    if ( atmosphere < minAtmosphere ) minAtmosphere = atmosphere;

    if ( step % 100 === 0 )
    {
        const total = run.genePool.getTotalWorldEnergy();
        const drift = Math.abs( total - initial ) / initial;
        if ( drift > maxDrift ) { maxDrift = drift; maxDriftStep = step; }
        if ( step % 5000 === 0 )
        {
            lastAlive = run.genePool.getNumSwimbots();
            console.log( `step=${step} total=${total.toFixed(3)} drift=${( drift * 100 ).toFixed(5)}% atmosphere=${atmosphere.toFixed(1)} alive=${lastAlive}` );
        }
    }
}

const counters = run.sandbox.energyBudgetCounters;
console.log( `initial=${initial.toFixed(3)} maxDrift=${( maxDrift * 100 ).toFixed(5)}% at step ${maxDriftStep}` );
console.log( `pool flows: photosynthesis+growth=${counters.photosynthesis.toFixed(1)} returned=${counters.returned.toFixed(1)} minAtmosphere=${minAtmosphere.toFixed(1)}` );
assert( maxDrift <= 0.0001, `energy conservation violated: ${( maxDrift * 100 ).toFixed(4)}% drift (limit 0.01%)` );
console.log( `energy-conservation regression passed over ${STEPS} steps` );
