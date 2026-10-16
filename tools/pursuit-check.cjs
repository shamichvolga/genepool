//------------------------------------------------------------------------------
// Why do food chases fail? Follows every "pursuing food" episode of the
// herbivores: distance at the start, closest approach, how long, and how it
// ended (ate it / someone else ate it / changed target / changed state:
// fled, went for a mate...). Also counts how often a mouth passes within
// the eating radius of some plant while NOT chasing it (food that contact
// eating would add).
//
//   node tools/pursuit-check.cjs --seed 1 --warm 6000 --steps 4000
//------------------------------------------------------------------------------
"use strict";
const { createSimulation } = require( "./headless.cjs" );
function arg( name, fallback ) { const i = process.argv.indexOf( "--" + name ); return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback; }
const SEED = parseInt( arg( "seed", "1" ), 10 ), WARM = parseInt( arg( "warm", "6000" ), 10 ), STEPS = parseInt( arg( "steps", "4000" ), 10 );

const run = createSimulation( SEED, {} );
const sb = run.sandbox, gp = run.genePool;
for ( let i = 0; i < WARM; i++ ) gp.update();

const st = sb.sharedState(), M = st.mind, MS = sb.MIND_STRIDE, B = st.bots, BS = sb.BOT_STRIDE;
const bots = gp.getSwimbots(), N = bots.length;
const PURSUING_FOOD = sb.BRAIN_STATE_PURSUING_FOOD;
const EAT_RADIUS = sb.SWIMBOT_MOUTH_LENGTH + sb.FOOD_BIT_GRAB_RADIUS;
const STATES = [ "resting", "looking for mate", "pursuing mate", "looking for food", "pursuing food", "looking for prey", "pursuing prey", "fleeing", "self feed" ];

const open = new Array( N ).fill( null );
const ended = [];
const meals = new Array( N ).fill( 0 );
for ( let s = 0; s < N; s++ )
{
    const real = bots[s].eatChosenFoodBit.bind( bots[s] );
    bots[s].eatChosenFoodBit = function() { meals[s] ++; return real(); };
}

let contactNotChasing = 0, contactSamples = 0, herbivoreSamples = 0;
const contactByState = {};

for ( let step = 0; step < STEPS; step++ )
{
    gp.update();
    const now = gp.getTimeStep();

    // plants in a coarse hash, for "mouth touches some plant"
    const CELL = 64, hash = new Map();
    for ( let f = 0; f < sb.MAX_FOODBITS; f++ )
    {
        if ( st.liveFood[f] !== 1 || st.foodType[f] === 2 ) continue;
        const key = Math.floor( st.foodX[f] / CELL ) * 100000 + Math.floor( st.foodY[f] / CELL );
        let list = hash.get( key ); if ( !list ) hash.set( key, list = [] ); list.push( f );
    }

    for ( let s = 0; s < N; s++ )
    {
        const b = bots[s];
        if ( !b.getAlive() || b.getPredatorLevel() > sb.PREDATOR_LEVEL_THRESHOLD ) { if ( open[s] ) { open[s].end = "died"; ended.push( open[s] ); open[s] = null; } continue; }
        const m = s * MS, k = s * BS;
        const state = M[ m + sb.M_STATE ], target = M[ m + sb.M_FOOD ];
        const mx = B[ k + sb.B_MOUTH_X ], my = B[ k + sb.B_MOUTH_Y ];
        const e = open[s];

        if ( e )
        {
            const finishedBy =
                ( meals[s] > e.meals ) ? "ate" :
                ( state !== PURSUING_FOOD ) ? ( "switched to " + ( STATES[ state ] || state )) :
                ( target !== e.target ) ? (( st.liveFood[ e.target ] !== 1 ) ? "target eaten or gone" : "changed target" ) : null;
            if ( finishedBy )
            {
                e.end = finishedBy; e.steps = now - e.start; ended.push( e ); open[s] = null;
            }
            else
            {
                const d = Math.hypot( st.foodX[ e.target ] - mx, st.foodY[ e.target ] - my );
                if ( d < e.closest ) e.closest = d;
            }
        }
        if ( !open[s] && state === PURSUING_FOOD && target >= 0 )
        {
            const d = Math.hypot( st.foodX[ target ] - mx, st.foodY[ target ] - my );
            open[s] = { s, start: now, target, startDistance: d, closest: d, meals: meals[s], mass: b.getPhenotypeMass(), parts: b.getNumParts() };
        }

        // every 10 steps: does the mouth touch any plant? (while not chasing it)
        if ( step % 10 === 0 )
        {
            herbivoreSamples ++;
            const cx = Math.floor( mx / CELL ), cy = Math.floor( my / CELL );
            let touching = false;
            for ( let dx = -1; dx <= 1 && !touching; dx++ ) for ( let dy = -1; dy <= 1 && !touching; dy++ )
            {
                const list = hash.get( ( cx + dx ) * 100000 + ( cy + dy ));
                if ( list ) for ( const f of list ) { if ( Math.hypot( st.foodX[f] - mx, st.foodY[f] - my ) < EAT_RADIUS && !( state === PURSUING_FOOD && f === target )) { touching = true; break; } }
            }
            if ( touching )
            {
                contactNotChasing ++;
                const name = STATES[ state ] || String( state );
                contactByState[ name ] = ( contactByState[ name ] || 0 ) + 1;
            }
        }
    }
}

// report
const byEnd = {};
for ( const e of ended ) { byEnd[ e.end ] = ( byEnd[ e.end ] || 0 ) + 1; }
const q = ( a, p ) => { if ( !a.length ) return "–"; const b = a.slice().sort( ( x, y ) => x - y ); return b[ Math.floor( p * b.length ) ].toFixed( 0 ); };
const failed = ended.filter( e => e.end !== "ate" ), ate = ended.filter( e => e.end === "ate" );
const SIZE = [ [ 0, 300 ], [ 300, 600 ], [ 600, 900 ], [ 900, 9999 ] ];
const bySize = SIZE.map( ( [ a, b ] ) => { const g = ended.filter( e => e.mass >= a && e.mass < b ); return { mass: a + "-" + b, episodes: g.length, ate_percent: g.length ? ( 100 * g.filter( e => e.end === "ate" ).length / g.length ).toFixed( 1 ) : "–", closest_median: q( g.map( e => e.closest ), 0.5 ) }; });
console.log( JSON.stringify({
    seed: SEED, measuredSteps: STEPS, afterWarmSteps: WARM,
    episodes: ended.length, endings: byEnd,
    ate_percent: ( 100 * ate.length / Math.max( 1, ended.length )).toFixed( 1 ),
    startDistance_p50: q( ended.map( e => e.startDistance ), 0.5 ),
    closestApproach_failed_p10_p50_p90: [ q( failed.map( e => e.closest ), 0.1 ), q( failed.map( e => e.closest ), 0.5 ), q( failed.map( e => e.closest ), 0.9 ) ],
    episodeSteps_failed_p50: q( failed.map( e => e.steps ), 0.5 ), episodeSteps_ate_p50: q( ate.map( e => e.steps ), 0.5 ),
    eatRadius: EAT_RADIUS, bySize,
    mouthTouchesAPlantItIsNotChasing_percentOfSamples: ( 100 * contactNotChasing / Math.max( 1, herbivoreSamples )).toFixed( 2 ),
    thoseTouchesByState: contactByState,
}, null, 1 ));
