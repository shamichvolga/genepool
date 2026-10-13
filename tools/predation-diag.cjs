//------------------------------------------------------------------------------
// Predator / prey check: how well-fed predators are, and how prey react.
//   node tools/predation-diag.cjs [steps] [seed] [--set "NAME=value,..."]
// Small world, predators from step 1000. Every 1000 steps:
//   predators, their mean energy, share above the hunger threshold (can mate),
//   kills, mean energy gained per kill,
//   herbivores near a hunting predator (< 300) and the share of them fleeing.
//------------------------------------------------------------------------------
const { createSimulation } = require( "./headless.cjs" );
const steps = parseInt( process.argv[2] || "8000", 10 );
const seed  = parseInt( process.argv[3] || "1", 10 );
const i = process.argv.indexOf( "--set" );
const overrides = { WORLD_SCALE: 1, PREDATOR_INTRODUCTION_STEP: 1000 };
if ( i > 0 ) for ( const kv of process.argv[ i + 1 ].split( "," )) { const [ k, v ] = kv.split( "=" ); overrides[ k ] = v; }

const run = createSimulation( seed, overrides );
const sb = run.sandbox, T = sb.PREDATOR_LEVEL_THRESHOLD;
const bots = run.genePool.getSwimbots();
let kills = 0, gained = 0;
for ( const b of bots )
{
    const hunt = b.huntEatChosenPrey;
    b.huntEatChosenPrey = function()
    {
        const before = b.getEnergy(), eaten = b.getNumPreyEaten();
        const r = hunt.apply( this, arguments );
        if ( b.getNumPreyEaten() > eaten ) { kills ++; gained += b.getEnergy() - before; }
        return r;
    };
}
console.log( "step,alive,predators,pred_energy,pred_can_mate,kills,energy_per_kill,herbivores_near_hunter,share_fleeing" );
let near = 0, fleeing = 0;
for ( let step = 1; step <= steps; step++ )
{
    run.genePool.update();
    if ( step % 10 === 0 )
    {
        const hunters = bots.filter( b => b.getAlive() && b.getPredatorLevel() > T &&
            ( b.getBrainState() === sb.BRAIN_STATE_LOOKING_FOR_PREY || b.getBrainState() === sb.BRAIN_STATE_PURSUING_PREY ));
        for ( const b of bots )
        {
            if ( !b.getAlive() || b.getPredatorLevel() > T ) continue;
            const p = b.getPosition();
            if ( hunters.some( h => h.getPosition().getDistanceTo( p ) < 300 ))
            {
                near ++;
                if ( b.getBrainState() === sb.BRAIN_STATE_FLEEING_PREDATOR ) fleeing ++;
            }
        }
    }
    if ( step % 1000 === 0 )
    {
        const alive = bots.filter( b => b.getAlive() );
        const preds = alive.filter( b => b.getPredatorLevel() > T );
        const e = preds.reduce( ( a, b ) => a + b.getEnergy(), 0 ) / Math.max( 1, preds.length );
        const canMate = preds.filter( b => b.getEnergy() > b.getHungerThreshold() ).length / Math.max( 1, preds.length );
        console.log( [ step, alive.length, preds.length, e.toFixed( 1 ), canMate.toFixed( 2 ), kills, kills ? ( gained / kills ).toFixed( 1 ) : 0,
                       near, near ? ( fleeing / near ).toFixed( 2 ) : 0 ].join( "," ));
        kills = gained = near = fleeing = 0;
    }
}
