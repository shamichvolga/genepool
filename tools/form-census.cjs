//------------------------------------------------------------------------------
// Census of body forms: who lives, who dies of what, who has children, by
// body size. Runs the "random" pool (environment on, default settings) and
// writes, into the folder --out:
//
//   census.csv  every --every steps: population, predators, plants, meat,
//               mass / parts / frequency / energy / age quantiles, histograms
//   deaths.csv  one row per death: mass, parts, width, length, cause, age,
//               energy at birth and at death, food and prey energy gained,
//               energy given to children, children, meals, mean gap between
//               meals, steps since the last meal, path length, mean |spin|,
//               mean effort, predator level
//   births.csv  one row per birth: mass and parts of both parents and of
//               the child, the energy the child got
//   newborns.csv the first 1000 steps: food at birth, actual sightings and
//               pursuit, first meal, energy gained and spent, survival
//   summary.json the settings and totals
//
//   node tools/form-census.cjs --seed 1 --steps 40000 --every 1000 --out tools/results/census-1
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
const STEPS = parseInt( arg( "steps", "40000" ), 10 );
const EVERY = parseInt( arg( "every", "1000" ), 10 );
const OUT   = arg( "out", path.join( __dirname, "results", "census-" + SEED ));
const ROOT  = arg( "root", path.join( __dirname, ".." ));
const BOTS  = arg( "bots", null );
const SAMPLE = 20;   // steps between position / spin samples
const NEWBORN_STEPS = 1000;

fs.mkdirSync( OUT, { recursive: true });

// --set "NAME=value,NAME2=value": constants of the simulation for this run
const overrides = {};
for ( const kv of ( arg( "set", "" ) || "" ).split( "," ).filter( Boolean )) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }
if ( BOTS !== null ) { overrides.INITIAL_NUM_SWIMBOTS = parseInt( BOTS, 10 ); }
const run = createSimulation( SEED, overrides, ROOT );
const sb  = run.sandbox;
const gp  = run.genePool;
const st  = sb.sharedState();
const bots = gp.getSwimbots();
const STRIDE = sb.BOT_STRIDE;

// Paired mixed-world test: replace only the initial complex bodies with the
// baseline or evolved motor genomes from locomotion-evolution.cjs. Positions,
// ages, energy and all other founders stay exactly the same in both runs.
const FOUNDERS = arg( "founders", null );
const FOUNDER_MODE = arg( "founder-mode", "baseline" );
let foundersReplaced = 0;
if ( FOUNDERS !== null )
{
    const source = JSON.parse( fs.readFileSync( path.resolve( ROOT, FOUNDERS ), "utf8" ));
    const genesets = source.results.map( r => FOUNDER_MODE === "evolved" ? r.evolvedGenes : r.genes );
    if (( genesets.length === 0 ) || !genesets.every( g => Array.isArray( g ) && g.length === 256 ))
        throw new Error( "Invalid founder gene sets" );
    for ( const b of bots )
    {
        if ( !b.getAlive() || b.getNumParts() < 10 || b.getNumParts() > 16 ) continue;
        const genotype = new sb.Genotype();
        genotype.setGenes( genesets[ foundersReplaced % genesets.length ].slice() );
        b.create( b.getIndex(), b.getAge(), b.getPosition(), b.getAngle(), b.getEnergy(), genotype, new sb.Embryology() );
        foundersReplaced ++;
    }
}

//------------------------------------------------------------
// what we keep per swimbot slot (reset at birth)
//------------------------------------------------------------
const N = bots.length;
const rec = new Array( N );
function fresh( s, energyAtBirth )
{
    return { born: gp.getTimeStep(), energyAtBirth, foodGained: 0, preyGained: 0, given: 0, meals: 0, lastMeal: gp.getTimeStep(),
             gapSum: 0, gapCount: 0, path: 0, spinSum: 0, effortSum: 0, samples: 0,
             lastX: NaN, lastY: NaN, newborn: null };
}

