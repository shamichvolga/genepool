//------------------------------------------------------------------------------
// A simulation worker thread (stage 7). It gets the shared memory once, then
// sleeps until the main thread starts a phase, does its share, reports done,
// and sleeps again. See ParallelRunner.ts.
//------------------------------------------------------------------------------
// load the modules in the same order as the page does (they import each other
// in a circle; starting from Globals is the order that works)
import "../simulation/Globals";
import { SharedState } from "../simulation/SharedState";
import { PerceptionScratch } from "../simulation/PerceptionKernel";
import { MAX_FOODBITS } from "../simulation/Parameters";
import { CTRL_DONE, CTRL_GENERATION, CTRL_TASK, workOnList } from "./ParallelWork";

self.onmessage = ( e: MessageEvent ) =>
{
    const { buffers, maxSwimbots, control: controlBuffer, list: listBuffer } = e.data;
    const st      = new SharedState( maxSwimbots, buffers );
    const scratch = new PerceptionScratch( maxSwimbots, MAX_FOODBITS );
    const control = new Int32Array( controlBuffer );
    const list    = new Int32Array( listBuffer );

    ( self as any ).postMessage( "ready" );

    let generation = Atomics.load( control, CTRL_GENERATION );
    while ( true )
    {
        Atomics.wait( control, CTRL_GENERATION, generation );       // sleep until the next phase
        generation = Atomics.load( control, CTRL_GENERATION );

        workOnList( Atomics.load( control, CTRL_TASK ), st, scratch, control, list );
        Atomics.add( control, CTRL_DONE, 1 );
    }
};
