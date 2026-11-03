// Paired checks for the five opt-in GP6-inspired mechanics.
// The same chromosomes go through control, each body mechanic and their union.
// A short world run separately checks energy recycling and the combined mode.
"use strict";
const fs = require( "fs" );
const path = require( "path" );
const { createSimulation } = require( "./headless.cjs" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return i >= 0 ? process.argv[ i + 1 ] : fallback;
}
const SAMPLES = parseInt( arg( "samples", "1000" ), 10 );
const STEPS = parseInt( arg( "steps", "1000" ), 10 );
const SEED = parseInt( arg( "seed", "731" ), 10 );
const OUT = arg( "out", null );

function makeRandom( seed )
{
    let a = seed >>> 0;
    return function()
    {
        a = ( a + 0x6D2B79F5 ) >>> 0;
        let t = a;
        t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
        t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
        return (( t ^ ( t >>> 14 )) >>> 0 ) / 4294967296;
    };
}

const bodyFlags = {
    SECONDARY_BRANCHING_ENABLED: "true",
    SEGMENT_REPLICATION_ENABLED: "true",
    GROWTH_TURN_ENABLED: "true",
    BRANCH_AMP_FLIP_ENABLED: "true",
};
const configs = {
    control: {},
    secondary: { SECONDARY_BRANCHING_ENABLED: "true" },
    replication: { SEGMENT_REPLICATION_ENABLED: "true" },
    growth: { GROWTH_TURN_ENABLED: "true" },
    mirror: { BRANCH_AMP_FLIP_ENABLED: "true" },
    allMorphology: bodyFlags,
};
const runs = {};
for ( const [ name, set ] of Object.entries( configs ))
{
    runs[name] = createSimulation( 1, { ...set, DEFAULT_WORLD_SCALE: "1" } );
}
const random = makeRandom( SEED );
const chromosomes = Array.from({ length: SAMPLES }, () => Array.from({ length: 256 }, () => Math.floor( random() * 256 )));

function grow( run, genes )
{
    const genotype = new run.sandbox.Genotype();
    genotype.setGenes( genes );
    return new run.sandbox.Embryology().generatePhenotypeFromGenotype( genotype );
}
const partKeys = [ "parent", "branch", "category", "width", "length", "red", "green", "blue", "angle", "amp", "phase", "turnAmp", "turnPhase" ];
function signature( phenotype )
{
    const rows = [];
    for ( let p = 1; p < phenotype.numParts; p++ )
    {
        const part = phenotype.parts[p];
        rows.push( partKeys.map( key => part[key] ) );
    }
    return JSON.stringify( rows );
}
function measure( phenotype )
{
    let length = 0, mass = 0, colorSquare = 0, curvature = 0, continuations = 0, repeated = 0, secondary = 0;
    const depth = [ 0 ];
    for ( let p = 1; p < phenotype.numParts; p++ )
    {
        const part = phenotype.parts[p];
        if ( part.parent < 0 || part.parent >= p ) throw new Error( "invalid parent link" );
        depth[p] = part.branch ? depth[part.parent] + 1 : depth[part.parent];
        if ( depth[p] >= 2 && part.branch ) secondary ++;
        if ( ![ part.width, part.length, part.red, part.green, part.blue, part.angle, part.amp, part.phase ].every( Number.isFinite )) throw new Error( "non-finite phenotype" );
        if ( part.width < 0.5 || part.width > 7 || part.length < 3 || part.length > 27 ) throw new Error( "size outside valid range" );
        if ( part.red < 0 || part.red > 1 || part.green < 0 || part.green > 1 || part.blue < 0 || part.blue > 1 ) throw new Error( "color outside valid range" );
        length += part.length;
        mass += part.length * part.width;
        colorSquare += ( part.red - part.green ) ** 2 + ( part.green - part.blue ) ** 2 + ( part.blue - part.red ) ** 2;
        if ( !part.branch ) curvature += Math.abs( part.angle );
        if ( p > 1 && !part.branch && part.category === phenotype.parts[p - 1].category )
        {
            continuations ++;
            if ( part.width === phenotype.parts[p - 1].width && part.length === phenotype.parts[p - 1].length
                && part.red === phenotype.parts[p - 1].red && part.green === phenotype.parts[p - 1].green && part.blue === phenotype.parts[p - 1].blue ) repeated ++;
        }
    }
    const n = Math.max( 1, phenotype.numParts - 1 );
    return { parts: phenotype.numParts, length, mass, meanWidth: mass / length,
        colorSpread: colorSquare / n, curvature: curvature / n,
        secondaryBranches: secondary, repeatedAdjacentShare: repeated / Math.max( 1, continuations ) };
}
const mean = values => values.reduce(( a, b ) => a + b, 0 ) / Math.max( 1, values.length );
const rows = {}, changedBodies = {}, sameTopology = {};
for ( const name of Object.keys( configs )) { rows[name] = []; changedBodies[name] = 0; sameTopology[name] = true; }
function topology( phenotype )
{
    const result = [];
    for ( let p = 1; p < phenotype.numParts; p++ ) result.push([ phenotype.parts[p].parent, phenotype.parts[p].branch ]);
    return JSON.stringify( result );
}
for ( const genes of chromosomes )
{
    const control = grow( runs.control, genes ), controlSignature = signature( control ), controlTopology = topology( control );
    rows.control.push( measure( control ));
    for ( const name of Object.keys( configs ).slice( 1 ))
    {
        const phenotype = grow( runs[name], genes );
        rows[name].push( measure( phenotype ));
        if ( signature( phenotype ) !== controlSignature ) changedBodies[name] ++;
        if ( topology( phenotype ) !== controlTopology ) sameTopology[name] = false;
    }
}
for ( const name of [ "replication", "growth", "mirror" ] )
{
    if ( !sameTopology[name] ) throw new Error( name + " unexpectedly changed topology" );
}
for ( const name of Object.keys( configs ).slice( 1 ))
{
    if ( changedBodies[name] === 0 ) throw new Error( name + " did not change any body" );
}
function summarize( list )
{
    return {
        meanParts: mean( list.map( x => x.parts )),
        meanLength: mean( list.map( x => x.length )),
        meanMass: mean( list.map( x => x.mass )),
        meanWidth: mean( list.map( x => x.meanWidth )),
        meanColorSpread: mean( list.map( x => x.colorSpread )),
        meanCurvature: mean( list.map( x => x.curvature )),
        meanSecondaryBranches: mean( list.map( x => x.secondaryBranches )),
        repeatedAdjacentShare: mean( list.map( x => x.repeatedAdjacentShare )),
    };
}
function founderNonzero( run, first, last )
{
    let nonzero = 0;
    for ( const bot of run.genePool.getSwimbots() )
    {
        if ( !bot.getAlive() ) continue;
        const genes = run.genePool.getSwimbotGenes( bot.getIndex() );
        for ( let g = first; g <= last; g++ ) if ( genes[g] !== 0 ) nonzero ++;
    }
    return nonzero;
}
const controlFounderNonzero = founderNonzero( runs.control, 184, 205 );
const experimentFounderNonzero = founderNonzero( runs.allMorphology, 184, 205 );
if ( controlFounderNonzero !== 0 || experimentFounderNonzero === 0 ) throw new Error( "new genes were not initialized as intended" );