let currentParent = -1;
const births = [ "step,parent1_mass,parent1_parts,parent2_mass,parent2_parts,child_mass,child_parts,child_energy,parent1_predator" ];
const deaths = [ "step,slot,mass,parts,length,mean_width,frequency,predator_level,cause,age,energy_at_birth,energy_at_death,food_gained,prey_gained,given_to_children,children,meals,mean_gap_between_meals,steps_since_last_meal,path,mean_speed,mean_abs_spin,mean_effort,thermal_optimum,thermal_width,hunger_threshold" ];
const newborns = [ "step,slot,mass,parts,predator_level,birth_energy,birth_nearest_food,birth_food_in_view,view_radius,observed_steps,looks,looks_with_food,seen_food_distance_mean,pursuit_steps,pursuit_distance_mean,pursuit_min_distance,first_meal_age,meals,food_gained,prey_gained,end_energy,energy_min,net_energy_spent,alive_at_end,end_age,end_reason" ];
const activeNewborns = new Set();

function bodyOf( b )
{
    const s = b.getIndex(), k = s * STRIDE;
    const mass = b.getPhenotypeMass(), length = st.bots[ k + sb.B_SUM_LENGTHS ];
    return { mass, parts: b.getNumParts(), length, width: length > 0 ? mass / length : 0, frequency: st.bots[ k + sb.B_FREQUENCY ] };
}

function csvNumber( value, digits = 2 ) { return Number.isFinite( value ) ? value.toFixed( digits ) : ""; }

function startNewborn( s, r, energy )
{
    const b = bots[s], k = s * STRIDE, m = s * sb.MIND_STRIDE;
    const mouth = b.getMouthPosition(), position = b.getPosition(), body = bodyOf( b );
    const predatorLevel = b.getPredatorLevel(), meatEater = predatorLevel > sb.PREDATOR_LEVEL_THRESHOLD;
    const viewRadius = st.mind[ m + sb.M_VIEW_RADIUS ];
    let nearest = Infinity, inView = 0;
    for ( let f = 0; f < st.liveFood.length; f++ )
    {
        if (( st.liveFood[f] !== 1 ) || (( st.foodType[f] === 2 ) !== meatEater )) continue;
        const mx = st.foodX[f] - mouth.x, my = st.foodY[f] - mouth.y;
        const mouthDistance = Math.hypot( mx, my );
        nearest = Math.min( nearest, mouthDistance );
        const bx = st.foodX[f] - position.x, by = st.foodY[f] - position.y;
        if (( mouthDistance < viewRadius ) && ( Math.hypot( bx, by ) < viewRadius )) inView ++;
    }
    r.newborn = { mass: body.mass, parts: body.parts, predatorLevel, birthEnergy: energy, nearest, inView, viewRadius, observedSteps: 0,
        looks: 0, looksWithFood: 0, seenDistanceSum: 0, pursuitSteps: 0, pursuitDistanceSum: 0,
        pursuitMinDistance: Infinity, feedingEvents: 0, firstMealAge: null, energyMin: energy, done: false };
    activeNewborns.add( s );
}

function finishNewborn( s, r, cause = "", runEnd = false )
{
    const n = r.newborn;
    if ( !n || n.done ) return;
    const b = bots[s], endEnergy = b.getEnergy(), endAge = b.getAge();
    n.observedSteps = Math.max( n.observedSteps, Math.min( NEWBORN_STEPS, endAge ));
    n.energyMin = Math.min( n.energyMin, endEnergy );
    const aliveAtEnd = ( cause === "" ) || runEnd;
    const endReason = runEnd ? "run_end" : ( aliveAtEnd ? "survived_1000" : cause );
    newborns.push( [ gp.getTimeStep(), s, n.mass.toFixed( 1 ), n.parts, n.predatorLevel.toFixed( 2 ),
        n.birthEnergy.toFixed( 2 ), csvNumber( n.nearest ), n.inView, n.viewRadius.toFixed( 1 ), n.observedSteps,
        n.looks, n.looksWithFood, csvNumber( n.looksWithFood > 0 ? n.seenDistanceSum / n.looksWithFood : NaN ),
        n.pursuitSteps, csvNumber( n.pursuitSteps > 0 ? n.pursuitDistanceSum / n.pursuitSteps : NaN ), csvNumber( n.pursuitMinDistance ),
        n.firstMealAge === null ? "" : n.firstMealAge, n.feedingEvents, r.foodGained.toFixed( 2 ), r.preyGained.toFixed( 2 ),
        endEnergy.toFixed( 2 ), n.energyMin.toFixed( 2 ), ( n.birthEnergy + r.foodGained + r.preyGained - endEnergy ).toFixed( 2 ),
        aliveAtEnd ? 1 : 0, endAge, endReason ].join( "," ));
    n.done = true;
    activeNewborns.delete( s );
}

