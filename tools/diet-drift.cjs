//------------------------------------------------------------------------------
// Do herbivores drift into predators? Every 2000 steps: predators, herbivores,
// herbivores' predator level (mean, share above 0.4 / 0.5 = close to the 0.6
// threshold), newborn predators (age < 2000) and how many of those have a
// herbivore-like ... (their level just above the threshold, < 0.7).
//   node tools/diet-drift.cjs [steps] [seed] [--set "NAME=value,..."]
//------------------------------------------------------------------------------
const { createSimulation } = require( "./headless.cjs" );
const steps = parseInt( process.argv[2] || "40000", 10 );
const seed  = parseInt( process.argv[3] || "1", 10 );
const i = process.argv.indexOf( "--set" );
const overrides = { WORLD_SCALE: 1 };
if ( i > 0 ) for ( const kv of process.argv[ i + 1 ].split( "," )) { const [ k, v ] = kv.split( "=" ); overrides[ k ] = v; }
const run = createSimulation( seed, overrides );
const T = run.sandbox.PREDATOR_LEVEL_THRESHOLD;
console.log( "step,alive,predators,herb_level_mean,herb_above_0.4,herb_above_0.5,young_predators,young_pred_level_below_0.7" );
for ( let step = 1; step <= steps; step++ )
{
    run.genePool.update();
    if ( step % 2000 ) continue;
    const alive = run.genePool.getSwimbots().filter( b => b.getAlive() );
    const herb = alive.filter( b => b.getPredatorLevel() <= T ), pred = alive.filter( b => b.getPredatorLevel() > T );
    const lv = herb.map( b => b.getPredatorLevel() );
    const young = pred.filter( b => b.getAge() < 2000 );
    console.log( [ step, alive.length, pred.length, ( lv.reduce( ( a, b ) => a + b, 0 ) / Math.max( 1, lv.length )).toFixed( 3 ),
        ( lv.filter( x => x > 0.4 ).length / Math.max( 1, lv.length )).toFixed( 3 ), ( lv.filter( x => x > 0.5 ).length / Math.max( 1, lv.length )).toFixed( 3 ),
        young.length, young.filter( b => b.getPredatorLevel() < 0.7 ).length ].join( "," ));
}