const energySet = { NUTRIENT_CYCLE_ENABLED: "true", SWIMMING_ENERGY_RECYCLE_ENABLED: "true", DEFAULT_WORLD_SCALE: "1" };
const energyRun = createSimulation( 1, energySet );
const allFiveRun = createSimulation( 1, { ...bodyFlags, ...energySet } );
function advance( run, steps )
{
    for ( let step = 0; step < steps; step++ ) run.genePool.update();
    if ( run.alerts.length ) throw new Error( run.alerts.join( "\n" ));
    return { alive: run.genePool.getNumSwimbots(), plants: run.genePool.getNumFoodBitsOfType( 0 ) + run.genePool.getNumFoodBitsOfType( 1 ),
        counters: { nutrientsFromSwimming: run.sandbox.energyCycleCounters.nutrientsFromSwimming,
            nutrientsFromMeatDecay: run.sandbox.simCounters.nutrientsFromMeatDecay,
            nutrientLimitedPlantSeeds: run.sandbox.simCounters.nutrientLimitedPlantSeeds } };
}
for ( let step = 0; step < STEPS; step++ ) runs.control.genePool.update();
const energyControl = { alive: runs.control.genePool.getNumSwimbots(), nutrientsFromSwimming: runs.control.sandbox.energyCycleCounters.nutrientsFromSwimming };
const energyOnly = advance( energyRun, STEPS );
const allFive = advance( allFiveRun, STEPS );
if ( energyControl.nutrientsFromSwimming !== 0 || energyOnly.counters.nutrientsFromSwimming <= 0 || allFive.counters.nutrientsFromSwimming <= 0 )
{
    throw new Error( "swimming energy recycling did not activate as intended" );
}
if ( energyOnly.alive <= 0 || allFive.alive <= 0 ) throw new Error( "short world run collapsed" );

const result = {
    samples: SAMPLES, seed: SEED, worldSteps: STEPS,
    controlFounderNonzero, experimentFounderNonzero,
    changedBodyShare: Object.fromEntries( Object.keys( configs ).slice( 1 ).map( name => [ name, changedBodies[name] / SAMPLES ] )),
    sameTopology,
    phenotypes: Object.fromEntries( Object.keys( configs ).map( name => [ name, summarize( rows[name] ) ] )),
    energyControl, energyOnly, allFive,
};
const text = JSON.stringify( result, null, 2 ) + "\n";
process.stdout.write( text );
if ( OUT ) { fs.mkdirSync( path.dirname( OUT ), { recursive: true }); fs.writeFileSync( OUT, text ); }
