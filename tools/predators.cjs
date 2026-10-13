//------------------------------------------------------------------------------
// Why do predators die out? Runs the environment pool, introduces predators
// early, and every --every steps reports for predators:
//   alive, mean energy, births (newborns that are predators), deaths by
//   starvation / old age / other, and how many prey they ate.
//
//   node tools/predators.cjs --seed 1 --steps 20000 --every 1000 [--set "NAME=value,..."]
//------------------------------------------------------------------------------
const { createSimulation } = require( "./headless.cjs" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

const SEED  = parseInt( arg( "seed", "1" ), 10 );
const STEPS = parseInt( arg( "steps", "20000" ), 10 );
const EVERY = parseInt( arg( "every", "1000" ), 10 );
const EXTRA = arg( "set", null );

const overrides = { PREDATOR_INTRODUCTION_STEP: "2000" };
if ( EXTRA ) for ( const kv of EXTRA.split( "," ) ) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }

const run = createSimulation( SEED, overrides );
const THRESHOLD = run.sandbox.PREDATOR_LEVEL_THRESHOLD;
const bots = run.genePool.getSwimbots();

let births = 0, starved = 0, old = 0, other = 0, mixedBirths = 0;
for ( const b of bots )
{
    const die = b.die, create = b.create;
    b.die = function()
    {
        if ( b.getAlive() && b.getPredatorLevel() > THRESHOLD )
        {
            if      ( b.getEnergy() <= 0 )             starved ++;
            else if ( b.getAge() > b.getMaxAge() )      old ++;
            else                                        other ++;
        }
        return die.apply( this, arguments );
    };
    b.create = function( index, age )
    {
        const result = create.apply( this, arguments );
        if ( age === 0 && b.getPredatorLevel() > THRESHOLD ) births ++;
        return result;
    };
}

console.log( "step,alive,predators,pred_energy,pred_prey_eaten,births,starved,old,other,herb_energy" );
let lastEaten = 0;
for ( let step = 1; step <= STEPS; step++ )
{
    run.genePool.update();
    if ( step % EVERY === 0 )
    {
        let n = 0, p = 0, pe = 0, he = 0, eaten = 0;
        for ( const b of bots )
        {
            if ( !b.getAlive() ) continue;
            n ++;
            if ( b.getPredatorLevel() > THRESHOLD ) { p ++; pe += b.getEnergy(); eaten += b.getNumPreyEaten(); }
            else he += b.getEnergy();
        }
        console.log( [ step, n, p, p ? ( pe / p ).toFixed( 1 ) : 0, eaten, births, starved, old, other, ( he / Math.max( 1, n - p )).toFixed( 1 ) ].join( "," ));
        births = starved = old = other = 0;
    }
}
