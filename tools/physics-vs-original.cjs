//------------------------------------------------------------------------------
// The same swimbot (genes from a file) alone in an empty pool, in this version
// and in "GenePool Original": how fast it swims, how much it turns, how long
// it coasts. A difference means the physics changed.
//
//   node tools/physics-vs-original.cjs genes1.json genes2.json ... [--set "NAME=value"] --original <copy of GenePool Original
//   whose GenePool.js has the line: this.getSwimbots = function() { return _swimbots; }>
//------------------------------------------------------------------------------
"use strict";
const fs = require( "fs" );
const vm = require( "vm" );
const path = require( "path" );
const { createSimulation } = require( "./headless.cjs" );

const files = process.argv.slice( 2 ).filter( a => a.endsWith( ".json" ));
const setIndex = process.argv.indexOf( "--set" );
const overrides = {};
if ( setIndex > 0 ) for ( const kv of process.argv[ setIndex + 1 ].split( "," ).filter( Boolean )) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }
// (the original has no getter for the swimbots: a copy with one added line, see --original)
const originalIndex = process.argv.indexOf( "--original" );
const ROOTS = { now: path.join( __dirname, ".." ), original: originalIndex > 0 ? process.argv[ originalIndex + 1 ] : path.join( __dirname, "..", "GenePool Original" ) };
const STEPS = 3000;

function measure( root, genes, extra )
{
    const run = createSimulation( 1, extra, root );
    const sb = run.sandbox, gp = run.genePool;
    gp.startSimulation( vm.runInContext( "SimulationStartMode.EMPTY", sb ));   // (the original's names are not on the global object)
    if ( gp.setRendering ) gp.setRendering( false );
    gp.createNewSwimbotWithGenes( genes.slice() );
    const bots = gp.getSwimbots ? gp.getSwimbots() : null;
    let bot = null;
    if ( bots ) { for ( const b of bots ) if ( b.getAlive() ) { bot = b; break; } }
    else { bot = gp.getSwimbot ? gp.getSwimbot( 0 ) : null; }
    if ( !bot ) return null;
    let last = bot.getPosition(), lx = last.x, ly = last.y, la = bot.getAngle();
    let distance = 0, turn = 0, n = 0, maxSpeed = 0;
    for ( let i = 0; i < STEPS; i++ )
    {
        gp.update();
        if ( !bot.getAlive() ) break;
        const p = bot.getPosition(), a = bot.getAngle();
        const d = Math.hypot( p.x - lx, p.y - ly );
        if ( i > 300 ) { distance += d; turn += Math.abs( a - la ); n ++; maxSpeed = Math.max( maxSpeed, d ); }
        lx = p.x; ly = p.y; la = a;
    }
    return { parts: bot.getNumParts ? bot.getNumParts() : "?", speed: distance / Math.max( 1, n ), maxSpeed, turn: turn / Math.max( 1, n ) };
}

for ( const file of files )
{
    const genes = JSON.parse( fs.readFileSync( file, "utf8" )).genes;
    const now = measure( ROOTS.now, genes, overrides ), original = measure( ROOTS.original, genes, {} );
    const f = ( r ) => r ? "parts " + r.parts + ", speed " + r.speed.toFixed( 3 ) + " (max " + r.maxSpeed.toFixed( 2 ) + "), turn " + r.turn.toFixed( 2 ) + " deg/step" : "-";
    console.log( path.basename( file ));
    console.log( "  now:      " + f( now ));
    console.log( "  original: " + f( original ));
}
