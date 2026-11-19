//--------------------------------------------------------------------------------
// Headless Gene Pool runner (Node.js) — runs the simulation without a browser,
// with a fixed random seed, and prints speed, population and diversity stats.
//
//   node tools/headless.cjs [--steps 20000] [--seed 1] [--every 1000] [--bots N]
//                          [--csv out.csv]
//
// Same seed + same code = same result, so two versions of the code can be
// compared fairly. Scripts are loaded in the same order as index.html.
//--------------------------------------------------------------------------------
"use strict";

const fs   = require( "fs" );
const path = require( "path" );
const vm   = require( "vm" );


//------------------------------------------------
// command line
//------------------------------------------------
function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

// the project to run: this one, or another copy given with --root
const ROOT = arg( "root", path.join( __dirname, ".." ) );

const STEPS = parseInt( arg( "steps", "20000" ), 10 );
const SEED  = parseInt( arg( "seed",  "1"     ), 10 );
const EVERY = parseInt( arg( "every", "1000"  ), 10 );
const BOTS  = arg( "bots", null );
const CSV   = arg( "csv",  null );

//------------------------------------------------
// seeded PRNG (mulberry32)
//------------------------------------------------
function makeRandom( seed )
{
    let a = seed >>> 0;
    return function()
    {
        a = ( a + 0x6D2B79F5 ) >>> 0;
        let t = a;
        t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
        t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
    };
}

//------------------------------------------------
// a canvas that accepts any call and does nothing
//------------------------------------------------
function makeNullCanvas()
{
    const noop = function() { return nullObject; };
    const nullObject = new Proxy( noop, { get: () => nullObject, set: () => true, apply: () => nullObject } );
    return nullObject;
}

//------------------------------------------------
// script list, read from index.html
//------------------------------------------------
function getSimulationScripts( root )
{
    const html = fs.readFileSync( path.join( root, "index.html" ), "utf8" );
    const re = /src\s*=\s*"(simulation\/[^"?]+)/g;
    const list = [];
    let m;
    while (( m = re.exec( html )) !== null ) { list.push( m[1] ); }
    return list;
}

//------------------------------------------------
// the TypeScript version (src/) is bundled in memory with esbuild;
// the old plain-script version is concatenated in index.html order
//------------------------------------------------
function isTypeScriptProject( root )
{
    return fs.existsSync( path.join( root, "src", "simulation", "GenePool.ts" ) );
}

function bundleTypeScript( root )
{
    const esbuild = require( path.join( __dirname, "..", "node_modules", "esbuild" ) );
    const dir = path.join( root, "src", "simulation" );
    const modules = fs.readdirSync( dir ).filter( f => f.endsWith( ".ts" ) ).map( f => f.slice( 0, -3 ) );
    // (and the work every thread does, see src/parallel/ParallelWork.ts)
    if ( fs.existsSync( path.join( root, "src", "parallel", "ParallelWork.ts" ))) modules.push( "../parallel/ParallelWork" );

    // put every export on the global object, like the plain-script version had them
    const imports = modules.map( ( m, i ) => `import * as m${i} from "./${m}";` );
    const assign  = `Object.assign( globalThis, ${ modules.map( ( m, i ) => "m" + i ).join( ", " ) } );`;
    const entry   = [ ...imports, assign ].join( "\n" );

    const result = esbuild.buildSync({
        stdin: { contents: entry, resolveDir: dir, sourcefile: "headless-entry.ts", loader: "ts" },
        bundle: true, write: false, format: "iife", target: "es2022", minify: false,
    });
    // Global names inside a Node "vm" sandbox go through a slow lookup on every
    // use; passing the hot ones in as parameters makes them plain local names,
    // as fast as in a browser.
    return "(function( Math, Number, Infinity ) {\n" + result.outputFiles[0].text + "\n})( Math, Number, Infinity );\n";
}

function concatenateScripts( root )
{
    let source = "";
    for ( const file of getSimulationScripts( root ) )
    {
        source += fs.readFileSync( path.join( root, file ), "utf8" ) + "\n;\n";
    }
    // gpRandom() and Math.random() both use the seeded generator
    return source + "\n;gpRandom = function() { return Math.random(); };\n";
}

