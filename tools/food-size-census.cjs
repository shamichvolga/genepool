//------------------------------------------------------------------------------
// Census for the "plant size" concept (docs/концепт_размер_пищи.md): who lives
// (bodies by number of parts), what the plants are (by size), who eats what.
// Works with PLANT_SIZE_ENABLED on and off (off: the control).
//
//   node tools/food-size-census.cjs --seed 1 --steps 100000 --every 5000 --out tools/results/fs-name [--set "NAME=value,..."]
//
// census.csv every --every steps:
//   step, alive, predators, herbivores by parts (3-5, 6-8, 9-12, 13-16),
//   effective number of forms (by parts, herbivores), share of the main form,
//   mean herbivore mass, plants by size (sprout < 0.2, young < 0.5, grown < 0.8,
//   tree), mean plant energy, meat,
//   plant energy eaten per herbivore per step, and how it is split by eater
//   size (3-5, 6-8, 9-12, 13-16 parts) and by plant size,
//   age of the plants eaten whole (p10, p50, p90),
//   currents (CURRENT_AWARENESS_ENABLED): share of swimbots in a stream, the mean
//   gene "how the stream counts" (-1..+1) in a stream and out of it, and the mean
//   weights of the brain from the current senses to steering and effort
//------------------------------------------------------------------------------
"use strict";
const fs = require( "fs" );
const path = require( "path" );
const { createSimulation } = require( "./headless.cjs" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}
const SEED  = parseInt( arg( "seed", "1" ), 10 );
const STEPS = parseInt( arg( "steps", "20000" ), 10 );
const EVERY = parseInt( arg( "every", "1000" ), 10 );
const OUT   = arg( "out", path.join( __dirname, "results", "fs-" + SEED ));
const overrides = {};
for ( const kv of ( arg( "set", "" ) || "" ).split( "," ).filter( Boolean )) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }
fs.mkdirSync( OUT, { recursive: true });

const run = createSimulation( SEED, overrides );
const sb = run.sandbox, gp = run.genePool, st = sb.sharedState();
const GROW = Number( overrides.PLANT_GROW_TIME || sb.PLANT_GROW_TIME || 3000 );
const sizeOf = ( age ) => ( age <= 0 ) ? 0 : 1 - Math.exp( -age / GROW );   // (as PlantSize.plantSize; the age scale of the control too)
const partsClass = ( n ) => n <= 5 ? 0 : n <= 8 ? 1 : n <= 12 ? 2 : 3;
const sizeClass  = ( z ) => z < 0.2 ? 0 : z < 0.5 ? 1 : z < 0.8 ? 2 : 3;

// what is eaten: by eater class x plant size class (energy), and ages of plants eaten whole
let eaten = new Float64Array( 16 ), wholeAges = [];
const bots = gp.getSwimbots();
for ( const b of bots )
{
    const original = b.eatChosenFoodBit;
    b.eatChosenFoodBit = function()
    {
        const food = b.getChosenFoodBit();
        const plant = food && food.getAlive() && food.getType() !== 2;
        const age = plant ? food.getAge() : 0, e0 = b.getEnergy();
        const result = original.call( this );
        if ( plant )
        {
            const gain = b.getEnergy() - e0;
            if ( gain > 0 ) eaten[ partsClass( b.getNumParts() ) * 4 + sizeClass( sizeOf( age )) ] += gain;
            if ( !food.getAlive() ) wholeAges.push( age );
        }
        return result;
    };
}

const header = [ "step", "alive", "predators", "herb_3_5", "herb_6_8", "herb_9_12", "herb_13_16", "eff_forms", "main_form_share", "herb_mass",
                 "plants_sprout", "plants_young", "plants_grown", "plants_tree", "plant_energy_mean", "meat", "intake_per_herb_step",
                 ...[ "3_5", "6_8", "9_12", "13_16" ].flatMap( c => [ "sprout", "young", "grown", "tree" ].map( p => "eat_" + c + "_" + p )),
                 "eaten_age_p10", "eaten_age_p50", "eaten_age_p90",
                 "in_stream_share", "current_gene_in_stream", "current_gene_out", "w_steer_side", "w_steer_ahead", "w_effort_ahead" ].join( "," );
const rows = [ header ];
console.log( "seed=" + SEED + " steps=" + STEPS + " set=" + JSON.stringify( overrides ));
console.log( header );

