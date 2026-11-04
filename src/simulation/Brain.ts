import { gpRandom } from "./Globals";
import * as ML from "./MindLayout";
import { OUT_FLEE, OUT_FOOD, OUT_HUNT, OUT_MATE, OUT_SELF_EAT } from "./NeuralBrain";
import { ZERO } from "./MathConstants";
import { PREDATOR_LEVEL_THRESHOLD } from "./Parameters";
import { ATTRACTION_SIMILAR_COLOR } from "./SwimbotTypes";

//----------------------------------------
// states
//----------------------------------------
export const BRAIN_STATE_NULL                = -1;
export const BRAIN_STATE_RESTING             =  0;
export const BRAIN_STATE_LOOKING_FOR_MATE    =  1;
export const BRAIN_STATE_PURSUING_MATE       =  2;
export const BRAIN_STATE_LOOKING_FOR_FOOD    =  3;
export const BRAIN_STATE_PURSUING_FOOD       =  4;
export const BRAIN_STATE_LOOKING_FOR_PREY    =  5;
export const BRAIN_STATE_PURSUING_PREY       =  6;
export const BRAIN_STATE_FLEEING_PREDATOR    =  7;
export const BRAIN_STATE_SELF_FEED            =  8;
export const NUM_BRAIN_STATES                =  9;

//--------------------------------------------
// perceiving
//--------------------------------------------
export const BRAIN_SENSORY_UPDATE_PERIOD           = 2;
export const BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS   = 20;

//const BRAIN_FOCUS_TARGET_SHIFT_STRENGTH	    = 0.2;
export const BRAIN_FOCUS_TARGET_SHIFT_STRENGTH	    = 0.1;
export const BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD    = 0.07;
export const BRAIN_WANDER_AMOUNT					= 0.2;
//const BRAIN_WALL_BOUNCE_SHIFT_AMOUNT	    = 0.1;


//------------------------------------------------------------------------------
// the brain's state machine: one row of the mind (see MindLayout.ts).
// Used by the Brain below and by the decision kernel (any thread).
// rand() gives a random number 0..1.
//------------------------------------------------------------------------------
export function brainUpdate( M: Float64Array, m: number, rand: () => number ): void
{
    //----------------------------------------------------------------------
    // neural brain: the network has chosen the goal (see NeuralBrain.ts);
    // the looking / pursuing steps below stay the same.
    // Classic brain: fleeing a predator in reach comes first (herbivores),
    // then food (prey for predators) when hungry, otherwise a mate.
    //----------------------------------------------------------------------
    let state = M[ m + ML.M_STATE ];
    const goal = M[ m + ML.M_GOAL ];

    // Below the hunger threshold, feeding takes precedence over mating even
    // when a random neural output keeps requesting a mate. Immediate flight
    // and the explicitly enabled self-feeding behaviour retain their priority.
    const hungerOverridesGoal = ( M[ m + ML.M_BRAIN_ENERGY ] < M[ m + ML.M_HUNGER ] )
        && ( goal !== OUT_FLEE ) && ( goal !== OUT_SELF_EAT );

    if (( goal >= 0 ) && !hungerOverridesGoal )
    {
        if ( goal === OUT_SELF_EAT ) { M[ m + ML.M_STATE ] = BRAIN_STATE_SELF_FEED;        return; }
        if ( goal === OUT_FLEE     ) { M[ m + ML.M_STATE ] = BRAIN_STATE_FLEEING_PREDATOR; return; }
        if (( goal === OUT_HUNT ) && ( state != BRAIN_STATE_PURSUING_PREY ) && ( state != BRAIN_STATE_LOOKING_FOR_PREY )) { state = BRAIN_STATE_LOOKING_FOR_PREY; }
        if (( goal === OUT_FOOD ) && ( state != BRAIN_STATE_PURSUING_FOOD ) && ( state != BRAIN_STATE_LOOKING_FOR_FOOD )) { state = BRAIN_STATE_LOOKING_FOR_FOOD; }
        if (( goal === OUT_MATE ) && ( state != BRAIN_STATE_PURSUING_MATE ) && ( state != BRAIN_STATE_LOOKING_FOR_MATE )) { state = BRAIN_STATE_LOOKING_FOR_MATE; }
    }
    else if (( M[ m + ML.M_THREAT_NEAR ] === 1 ) && ( M[ m + ML.M_PRED_LEVEL ] <= PREDATOR_LEVEL_THRESHOLD ))
    {
        M[ m + ML.M_STATE ] = BRAIN_STATE_FLEEING_PREDATOR;
        return;
    }
    else if ( M[ m + ML.M_BRAIN_ENERGY ] < M[ m + ML.M_HUNGER ] )
    {
        if ( M[ m + ML.M_PRED_LEVEL ] > PREDATOR_LEVEL_THRESHOLD )
        {
            if (( state != BRAIN_STATE_PURSUING_PREY ) && ( state != BRAIN_STATE_LOOKING_FOR_PREY )) { state = BRAIN_STATE_LOOKING_FOR_PREY; }
        }
        else
        {
            if (( state != BRAIN_STATE_PURSUING_FOOD ) && ( state != BRAIN_STATE_LOOKING_FOR_FOOD )) { state = BRAIN_STATE_LOOKING_FOR_FOOD; }
        }
    }
    else
    {
        if (( state != BRAIN_STATE_PURSUING_MATE ) && ( state != BRAIN_STATE_LOOKING_FOR_MATE )) { state = BRAIN_STATE_LOOKING_FOR_MATE; }
    }

    const foundFood = M[ m + ML.M_FOUND_FOOD ] === 1;
    const foundMate = M[ m + ML.M_FOUND_MATE ] === 1;
    const foundPrey = M[ m + ML.M_FOUND_PREY ] === 1;

    if      ( state == BRAIN_STATE_LOOKING_FOR_FOOD ) { if (  foundFood ) state = BRAIN_STATE_PURSUING_FOOD;    }
    else if ( state == BRAIN_STATE_PURSUING_FOOD    ) { if ( !foundFood ) state = BRAIN_STATE_LOOKING_FOR_FOOD; }
    else if ( state == BRAIN_STATE_LOOKING_FOR_PREY ) { if (  foundPrey ) state = BRAIN_STATE_PURSUING_PREY;    }
    else if ( state == BRAIN_STATE_PURSUING_PREY    )
    {
        // no switching at once (it would dither): a small chance per step
        if ( !foundPrey && ( rand() < 0.1 )) state = BRAIN_STATE_LOOKING_FOR_PREY;
    }
    else if ( state == BRAIN_STATE_LOOKING_FOR_MATE ) { if (  foundMate ) state = BRAIN_STATE_PURSUING_MATE;    }
    else if ( state == BRAIN_STATE_PURSUING_MATE    ) { if ( !foundMate ) state = BRAIN_STATE_LOOKING_FOR_MATE; }

    M[ m + ML.M_STATE ] = state;
}

