//------------------------------------------------------------------------------
// Does a saved world go on exactly as the world it was saved from?
//
//   A  saving changes nothing: a run that saves at step WARM and goes on to
//      WARM+AFTER ends as a run that never saved (same hashes of every array).
//   B  loading is exact: another world (another seed, run a while) loads the
//      file, goes on AFTER steps, and ends as run A.
//
// When B fails, both worlds are stepped one by one after the load, and the
// first step and the first parts (chunks) that differ are shown.
//
//   node tools/save-load-check.cjs --seed 1 --warm 3000 --after 500 [--set "NAME=value"]
//------------------------------------------------------------------------------
"use strict";
const zlib = require( "zlib" );
const { createSimulation } = require( "./headless.cjs" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}
const SEED  = parseInt( arg( "seed",  "1"   ), 10 );
const WARM  = parseInt( arg( "warm",  "3000" ), 10 );
const AFTER = parseInt( arg( "after", "500"  ), 10 );
const overrides = {};
for ( const kv of ( arg( "set", "" ) || "" ).split( "," ).filter( Boolean )) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }

function steps( run, n ) { for ( let i = 0; i < n; i++ ) { run.genePool.update(); } }
function diff( a, b ) { return Object.keys( a ).filter( k => a[ k ] !== b[ k ] ); }

const t0 = Date.now();
const log = ( m ) => console.log( "[" + ( ( Date.now() - t0 ) / 1000 ).toFixed( 0 ) + "s] " + m );

// run 1: warm up, save, go on
const run1 = createSimulation( SEED, overrides );
steps( run1, WARM );
const bytes = Buffer.from( run1.genePool.saveWorld() );          // (a copy: the sandbox owns the original)
const hashSaved = run1.genePool.worldHashes();
const gz = zlib.gzipSync( bytes );
log( "saved at step " + run1.genePool.getTimeStep() + ": " + ( bytes.length / 1048576 ).toFixed( 1 ) + " MB, gzip " + ( gz.length / 1048576 ).toFixed( 1 ) + " MB, alive " + run1.genePool.getNumSwimbots() );
const savedAgain = run1.genePool.worldHashes();
const changedBySaving = diff( hashSaved, savedAgain );
steps( run1, AFTER );
const hashA = run1.genePool.worldHashes();

// run 2: the same without saving
const run2 = createSimulation( SEED, overrides );
steps( run2, WARM + AFTER );
const hashB = run2.genePool.worldHashes();
const badA = diff( hashA, hashB );
log( "A (saving changes nothing): " + ( badA.length === 0 && changedBySaving.length === 0 ? "OK" : "FAILED " + badA.concat( changedBySaving ).join( "," ) ) );

// run 3: another world, loads the file
function loaded( seed )
{
    const run = createSimulation( seed, overrides );
    steps( run, 500 );
    const result = run.genePool.loadWorld( new Uint8Array( bytes ));
    return { run, result };
}
const r3 = loaded( SEED + 100 );
log( "load: " + JSON.stringify( r3.result ));
steps( r3.run, AFTER );
const hashC = r3.run.genePool.worldHashes();
const badB = diff( hashA, hashC );
log( "B (loading is exact): " + ( badB.length === 0 ? "OK" : "FAILED in " + badB.join( "," )));

if ( badB.length > 0 )
{
    // find where they part: step both one by one
    const r1 = createSimulation( SEED, overrides );
    steps( r1, WARM );
    const r4 = loaded( SEED + 200 );
    for ( let i = 1; i <= Math.min( AFTER, 60 ); i++ )
    {
        r1.genePool.update(); r4.run.genePool.update();
        const d = diff( r1.genePool.worldHashes(), r4.run.genePool.worldHashes() );
        if ( d.length > 0 ) { log( "first difference after " + i + " step(s), in: " + d.join( ", " )); break; }
    }
}
process.exit( badA.length === 0 && changedBySaving.length === 0 && badB.length === 0 ? 0 : 1 );
