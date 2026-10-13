//------------------------------------------------------------------------------
// Speed of the simulation with worker threads (stage 7), without a browser.
//
//   node --max-old-space-size=8000 tools/threads-bench.cjs <swimbots> [steps] [threads] [seed]
//
// Runs the pool in the headless sandbox (like bench.cjs) and lets Node worker
// threads do the heavy phases (moving bodies, looking around), the same way
// src/parallel/ParallelRunner.ts does in the browser. threads = 1 means no
// workers. Prints ms per step for every phase and a fingerprint of the state
// (it must not depend on the number of threads).
//------------------------------------------------------------------------------
const path = require( "path" );
const fs = require( "fs" );
const os = require( "os" );
const { Worker } = require( "worker_threads" );
const { createSimulation } = require( "./headless.cjs" );

const bots    = parseInt( process.argv[2] || "2000", 10 );
const steps   = parseInt( process.argv[3] || "200",  10 );
const threads = parseInt( process.argv[4] || "8",    10 );
const seed    = parseInt( process.argv[5] || "1",    10 );

const maxSwimbots = Math.max( 6000, Math.ceil( bots * 1.6 ));
const maxFoodBits = Math.max( 8000, bots * 4 );
const overrides = {
    MAX_SWIMBOTS: maxSwimbots, INITIAL_NUM_SWIMBOTS: bots,
    MAX_FOODBITS: maxFoodBits, MAX_FOODBITS_PER_TYPE: maxFoodBits / 2, INITIAL_NUM_FOODBITS: bots * 2,
};

//------------------------------------------------------------
// the worker program: the kernels, bundled with the same overrides
//------------------------------------------------------------
function workerSource()
{
    const esbuild = require( path.join( __dirname, "..", "node_modules", "esbuild" ) );
    const entry = `
        import "./Globals";
        import { SharedState } from "./SharedState";
        import { physicsStep } from "./PhysicsKernel";
        import { perceive, PerceptionScratch } from "./PerceptionKernel";
        import { MAX_FOODBITS } from "./Parameters";
        globalThis.__workerMain = function( data, parentPort )
        {
            const st = new SharedState( data.maxSwimbots, data.buffers );
            const scratch = new PerceptionScratch( data.maxSwimbots, MAX_FOODBITS );
            const control = new Int32Array( data.control ), list = new Int32Array( data.list );
            let generation = Atomics.load( control, 0 );
            parentPort.postMessage( "ready" );
            while ( true )
            {
                Atomics.wait( control, 0, generation );
                generation = Atomics.load( control, 0 );
                const task = Atomics.load( control, 1 ), n = Atomics.load( control, 2 );
                while ( true )
                {
                    const start = Atomics.add( control, 3, 16 );
                    if ( start >= n ) break;
                    const end = Math.min( n, start + 16 );
                    if ( task === 1 ) { for ( let i = start; i < end; i++ ) { const s = list[i]; if ( st.alive[s] ) physicsStep( s, st ); } }
                    else              { for ( let i = start; i < end; i++ ) { const s = list[i]; if ( st.sensing[s] ) perceive( s, st, scratch ); } }
                }
                Atomics.add( control, 4, 1 );
            }
        };`;
    let text = esbuild.buildSync({
        stdin: { contents: entry, resolveDir: path.join( __dirname, "..", "src", "simulation" ), sourcefile: "worker-entry.ts", loader: "ts" },
        bundle: true, write: false, format: "iife", target: "es2022", platform: "neutral",
    }).outputFiles[0].text;
    for ( const name in overrides )
    {
        const pattern = new RegExp( "((?:const|let|var) " + name + "\\s*=\\s*)[^;,]+" );
        if ( pattern.test( text )) text = text.replace( pattern, "$1" + overrides[ name ] );
    }
    return `const { parentPort } = require( "worker_threads" );\n${ text }\nparentPort.once( "message", d => __workerMain( d, parentPort ));\n`;
}