function sampleNewborn( s, r )
{
    const n = r.newborn, b = bots[s], k = s * STRIDE, m = s * sb.MIND_STRIDE;
    if ( !n || n.done ) return;
    if ( gp.getTimeStep() === r.born ) return;
    n.observedSteps = Math.max( n.observedSteps, Math.min( NEWBORN_STEPS, b.getAge() ));
    n.energyMin = Math.min( n.energyMin, b.getEnergy() );
    const mouthX = st.bots[ k + sb.B_MOUTH_X ], mouthY = st.bots[ k + sb.B_MOUTH_Y ];
    if ( st.sensing[s] === 1 )
    {
        n.looks ++;
        const f = st.seenFood[s];
        if ( f >= 0 )
        {
            n.looksWithFood ++;
            n.seenDistanceSum += Math.hypot( st.foodX[f] - mouthX, st.foodY[f] - mouthY );
        }
    }
    const state = st.mind[ m + sb.M_STATE ], f = st.mind[ m + sb.M_FOOD ];
    const pursuing = ( state === sb.BRAIN_STATE_PURSUING_FOOD )
        || ((( state === sb.BRAIN_STATE_LOOKING_FOR_PREY ) || ( state === sb.BRAIN_STATE_PURSUING_PREY )) && ( f >= 0 ) && ( st.foodType[f] === 2 ));
    if ( pursuing && ( f >= 0 ) && ( st.mind[ m + sb.M_CANNIBAL ] !== 1 ))
    {
        const distance = Math.hypot( st.foodX[f] - mouthX, st.foodY[f] - mouthY );
        n.pursuitSteps ++;
        n.pursuitDistanceSum += distance;
        n.pursuitMinDistance = Math.min( n.pursuitMinDistance, distance );
    }
    if ( b.getAge() >= NEWBORN_STEPS ) finishNewborn( s, r );
}

// interact(s): the swimbot that may give birth now
const realInteract = gp.interact.bind( gp );
let contributors = [];   // who gave energy to the coming child (the two parents)
gp.interact = function( s ) { currentParent = s; contributors = []; realInteract( s ); currentParent = -1; };

