//------------------------------------------------------------------------------
// Why do swimbots starve among plants? After --steps steps, for every living
// herbivore: distance to the nearest plant, whether it is within its view,
// its brain state, energy vs hunger threshold, and the temperature fit
// where it is and where the nearest plant is.
//
//   node tools/forage-check.cjs --seed 1 --steps 6000
//------------------------------------------------------------------------------
"use strict";
const { createSimulation } = require( "./headless.cjs" );
function arg( name, fallback ) { const i = process.argv.indexOf( "--" + name ); return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback; }
const SEED = parseInt( arg( "seed", "1" ), 10 ), STEPS = parseInt( arg( "steps", "6000" ), 10 );

const run = createSimulation( SEED, {} );
const sb = run.sandbox, gp = run.genePool;
for ( let i = 0; i < STEPS; i++ ) gp.update();

const st = sb.sharedState();
const plants = [];
for ( let f = 0; f < sb.MAX_FOODBITS; f++ ) if ( st.liveFood[f] === 1 && st.foodType[f] !== 2 ) plants.push( [ st.foodX[f], st.foodY[f] ] );

const STATES = [ "resting", "looking for mate", "pursuing mate", "looking for food", "pursuing food", "looking for prey", "pursuing prey", "fleeing", "self feed" ];
const byState = {};
let n = 0, hungry = 0, seeing = 0, hungrySeeing = 0;
const dists = [], fitHere = [], fitAtPlant = [];
for ( const b of gp.getSwimbots() )
{
    if ( !b.getAlive() || b.getPredatorLevel() > sb.PREDATOR_LEVEL_THRESHOLD ) continue;
    n ++;
    const p = b.getPosition(), mouth = b.getMouthPosition();
    let best = Infinity, bx = 0, by = 0;
    for ( const [ x, y ] of plants ) { const d = Math.hypot( x - mouth.x, y - mouth.y ); if ( d < best ) { best = d; bx = x; by = y; } }
    dists.push( best );
    const isHungry = b.getEnergy() < b.getHungerThreshold();
    if ( isHungry ) hungry ++;
    if ( best < sb.SWIMBOT_VIEW_RADIUS ) { seeing ++; if ( isHungry ) hungrySeeing ++; }
    const state = STATES[ b.getBrainState() ] || String( b.getBrainState() );
    byState[ state ] = ( byState[ state ] || 0 ) + 1;
    const env = gp.getEnvironment();
    fitHere.push( sb.thermalFit( env.temperatureAt( p.x, p.y ), b.getThermalOptimum(), b.getThermalWidth() ));
    fitAtPlant.push( sb.thermalFit( env.temperatureAt( bx, by ), b.getThermalOptimum(), b.getThermalWidth() ));
}
dists.sort( ( a, b ) => a - b );
const q = p => dists[ Math.floor( p * dists.length ) ].toFixed( 0 );
const mean = a => ( a.reduce( ( s, x ) => s + x, 0 ) / a.length ).toFixed( 2 );
console.log( JSON.stringify({ seed: SEED, step: gp.getTimeStep(), herbivores: n, plants: plants.length,
    nearestPlantDistance_p10_p50_p90: [ q( 0.1 ), q( 0.5 ), q( 0.9 ) ], plantWithinView_percent: ( 100 * seeing / n ).toFixed( 0 ),
    hungry_percent: ( 100 * hungry / n ).toFixed( 0 ), hungryAndPlantInView_percent: ( 100 * hungrySeeing / n ).toFixed( 0 ),
    brainStates: byState, meanThermalFitHere: mean( fitHere ), meanThermalFitAtNearestPlant: mean( fitAtPlant ) }, null, 1 ));
