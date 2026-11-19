//------------------------------------------------------------------------------
// The part of the parallel runner that every thread runs (main and workers):
// the control slots, the tasks, and "grab chunks of the list until it is
// used up".
//------------------------------------------------------------------------------
import { writeRenderData } from "../simulation/RenderData";
import { SharedState, BOT_STRIDE, B_POS_X, B_POS_Y, B_GENITAL_X, B_GENITAL_Y, NUM_COUNTERS } from "../simulation/SharedState";
import { physicsStep } from "../simulation/PhysicsKernel";
import { perceive, PerceptionScratch } from "../simulation/PerceptionKernel";
import { decideStep, prepareLook, takeInLook } from "../simulation/DecisionKernel";

// control slots (Int32Array in shared memory)
export const CTRL_GENERATION = 0;   // +1 for every phase: wakes the workers
export const CTRL_TASK       = 1;   // which task (TASK_...)
export const CTRL_COUNT      = 2;   // how many slots in the list
export const CTRL_NEXT       = 3;   // next unclaimed position in the list
export const CTRL_DONE       = 4;   // workers finished with this phase
export const CTRL_SIZE       = 8;

// the tasks of a step, in this order
export const TASK_DECIDE       = 1;   // the brain (DecisionKernel.decideStep)
export const TASK_PHYSICS      = 2;   // move the bodies (PhysicsKernel)
export const TASK_PREPARE_LOOK = 3;   // after moving: who looks around (DecisionKernel.prepareLook)
export const TASK_LOOK         = 4;   // look around and take it in (PerceptionKernel + DecisionKernel.takeInLook)
export const TASK_RENDER_DATA  = 5;   // before a frame: the visible bodies for the graphics card (RenderData.ts)
export const TASK_DECIDE_PHYSICS = 6; // decide and move in one pass: one barrier instead of two
export const CHUNK             = 64;  // swimbots per grab

//------------------------------------------------------------------------------
// one task for one swimbot. thread = which row of st.counters to add to
// (0 = the main thread, 1.. = the workers)
//------------------------------------------------------------------------------
export function doTask( task: number, st: SharedState, scratch: PerceptionScratch, s: number, thread: number ): void
{
    if ( task === TASK_DECIDE || task === TASK_DECIDE_PHYSICS )
    {
        if ( st.liveSwimbot[s] === 1 ) { decideStep( st, s, thread * NUM_COUNTERS ); }
    }
    if ( task === TASK_PHYSICS || task === TASK_DECIDE_PHYSICS )
    {
        if ( st.alive[s] ) { physicsStep( s, st ); }
    }
    if ( task === TASK_PREPARE_LOOK )
    {
        // positions straight from the physics numbers
        const k = s * BOT_STRIDE, B = st.bots;
        st.botX    [s] = B[ k + B_POS_X     ];
        st.botY    [s] = B[ k + B_POS_Y     ];
        st.genitalX[s] = B[ k + B_GENITAL_X ];
        st.genitalY[s] = B[ k + B_GENITAL_Y ];
        st.sensing [s] = 0;
        if ( st.alive[s] === 1 ) { prepareLook( st, s ); }    // (not if it died just now)
    }
    else if ( task === TASK_RENDER_DATA )
    {
        if ( st.liveSwimbot[s] === 1 ) { writeRenderData( s, st ); }
    }
    else if ( task === TASK_LOOK )
    {
        if ( st.sensing[s] )
        {
            perceive( s, st, scratch );
            takeInLook( st, s, thread * NUM_COUNTERS );
        }
    }
}

//------------------------------------------------------------------------------
// grab chunks of the list and do the task for each swimbot in them
// (used by the main thread and by the workers)
//------------------------------------------------------------------------------
export function workOnList( task: number, st: SharedState, scratch: PerceptionScratch, control: Int32Array, list: Int32Array, thread: number ): void
{
    const n = Atomics.load( control, CTRL_COUNT );
    while ( true )
    {
        const start = Atomics.add( control, CTRL_NEXT, CHUNK );
        if ( start >= n ) break;
        const end = Math.min( n, start + CHUNK );
        for (let i = start; i < end; i++) { doTask( task, st, scratch, list[i], thread ); }
    }
}
