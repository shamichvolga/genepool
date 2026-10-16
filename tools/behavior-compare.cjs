//------------------------------------------------------------------------------
// Does a change keep the behaviour? Runs the random pool (environment on)
// for some steps and prints what the swimbots did: births, meals, attacks,
// deaths, population. Give another copy of the project to compare.
//
//   node tools/behavior-compare.cjs [bots] [steps] [seed] [root]
//
// Numbers will not be equal when the random numbers are used differently,
// but they should be close (try a few seeds).
//------------------------------------------------------------------------------
"use strict";
const path = require( "path" );
const { createSimulation } = require( path.join( __dirname, "headless.cjs" ) );

const bots  = parseInt( process.argv[2] || "800",  10 );
const steps = parseInt( process.argv[3] || "1500", 10 );
const seed  = parseInt( process.argv[4] || "1",    10 );
const root  = process.argv[5] || path.join( __dirname, ".." );

const run = createSimulation( seed, {
    INITIAL_NUM_SWIMBOTS : bots,
    MAX_SWIMBOTS         : Math.max( 2000, bots * 2 ),
}, root );
const sb = run.sandbox;

const t0 = process.hrtime.bigint();
for ( let i = 0; i < steps; i++ ) run.genePool.update();
const ms = Number( process.hrtime.bigint() - t0 ) / 1e6 / steps;

const c = sb.simCounters;
const s = run.stats( run.genePool );
const keys = [ "births", "plantMeals", "meatMeals", "attackCount", "failedAttacks", "starvationDeaths", "oldAgeDeaths",
               "predationDeaths", "otherDeaths", "autotomyThreatDrops", "autotomyBiteDrops", "reproductivePairAttempts", "meatTargetsWhilePursuing" ];
const out = { root: path.basename( path.resolve( root )), seed, steps, alive: s.alive, predators: s.predators, meanEnergy: +s.meanEnergy.toFixed( 1 ), msPerStep: +ms.toFixed( 2 ) };
for ( const k of keys ) { if ( c[k] !== undefined ) out[k] = c[k]; }
console.log( JSON.stringify( out ));