//------------------------------------------------
// build the sandbox and load the simulation
//------------------------------------------------
function createSimulation( seed, overrides = {}, root = ROOT )
{
const random = makeRandom( seed );

const alerts = [];
const sandbox =
{
    console,
    performance : { now: () => 0 },          // deterministic timing inside the sim
    // the profiler's own clock (tools/profile-deep.cjs): real, high resolution,
    // and never used for anything the simulation decides
    __profNow   : () => Number( process.hrtime.bigint() ) / 1e6,
    Date        : Date,
    setTimeout  : () => 0,                   // the sim schedules itself; we drive it by hand
    clearTimeout: () => {},
    alert       : ( m ) => { alerts.push( String( m ) ); },
    canvas      : makeNullCanvas(),
    document    : makeNullCanvas(),
    window      : {},
};
sandbox.window = sandbox;
vm.createContext( sandbox );

// seeded Math.random() inside the sandbox. The sandbox keeps its own built-in
// Math object (replacing the whole object would stop the JavaScript engine from
// treating Math.sin, Math.sqrt... as fast built-ins and slow everything down).
sandbox.__seededRandom = random;
vm.runInContext( "Math.random = __seededRandom;", sandbox );

let source = isTypeScriptProject( root ) ? bundleTypeScript( root ) : concatenateScripts( root );

// optional: override constants, e.g. { INITIAL_NUM_SWIMBOTS: 500 }
for ( const name in overrides )
{
    const pattern = new RegExp( "((?:const|let|var) " + name + "\\s*=\\s*)[^;,]+" );
    if ( !pattern.test( source ) ) throw new Error( "cannot override " + name + ": not found" );
    source = source.replace( pattern, "$1" + overrides[ name ] );
}

vm.runInContext( source, sandbox, { filename: "genepool-bundle.js" } );
// the simulation has its own random numbers now (Globals.ts gpRandom): the same
// generator and seed as before, so runs with the same --seed do not change
if ( typeof sandbox.setRandomSeed === "function" ) { sandbox.setRandomSeed( seed ); }

//------------------------------------------------
// genetic clustering on used genes (not a biological species estimate)
//------------------------------------------------
const run = vm.runInContext( `
(function()
{
    const GENETIC_CLUSTER_DISTANCE = 0.12;  // mean used-gene difference
    const MIN_GENETIC_CLUSTER_SIZE = 5;

    function geneDistance( a, b )
    {
        let sum = 0;
        for ( let g = 0; g < NUM_GENES_USED; g++ ) { sum += Math.abs( a[g] - b[g] ); }
        return sum / ( NUM_GENES_USED * 255 );
    }

    function stats( genePool )
    {
        if ( typeof genePool.getSwimbots !== 'function' )
        {
            // older versions of the code: only totals are available
            const n = genePool.getNumSwimbots();
            return { alive: n, predators: 0, food: genePool.getNumFoodBits(), meat: 0, meanEnergy: 0, geneticClusters: 0, effectiveGeneticClusters: 0, largestGeneticClusterShare: 0,
                     trees: 0, fruits: 0, carriedSeeds: 0, soil: 0, atmosphere: 0, totalEnergy: 0 };
        }
        const bots = genePool.getSwimbots();
        let alive = 0, predators = 0, energy = 0;
        let parts = 0, mass = 0, simple = 0, medium = 0, complex = 0;
        const clusters = [];   // greedy first-fit groups: { genes, count, predators }

        for ( let s = 0; s < bots.length; s++ )
        {
            const b = bots[s];
            if ( !b.getAlive() ) continue;
            alive ++;
            energy += b.getEnergy();
            const numParts = b.getNumParts();
            parts += numParts;
            mass += b.getPhenotypeMass();
            if ( numParts <= 5 ) simple ++; else if ( numParts <= 9 ) medium ++; else complex ++;
            const isPredator = ( typeof b.getPredatorLevel === 'function' ) && ( b.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD );
            if ( isPredator ) predators ++;

            const genotype = b.getGenotype();
            const genes = new Array( NUM_GENES_USED );
            for ( let g = 0; g < NUM_GENES_USED; g++ ) { genes[g] = genotype.getGeneValue(g); }

            let found = null;
            for ( const r of clusters ) { if ( geneDistance( r.genes, genes ) < GENETIC_CLUSTER_DISTANCE ) { found = r; break; } }
            if ( found === null ) { clusters.push({ genes, count: 1, predators: isPredator ? 1 : 0 }); }
            else { found.count ++; if ( isPredator ) found.predators ++; }
        }

        const hasTypes = ( typeof genePool.getNumFoodBitsOfType === 'function' );
        const geneticClusters = clusters.filter( r => r.count >= MIN_GENETIC_CLUSTER_SIZE ).sort( ( a, b ) => b.count - a.count );
        let shannon = 0;
        for ( const r of clusters ) { const p = r.count / alive; shannon -= p * Math.log( p ); }

        const ecology = typeof genePool.getEcologyStats === 'function' ? genePool.getEcologyStats() :
            { trees: 0, fruits: 0, carriedSeeds: 0, soil: 0, atmosphere: 0, totalEnergy: 0 };
        return {
            alive,
            predators,
            food        : hasTypes ? genePool.getNumFoodBitsOfType(0) + genePool.getNumFoodBitsOfType(1) : genePool.getNumFoodBits(),
            meat        : hasTypes ? genePool.getNumFoodBitsOfType(2) : 0,
            meanEnergy  : alive > 0 ? energy / alive : 0,
            meanParts   : alive > 0 ? parts / alive : 0,
            meanMass    : alive > 0 ? mass / alive : 0,
            simpleShare : alive > 0 ? simple / alive : 0,
            mediumShare : alive > 0 ? medium / alive : 0,
            complexShare: alive > 0 ? complex / alive : 0,
            geneticClusters: geneticClusters.length,
            effectiveGeneticClusters: alive > 0 ? Math.exp( shannon ) : 0,
            largestGeneticClusterShare: geneticClusters.length > 0 && alive > 0 ? geneticClusters[0].count / alive : 0,
            trees: ecology.trees,
            fruits: ecology.fruits,
            carriedSeeds: ecology.carriedSeeds,
            soil: ecology.soil,
            atmosphere: ecology.atmosphere,
            totalEnergy: ecology.totalEnergy,
        };
    }

    const genePool = new GenePool();
    genePool.initialize();   // same start as in the browser (pool center, random pool)
    genePool.setRendering( false );
    genePool.setSimulationRunning( true );

    return { genePool, stats };
})()
`, sandbox );

run.sandbox = sandbox;
run.alerts  = alerts;
return run;
}

