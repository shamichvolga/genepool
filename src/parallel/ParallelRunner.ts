//------------------------------------------------------------------------------
// Parallel runner (stage 7): runs the heavy phases of a step - moving the
// bodies, looking around - in several threads at once.
//
// All threads share the simulation's numbers (SharedState, in shared memory).
// For a phase, the main thread puts the list of swimbot slots into shared
// memory and wakes the workers; then everybody (the main thread too) grabs
// small chunks of the list until it is used up. Each swimbot is handled by
// exactly one thread and writes only its own slot, so the result does not
// depend on how many threads there are or who took which chunk.
//
// Until the workers have started (or if the page is not "cross-origin
// isolated", so there is no shared memory), everything runs in this thread.
//------------------------------------------------------------------------------
import { SharedState } from "../simulation/SharedState";
import { physicsStep } from "../simulation/PhysicsKernel";
import { perceive, PerceptionScratch } from "../simulation/PerceptionKernel";
import { MAX_FOODBITS } from "../simulation/Parameters";
import { WORLD_SCALE } from "../simulation/World";
import { CTRL_COUNT, CTRL_DONE, CTRL_GENERATION, CTRL_NEXT, CTRL_SIZE, CTRL_TASK, TASK_PERCEPTION, TASK_PHYSICS, workOnList } from "./ParallelWork";

export class ParallelRunner
{
    private readonly st       : SharedState;
    private readonly scratch  : PerceptionScratch;
    private readonly control  : Int32Array;
    private readonly list     : Int32Array;
    private readonly workers  : Worker[] = [];
    private numReady          = 0;
    private broken            = false;   // a worker failed: back to one thread
    private phaseStart        = 0;

    constructor( st: SharedState, numWorkers: number )
    {
        this.st      = st;
        this.scratch = new PerceptionScratch( st.maxSwimbots, MAX_FOODBITS );
        this.control = new Int32Array( new SharedArrayBuffer( CTRL_SIZE * 4 ));
        this.list    = new Int32Array( new SharedArrayBuffer( st.maxSwimbots * 4 ));

        for (let w = 0; w < numWorkers; w++)
        {
            // (the name tells the worker the world size, see World.ts)
            const worker = new Worker( new URL( "./sim.worker.ts", import.meta.url ), { type: "module", name: "world=" + WORLD_SCALE } );
            worker.onmessage = ( e ) => { if ( e.data === "ready" ) { this.numReady ++; } };
            worker.onerror   = ( e ) => { console.error( "simulation worker failed:", e.message ); this.broken = true; };
            worker.postMessage({ buffers: st.buffers, maxSwimbots: st.maxSwimbots, control: this.control.buffer, list: this.list.buffer });
            this.workers.push( worker );
        }
    }

    // how many threads work on a step right now (main thread included)
    getNumThreads(): number { return this.ready() ? this.workers.length + 1 : 1; }

    private ready(): boolean { return this.enabled && !this.broken && this.numReady === this.workers.length && this.workers.length > 0; }

    // false = run everything in this thread (for comparisons)
    private enabled = true;
    setEnabled( on: boolean ): void { this.enabled = on; }

    physics( list: ArrayLike<number>, n: number ): void
    {
        if ( !this.ready() ) { this.physicsHere( list, n ); return; }

        if ( this.checking )
        {
            // run it both ways from the same numbers and compare
            const bots = this.st.bots.slice(), parts = this.st.parts.slice();
            this.run( TASK_PHYSICS, list, n );
            const threadBots = this.st.bots.slice(), threadParts = this.st.parts.slice();
            this.st.bots.set( bots ); this.st.parts.set( parts );
            this.physicsHere( list, n );
            this.compare( threadBots, this.st.bots );
            this.compare( threadParts, this.st.parts );
            return;
        }
        this.run( TASK_PHYSICS, list, n );
    }

    perception( list: ArrayLike<number>, n: number ): void
    {
        if ( !this.ready() ) { this.perceptionHere( list, n ); return; }

        if ( this.checking )
        {
            const st = this.st;
            this.run( TASK_PERCEPTION, list, n );
            const outputs = [ st.seenCount.slice(), st.seen.slice(), st.seenFood.slice(), st.seenPrey.slice(), st.seenThreat.slice(), st.seenMate.slice(), st.socialX.slice(), st.socialY.slice() ];
            this.perceptionHere( list, n );
            const again = [ st.seenCount, st.seen, st.seenFood, st.seenPrey, st.seenThreat, st.seenMate, st.socialX, st.socialY ];
            for (let k = 0; k < outputs.length; k++) { this.compare( outputs[k], again[k] ); }
            return;
        }
        this.run( TASK_PERCEPTION, list, n );
    }

    private physicsHere( list: ArrayLike<number>, n: number ): void
    {
        for (let i = 0; i < n; i++) { const s = list[i]; if ( this.st.alive[s] ) { physicsStep( s, this.st ); } }
    }

    private perceptionHere( list: ArrayLike<number>, n: number ): void
    {
        for (let i = 0; i < n; i++) { const s = list[i]; if ( this.st.sensing[s] ) { perceive( s, this.st, this.scratch ); } }
    }

    //--------------------------------------------------------------------
    // checking mode (for tests): every phase runs in the threads AND here,
    // and every number that differs is counted
    //--------------------------------------------------------------------
    private checking   = false;
    private mismatches = 0;
    private checkedPhases = 0;
    setChecking( on: boolean ): void { this.checking = on; }
    getCheckResult() { return { phases: this.checkedPhases, mismatches: this.mismatches }; }

    private compare( a: ArrayLike<number>, b: ArrayLike<number> ): void
    {
        this.checkedPhases ++;
        for (let i = 0; i < a.length; i++)
        {
            if ( a[i] !== b[i] && !( a[i] !== a[i] && b[i] !== b[i] )) { this.mismatches ++; }   // (NaN = NaN here)
        }
    }

    //--------------------------------------------------------------------
    // one phase in all threads
    //--------------------------------------------------------------------
    private run( task: number, list: ArrayLike<number>, n: number ): void
    {
        const control = this.control;
        this.phaseStart = performance.now();
        for (let i = 0; i < n; i++) { this.list[i] = list[i]; }

        Atomics.store( control, CTRL_TASK,  task );
        Atomics.store( control, CTRL_COUNT, n );
        Atomics.store( control, CTRL_NEXT,  0 );
        Atomics.store( control, CTRL_DONE,  0 );
        Atomics.add  ( control, CTRL_GENERATION, 1 );
        Atomics.notify( control, CTRL_GENERATION );

        // the main thread works too
        workOnList( task, this.st, this.scratch, control, this.list );

        // wait for the workers (the main thread may not sleep, so it spins)
        const numWorkers = this.workers.length;
        let spins = 0;
        while ( Atomics.load( control, CTRL_DONE ) < numWorkers )
        {
            // safety: a worker that never answers must not freeze the page
            if ((( ++ spins ) & 0xffff ) === 0 && ( performance.now() - this.phaseStart > 3000 ))
            {
                console.error( "simulation workers stopped answering: continuing in one thread" );
                this.broken = true;
                return;
            }
        }
    }
}