for ( let s = 0; s < N; s++ )
{
    const b = bots[s];

    const realCreate = b.create.bind( b );
    b.create = function( index, age, position, angle, energy, genotype, embryology )
    {
        realCreate( index, age, position, angle, energy, genotype, embryology );
        rec[ index ] = fresh( index, energy );
        if ( currentParent >= 0 )
        {
            const p1 = bots[ contributors.length > 0 ? contributors[0] : currentParent ];
            const p2 = ( contributors.length > 1 ) ? bots[ contributors[1] ] : null;
            contributors = [];
            const a = bodyOf( p1 ), c = bodyOf( b ), q = p2 ? bodyOf( p2 ) : { mass: NaN, parts: NaN };
            births.push( [ gp.getTimeStep(), a.mass.toFixed( 1 ), a.parts, q.mass.toFixed( 1 ), q.parts, c.mass.toFixed( 1 ), c.parts, energy.toFixed( 1 ), p1.getPredatorLevel().toFixed( 2 ) ].join( "," ));
            startNewborn( index, rec[index], energy );
        }
    };

    const realEat = b.eatChosenFoodBit.bind( b );
    b.eatChosenFoodBit = function()
    {
        const before = b.getEnergy();
        const result = realEat();
        const gained = b.getEnergy() - before;
        const r = rec[s];
        if ( r ) { r.foodGained += gained; meal( r, gained > 0 ); }
        return result;
    };

    const realHunt = b.huntEatChosenPrey.bind( b );
    b.huntEatChosenPrey = function()
    {
        const before = b.getEnergy();
        const result = realHunt();
        const gained = b.getEnergy() - before;
        const r = rec[s];
        if ( r && gained > 0 ) { r.preyGained += gained; meal( r ); }
        return result;
    };

    const realGive = b.contributeToOffspring.bind( b );
    b.contributeToOffspring = function( ...args )
    {
        const given = realGive( ...args );
        if ( rec[s] ) { rec[s].given += given; }
        contributors.push( s );
        return given;
    };

    const realDie = b.die.bind( b );
    b.die = function( cause = "other" )
    {
        if ( b.getAlive() && rec[s] )
        {
            const r = rec[s], body = bodyOf( b ), age = b.getAge();
            finishNewborn( s, r, cause );
            deaths.push( [ gp.getTimeStep(), s, body.mass.toFixed( 1 ), body.parts, body.length.toFixed( 1 ), body.width.toFixed( 2 ), body.frequency.toFixed( 3 ),
                           b.getPredatorLevel().toFixed( 2 ), cause, age, r.energyAtBirth.toFixed( 1 ), b.getEnergy().toFixed( 1 ),
                           r.foodGained.toFixed( 1 ), r.preyGained.toFixed( 1 ), r.given.toFixed( 1 ), b.getNumOffspring(), r.meals,
                           r.gapCount > 0 ? ( r.gapSum / r.gapCount ).toFixed( 0 ) : "", gp.getTimeStep() - r.lastMeal,
                           r.path.toFixed( 0 ), age > 0 ? ( r.path / age ).toFixed( 3 ) : "", r.samples > 0 ? ( r.spinSum / r.samples ).toFixed( 4 ) : "",
                           r.samples > 0 ? ( r.effortSum / r.samples ).toFixed( 3 ) : "",
                           b.getThermalOptimum().toFixed( 2 ), b.getThermalWidth().toFixed( 2 ), b.getHungerThreshold().toFixed( 1 ) ].join( "," ));
            rec[s] = null;
        }
        realDie( cause );
    };
}

function meal( r, feeding = true )
{
    const now = gp.getTimeStep();
    if ( r.newborn && feeding )
    {
        r.newborn.feedingEvents ++;
        if ( r.newborn.firstMealAge === null ) r.newborn.firstMealAge = now - r.born;
    }
    if ( r.meals > 0 ) { r.gapSum += now - r.lastMeal; r.gapCount ++; }
    r.meals ++;
    r.lastMeal = now;
}

// the swimbots that exist at the start
for ( let s = 0; s < N; s++ ) { if ( bots[s].getAlive() ) rec[s] = fresh( s, bots[s].getEnergy() ); }

//------------------------------------------------------------
// census
//------------------------------------------------------------
const quantiles = ( a, qs ) => { if ( a.length === 0 ) return qs.map( () => "" ); const b = a.slice().sort( ( x, y ) => x - y ); return qs.map( q => b[ Math.min( b.length - 1, Math.floor( q * b.length )) ].toFixed( 2 )); };
const MASS_BINS  = [ 0, 100, 200, 300, 400, 600, 800, 1000, 1500, 99999 ];
const census = [ "step,alive,predators,plants,meat,mass_p10,mass_p50,mass_p90,parts_p10,parts_p50,parts_p90,freq_p50,energy_p50,age_p50,"
               + MASS_BINS.slice( 0, -1 ).map( ( m, i ) => "mass_" + m + "_" + MASS_BINS[ i + 1 ] ).join( "," ) + ","
               + Array.from({ length: 15 }, ( _, i ) => "parts_" + ( i + 2 )).join( "," ) ];

