// Paired phenotype check for the opt-in GP6-inspired iterative growth mode.
// The same generated chromosomes go through control and experiment; topology,
// valid ranges and geometric changes are checked without running a world.
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
const PASSES  = parseInt( arg( "passes", "16" ), 10 );
const SEED    = parseInt( arg( "seed", "731" ), 10 );
const OUT     = arg( "out", null );

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

const controlRun = createSimulation( 1, { ITERATIVE_GROWTH_ENABLED: false } );
const growthRun  = createSimulation( 1, { ITERATIVE_GROWTH_ENABLED: true, ITERATIVE_GROWTH_PASSES: PASSES } );
const random = makeRandom( SEED );
const chromosomes = Array.from({ length: SAMPLES }, () => Array.from({ length: 256 }, () => Math.floor( random() * 256 )));

function grow( run, genes )
{
    const genotype = new run.sandbox.Genotype();
    genotype.setGenes( genes );
    const embryology = new run.sandbox.Embryology();
    return { phenotype: embryology.generatePhenotypeFromGenotype( genotype ), genesUsed: embryology.getNumGenesUsed() };
}

function measure( phenotype )
{
    let length = 0, mass = 0, boundary = 0, colorSquare = 0;
    const categories = new Set();
    const topology = [];
    for ( let p = 1; p < phenotype.numParts; p++ )
    {
        const part = phenotype.parts[p];
        if ( ![ part.width, part.length, part.red, part.green, part.blue ].every( Number.isFinite )) throw new Error( "non-finite phenotype" );
        if ( part.width < 0.5 || part.width > 7 || part.length < 3 || part.length > 27 ) throw new Error( "size outside valid range" );
        if ( part.red < 0 || part.red > 1 || part.green < 0 || part.green > 1 || part.blue < 0 || part.blue > 1 ) throw new Error( "color outside valid range" );
        length += part.length;
        mass += part.length * part.width;
        if ( part.width === 0.5 || part.width === 7 || part.length === 3 || part.length === 27 ) boundary ++;
        colorSquare += ( part.red - part.green ) ** 2 + ( part.green - part.blue ) ** 2 + ( part.blue - part.red ) ** 2;
        categories.add( part.category );
        topology.push([ part.parent, part.branch, part.amp, part.phase ]);
    }
    return { length, mass, meanWidth: mass / length, boundary, categories: categories.size,
             colorSpread: colorSquare / Math.max( 1, phenotype.numParts - 1 ), topology };
}

const mean = values => values.reduce(( a, b ) => a + b, 0 ) / Math.max( 1, values.length );
const rows = { control: [], growth: [] };
let changedBodies = 0, sameTopology = true, controlGenesUsed = 0, growthGenesUsed = 0;
for ( const genes of chromosomes )
{
    const a = grow( controlRun, genes ), b = grow( growthRun, genes );
    controlGenesUsed = a.genesUsed; growthGenesUsed = b.genesUsed;
    const ma = measure( a.phenotype ), mb = measure( b.phenotype );
    rows.control.push( ma ); rows.growth.push( mb );
    if ( JSON.stringify( ma.topology ) !== JSON.stringify( mb.topology )) sameTopology = false;
    let changed = false;
    for ( let p = 1; p < a.phenotype.numParts; p++ )
    {
        const x = a.phenotype.parts[p], y = b.phenotype.parts[p];
        if ([ "width", "length", "red", "green", "blue", "category" ].some( key => x[key] !== y[key] )) { changed = true; break; }
    }
    if ( changed ) changedBodies ++;
}
if ( !sameTopology ) throw new Error( "iterative growth changed topology" );

const summarize = list => ({
    meanLength: mean( list.map( x => x.length )),
    meanMass: mean( list.map( x => x.mass )),
    meanWidth: mean( list.map( x => x.meanWidth )),
    meanCategories: mean( list.map( x => x.categories )),
    meanColorSpread: mean( list.map( x => x.colorSpread )),
    boundaryPartShare: mean( list.map( x => x.boundary )) / mean( rows.control.map( x => x.topology.length )),
});
function founderGrowthGeneStats( run )
{
    let nonzero = 0;
    for ( const bot of run.genePool.getSwimbots() )
    {
        if ( !bot.getAlive() ) continue;
        const genes = run.genePool.getSwimbotGenes( bot.getIndex() );
        for ( let g = 171; g <= 183; g++ ) if ( genes[g] !== 0 ) nonzero ++;
    }
    return nonzero;
}
const controlFounderNonzero = founderGrowthGeneStats( controlRun );
const growthFounderNonzero = founderGrowthGeneStats( growthRun );
if ( controlFounderNonzero !== 0 || growthFounderNonzero === 0 ) throw new Error( "growth genes were not initialized as intended" );

const result = {
    samples: SAMPLES, seed: SEED, passes: PASSES, controlGenesUsed, growthGenesUsed,
    controlFounderNonzero, growthFounderNonzero,
    sameTopology, changedBodyShare: changedBodies / SAMPLES,
    control: summarize( rows.control ), growth: summarize( rows.growth ),
    lengthRatio: mean( rows.growth.map( x => x.length )) / mean( rows.control.map( x => x.length )),
    massRatio: mean( rows.growth.map( x => x.mass )) / mean( rows.control.map( x => x.mass )),
};
const text = JSON.stringify( result, null, 2 ) + "\n";
process.stdout.write( text );
if ( OUT ) { fs.mkdirSync( path.dirname( OUT ), { recursive: true }); fs.writeFileSync( OUT, text ); }
