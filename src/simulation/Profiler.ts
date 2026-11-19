//--------------------------------------------------------------------------------
// A very light process profiler for the simulation.
//
// It does nothing at all unless PROFILER_ENABLED is turned on (the owner's
// "P" key in the browser, or tools/profile-deep.cjs).  The storage is two
// Float64Arrays of 16 slots, so a measurement never allocates.
//
// profEnter() counts the call and returns the start time; profExit() adds the
// elapsed milliseconds.  profReport() sorts the slots and says how many calls
// per step and how many milliseconds per step each process cost.
//--------------------------------------------------------------------------------

export const PROF_DECIDE_STEP        = 0;
export const PROF_NEURAL_THINK       = 1;
export const PROF_EDIBLE_FOOD        = 2;
export const PROF_PHYSICS_A          = 3;
export const PROF_PHYS_KINEMATICS    = 4;
export const PROF_PHYS_FLUID         = 5;
export const PROF_PHYS_CAVITY_JET    = 6;
export const PROF_PHYS_TREES         = 7;
export const PROF_PHYS_COLLISIONS    = 8;
export const PROF_PERCEIVE           = 9;
export const PROF_PERC_SWIMBOTS      = 10;
export const PROF_PERC_FOOD          = 11;
export const PROF_PERC_OBSTRUCTED    = 12;
export const PROF_INTERACT           = 13;
export const PROF_UPDATE_FOOD        = 14;
export const PROF_SNAPSHOT           = 15;

export const PROF_SLOTS = 16;

export const PROF_NAMES: readonly string[] =
[
    "decideStep",
    "neuralThink",
    "edibleFoodAtMouth",
    "physicsPartA",
    "physKinematics",
    "physFluid",
    "physCavityJet",
    "physTrees",
    "physCollisions",
    "perceive",
    "percSwimbots",
    "percFood",
    "percObstructed",
    "interact",
    "updateFood",
    "snapshotsAndClusters",
];

const _times = new Float64Array( PROF_SLOTS );
const _calls = new Float64Array( PROF_SLOTS );

// off in the running world: every call site asks this first, so a switched-off
// profiler costs one branch and nothing else
export let PROFILER_ENABLED = false;

// the clock: the browser's performance.now(), or the high-resolution clock that
// tools/headless.cjs hands in as __profNow (its performance.now is stubbed to 0
// so that headless runs stay deterministic)
const _global: any = globalThis as any;
const _profNow: () => number = ( typeof _global.__profNow === "function" ) ? _global.__profNow : () => performance.now();

export function setProfilerEnabled( on: boolean ): void
{
    PROFILER_ENABLED = on;
    if ( on ) { profReset(); }
}

export function profEnter( id: number ): number
{
    _calls[ id ] ++;
    return _profNow();
}

export function profExit( id: number, startedAt: number ): void
{
    _times[ id ] += _profNow() - startedAt;
}

export function profReset(): void
{
    _times.fill( 0 );
    _calls.fill( 0 );
}

export interface ProfRow
{
    process     : string;
    calls       : number;   // total calls in the measured window
    callsPerStep: number;
    msPerStep   : number;
    share       : number;   // percent of the measured time (nested slots included)
}

// steps = how many simulation steps the window covered
export function profReport( steps: number ): ProfRow[]
{
    const n = ( steps > 0 ) ? steps : 1;
    let total = 0;
    for ( let i = 0; i < PROF_SLOTS; i++ ) { total += _times[ i ]; }

    const rows: ProfRow[] = [];
    for ( let i = 0; i < PROF_SLOTS; i++ )
    {
        // keep all 16 slots in the table; an unused one simply shows zeroes
        rows.push({
            process     : PROF_NAMES[ i ],
            calls       : _calls[ i ],
            callsPerStep: _calls[ i ] / n,
            msPerStep   : _times[ i ] / n,
            share       : ( total > 0 ) ? 100 * _times[ i ] / total : 0,
        });
    }
    rows.sort( ( a, b ) => b.msPerStep - a.msPerStep );
    return rows;
}

// a console.table-friendly view, for the "P" key in the browser
export function profReportText( steps: number ): string
{
    const rows = profReport( steps );
    let text = "process | calls | calls/step | ms/step | % time\n";
    for ( const r of rows )
    {
        text += r.process.padEnd( 22 ) + " | "
              + String( r.calls ).padStart( 10 ) + " | "
              + r.callsPerStep.toFixed( 2 ).padStart( 10 ) + " | "
              + r.msPerStep.toFixed( 4 ).padStart( 10 ) + " | "
              + r.share.toFixed( 1 ).padStart( 5 ) + "\n";
    }
    return text;
}
