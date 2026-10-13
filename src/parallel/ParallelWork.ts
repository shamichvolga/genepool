//------------------------------------------------------------------------------
// The part of the parallel runner that every thread runs (main and workers):
// the control slots and "grab chunks of the list until it is used up".
//------------------------------------------------------------------------------
import { SharedState } from "../simulation/SharedState";
import { physicsStep } from "../simulation/PhysicsKernel";
import { perceive, PerceptionScratch } from "../simulation/PerceptionKernel";

// control slots (Int32Array in shared memory)
export const CTRL_GENERATION = 0;   // +1 for every phase: wakes the workers
export const CTRL_TASK       = 1;   // 1 = physics, 2 = perception
export const CTRL_COUNT      = 2;   // how many slots in the list
export const CTRL_NEXT       = 3;   // next unclaimed position in the list
export const CTRL_DONE       = 4;   // workers finished with this phase
export const CTRL_SIZE       = 8;

export const TASK_PHYSICS    = 1;
export const TASK_PERCEPTION = 2;
export const CHUNK           = 16;  // swimbots per grab

//------------------------------------------------------------------------------
// grab chunks of the list and do the task for each swimbot in them
// (used by the main thread and by the workers)
//------------------------------------------------------------------------------
export function workOnList( task: number, st: SharedState, scratch: PerceptionScratch, control: Int32Array, list: Int32Array ): void
{
    const n = Atomics.load( control, CTRL_COUNT );
    while ( true )
    {
        const start = Atomics.add( control, CTRL_NEXT, CHUNK );
        if ( start >= n ) break;
        const end = Math.min( n, start + CHUNK );

        if ( task === TASK_PHYSICS )
        {
            for (let i = start; i < end; i++) { const s = list[i]; if ( st.alive[s] ) { physicsStep( s, st ); } }
        }
        else
        {
            for (let i = start; i < end; i++) { const s = list[i]; if ( st.sensing[s] ) { perceive( s, st, scratch ); } }
        }
    }
}
