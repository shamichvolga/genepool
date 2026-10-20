//------------------------------------------------------------------------------
// Does a saved world go on exactly as the world it was saved from?
//
//   A  saving changes nothing: a run that saves at step WARM and goes on ends as
//      a run that never saved (only with --control: it costs a second long run).
//   B  loading is exact: another world (another seed, run a while) loads the
//      file; it and the world the file came from are then stepped side by side,
//      and the hashes of every array are compared (every step at first, then
//      every 25th). The first step and the first parts that differ are shown.
//
//   node tools/save-load-check.cjs --seed 1 --warm 3000 --after 400 [--control] [--set "NAME=value"]
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
const CONTROL = process.argv.includes( "--control" );
const overrides = {};
for ( const kv of ( arg( "set", "" ) || "" ).split( "," ).filter( Boolean )) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }

function steps( run, n ) { for ( let i = 0; i < n; i++ ) { run.genePool.update(); } }
function diff( a, b ) { return Object.keys( a ).filter( k => a[ k ] !== b[ k ] ); }
const t0 = Date.now();
const log = ( m ) => console.log( "[" + ( ( Date.now() - t0 ) / 1000 ).toFixed( 0 ) + "s] " + m );

// the world the file comes from: warm up, save
const run1 = createSimulation( SEED, overrides );
steps( run1, WARM );
const bytes = Buffer.from( run1.genePool.saveWorld() );
const hashSaved = run1.genePool.worldHashes();
log( "saved at step " + run1.genePool.getTimeStep() + ": " + ( bytes.length / 1048576 ).toFixed( 1 ) + " MB, gzip " + ( zlib.gzipSync( bytes ).length / 1048576 ).toFixed( 1 ) + " MB, alive " + run1.genePool.getNumSwimbots() );
const changedBySaving = diff( hashSaved, run1.genePool.worldHashes() );

// another world loads it
const run3 = createSimulation( SEED + 100, overrides );
steps( run3, 500 );
const result = run3.genePool.loadWorld( new Uint8Array( bytes ));
log( "load: " + JSON.stringify( result ));
let ok = result.ok && result.mismatches.length === 0 && changedBySaving.length === 0;

// side by side
let first = null;
for ( let i = 1; i <= AFTER && first === null; i++ )
{
    run1.genePool.update(); run3.genePool.update();
    if ( i <= 10 || i % 25 === 0 || i === AFTER )
    {
        const d = diff( run1.genePool.worldHashes(), run3.genePool.worldHashes() );
        if ( d.length > 0 ) { first = { step: i, chunks: d }; }
    }
}
if ( first ) { ok = false; log( "B FAILED: first difference at step " + first.step + " after the load, in: " + first.chunks.join( ", " )); }
else { log( "B (loading is exact): " + ( ok ? "OK" : "load already differed" ) + ", compared up to " + AFTER + " steps" ); }

if ( CONTROL )
{
    const hashA = run1.genePool.worldHashes();
    const run2 = createSimulation( SEED, overrides );
    steps( run2, WARM + AFTER );
    const badA = diff( hashA, run2.genePool.worldHashes() );
    log( "A (saving changes nothing): " + ( badA.length === 0 ? "OK" : "FAILED in " + badA.join( "," )));
    if ( badA.length > 0 ) ok = false;
}
process.exit( ok ? 0 : 1 );