module.exports = { createSimulation };

if ( require.main === module )
{
const run = createSimulation( SEED, BOTS === null ? {} : { INITIAL_NUM_SWIMBOTS: parseInt( BOTS, 10 ) } );
const alerts = run.alerts;

//------------------------------------------------
// main loop
//------------------------------------------------
const rows = [];
const header = "step,ms_per_step,alive,predators,plants,meat,mean_energy,mean_parts,mean_mass,simple_share,medium_share,complex_share,genetic_clusters,effective_genetic_clusters,largest_genetic_cluster_share,trees,fruits,carried_seeds,soil,atmosphere,total_energy,heap_mb";
console.log( `seed=${SEED} steps=${STEPS} bots=${BOTS === null ? "default" : BOTS}` );
console.log( header );

let t0 = process.hrtime.bigint();
let totalMs = 0;

for ( let step = 1; step <= STEPS; step++ )
{
    run.genePool.update();

    if ( step % EVERY === 0 || step === STEPS )
    {
        const t1 = process.hrtime.bigint();
        const ms = Number( t1 - t0 ) / 1e6;
        totalMs += ms;
        const s = run.stats( run.genePool );
        const heap = process.memoryUsage().heapUsed / 1048576;
        const stepsInWindow = ( step % EVERY === 0 ) ? EVERY : ( step % EVERY );
        const row = [ step, ( ms / stepsInWindow ).toFixed( 2 ), s.alive, s.predators, s.food, s.meat,
                      s.meanEnergy.toFixed( 1 ), s.meanParts.toFixed( 2 ), s.meanMass.toFixed( 1 ),
                      s.simpleShare.toFixed( 3 ), s.mediumShare.toFixed( 3 ), s.complexShare.toFixed( 3 ),
                      s.geneticClusters, s.effectiveGeneticClusters.toFixed( 1 ), s.largestGeneticClusterShare.toFixed( 2 ),
                      s.trees, s.fruits, s.carriedSeeds, s.soil.toFixed( 3 ), s.atmosphere.toFixed( 3 ), s.totalEnergy.toFixed( 3 ), heap.toFixed( 0 ) ].join( "," );
        rows.push( row );
        console.log( row );
        t0 = process.hrtime.bigint();
    }
}

console.log( `average ms/step = ${( totalMs / STEPS ).toFixed( 2 )}` );
if ( alerts.length > 0 )
{
    console.log( `ALERTS (${alerts.length}), first: ${alerts[0]}` );
}

if ( CSV !== null )
{
    fs.writeFileSync( CSV, header + "\n" + rows.join( "\n" ) + "\n" );
}
}