function takeCensus()
{
    const mass = [], parts = [], freq = [], energy = [], age = [];
    let predators = 0;
    const massHist = new Array( MASS_BINS.length - 1 ).fill( 0 ), partsHist = new Array( 15 ).fill( 0 );
    for ( const b of bots )
    {
        if ( !b.getAlive() ) continue;
        const body = bodyOf( b );
        mass.push( body.mass ); parts.push( body.parts ); freq.push( body.frequency ); energy.push( b.getEnergy() ); age.push( b.getAge() );
        if ( b.getPredatorLevel() > sb.PREDATOR_LEVEL_THRESHOLD ) predators ++;
        for ( let i = 0; i < massHist.length; i++ ) if ( body.mass >= MASS_BINS[i] && body.mass < MASS_BINS[ i + 1 ] ) massHist[i] ++;
        if ( body.parts >= 2 && body.parts <= 16 ) partsHist[ body.parts - 2 ] ++;
    }
    census.push( [ gp.getTimeStep(), mass.length, predators, gp.getNumFoodBitsOfType( 0 ) + gp.getNumFoodBitsOfType( 1 ), gp.getNumFoodBitsOfType( 2 ),
                   ...quantiles( mass, [ 0.1, 0.5, 0.9 ] ), ...quantiles( parts, [ 0.1, 0.5, 0.9 ] ), ...quantiles( freq, [ 0.5 ] ),
                   ...quantiles( energy, [ 0.5 ] ), ...quantiles( age, [ 0.5 ] ), ...massHist, ...partsHist ].join( "," ));
}

function save()
{
    fs.writeFileSync( path.join( OUT, "census.csv" ), census.join( "\n" ) + "\n" );
    fs.writeFileSync( path.join( OUT, "deaths.csv" ), deaths.join( "\n" ) + "\n" );
    fs.writeFileSync( path.join( OUT, "births.csv" ), births.join( "\n" ) + "\n" );
    fs.writeFileSync( path.join( OUT, "newborns.csv" ), newborns.join( "\n" ) + "\n" );
    fs.writeFileSync( path.join( OUT, "summary.json" ), JSON.stringify({ seed: SEED, stepsDone: gp.getTimeStep(), stepsAsked: STEPS, deaths: deaths.length - 1, births: births.length - 1,
        newbornSteps: NEWBORN_STEPS, newbornsFinished: newborns.length - 1, newbornsActive: activeNewborns.size,
        founderSource: FOUNDERS, founderMode: FOUNDER_MODE, foundersReplaced,
        counters: { ...Object.fromEntries( Object.entries( sb.simCounters ).filter( ([ k, v ]) => typeof v === "number" )),
            nutrientsFromSwimming: sb.energyCycleCounters ? sb.energyCycleCounters.nutrientsFromSwimming : 0 },
        secondsSoFar: ( Date.now() - t0 ) / 1000 }, null, 2 ));
}

const t0 = Date.now();
takeCensus();
for ( let step = 1; step <= STEPS; step++ )
{
    gp.update();
    for ( const s of activeNewborns ) { sampleNewborn( s, rec[s] ); }

    if ( step % SAMPLE === 0 )
    {
        for ( let s = 0; s < N; s++ )
        {
            const r = rec[s];
            if ( !r || !bots[s].getAlive() ) continue;
            const k = s * STRIDE, x = st.bots[ k + sb.B_POS_X ], y = st.bots[ k + sb.B_POS_Y ];
            if ( !Number.isNaN( r.lastX )) r.path += Math.hypot( x - r.lastX, y - r.lastY );
            r.lastX = x; r.lastY = y;
            r.spinSum   += Math.abs( st.bots[ k + sb.B_SPIN ] );
            r.effortSum += st.bots[ k + sb.B_EFFORT ];
            r.samples ++;
        }
    }
    if ( step % EVERY === 0 )
    {
        takeCensus();
        save();
        console.log( `seed ${ SEED } step ${ step } alive ${ gp.getNumSwimbots() } deaths ${ deaths.length - 1 } births ${ births.length - 1 } ${ (( Date.now() - t0 ) / 1000 ).toFixed( 0 ) }s` );
    }
}
for ( const s of activeNewborns ) { finishNewborn( s, rec[s], "", true ); }
save();
console.log( "done", OUT );
