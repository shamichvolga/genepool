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
import { MAX_FOODBITS, MAX_SWIMBOTS } from "./Parameters";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { GridAllocator, UniformGrid } from "./UniformGrid";
import { BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS } from "./Brain";
import { BRAIN_SIZE, NUM_HIDDEN, NUM_INPUTS, NUM_OUTPUTS } from "./NeuralBrain";
import { FIELD_SIZE, PLANT_CELL_SIZE } from "./Environment";

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
export const PARAM_ENV_ACTIVE   = 1;    // 1 = environment rules on (the "random" pool)
export const PARAM_FOOD_TYPES   = 2;    // globalTweakers.numFoodTypes
export const PARAM_OBSTACLE_X1  = 3;
export const PARAM_OBSTACLE_Y1  = 4;
export const PARAM_OBSTACLE_X2  = 5;
export const PARAM_OBSTACLE_Y2  = 6;
export const PARAM_ENV_FIELDS   = 7;    // 1 = the maps vary (environment on and not the flat control)
export const PARAM_OB_MID_X     = 8;    // obstacle geometry (see Obstacle.writeGeometry)
export const PARAM_OB_MID_Y     = 9;
export const PARAM_OB_LENGTH    = 10;
export const PARAM_OB_PERP_X    = 11;
export const PARAM_OB_PERP_Y    = 12;
export const PARAM_OB_END_RADIUS= 13;
export const PARAM_TIME         = 14;   // the environment's clock (seasons)
export const PARAM_PETRI        = 15;   // 1 = the "petri" map (no seasons)
export const PARAM_MAX_ENERGY   = 16;
export const NUM_PARAMS         = 20;

export * from "./MindLayout";
import { MAX_THREADS, MIND_STRIDE, NUM_COUNTERS } from "./MindLayout";

// the plant counting grid (as in Environment)
export const PLANT_COLUMNS = Math.ceil( ( POOL_RIGHT  - POOL_LEFT ) / PLANT_CELL_SIZE );
export const PLANT_ROWS    = Math.ceil( ( POOL_BOTTOM - POOL_TOP  ) / PLANT_CELL_SIZE );

export const MAX_SEEN           = BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS;
export const BACKGROUND_SIZE    = 256;  // = Environment FIELD_SIZE