//----------------------------------------
// Brain! (its numbers live in a mind row:
// a private one until bind() gives it
// the swimbot's row in the shared state)
//----------------------------------------
export function Brain()
{
    let _M = new Float64Array( ML.MIND_STRIDE );
    let _m = 0;
    _M[ ML.M_STATE ]      = BRAIN_STATE_NULL;
    _M[ ML.M_GOAL ]       = -1;
    _M[ ML.M_ATTRACTION ] = ATTRACTION_SIMILAR_COLOR;

    // use the row m of the array M from now on (the numbers move along)
    this.bind = function( M: Float64Array, m: number )
    {
        M.set( _M.subarray( _m, _m + ML.MIND_STRIDE ), m );
        _M = M;
        _m = m;
    }

    //-----------------------------
    this.initialize = function()
    {
        _M[ _m + ML.M_STATE ]       = BRAIN_STATE_NULL;
        _M[ _m + ML.M_PRED_LEVEL ]  = ZERO;
        _M[ _m + ML.M_FOUND_PREY ]  = 0;
        _M[ _m + ML.M_THREAT_NEAR ] = 0;
        _M[ _m + ML.M_GOAL ]        = -1;
    }

    this.update = function() { brainUpdate( _M, _m, gpRandom ); }

    //-------------------------------------------------------------------
    // setters
    //-------------------------------------------------------------------
    this.setEnergyLevel     = function(e) { _M[ _m + ML.M_BRAIN_ENERGY ] = e; }
    this.setHungerThreshold = function(h) { _M[ _m + ML.M_HUNGER ]       = h; }
    this.setFoundFoodBit    = function(f) { _M[ _m + ML.M_FOUND_FOOD ]   = f ? 1 : 0; }
    this.setFoundSwimbot    = function(f) { _M[ _m + ML.M_FOUND_MATE ]   = f ? 1 : 0; }
    this.setFoundPrey       = function(f) { _M[ _m + ML.M_FOUND_PREY ]   = f ? 1 : 0; }
    this.setPredatorLevel        = function(level) { _M[ _m + ML.M_PRED_LEVEL ]  = level; }
    this.setNearbyPredatorThreat = function(v)     { _M[ _m + ML.M_THREAT_NEAR ] = v ? 1 : 0; }
    this.returnToSearchingForPrey = function() { if ( _M[ _m + ML.M_STATE ] === BRAIN_STATE_PURSUING_PREY ) _M[ _m + ML.M_STATE ] = BRAIN_STATE_LOOKING_FOR_PREY; }
    this.setGoal                 = function(g)     { _M[ _m + ML.M_GOAL ] = g; }
    this.getGoal                 = function()      { return _M[ _m + ML.M_GOAL ]; }

    //--------------------------------
    this.setAttraction = function(a)
    {
        _M[ _m + ML.M_ATTRACTION ] = a;

        // forgetting the found swimbot makes the swimbot search for a new potential mate
        _M[ _m + ML.M_FOUND_MATE ] = 0;
    }

    //--------------------------------------------------------------------------
    // getters
    //--------------------------------------------------------------------------
    this.getHungerThreshold     = function() { return _M[ _m + ML.M_HUNGER ];     }
    this.getAttractionCriterion = function() { return _M[ _m + ML.M_ATTRACTION ]; }
    this.getState               = function() { return _M[ _m + ML.M_STATE ];      }
    this.getPredatorLevel       = function() { return _M[ _m + ML.M_PRED_LEVEL ]; }
}