let herbStepSum = 0;
const t0 = Date.now();
for ( let step = 1; step <= STEPS; step++ )
{
    gp.update();
    // Use the shared typed arrays here instead of calling through every Swimbot
    // wrapper on every simulation step.  This is the same predicate as before,
    // but avoids millions of JS method calls during a long census.
    let herbivoresNow = 0;
    for ( let s = 0; s < st.liveSwimbot.length; s++ )
        if ( st.liveSwimbot[s] === 1 && st.predator[s] <= sb.PREDATOR_LEVEL_THRESHOLD ) herbivoresNow ++;
    herbStepSum += herbivoresNow;

    if ( step % EVERY !== 0 && step !== STEPS ) continue;

    let alive = 0, predators = 0, mass = 0, herb = 0;
    const byClass = [ 0, 0, 0, 0 ], byParts = new Map();
    for ( let s = 0; s < bots.length; s++ )
    {
        const b = bots[s];
        if ( st.liveSwimbot[s] !== 1 ) continue;
        alive ++;
        if ( b.getPredatorLevel() > sb.PREDATOR_LEVEL_THRESHOLD ) { predators ++; continue; }
        herb ++;
        const n = b.getNumParts();
        byClass[ partsClass( n ) ] ++;
        byParts.set( n, ( byParts.get( n ) || 0 ) + 1 );
        mass += b.getPhenotypeMass();
    }
    let shannon = 0, main = 0;
    for ( const c of byParts.values() ) { const p = c / Math.max( 1, herb ); shannon -= p * Math.log( p ); main = Math.max( main, p ); }

    const plants = [ 0, 0, 0, 0 ];
    let plantEnergy = 0, numPlants = 0, meat = 0;
    const now = gp.getTimeStep();
    for ( let f = 0; f < st.liveFood.length; f++ )
    {
        if ( st.liveFood[f] !== 1 ) continue;
        if ( st.foodType[f] === 2 ) { meat ++; continue; }
        plants[ sizeClass( sizeOf( now - st.foodBorn[f] )) ] ++;
        plantEnergy += st.foodEnergy[f]; numPlants ++;
    }
    // currents: where they live, the gene, the brain's weights on the current senses
    let inStream = 0, geneIn = 0, geneOut = 0, wSide = 0, wAhead = 0, wEffort = 0, counted = 0;
    const hasCurrentSenses = ( typeof sb.IN_CURRENT_SIDE === "number" );
    for ( let s = 0; s < st.liveSwimbot.length; s++ )
    {
        if ( st.liveSwimbot[s] !== 1 ) continue;
        counted ++;
        sb.currentAt( st.botX[s], st.botY[s] );
        const gene = st.mind[ s * sb.MIND_STRIDE + ( sb.M_CURRENT_W || 81 ) ];
        if ( sb.currentStrength() > 0.3 ) { inStream ++; geneIn += gene; } else { geneOut += gene; }
        if ( hasCurrentSenses )
        {
            const w = s * sb.BRAIN_SIZE;
            wSide   += st.brainWeights[ w + sb.OUT_STEER  * sb.NUM_INPUTS + sb.IN_CURRENT_SIDE  ];
            wAhead  += st.brainWeights[ w + sb.OUT_STEER  * sb.NUM_INPUTS + sb.IN_CURRENT_AHEAD ];
            wEffort += st.brainWeights[ w + sb.OUT_EFFORT * sb.NUM_INPUTS + sb.IN_CURRENT_AHEAD ];
        }
    }
    const currentCols = [ ( inStream / Math.max( 1, counted )).toFixed( 3 ), inStream ? ( geneIn / inStream ).toFixed( 3 ) : "",
                          ( counted - inStream ) ? ( geneOut / ( counted - inStream )).toFixed( 3 ) : "",
                          ( wSide / Math.max( 1, counted )).toFixed( 3 ), ( wAhead / Math.max( 1, counted )).toFixed( 3 ), ( wEffort / Math.max( 1, counted )).toFixed( 3 ) ];

    const totalEaten = eaten.reduce( ( a, x ) => a + x, 0 );
    wholeAges.sort( ( a, b ) => a - b );
    const q = ( p ) => wholeAges.length ? Math.round( wholeAges[ Math.min( wholeAges.length - 1, Math.floor( p * wholeAges.length )) ] ) : "";
    const row = [ step, alive, predators, ...byClass, Math.exp( shannon ).toFixed( 2 ), main.toFixed( 3 ), herb ? ( mass / herb ).toFixed( 0 ) : 0,
                  ...plants, numPlants ? ( plantEnergy / numPlants ).toFixed( 1 ) : 0, meat,
                  ( totalEaten / Math.max( 1, herbStepSum )).toFixed( 4 ),
                  ...Array.from( eaten, x => ( totalEaten > 0 ? x / totalEaten : 0 ).toFixed( 3 )),
                  q( 0.1 ), q( 0.5 ), q( 0.9 ), ...currentCols ].join( "," );
    rows.push( row );
    console.log( row + "  [" + (( Date.now() - t0 ) / 60000 ).toFixed( 1 ) + " min]" );
    fs.writeFileSync( path.join( OUT, "census.csv" ), rows.join( "\n" ) + "\n" );
    eaten = new Float64Array( 16 ); wholeAges = []; herbStepSum = 0;
    if ( alive === 0 ) { console.log( "extinct" ); break; }
}
fs.writeFileSync( path.join( OUT, "summary.json" ), JSON.stringify({ seed: SEED, steps: STEPS, set: overrides, minutes: ( Date.now() - t0 ) / 60000 }, null, 2 ));