async function main()
{
    const run = createSimulation( seed, overrides );
    const sb  = run.sandbox;
    const st  = sb.sharedState();
    const genePool = run.genePool;

    //------------------------------------------------------------
    // workers
    //------------------------------------------------------------
    const numWorkers = threads - 1;
    const control = new Int32Array( new SharedArrayBuffer( 32 ));
    const list    = new Int32Array( new SharedArrayBuffer( maxSwimbots * 4 ));
    const workers = [];
    if ( numWorkers > 0 )
    {
        if ( !st.shared ) throw new Error( "no shared memory in the sandbox" );
        const file = path.join( os.tmpdir(), "genepool-worker-" + process.pid + ".cjs" );
        fs.writeFileSync( file, workerSource() );
        let ready = 0;
        await new Promise( ( resolve, reject ) =>
        {
            for ( let w = 0; w < numWorkers; w++ )
            {
                const worker = new Worker( file );
                worker.on( "message", m => { if ( m === "ready" && ++ ready === numWorkers ) resolve(); } );
                worker.on( "error", reject );
                worker.postMessage({ buffers: st.buffers, maxSwimbots: st.maxSwimbots, control: control.buffer, list: list.buffer });
                workers.push( worker );
            }
        });
    }

    const scratch = new sb.PerceptionScratch( st.maxSwimbots, maxFoodBits );
    function runPhase( task, items, n )
    {
        if ( numWorkers === 0 )
        {
            if ( task === 1 ) { for ( let i = 0; i < n; i++ ) { const s = items[i]; if ( st.alive[s] ) sb.physicsStep( s, st ); } }
            else              { for ( let i = 0; i < n; i++ ) { const s = items[i]; if ( st.sensing[s] ) sb.perceive( s, st, scratch ); } }
            return;
        }
        for ( let i = 0; i < n; i++ ) list[i] = items[i];
        Atomics.store( control, 1, task ); Atomics.store( control, 2, n );
        Atomics.store( control, 3, 0 );    Atomics.store( control, 4, 0 );
        Atomics.add( control, 0, 1 );      Atomics.notify( control, 0 );
        while ( true )
        {
            const start = Atomics.add( control, 3, 16 );
            if ( start >= n ) break;
            const end = Math.min( n, start + 16 );
            if ( task === 1 ) { for ( let i = start; i < end; i++ ) { const s = list[i]; if ( st.alive[s] ) sb.physicsStep( s, st ); } }
            else              { for ( let i = start; i < end; i++ ) { const s = list[i]; if ( st.sensing[s] ) sb.perceive( s, st, scratch ); } }
        }
        while ( Atomics.load( control, 4 ) < numWorkers ) {}
    }
    genePool.setParallelRunner({
        getNumThreads: () => threads,
        physics:    ( items, n ) => runPhase( 1, items, n ),
        perception: ( items, n ) => runPhase( 2, items, n ),
    });

    //------------------------------------------------------------
    // measure (the sandbox clock is fake, so time the phases here)
    //------------------------------------------------------------
    sb.performance.now = () => Number( process.hrtime.bigint() ) / 1e6;
    for ( let i = 0; i < 10; i++ ) genePool.update();
    const times = genePool.getPhaseTimes();
    times.fill( 0 );
    const t0 = process.hrtime.bigint();
    for ( let i = 0; i < steps; i++ ) genePool.update();
    const ms = Number( process.hrtime.bigint() - t0 ) / 1e6 / steps;

    let fingerprint = 0;
    for ( const b of genePool.getSwimbots() )
    {
        if ( !b.getAlive() ) continue;
        const p = b.getPosition();
        fingerprint += p.x * 1.1 + p.y * 0.7 + b.getEnergy() * 3.3 + b.getIndex();
    }
    const n = times[6];
    const f = ( x ) => ( x / n ).toFixed( 2 );
    console.log( `swimbots=${ bots } alive=${ genePool.getNumSwimbots() } threads=${ threads } ms/step=${ ms.toFixed( 2 ) } steps/sec=${ ( 1000 / ms ).toFixed( 1 ) }` );
    console.log( `  decide ${ f( times[0] ) } | move ${ f( times[1] ) } | after ${ f( times[2] ) } | look ${ f( times[3] ) } | act ${ f( times[4] ) } | rest ${ f( times[5] - times[0] - times[1] - times[2] - times[3] - times[4] ) }` );
    console.log( `fingerprint=${ fingerprint.toFixed( 6 ) }` );
    for ( const w of workers ) w.terminate();
}

main().catch( e => { console.error( e ); process.exit( 1 ); } );
