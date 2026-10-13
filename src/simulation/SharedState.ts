//------------------------------------------------------------------------------
// Shared state (stage 7): the numbers that several threads work on, kept in
// flat arrays that can live in shared memory (SharedArrayBuffer).
//
// Each swimbot owns one "slot" (its index): BOT_STRIDE numbers in `bots`,
// PART_STRIDE numbers in `parts` (the body part state, see PS / P_X...) and
// MAX_PARTS numbers in each of the static part arrays (filled at birth).
//
// The physics kernel (PhysicsKernel.ts) reads and writes only these arrays,
// so it can run in any thread. This module imports nothing from the
// simulation objects on purpose (workers import it too).
//------------------------------------------------------------------------------
import { MAX_PARTS } from "./SwimbotTypes";
import { MAX_SWIMBOTS } from "./Parameters";

//------------------------------------------------------------
// per swimbot numbers
//------------------------------------------------------------
export const B_POS_X         = 0;
export const B_POS_Y         = 1;
export const B_VEL_X         = 2;
export const B_VEL_Y         = 3;
export const B_ANGLE         = 4;
export const B_SPIN          = 5;
export const B_TIMER         = 6;
export const B_TIMER_DELTA   = 7;
export const B_EFFORT        = 8;
export const B_FOCUS_X       = 9;
export const B_FOCUS_Y       = 10;
export const B_GROWTH        = 11;
export const B_ENERGY        = 12;
export const B_AGE           = 13;
export const B_ETERNAL       = 14;
export const B_NUM_PARTS     = 15;
export const B_FREQUENCY     = 16;
export const B_SUM_LENGTHS   = 17;
export const B_BODY_MASS     = 18;
export const B_GOAL_X        = 19;    // direction to the goal (walls push it)
export const B_GOAL_Y        = 20;
export const B_SELECT_RADIUS = 21;
export const B_MOUTH_X       = 22;
export const B_MOUTH_Y       = 23;
export const B_GENITAL_X     = 24;
export const B_GENITAL_Y     = 25;
export const B_DEATHS        = 26;    // how many times the kernel decided "die" this step
export const B_BASAL         = 27;    // basal metabolism (energy per step)
export const B_COM_X         = 28;    // center of mass
export const B_COM_Y         = 29;
export const B_LAST_X        = 30;    // for measuring energy efficiency
export const B_LAST_Y        = 31;
export const B_LAST_ENERGY   = 32;
export const B_EFFICIENCY    = 33;
export const BOT_STRIDE      = 34;

//------------------------------------------------------------
// per body part numbers (in `parts`)
//------------------------------------------------------------
export const PS  = 14;
export const P_X = 0,  P_Y = 1;    // end position of the part
export const M_X = 2,  M_Y = 3;    // middle of the part
export const Q_X = 4,  Q_Y = 5;    // previous middle
export const A_X = 6,  A_Y = 7;    // axis (parent end -> this end)
export const N_X = 8,  N_Y = 9;    // perpendicular of the axis
export const V_X = 10, V_Y = 11;   // velocity of the middle
export const C_A = 12;             // current angle
export const B_A = 13;             // bending angle
export const PART_STRIDE = MAX_PARTS * PS;

//------------------------------------------------------------
// shared parameters (same for all swimbots)
//------------------------------------------------------------
export const PARAM_MAX_LIFESPAN = 0;
export const NUM_PARAMS         = 8;

export class SharedState
{
    readonly shared       : boolean;     // true = really in shared memory (threads possible)
    readonly maxSwimbots  : number;

    readonly bots         : Float64Array;
    readonly parts        : Float64Array;
    readonly partLength   : Float64Array;
    readonly partWidth    : Float64Array;
    readonly partMass     : Float64Array;
    readonly partAngle    : Float64Array;
    readonly partAmp      : Float64Array;
    readonly partPhase    : Float64Array;
    readonly partTurnAmp  : Float64Array;
    readonly partTurnPhase: Float64Array;
    readonly partMoment   : Float64Array;
    readonly partParent   : Int32Array;
    readonly params       : Float64Array;

    // the raw buffers, to hand them to worker threads
    readonly buffers      : { [ name: string ]: ArrayBufferLike };

    constructor( maxSwimbots: number, buffers?: { [ name: string ]: ArrayBufferLike } )
    {
        this.maxSwimbots = maxSwimbots;
        const canShare = ( typeof SharedArrayBuffer !== "undefined" )
                      && (( typeof crossOriginIsolated === "undefined" ) || crossOriginIsolated );
        this.shared  = buffers ? true : canShare;
        this.buffers = buffers ? buffers : {};

        const make = ( name: string, bytes: number ): ArrayBufferLike =>
        {
            if ( !this.buffers[ name ] ) { this.buffers[ name ] = canShare ? new SharedArrayBuffer( bytes ) : new ArrayBuffer( bytes ); }
            return this.buffers[ name ];
        };
        const f64 = ( name: string, count: number ) => new Float64Array( make( name, count * 8 ));

        const partCount = maxSwimbots * MAX_PARTS;
        this.bots          = f64( "bots",          maxSwimbots * BOT_STRIDE );
        this.parts         = f64( "parts",         maxSwimbots * PART_STRIDE );
        this.partLength    = f64( "partLength",    partCount );
        this.partWidth     = f64( "partWidth",     partCount );
        this.partMass      = f64( "partMass",      partCount );
        this.partAngle     = f64( "partAngle",     partCount );
        this.partAmp       = f64( "partAmp",       partCount );
        this.partPhase     = f64( "partPhase",     partCount );
        this.partTurnAmp   = f64( "partTurnAmp",   partCount );
        this.partTurnPhase = f64( "partTurnPhase", partCount );
        this.partMoment    = f64( "partMoment",    partCount );
        this.partParent    = new Int32Array( make( "partParent", partCount * 4 ));
        this.params        = f64( "params",        NUM_PARAMS );
    }
}

// the one shared state of the simulation (created on first use)
let _shared: SharedState | null = null;

export function sharedState(): SharedState
{
    if ( _shared === null ) { _shared = new SharedState( MAX_SWIMBOTS ); }
    return _shared;
}
