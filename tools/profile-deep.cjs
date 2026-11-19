//--------------------------------------------------------------------------------
// Deep process profile of the simulation, without a browser.
//
//   node --max-old-space-size=8000 tools/profile-deep.cjs [--bots 1000] [--steps 1000] [--seed 1]
//
// Runs the world headless with the population the same way bench.cjs does,
// turns the built-in profiler on, measures the steps and prints the table:
//
//   process | calls | calls/step | ms/step | % time
//--------------------------------------------------------------------------------
"use strict";

const path = require( "path" );
const { createSimulation } = require( path.join( __dirname, "headless.cjs" ) );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

const bots  = parseInt( arg( "bots",  "1000" ), 10 );
const steps = parseInt( arg( "steps", "1000" ), 10 );
const seed  = parseInt( arg( "seed",  "1"    ), 10 );
const root  = arg( "root", path.join( __dirname, ".." ) );

const overrides =
{
    INITIAL_NUM_SWIMBOTS : bots,
    MAX_SWIMBOTS         : Math.max( 2000, bots * 2 ),
    INITIAL_NUM_FOODBITS : bots,
    MAX_FOODBITS         : Math.max( 2000, bots * 2 ),
    MAX_FOODBITS_PER_TYPE: Math.max( 1000, bots ),
};

const run = createSimulation( seed, overrides, root );

for ( let i = 0; i < 20; i++ ) run.genePool.update();   // warm-up

// the same window the "P" key uses, only started by hand (the tool prints its own table)
run.genePool.profileSteps( steps, false );

const t0 = process.hrtime.bigint();
for ( let i = 0; i < steps; i++ ) run.genePool.update();
const msPerStep = Number( process.hrtime.bigint() - t0 ) / 1e6 / steps;

const table = run.genePool.takeProfilerReport();
console.log( table || "(no report)" );
console.log( `bots=${bots} alive=${run.genePool.getNumSwimbots()} ms/step=${msPerStep.toFixed( 2 )} steps/sec=${( 1000 / msPerStep ).toFixed( 1 )}` );
