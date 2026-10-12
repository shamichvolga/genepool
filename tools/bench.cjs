//--------------------------------------------------------------------------------
// Speed and memory benchmark at a given population size.
//
//   node --max-old-space-size=8000 tools/bench.cjs <swimbots> [steps] [seed]
//
// Raises the pool limits to fit the population, runs a few warm-up steps,
// then reports milliseconds per step and memory in use.
//--------------------------------------------------------------------------------
"use strict";

const path = require( "path" );
const { createSimulation } = require( path.join( __dirname, "headless.cjs" ) );

const bots  = parseInt( process.argv[2] || "1000", 10 );
const steps = parseInt( process.argv[3] || "200",  10 );
const seed  = parseInt( process.argv[4] || "1",    10 );
const root  = process.argv[5] || path.join( __dirname, ".." );   // another copy of the project, to compare

const overrides =
{
    INITIAL_NUM_SWIMBOTS : bots,
    MAX_SWIMBOTS         : Math.max( 2000, bots * 2 ),
    INITIAL_NUM_FOODBITS : bots,
    MAX_FOODBITS         : Math.max( 2000, bots * 2 ),
    MAX_FOODBITS_PER_TYPE: Math.max( 1000, bots ),
};

const memoryBefore = process.memoryUsage().heapUsed;
const t0 = Date.now();
const run = createSimulation( seed, overrides, root );
const createMs = Date.now() - t0;

for ( let i = 0; i < 20; i++ ) run.genePool.update();   // warm-up

const t1 = process.hrtime.bigint();
for ( let i = 0; i < steps; i++ ) run.genePool.update();
const msPerStep = Number( process.hrtime.bigint() - t1 ) / 1e6 / steps;

if ( global.gc ) global.gc();
const heapMb = ( process.memoryUsage().heapUsed - memoryBefore ) / 1048576;

// fingerprint of the whole state: any change in behaviour changes it
let fingerprint = 0;
for ( const b of run.genePool.getSwimbots() )
{
    if ( b.getAlive() ) fingerprint += b.getPosition().x + 3 * b.getPosition().y + 7 * b.getEnergy() + 11 * b.getBrainState();
}

console.log( `fingerprint=${fingerprint.toFixed( 6 )}` );
console.log( `swimbots=${bots} alive=${run.genePool.getNumSwimbots()} ms/step=${msPerStep.toFixed( 2 )} ` +
             `steps/sec=${( 1000 / msPerStep ).toFixed( 1 )} heap=${heapMb.toFixed( 0 )}MB create=${createMs}ms` );
