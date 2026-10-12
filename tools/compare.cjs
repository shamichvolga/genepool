//--------------------------------------------------------------------------------
// Runs two copies of the code side by side with the same seed and reports
// the first step where they stop behaving identically.
//
//   node tools/compare.cjs <other project folder> [steps] [seed] [swimbots]
//--------------------------------------------------------------------------------
"use strict";

const path = require( "path" );
const { createSimulation } = require( path.join( __dirname, "headless.cjs" ) );

const otherRoot = process.argv[2];
const steps     = parseInt( process.argv[3] || "3000", 10 );
const seed      = parseInt( process.argv[4] || "1", 10 );
const bots      = process.argv[5] ? parseInt( process.argv[5], 10 ) : null;
const overrides = bots === null ? {} : { INITIAL_NUM_SWIMBOTS: bots, MAX_SWIMBOTS: Math.max( 2000, bots * 2 ) };

const a = createSimulation( seed, overrides, otherRoot );
const b = createSimulation( seed, overrides, path.join( __dirname, ".." ) );

function snapshot( run )
{
    const rows = [];
    for ( const s of run.genePool.getSwimbots() )
    {
        if ( !s.getAlive() ) continue;
        rows.push( [ s.getIndex(), s.getPosition().x, s.getPosition().y, s.getEnergy(), s.getBrainState(), s.getChosenMateIndex(), s.getChosenFoodBitIndex() ] );
    }
    return rows;
}

for ( let step = 1; step <= steps; step++ )
{
    a.genePool.update();
    b.genePool.update();

    const sa = snapshot( a ), sb = snapshot( b );
    const ja = JSON.stringify( sa ), jb = JSON.stringify( sb );
    if ( ja !== jb )
    {
        console.log( `first difference at step ${step}: alive ${sa.length} vs ${sb.length}` );
        const n = Math.max( sa.length, sb.length );
        let shown = 0;
        for ( let i = 0; i < n && shown < 8; i++ )
        {
            if ( JSON.stringify( sa[i] ) !== JSON.stringify( sb[i] ) )
            {
                console.log( "  other:", JSON.stringify( sa[i] ) );
                console.log( "  this :", JSON.stringify( sb[i] ) );
                shown ++;
            }
        }
        process.exit( 1 );
    }
    if ( step % 500 === 0 ) console.log( `step ${step}: identical (${sa.length} alive)` );
}
console.log( `identical for all ${steps} steps` );
