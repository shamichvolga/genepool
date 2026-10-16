//------------------------------------------------------------------------------
// Plants over time: share of sprouts / grown-up / old, how rich the standing
// plants are for an average eater, plant genes (PLANT_EVOLUTION_ENABLED).
//   node tools/plant-check.cjs --seed 4 --steps 30000 [--set NAME=value,...]
//------------------------------------------------------------------------------
"use strict";
const { createSimulation } = require( "./headless.cjs" );
const arg = ( n, d ) => { const i = process.argv.indexOf( "--" + n ); return i >= 0 ? process.argv[ i + 1 ] : d; };
const overrides = {};
for ( const kv of ( arg( "set", "" ) || "" ).split( "," ).filter( x => x )) { const [ k, v ] = kv.split( "=" ); overrides[k] = v === "true" ? true : v === "false" ? false : +v; }
const STEPS = +arg( "steps", 30000 ), EVERY = +arg( "every", 5000 );
const run = createSimulation( +arg( "seed", 4 ), overrides ); const gp = run.genePool, sb = run.sandbox;
const st = sb.sharedState();
const label = arg( "set", "default" ) || "default";
for ( let step = 1; step <= STEPS; step++ ) { gp.update();
  if ( step % EVERY ) continue;
  let n = 0, stage = [ 0, 0, 0 ], rich = 0, g = 0, s = 0;
  for ( let f = 0; f < st.liveFood.length; f++ ) {
    if ( !st.liveFood[f] || st.foodType[f] === 2 ) continue;
    const age = step - st.foodBorn[f];
    const k = sb.PLANT_STAGES_ENABLED ? sb.plantStage( f, age ) : 1;
    stage[k]++; n++;
    rich += !sb.PLANT_STAGES_ENABLED ? 1 : k === 0 ? sb.PLANT_STAGE_ENERGY[0] : k === 2 ? sb.plantOldEnergy( f ) : 1;
    g += st.plantGrowth[f]; s += st.plantSpread[f];
  }
  let alive = 0, pred = 0; for ( let b = 0; b < st.liveSwimbot.length; b++ ) if ( st.liveSwimbot[b] ) { alive++; if ( st.predator[b] > sb.PREDATOR_LEVEL_THRESHOLD ) pred++; }
  console.log( `${ label } step ${ step } swimbots ${ alive } predators ${ pred } plants ${ n } sprout/grown/old % ${ stage.map( x => ( 100 * x / Math.max( 1, n )).toFixed( 0 )).join( "/" ) } richness ${ ( rich / Math.max( 1, n )).toFixed( 2 ) } growth ${ ( g / Math.max( 1, n )).toFixed( 2 ) } spread ${ ( s / Math.max( 1, n )).toFixed( 2 ) }` );
}
