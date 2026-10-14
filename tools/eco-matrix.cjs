// Reproducible ecological control matrix. Each scenario/seed pair runs in its
// own process and writes an eco CSV plus adjacent JSON metadata.
//
//   node tools/eco-matrix.cjs --scenarios BASE,C0,C1,C2,C3,C4,C5,C6,C7,C8,C9 \
//     --seeds 1,2,3,4,5 --steps 50000 --every 5000
"use strict";

const fs = require( "fs" );
const path = require( "path" );
const { spawnSync } = require( "child_process" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

const scenarios = arg( "scenarios", "BASE,C0,C1,C2,C3,C4,C5,C6,C7,C8,C9" ).split( "," ).map( x => x.trim().toUpperCase() );
const seeds = arg( "seeds", "1,2,3,4,5" ).split( "," ).map( x => parseInt( x.trim(), 10 ) );
const steps = parseInt( arg( "steps", "50000" ), 10 );
const every = parseInt( arg( "every", "5000" ), 10 );
const outputDir = path.resolve( arg( "out", path.join( __dirname, "results", "ecology-matrix" ) ));
const overrides = arg( "set", null );
const scenarioNames = new Set([ "BASE", "C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9" ]);

if ( scenarios.length === 0 || scenarios.some( x => !scenarioNames.has( x )))
    throw new Error( "scenarios must be selected from BASE,C0,C1,C2,C3,C4,C5,C6,C7,C8,C9" );
if ( seeds.length === 0 || seeds.some( x => !Number.isFinite( x )))
    throw new Error( "seeds must be comma-separated integers" );
if ( !( steps > 0 ) || !( every > 0 )) throw new Error( "steps and every must be positive integers" );

fs.mkdirSync( outputDir, { recursive: true } );
const ecoScript = path.join( __dirname, "eco.cjs" );
const total = scenarios.length * seeds.length;
let finished = 0;

for ( const scenario of scenarios )
{
    for ( const seed of seeds )
    {
        const csv = path.join( outputDir, `${scenario}-seed-${seed}.csv` );
        const args = [ ecoScript, "--scenario", scenario, "--seed", String( seed ), "--steps", String( steps ), "--every", String( every ), "--csv", csv ];
        if ( overrides ) args.push( "--set", overrides );
        console.log( `[${finished + 1}/${total}] ${scenario}, seed ${seed}` );
        const result = spawnSync( process.execPath, args, { stdio: "inherit" } );
        if ( result.error ) throw result.error;
        if ( result.status !== 0 ) throw new Error( `${scenario}, seed ${seed} exited with code ${result.status}` );
        finished ++;
    }
}

console.log( `completed ${finished} runs in ${outputDir}` );
