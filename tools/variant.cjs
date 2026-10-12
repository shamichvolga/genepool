//--------------------------------------------------------------------------------
// Run the headless simulation with some constants changed, without editing files.
//
//   node tools/variant.cjs <steps> <seed> [NAME=value ...]
//   node tools/variant.cjs 30000 1 INITIAL_PREDATOR_FRACTION=0 BASAL_METABOLISM=0
//
// Prints a line every 2000 steps: population, predators, plants, meat,
// mean energy, births in the window, number of species clusters.
//--------------------------------------------------------------------------------
"use strict";

const fs   = require( "fs" );
const path = require( "path" );

const steps     = parseInt( process.argv[2] || "20000", 10 );
const seed      = parseInt( process.argv[3] || "1", 10 );
const overrides = process.argv.slice( 4 ).map( a => a.split( "=" ) );

const { createSimulation } = require( path.join( __dirname, "headless.cjs" ) );
const run = createSimulation( seed, Object.fromEntries( overrides ) );
const genePool = run.genePool;

console.log( `steps=${steps} seed=${seed} ${overrides.map( o => o.join( "=" ) ).join( " " )}` );
console.log( "step,alive,predators,plants,meat,mean_energy,births,species,eff_species,top_share" );

let lastNodes = genePool.getFamilyTree().getNumNodes();

for ( let step = 1; step <= steps; step++ )
{
    genePool.update();

    if ( step % 2000 === 0 )
    {
        const s = run.stats( genePool );
        const nodes = genePool.getFamilyTree().getNumNodes();
        console.log( [ step, s.alive, s.predators, s.food, s.meat, s.meanEnergy.toFixed( 1 ), nodes - lastNodes,
                       s.species, s.effSpecies.toFixed( 1 ), s.topShare.toFixed( 2 ) ].join( "," ) );
        lastNodes = nodes;
    }
}

if ( run.alerts.length > 0 )
{
    console.log( `ALERTS (${run.alerts.length}), first: ${run.alerts[0]}` );
}