// the neighbour grids (same sizes as GenePool's)
export const SWIMBOT_GRID_CELL  = 200;
export const FOOD_GRID_CELL     = 150;

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

    //--------------------------------------------------------
    // what perception reads (one number per swimbot slot)
    //--------------------------------------------------------
    readonly botX         : Float64Array;   // body center
    readonly botY         : Float64Array;
    readonly genitalX     : Float64Array;
    readonly genitalY     : Float64Array;
    readonly mouthX       : Float64Array;
    readonly mouthY       : Float64Array;
    readonly predator     : Float64Array;   // predator level 0..1
    readonly mass         : Float64Array;
    readonly brightness   : Float64Array;
    readonly energy       : Float64Array;
    readonly scanRadius   : Float64Array;   // how far a predator looks for prey
    readonly effWarm      : Float64Array;   // digestion of warm / cold plants
    readonly effCold      : Float64Array;
    readonly preferred    : Float64Array;   // preferred food type (classic pools)
    readonly alive        : Uint8Array;
    readonly liveSwimbot  : Uint8Array;     // 1 = alive right now (the swimbot's own flag)
    readonly liveFood     : Uint8Array;     // 1 = the food bit exists right now (its own flag)
    readonly eternal      : Uint8Array;
    readonly sensing      : Uint8Array;     // 1 = perceives this step
    readonly brainState   : Int8Array;
    readonly age          : Float64Array;
    readonly colorR       : Float64Array;   // average body color (mate choice by similar color)
    readonly colorG       : Float64Array;
    readonly colorB       : Float64Array;
    readonly choosiness   : Float64Array;
    readonly attraction   : Int8Array;      // the swimbot's mate choice criterion
    readonly imageR       : Float64Array;   // predator search image: color, size, strength 0..1
    readonly imageG       : Float64Array;
    readonly imageB       : Float64Array;
    readonly imageSize    : Float64Array;
    readonly imageStrength: Float64Array;
    readonly preyValueWeight  : Float64Array;
    readonly preyTravelWeight : Float64Array;
    readonly preyBaitBias     : Float64Array;

    readonly foodX        : Float64Array;
    readonly foodY        : Float64Array;
    readonly foodType     : Uint8Array;     // 0, 1 = plants, 2 = meat
    readonly foodAlive    : Uint8Array;
    readonly foodEnergy    : Float64Array;
    readonly foodBorn     : Float64Array;   // the step it appeared (its age = now - born)

    readonly background   : Float32Array;   // environment: brightness of the bottom
    readonly temperature  : Float32Array;   // environment: base temperature map (FIELD_SIZE²)
    readonly plantWarm    : Int32Array;     // environment: plants per cell
    readonly plantCold    : Int32Array;

    //--------------------------------------------------------
    // the mind (see M_...), the neural brains and their state
    //--------------------------------------------------------
    readonly mind         : Float64Array;
    readonly brainWeights : Float32Array;   // BRAIN_SIZE per swimbot (copied from the genes)
    readonly nnInputs     : Float64Array;
    readonly nnHidden     : Float64Array;
    readonly nnOutputs    : Float64Array;
    readonly random       : Uint32Array;    // each swimbot's own random numbers
    readonly counters     : Float64Array;   // NUM_COUNTERS per thread

    readonly swimbotGrid  : UniformGrid;
    readonly foodGrid     : UniformGrid;

    //--------------------------------------------------------
    // what perception writes
    //--------------------------------------------------------
    readonly seenCount    : Int32Array;     // how many swimbots seen (<= MAX_SEEN)
    readonly seen         : Int32Array;     // MAX_SEEN per swimbot, nearest first
    readonly seenFood     : Int32Array;     // chosen food bit, -1 = none
    readonly seenPrey     : Int32Array;     // chosen prey, -1 = none
    readonly targetPreyDistance : Float64Array;
    readonly targetPreyReward   : Float64Array;
    readonly targetPreySuccess  : Float64Array;
    readonly targetPreyChase    : Float64Array;
    readonly targetBaitPresent  : Uint8Array;
    readonly targetBaitDistance : Float64Array;
    readonly targetBaitReward   : Float64Array;
    readonly seenThreat   : Int32Array;     // nearest hunting predator, -1 = none
    readonly seenPredator : Int32Array;     // nearest predator of any mood, -1 = none
    readonly seenMate     : Int32Array;     // chosen mate, -1 = none, -2 = not chosen here (main thread does it)
    readonly socialX      : Float64Array;   // sum of offsets to the swimbots seen
    readonly socialY      : Float64Array;

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

        const u8  = ( name: string, count: number ) => new Uint8Array( make( name, count ));
        const n = maxSwimbots;
        this.botX       = f64( "botX", n );
        this.botY       = f64( "botY", n );
        this.genitalX   = f64( "genitalX", n );
        this.genitalY   = f64( "genitalY", n );
        this.mouthX     = f64( "mouthX", n );
        this.mouthY     = f64( "mouthY", n );
        this.predator   = f64( "predator", n );
        this.mass       = f64( "mass", n );
        this.brightness = f64( "brightness", n );
        this.energy     = f64( "energy", n );
        this.scanRadius = f64( "scanRadius", n );
        this.effWarm    = f64( "effWarm", n );
        this.effCold    = f64( "effCold", n );
        this.preferred  = f64( "preferred", n );
        this.alive      = u8 ( "alive", n );
        this.liveSwimbot = u8( "liveSwimbot", n );
        this.liveFood    = u8( "liveFood", MAX_FOODBITS );
        this.eternal    = u8 ( "eternal", n );
        this.sensing    = u8 ( "sensing", n );
        this.brainState = new Int8Array( make( "brainState", n ));
        this.age        = f64( "age", n );
        this.colorR     = f64( "colorR", n );
        this.colorG     = f64( "colorG", n );
        this.colorB     = f64( "colorB", n );
        this.choosiness = f64( "choosiness", n );
        this.attraction = new Int8Array( make( "attraction", n ));
        this.imageR        = f64( "imageR", n );
        this.imageG        = f64( "imageG", n );
        this.imageB        = f64( "imageB", n );
        this.imageSize     = f64( "imageSize", n );
        this.imageStrength = f64( "imageStrength", n );
        this.preyValueWeight  = f64( "preyValueWeight", n );
        this.preyTravelWeight = f64( "preyTravelWeight", n );
        this.preyBaitBias     = f64( "preyBaitBias", n );

        this.foodX      = f64( "foodX", MAX_FOODBITS );
        this.foodY      = f64( "foodY", MAX_FOODBITS );
        this.foodType   = u8 ( "foodType", MAX_FOODBITS );
        this.foodAlive  = u8 ( "foodAlive", MAX_FOODBITS );
        this.foodEnergy = f64( "foodEnergy", MAX_FOODBITS );
        this.foodBorn   = f64( "foodBorn", MAX_FOODBITS );

        this.background = new Float32Array( make( "background", BACKGROUND_SIZE * BACKGROUND_SIZE * 4 ));
        this.temperature = new Float32Array( make( "temperature", FIELD_SIZE * FIELD_SIZE * 4 ));
        this.plantWarm   = new Int32Array( make( "plantWarm", PLANT_COLUMNS * PLANT_ROWS * 4 ));
        this.plantCold   = new Int32Array( make( "plantCold", PLANT_COLUMNS * PLANT_ROWS * 4 ));

        this.mind         = f64( "mind", n * MIND_STRIDE );
        this.brainWeights = new Float32Array( make( "brainWeights", n * BRAIN_SIZE * 4 ));
        this.nnInputs     = f64( "nnInputs",  n * NUM_INPUTS );
        this.nnHidden     = f64( "nnHidden",  n * NUM_HIDDEN );
        this.nnOutputs    = f64( "nnOutputs", n * NUM_OUTPUTS );
        this.random       = new Uint32Array( make( "random", n * 4 ));
        this.counters     = f64( "counters", MAX_THREADS * NUM_COUNTERS );

        const allocator = ( prefix: string ): GridAllocator => ( name, bytes ) => make( prefix + name, bytes );
        this.swimbotGrid = new UniformGrid( SWIMBOT_GRID_CELL, POOL_LEFT, POOL_TOP, POOL_RIGHT, POOL_BOTTOM, n,            allocator( "swimbotGrid." ));
        this.foodGrid    = new UniformGrid( FOOD_GRID_CELL,    POOL_LEFT, POOL_TOP, POOL_RIGHT, POOL_BOTTOM, MAX_FOODBITS, allocator( "foodGrid." ));

        this.seenCount  = new Int32Array( make( "seenCount",  n * 4 ));
        this.seen       = new Int32Array( make( "seen",       n * MAX_SEEN * 4 ));
        this.seenFood   = new Int32Array( make( "seenFood",   n * 4 ));
        this.seenPrey   = new Int32Array( make( "seenPrey",   n * 4 ));
        this.targetPreyDistance = f64( "targetPreyDistance", n );
        this.targetPreyReward = f64( "targetPreyReward", n );
        this.targetPreySuccess = f64( "targetPreySuccess", n );
        this.targetPreyChase = f64( "targetPreyChase", n );
        this.targetBaitPresent = u8( "targetBaitPresent", n );
        this.targetBaitDistance = f64( "targetBaitDistance", n );
        this.targetBaitReward = f64( "targetBaitReward", n );
        this.seenThreat = new Int32Array( make( "seenThreat", n * 4 ));
        this.seenPredator = new Int32Array( make( "seenPredator", n * 4 ));
        this.seenMate   = new Int32Array( make( "seenMate",   n * 4 ));
        this.socialX    = f64( "socialX", n );
        this.socialY    = f64( "socialY", n );
    }
}

// the one shared state of the simulation (created on first use)
let _shared: SharedState | null = null;

export function sharedState(): SharedState
{
    if ( _shared === null ) { _shared = new SharedState( MAX_SWIMBOTS ); }
    return _shared;
}
