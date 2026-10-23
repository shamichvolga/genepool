//------------------------------------------------------------------------------
// CURRENT_AWARENESS_ENABLED check: a predator in a stream, two prey at the same
// distance, one down the stream and one up. With the gene "feel for the
// current" 0 it takes either (the nearer one); with 1 the one down the stream.
//   node tools/current-choice-check.cjs
//------------------------------------------------------------------------------
const { createSimulation } = require( "./headless.cjs" );
const run = createSimulation( 7, { INITIAL_NUM_SWIMBOTS: 20 } );
const gp = run.genePool, sb = run.sandbox, st = sb.sharedState();
const pv = gp.getMapPreview();
const W = pv.width, L = pv.left, T = pv.top;
const px = L + ( 0.30 + 0.22 ) * W, py = T + 0.32 * W;      // on ring 0: the water flows towards +y here
const D = 110;
const B = sb.BOT_STRIDE, MS = sb.MIND_STRIDE;
let currentsOn = false;

function trial( w )
{
    const seeds = [ px, py, 13,  px, py + D, 4,  px, py - D, 4 ];
    gp.startSimulationWithMap({ version: 1, base: "vanilla", environment: pv.environment, zones: [], seeds, diets: [ 2, 1, 1 ], barrier: null, partsMin: 3, partsMax: 16 });
    gp.setRendering( false );
    if ( !gp.getCurrentsOn() ) gp.toggleCurrents();
    st.bots[ 0 * B + sb.B_ENERGY ] = 15;                    // hungry: it hunts
    st.mind[ 0 * MS + sb.M_CURRENT_W ] = w;
    gp.update();                                                       // (the grids are built, the scan radius set)
    const scratch = new sb.PerceptionScratch( st.maxSwimbots, sb.MAX_FOODBITS );
    st.bots[ sb.B_VEL_X ] = 0.25; st.bots[ sb.B_VEL_Y ] = 0;               // (a usual swimming speed; the first step after the start is not)
    for ( const o of [ 1, 2 ] ) { st.brightness[o] = 0; st.age[o] = 3000; st.bots[ o * B + sb.B_AGE ] = 3000; st.energy[o] = 150; st.bots[ o * B + sb.B_ENERGY ] = 150; }   // (both well seen, young, fed: alike but for the stream)
    sb.perceive( 0, st, scratch );
    sb.__dbgKernel = false;                                     // the predator looks around once
    const prey = st.seenPrey[0];

    if ( prey === 1 ) return "down";
    if ( prey === 2 ) return "up";
    return "none";
}

for ( const w of [ 0, 1 ] )
{
    const count = { down: 0, up: 0, none: 0 };
    for ( let i = 0; i < 40; i++ ) count[ trial( w ) ] ++;
    console.log( "feel for the current " + w + ": chose the prey down the stream " + count.down + ", up the stream " + count.up + ", none " + count.none );
}
console.log( 'factor down/up at speed 0.15:', sb.currentTravelFactor( 0, 0.3, 0, D, 0.15, 1 ).toFixed( 2 ), sb.currentTravelFactor( 0, 0.3, 0, -D, 0.15, 1 ).toFixed( 2 ));
console.log( "drift at the predator:", ( sb.currentAt( px, py ), [ sb.currentDriftX().toFixed( 3 ), sb.currentDriftY().toFixed( 3 ) ] ));
