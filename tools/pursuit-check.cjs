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
const switches = [];
const mealEnergy = [];
const claimants = [];   // for each targeted plant at a sample: how many herbivores target it
const meals = new Array( N ).fill( 0 );
for ( let s = 0; s < N; s++ )
{
    const real = bots[s].eatChosenFoodBit.bind( bots[s] );
    bots[s].eatChosenFoodBit = function() { const before = bots[s].getEnergy(); meals[s] ++; const r = real(); mealEnergy.push( bots[s].getEnergy() - before ); return r; };
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

    if ( step % 10 === 0 )
    {
        const count = new Map();
        for ( let s = 0; s < N; s++ )
        {
            if ( !bots[s].getAlive() || bots[s].getPredatorLevel() > sb.PREDATOR_LEVEL_THRESHOLD ) continue;
            const t = M[ s * MS + sb.M_FOOD ];
            if ( M[ s * MS + sb.M_STATE ] === PURSUING_FOOD && t >= 0 ) count.set( t, ( count.get( t ) || 0 ) + 1 );
        }
        for ( const c of count.values()) claimants.push( c );
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
            if ( finishedBy === "changed target" && switches.length < 20000 )
            {
                const od = Math.hypot( st.foodX[ e.target ] - mx, st.foodY[ e.target ] - my );
                const nd = target >= 0 ? Math.hypot( st.foodX[ target ] - mx, st.foodY[ target ] - my ) : -1;
                switches.push({ od, nd, persist: M[ m + sb.M_PERSIST ], ready: M[ m + sb.M_READY ], sensing: st.sensing[s], seen: st.seenFood[s], newTarget: target });
            }
            if ( finishedBy )
            {
                e.end = finishedBy; e.steps = now - e.start; e.x1 = B[ k + sb.B_POS_X ]; e.y1 = B[ k + sb.B_POS_Y ]; ended.push( e ); open[s] = null;
            }
            else
            {
                const d = Math.hypot( st.foodX[ e.target ] - mx, st.foodY[ e.target ] - my );
                if ( d < e.closest ) e.closest = d;
                // steering: angle between the body's motion and the way to the target
                const vx = B[ k + sb.B_VEL_X ], vy = B[ k + sb.B_VEL_Y ], speed = Math.hypot( vx, vy );
                if ( speed > 0.02 )
                {
                    const tx = st.foodX[ e.target ] - B[ k + sb.B_POS_X ], ty = st.foodY[ e.target ] - B[ k + sb.B_POS_Y ], tl = Math.hypot( tx, ty );
                    if ( tl > 1 ) { e.angleSum += Math.acos( Math.max( -1, Math.min( 1, ( vx * tx + vy * ty ) / ( speed * tl )))) * 180 / Math.PI; e.angleN ++; }
                }
                e.pathLength += speed;
                if ( d > e.lastD ) { e.growing ++; } e.lastD = d;
            }
        }
        if ( !open[s] && state === PURSUING_FOOD && target >= 0 )
        {
            const d = Math.hypot( st.foodX[ target ] - mx, st.foodY[ target ] - my );
            open[s] = { s, start: now, target, startDistance: d, closest: d, meals: meals[s], mass: b.getPhenotypeMass(), parts: b.getNumParts(),
                        angleSum: 0, angleN: 0, pathLength: 0, growing: 0, lastD: d,
                        x0: B[ k + sb.B_POS_X ], y0: B[ k + sb.B_POS_Y ], tx0: st.foodX[ target ], ty0: st.foodY[ target ] };
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
const ratios = switches.filter( w => w.nd >= 0 ).map( w => w.nd / Math.max( 1, w.od )).sort( ( a, b ) => a - b );
console.log( "SWITCHES", switches.length, "new/old distance p10 p50 p90:", ratios.length ? [ 0.1, 0.5, 0.9 ].map( p => ratios[ Math.floor( p * ratios.length ) ].toFixed( 2 )).join( " " ) : "-",
             "old dist p50:", switches.map( w => w.od ).sort( ( a, b ) => a - b )[ Math.floor( switches.length / 2 ) ]?.toFixed( 0 ),
             "new target -1:", switches.filter( w => w.newTarget < 0 ).length, "sample:", JSON.stringify( switches.slice( 0, 5 )));
const qq = ( a, p ) => { const b = a.slice().sort( ( x, y ) => x - y ); return b.length ? b[ Math.floor( p * b.length ) ].toFixed( 1 ) : "-"; };
const chasers = claimants.reduce( ( s, c ) => s + c, 0 );
console.log( "CROWD targeted plants sampled", claimants.length, "chasers per plant p50/p90/max", qq( claimants, 0.5 ), qq( claimants, 0.9 ), Math.max( ...claimants ),
             "share of chasers on a plant with >=3 chasers", ( 100 * claimants.filter( c => c >= 3 ).reduce( ( s, c ) => s + c, 0 ) / Math.max( 1, chasers )).toFixed( 0 ) + "%" );
console.log( "MEAL ENERGY n", mealEnergy.length, "p10/p50/p90", qq( mealEnergy, 0.1 ), qq( mealEnergy, 0.5 ), qq( mealEnergy, 0.9 ), "mean", ( mealEnergy.reduce( ( s, x ) => s + x, 0 ) / Math.max( 1, mealEnergy.length )).toFixed( 1 ));
// steering by number of parts: mean angle to the target, share of steps moving away, success
const byParts = {};
for ( const e of ended )
{
    if ( e.angleN < 5 ) continue;
    const key = e.parts <= 4 ? "2-4" : e.parts <= 6 ? "5-6" : e.parts <= 9 ? "7-9" : e.parts <= 12 ? "10-12" : "13-16";
    const g = byParts[ key ] || ( byParts[ key ] = { episodes: 0, angle: 0, away: 0, steps: 0, ate: 0 } );
    g.episodes ++; g.angle += e.angleSum / e.angleN; g.away += e.growing; g.steps += Math.max( 1, e.angleN ); if ( e.end === "ate" ) g.ate ++;
}
// net displacement over long chases (>= 100 steps) against the first direction to the target
const longOnes = ended.filter( e => e.steps >= 100 && e.x1 !== undefined );
const cosines = longOnes.map( e => { const dx = e.x1 - e.x0, dy = e.y1 - e.y0, tx = e.tx0 - e.x0, ty = e.ty0 - e.y0; const a = Math.hypot( dx, dy ), b = Math.hypot( tx, ty ); return ( a > 1 && b > 1 ) ? ( dx * tx + dy * ty ) / ( a * b ) : NaN; }).filter( Number.isFinite );
const moved = longOnes.map( e => Math.hypot( e.x1 - e.x0, e.y1 - e.y0 ) / Math.max( 1, e.steps ));
console.log( "NET long chases", longOnes.length, "mean cos(displacement, target dir)", ( cosines.reduce( ( s, x ) => s + x, 0 ) / Math.max( 1, cosines.length )).toFixed( 2 ),
             "share heading roughly toward (cos>0.7)", ( 100 * cosines.filter( c => c > 0.7 ).length / Math.max( 1, cosines.length )).toFixed( 0 ) + "%",
             "net speed per step", ( moved.reduce( ( s, x ) => s + x, 0 ) / Math.max( 1, moved.length )).toFixed( 3 ) );
const groupsNet = {};
longOnes.forEach( e => { const dx = e.x1 - e.x0, dy = e.y1 - e.y0, tx = e.tx0 - e.x0, ty = e.ty0 - e.y0; const a = Math.hypot( dx, dy ), b = Math.hypot( tx, ty ); if ( a <= 1 || b <= 1 ) return;
    const key = e.parts <= 4 ? "2-4" : e.parts <= 6 ? "5-6" : e.parts <= 9 ? "7-9" : e.parts <= 12 ? "10-12" : "13-16";
    const g = groupsNet[ key ] || ( groupsNet[ key ] = { n: 0, cos: 0, toward: 0, speed: 0 } ); const c = ( dx * tx + dy * ty ) / ( a * b ); g.n ++; g.cos += c; if ( c > 0.7 ) g.toward ++; g.speed += a / e.steps; });
for ( const [ k, g ] of Object.entries( groupsNet ).sort()) console.log( "NET parts", k.padEnd( 6 ), "chases", g.n, "mean cos", ( g.cos / g.n ).toFixed( 2 ), "toward", ( 100 * g.toward / g.n ).toFixed( 0 ) + "%", "net speed", ( g.speed / g.n ).toFixed( 3 ));
for ( const [ k, g ] of Object.entries( byParts )) console.log( "STEERING parts", k.padEnd( 6 ), "episodes", g.episodes, "mean angle to target", ( g.angle / g.episodes ).toFixed( 0 ) + "°", "steps moving away", ( 100 * g.away / g.steps ).toFixed( 0 ) + "%", "ate", ( 100 * g.ate / g.episodes ).toFixed( 1 ) + "%" );
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
