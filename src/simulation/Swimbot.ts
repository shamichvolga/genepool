import { MEAT_ASSIMILATION } from "./Parameters";
import { RENDER_FLOATS } from "./RenderData";
import { FILTER_FEEDING_EFFICIENCY, LIMB_SPINES_ENABLED, LIMB_SPINE_EFFECT, LIMB_SPINE_FLOOR } from "./Parameters";
import { plantOldEnergy, plantSproutGrowth, plantStage } from "./PlantGenes";
import { geneAverage, GENES_CURRENT, GENES_CANNIBAL, GENES_IMMUNE, GENES_WEAK_PREY, GENES_RUDDER, GENES_DEFERENCE, GENES_PERSISTENCE, GENES_INVESTMENT, GENES_SIZE_PICKINESS, setTrait, GENES_PREDATOR, GENES_SELF_FEED_WHICH, GENES_SELF_FEED_AMOUNT } from "./EcologyGenes";
import { physicsPartA, physicsPartB } from "./PhysicsKernel";
import { applyWaterDrag, bodyMotionFactors } from "./BodyPhysics";
import { advanceBodyTemperature } from "./ThermalPhysics";
import * as SS from "./SharedState";
import { decideStep, neuralThink, takeInLook } from "./DecisionKernel";
import { BRAIN_SIZE, think, sigmoid, NUM_INPUTS, NUM_HIDDEN, NUM_OUTPUTS, DRIVE_OUTPUTS, THINK_PERIOD, DRIVE_HYSTERESIS, EFFORT_MIN, EFFORT_RANGE, IN_BIAS, IN_HUNGER, IN_ENERGY, IN_AGE, IN_FIT, IN_TREND, IN_FOOD, IN_MATE, IN_THREAT, IN_PREY, IN_CROWD, IN_PREDATOR, OUT_FOOD, OUT_MATE, OUT_FLEE, OUT_HUNT, OUT_CLIMATE, OUT_SOCIAL, OUT_EFFORT,
         IN_FOOD_SIDE, IN_FOOD_AHEAD, IN_NEAR_SIDE, IN_NEAR_AHEAD, IN_THREAT_SIDE, IN_THREAT_AHEAD, IN_KIN, IN_SEASON, IN_PREDATOR_NEAR, IN_PREY_DISTANCE, IN_PREY_REWARD, IN_PREY_SUCCESS, IN_PREY_CHASE, IN_BAIT_PRESENT, IN_BAIT_DISTANCE, IN_BAIT_REWARD, OUT_STEER, OUT_SELF_EAT, OUT_PREY_VALUE, OUT_PREY_TRAVEL, OUT_PREY_BAIT, STEER_MAX_DEGREES } from "./NeuralBrain";
import { biteEnergy } from "./PlantSize";
import { PLANT_SIZE_ENABLED, PLANT_SPROUT_ENERGY, PLANT_EVOLUTION_ENABLED, RUDDER_MAX_TURN, SIZE_SCALED_VISION_ENABLED, SIZE_SCALED_GRAB_ENABLED, GAPE_SUCCESS_FLOOR, GAPE_COOLDOWN_SLOPE, MASS_SCALED_STOMACH_ENABLED, SIZE_MATURITY_ENABLED, INHERITED_INVESTMENT_ENABLED, PLANT_STAGES_ENABLED, PLANT_SPROUT_AGE, PLANT_OLD_AGE, PLANT_STAGE_ENERGY, PREDATOR_GAPE_CURVE_ENABLED, NEURAL_BRAIN_ENABLED, CLIMATE_STEERING, SOCIAL_STEERING, CLIMATE_PROBE_DISTANCE, BODY_TEMPERATURE_INERTIA_ENABLED, SELF_CANNIBALISM_ENABLED, PREDATOR_TARGET_SELECTION_ENABLED } from "./Parameters";
import { environment, PLANT_TYPE_WARM, PLANT_TYPE_COLD } from "./Environment";
import { sizeSignature, SEARCH_IMAGE_LEARNING, SEARCH_IMAGE_GAIN, SEARCH_IMAGE_FORGETTING, bodySize, sizeDietFactor, climateFoodFactor, digestionEfficiency, thermalFit, thermalPeak, THERMAL_MISMATCH_DRAIN, THERMAL_FIT_UPDATE_PERIOD, THERMOMELANISM, mateAcceptance, pairRandom, KINESIS_PERIOD, KINESIS_TURN_CHANCE, KINESIS_MAX_TURN, EMERGENCY_THERMAL_FIT, EMERGENCY_PROBE_DISTANCE } from "./Ecology";
//--------------------------------------------------------------------------
//
//    This file is part of GenePool Swimbots.
//    Copyright (c) 2021 by Jeffrey Ventrella - All Rights Reserved.
//
//    See the README file or go to swimbots.com for full license details.
//    You may use, distribute, and modify this code only under the terms
//    of the "Commons Clause" license (commonsclause.com).
//
//    This software is intended for education, game design, and research.
//
// --------------------------------------------------------------------------
import { SWIMBOT_DOT_RENDER_RADIUS } from "./Parameters";
import { BRAIN_FOCUS_TARGET_SHIFT_STRENGTH, BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD, BRAIN_SENSORY_UPDATE_PERIOD, BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_FOOD, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_FOOD, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY, BRAIN_STATE_SELF_FEED, BRAIN_STATE_RESTING, BRAIN_WANDER_AMOUNT, Brain } from "./Brain";
import { GREATEST_POSSIBLE_SWIMBOT_LENGTH, GREATEST_POSSIBLE_SWIMBOT_MASS } from "./Embryology";
import { DEFAULT_FOOD_BIT_ENERGY, FOOD_BIT_GRAB_RADIUS, FoodBit } from "./FoodBit";
import { Genotype } from "./Genotype";
import { globalTweakers, gpRandom, simCounters } from "./Globals";
import { NULL_INDEX, ONE, ONE_HALF, ONE_THIRD, PI_OVER_180, ZERO } from "./MathConstants";
import { BIG_BODY_STOMACH_ENABLED, STOMACH_REFERENCE_MASS } from "./Parameters";
import { AUTOTOMY_REGROW_DELAY, AUTOTOMY_DECOY_SPAN, PREY_BODY_ENERGY, ATTACK_COOLDOWN, ATTACK_SUCCESS_CHANCE, ENVIRONMENT_ATTACK_SUCCESS_CHANCE, BASAL_METABOLISM, DEFAULT_SWIMBOT_HUNGER_THRESHOLD, FOOD_TYPE_OFFSET, OLD_AGE_DURATION, PREDATION_ENERGY_TRANSFER, PREDATOR_FLEE_RADIUS, PREDATOR_LEVEL_THRESHOLD, PREY_SCAN_COOLDOWN, PREY_SCAN_RADIUS_GROWTH, PREY_SCAN_RADIUS_MAX_SCALE, RANDOM_MATING_CONTROL, SWIMBOT_MAX_ENERGY, SWIMBOT_SELECT_RADIUS_SCALAR, YOUNG_AGE_DURATION } from "./Parameters";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { SwimbotRenderer } from "./SwimbotRenderer";
import { ATTRACTION_BIG, ATTRACTION_CLOSEST, ATTRACTION_COLORFUL, ATTRACTION_CROOKED, ATTRACTION_HYPER, ATTRACTION_LONG, ATTRACTION_NO_COLOR, ATTRACTION_RANDOM, ATTRACTION_SHORT, ATTRACTION_SIMILAR_COLOR, ATTRACTION_SIMILAR_HYPER, ATTRACTION_SIMILAR_LENGTH, ATTRACTION_SIMILAR_SIZE, ATTRACTION_SIMILAR_STRAIGHT, ATTRACTION_SMALL, ATTRACTION_STILL, ATTRACTION_STRAIGHT, CONTINUAL_ENERGY_DRAIN, ENERGY_EFFICIENCY_MEASUREMENT_PERIOD, ENERGY_USED_UP_SWIMMING, GENITAL_INDEX, MAX_PARTS, MOUTH_INDEX, NULL_PART, Phenotype, ROOT_PART, STARVING, STARVING_TIMER_DELTA, SWIMBOT_GENITAL_LENGTH, SWIMBOT_MOUTH_LENGTH, SWIMBOT_VIEW_RADIUS, TIMER_DELTA_INCREASE_RATE, WALL_BOUNCE } from "./SwimbotTypes";
import { Color, assert } from "./Utility";
import { SharedVector2D, Vector2D } from "./Vector2D";


export function Swimbot()
{

var    flopperX = 0;
var    flopperY = 0;
var    flopperXV = 0;
var    flopperYV = 0;


    //---------------------------------
    //  attraction
    //---------------------------------
    const TOO_UGLY_TO_CHOOSE = ZERO;

    //---------------------------------
    //  colors
    //---------------------------------

    // I believe all of these have been moved over to swimbot renderer...
    /*
    const COLOR_WHITENESS   = 0.4; // 0.0 = normal-saturated color; 0.5 = white-washed; 1.0 = pure white
    const DEAD_COLOR_RED    = 0.2;
    const DEAD_COLOR_GREEN  = 0.25;
    const DEAD_COLOR_BLUE   = 0.3;
    const ROLLOVER_COLOR    = "rgba( 180, 190, 200, 0.7 )";
    const SELECT_COLOR      = "rgba( 255, 255, 255, 0.8 )";
    const OUTLINE_COLOR     = "rgba( 0, 0, 0, 0.4 )";
    */

	//-----------------------------------------------------------------------
	// the numbers used every step (position, speed, angle, energy, age,
	// goal...) live in one row of the shared state (SharedState.bots), so the
	// threads read and write them directly - no copying back and forth.
	// Until the swimbot gets its slot they live in a private row.
	//-----------------------------------------------------------------------
	let _B = new Float64Array( SS.BOT_STRIDE );
	let _b = 0;
	_B[ SS.B_EFFORT ] = 1;

	// the mind: what the brain keeps from step to step (SharedState.mind;
	// the decision kernel works on it). The Brain uses the same row.
	let _M = new Float64Array( SS.MIND_STRIDE );
	let _m = 0;
	_M[ SS.M_FOOD ] = _M[ SS.M_MATE ] = _M[ SS.M_PREY ] = _M[ SS.M_NEAR_PRED ] = _M[ SS.M_CALM_PRED ] = -1;
	_M[ SS.M_LAST_MEAT ] = _M[ SS.M_NEAREST_SEEN ] = -1;
	_M[ SS.M_COMFORT ] = -1;
	_M[ SS.M_THERMAL_FIT ] = 1;
	_M[ SS.M_THERMAL_WIDTH ] = 0.4;
	_M[ SS.M_THERMAL_OPT ] = _M[ SS.M_BODY_TEMP ] = 0.5;
	_M[ SS.M_THERMAL_PEAK ] = 1;
	_M[ SS.M_SCAN_RADIUS ] = SWIMBOT_VIEW_RADIUS;
	_M[ SS.M_MAX_ENERGY ]  = SWIMBOT_MAX_ENERGY;
	_M[ SS.M_VIEW_RADIUS ] = SWIMBOT_VIEW_RADIUS;
	_M[ SS.M_GRAB_RADIUS ] = FOOD_BIT_GRAB_RADIUS;
	_M[ SS.M_MATURE_AGE ]  = YOUNG_AGE_DURATION;

	// targets: the mind keeps their numbers, these give the objects
	const indexOf        = function( thing ) { return ( thing == null ) ? NULL_INDEX : thing.getIndex(); }
	const swimbotAt      = function( i ) { return ( i >= 0 && _parent != null ) ? _parent.getSwimbotAt( i ) : null; }
	const chosenFoodBit  = function() { const i = _M[ _m + SS.M_FOOD ]; return ( i >= 0 && _parent != null ) ? _parent.getFoodBitAt( i ) : null; }
	const chosenMate     = function() { return swimbotAt( _M[ _m + SS.M_MATE ] ); }
	const chosenPrey     = function() { return swimbotAt( _M[ _m + SS.M_PREY ] ); }
	const nearestPredator = function() { return swimbotAt( _M[ _m + SS.M_NEAR_PRED ] ); }
	const calmPredator   = function() { return swimbotAt( _M[ _m + SS.M_CALM_PRED ] ); }

	//-----------------------------------------
	// variables
	//-----------------------------------------
	let _genotype		    = new Genotype();
	let _phenotype		    = new Phenotype();
	let _brain  		    = new Brain();
	_brain.bind( _M, _m );
	const _position = new SharedVector2D( _B, SS.B_POS_X );
	const _velocity = new SharedVector2D( _B, SS.B_VEL_X );
	let _acceleration       = new Vector2D();
	let _heading		    = new Vector2D();
	const _directionToGoal = new SharedVector2D( _B, SS.B_GOAL_X );
	const _focusDirection = new SharedVector2D( _B, SS.B_FOCUS_X );
	const _centerOfMass = new SharedVector2D( _B, SS.B_COM_X );
	let _vectorUtility      = new Vector2D();
	let _swimbotRenderer  	= new SwimbotRenderer();
	let _numOffspring       = 0;
	let _numFoodBitsEaten   = 0;
	//let _maximumLifeSpan    = 0;
	let _index              = NULL_INDEX;
	// alive or not: one byte, in the shared state once I have a slot
	let _live    = new Uint8Array( 1 );
	let _liveAt  = 0;
	let _torque             = ZERO;
	let _colorUtility       = new Color();
	let _previousFocusDirection = new Vector2D(); // scratch, reused every update
	let _species            = NULL_INDEX;

	const _lastPositionForEfficiencyMeasurement = new SharedVector2D( _B, SS.B_LAST_X );

	//-----------------------------------------
	// predation
	//-----------------------------------------
	let _embryology         = null;  // kept so the phenotype can be regrown (applyPredatorLevel)
	let _numPreyEaten       = 0;
	let _numPartsEaten      = 0;      // parts that prey dropped when bitten
	let _numCannibalized    = 0;      // young ones of its own kind eaten (YOUNG_CANNIBALISM_ENABLED)

	//-----------------------------------------------------------------------
	// ecology (stage 5): how this swimbot copes with the temperature and the
	// two kinds of plants (see Ecology.ts)
	//-----------------------------------------------------------------------
	let _digestion          = ONE_HALF;
	let _efficiencyWarm     = ONE;
	let _efficiencyCold     = ONE;
	let _brightness         = ONE_HALF;  // body brightness: camouflage and mating signal
	let _choosiness         = ZERO;
	let _averageColor       = null;   // cached by getAverageColor (reset with a new phenotype)
	let _baseHungerThreshold = DEFAULT_SWIMBOT_HUNGER_THRESHOLD;   // the pool's setting
	let _partsDropped       = 0;      // how many times in its life

	//-----------------------------------------------------------------------
	// neural brain (stage 6, see NeuralBrain.ts)
	//-----------------------------------------------------------------------
	let _nnInputs           = new Float64Array( NUM_INPUTS  );
	let _nnHidden           = new Float64Array( NUM_HIDDEN  );
	const _nnNewHidden      = new Float64Array( NUM_HIDDEN  );
	let _nnOutputs          = new Float64Array( NUM_OUTPUTS );

	//-----------------------------------------------------------------------
	// Body part state lives in flat number arrays, which is much faster than
	// the Part objects. Physics reads and writes only these arrays; the Part
	// objects in _phenotype are refreshed from them just before drawing.
	//
	// _pd holds PS numbers per part (see the P_X... offsets below).
	//-----------------------------------------------------------------------
	const PS  = 14;
	const P_X = 0,  P_Y = 1;    // end position of the part
	const M_X = 2,  M_Y = 3;    // middle of the part
	const Q_X = 4,  Q_Y = 5;    // previous middle
	const A_X = 6,  A_Y = 7;    // axis (parent end -> this end)
	const N_X = 8,  N_Y = 9;    // perpendicular of the axis
	const V_X = 10, V_Y = 11;   // velocity of the middle
	const C_A = 12;             // current angle
	const B_A = 13;             // bending angle

	// copies of phenotype values used every step (reading them from the
	// phenotype object each time is slow: phenotype objects differ in shape)

	let _pd          = new Float64Array( MAX_PARTS * PS );
	let _pLength     = new Float64Array( MAX_PARTS );
	let _pWidth      = new Float64Array( MAX_PARTS );
	let _partStartWidth = new Float32Array( MAX_PARTS );     // width at the start of each part (for drawing)
	let _partRGB        = new Float32Array( MAX_PARTS * 3 ); // part colours (for drawing)
	let _pMass       = new Float64Array( MAX_PARTS );
	let _pAngle      = new Float64Array( MAX_PARTS );
	let _pAmp        = new Float64Array( MAX_PARTS );
	let _pPhase      = new Float64Array( MAX_PARTS );
	let _pTurnAmp    = new Float64Array( MAX_PARTS );
	let _pTurnPhase  = new Float64Array( MAX_PARTS );
	let _pMoment     = new Float64Array( MAX_PARTS );
	let _pParent     = new Int32Array  ( MAX_PARTS );
	let _unitAxisX   = new Float64Array( MAX_PARTS );   // scratch for getCurrentBodyStraightness
	let _unitAxisY   = new Float64Array( MAX_PARTS );
	const _mouthPosition = new SharedVector2D( _B, SS.B_MOUTH_X );               // kept up to date from _pd
	const _genitalPosition = new SharedVector2D( _B, SS.B_GENITAL_X );


let _parent = null;

//----------------------------------
this.setParent = function( parent )
{
    _parent = parent;
}

	//-----------------------------------------------------------------------
	// Stage 7: a swimbot of the pool owns a slot in the shared state. Its
	// body part arrays then live there (so other threads can move the body),
	// and the physics runs in PhysicsKernel.ts.
	//-----------------------------------------------------------------------
	let _slot   = -1;
	let _shared : SS.SharedState | null = null;

	this.bindSharedState = function( slot )
	{
	    const st = SS.sharedState();
	    _shared = st;
	    _slot   = slot;

	    st.liveSwimbot[ slot ] = _live[ _liveAt ];
	    _live   = st.liveSwimbot;
	    _liveAt = slot;

	    // the mind and the neural brain move into the slot's rows
	    const mindRow = slot * SS.MIND_STRIDE;
	    st.mind.set( _M.subarray( _m, _m + SS.MIND_STRIDE ), mindRow );
	    _M = st.mind;
	    _m = mindRow;
	    _brain.bind( _M, _m );
	    _M[ _m + SS.M_INDEX ] = slot;
	    st.nnInputs .set( _nnInputs,  slot * NUM_INPUTS  ); _nnInputs  = st.nnInputs .subarray( slot * NUM_INPUTS,  ( slot + 1 ) * NUM_INPUTS  );
	    st.nnHidden .set( _nnHidden,  slot * NUM_HIDDEN  ); _nnHidden  = st.nnHidden .subarray( slot * NUM_HIDDEN,  ( slot + 1 ) * NUM_HIDDEN  );
	    st.nnOutputs.set( _nnOutputs, slot * NUM_OUTPUTS ); _nnOutputs = st.nnOutputs.subarray( slot * NUM_OUTPUTS, ( slot + 1 ) * NUM_OUTPUTS );

	    // the hot numbers move into the slot's row (keeping their values)
	    const row = slot * SS.BOT_STRIDE;
	    st.bots.set( _B.subarray( _b, _b + SS.BOT_STRIDE ), row );
	    _B = st.bots;
	    _b = row;
	    _position.rebind( _B, _b + SS.B_POS_X );
	    _velocity.rebind( _B, _b + SS.B_VEL_X );
	    _directionToGoal.rebind( _B, _b + SS.B_GOAL_X );
	    _focusDirection.rebind( _B, _b + SS.B_FOCUS_X );
	    _centerOfMass.rebind( _B, _b + SS.B_COM_X );
	    _mouthPosition.rebind( _B, _b + SS.B_MOUTH_X );
	    _genitalPosition.rebind( _B, _b + SS.B_GENITAL_X );
	    _lastPositionForEfficiencyMeasurement.rebind( _B, _b + SS.B_LAST_X );
	    const from = slot * MAX_PARTS, to = from + MAX_PARTS;
	    _pd         = st.parts        .subarray( slot * SS.PART_STRIDE, ( slot + 1 ) * SS.PART_STRIDE );
	    _pLength    = st.partLength   .subarray( from, to );
	    _pWidth     = st.partWidth    .subarray( from, to );
	    _partStartWidth = st.partStartWidth.subarray( from, to );
	    _partRGB        = st.partRGB       .subarray( from * 3, to * 3 );
	    _pMass      = st.partMass     .subarray( from, to );
	    _pAngle     = st.partAngle    .subarray( from, to );
	    _pAmp       = st.partAmp      .subarray( from, to );
	    _pPhase     = st.partPhase    .subarray( from, to );
	    _pTurnAmp   = st.partTurnAmp  .subarray( from, to );
	    _pTurnPhase = st.partTurnPhase.subarray( from, to );
	    _pMoment    = st.partMoment   .subarray( from, to );
	    _pParent    = st.partParent   .subarray( from, to );
	}

	this.getSlot = function() { return _slot; }

	//------------------------------------------------------------------------
	// What the decision kernel left for the main thread (bits in M_EVENTS,
	// see DecisionKernel.ts). before = the start of the step (regrow, eat a
	// part of myself); after = after looking around (drop a decoy, choose a
	// mate by other criteria than color).
	//------------------------------------------------------------------------
	this.getKernelEvents = function() { return _M[ _m + SS.M_EVENTS ]; }
	this.getIsCannibalHunting = function() { return _M[ _m + SS.M_CANNIBAL ] === 1; }

	//------------------------------------------------------------------------
	// what am I after, for drawing a line to it: { fromX, fromY, toX, toY }
	// (food or prey from the mouth, a mate from the genitals, a predator I
	// flee from the body), or null
	//------------------------------------------------------------------------
	this.getTargetLine = function()
	{
	    const state = _brain.getState();
	    const food = chosenFoodBit(), prey = chosenPrey(), mate = chosenMate();
	    const line = ( from, to ) => ({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });
	    if (( state === BRAIN_STATE_PURSUING_MATE ) && ( mate != null ) && mate.getAlive() ) return line( _genitalPosition, mate.getGenitalPosition() );
	    if ( state === BRAIN_STATE_FLEEING_PREDATOR )
	    {
	        const danger = ( nearestPredator() != null ) ? nearestPredator() : calmPredator();
	        return (( danger != null ) && danger.getAlive() ) ? line( _position, danger.getPosition() ) : null;
	    }
	    if (( prey != null ) && prey.getAlive() && (( state === BRAIN_STATE_PURSUING_PREY ) || ( _M[ _m + SS.M_CANNIBAL ] === 1 ))) return line( _mouthPosition, prey.getPosition() );
	    if (( food != null ) && food.getAlive() ) return line( _mouthPosition, food.getPosition() );
	    return null;
	}
	this.getNumCannibalized   = function() { return _numCannibalized; }

	//------------------------------------------------------------------------
	// FILTER_FEEDING_ENABLED: a limb brushed a sprout - eat it, less well
	// than with the mouth (and a sprout is worth little anyway)
	//------------------------------------------------------------------------
	this.filterFeed = function( plant )
	{
	    const room = Math.max( ZERO, _M[ _m + SS.M_MAX_ENERGY ] - _B[ _b + SS.B_ENERGY ] );
	    if ( room <= ZERO ) return;
	    const grown = PLANT_EVOLUTION_ENABLED ? plantSproutGrowth( plant.getIndex(), plant.getAge() ) : 0;
	    let energy = plant.getEnergy() * FILTER_FEEDING_EFFICIENCY * ( PLANT_STAGE_ENERGY[0] + ( PLANT_STAGE_ENERGY[1] - PLANT_STAGE_ENERGY[0] ) * grown );
	    if ( environment.active ) { energy *= this.getDigestionEfficiency( plant.getType() ) * climateFoodFactor( _M[ _m + SS.M_THERMAL_FIT ], _M[ _m + SS.M_THERMAL_PEAK ] ); }
	    _B[ _b + SS.B_ENERGY ] += Math.min( room, energy );
	    _parent.plantEaten( plant );
	    plant.kill();
	    _numFoodBitsEaten ++;
	    _numFilterMeals ++;
	    simCounters.plantMeals ++;
	}
	let _numFilterMeals = 0;
	this.getNumFilterMeals = function() { return _numFilterMeals; }

	// limb tips: parts with nothing growing from them (LIMB_SPINES_ENABLED)
	let _numTips = 0;
	this.getNumLimbTips = function() { return _numTips; }

	//------------------------------------------------------------------------
	// PLANT_STAGES_ENABLED: a sprout gives little, an old plant much; small
	// bodies digest sprouts best, big bodies old plants (one plant, three ages)
	//------------------------------------------------------------------------
	this.plantStageFactor = function( plant )
	{
	    if ( !PLANT_STAGES_ENABLED || PLANT_SIZE_ENABLED ) return ONE;
	    const size  = bodySize( _phenotype.mass );                // -1 small .. +1 big
	    const stage = plantStage( plant.getIndex(), plant.getAge() );
	    if ( stage === 0 )
	    {
	        // a sprout grows: from PLANT_STAGE_ENERGY[0] to a grown-up plant's worth
	        const grown = PLANT_EVOLUTION_ENABLED ? plantSproutGrowth( plant.getIndex(), plant.getAge() ) : 0;
	        return ( PLANT_STAGE_ENERGY[0] + ( PLANT_STAGE_ENERGY[1] - PLANT_STAGE_ENERGY[0] ) * grown ) * Math.min( ONE, Math.max( 0.15, ONE - 0.35 * size ));
	    }
	    if ( stage === 2 ) return plantOldEnergy( plant.getIndex() ) * Math.min( ONE, Math.max( 0.15, ONE + 0.35 * size ));
	    return PLANT_STAGE_ENERGY[1];
	}

	//------------------------------------------------------------------------
	// One swimbot alone, through the same kernel (for tests and tools; the
	// pool runs the kernel for everybody at once, see GenePool)
	//------------------------------------------------------------------------
	this.decide = function()
	{
	    if ( _parent != null ) { _parent.writePerceptionParams(); }
	    decideStep( _shared, _slot, 0 );
	    this.handleEventsBeforeMoving();
	    if ( _parent != null ) { _parent.collectKernelCounters(); }
	}

	this.think = function()
	{
	    if ( _parent != null ) { _parent.writePerceptionParams(); }
	    _shared.brainWeights.set( _genotype.getBrain(), _slot * BRAIN_SIZE );   // (the genes may have just been changed)
	    neuralThink( _shared, _slot );
	}

	// what it sees (as the perception would find it), taken in at once
	this.setEnvironmentalStimuli = function( numNearbySwimbots, nearbySwimbotArray, foodBitWasFound, theFoodBit, preyWasFound, thePrey, theNearestPredator, mateChoice = undefined )
	{
	    const st = _shared, s = _slot, base = s * SS.MAX_SEEN;
	    st.seenCount[s] = numNearbySwimbots;
	    for (let k = 0; k < numNearbySwimbots; k++) { st.seen[ base + k ] = nearbySwimbotArray[k].getIndex(); }
	    const food = ( foodBitWasFound && ( theFoodBit != null )) ? theFoodBit : null;
	    st.seenFood[s] = ( food != null ) ? food.getIndex() : -1;
	    if ( food != null )
	    {
	        const f = food.getIndex();
	        st.foodX[f] = food.getPosition().x;
	        st.foodY[f] = food.getPosition().y;
	        st.foodType[f] = food.getType();
	    }
	    st.seenPrey[s]     = ( preyWasFound && ( thePrey != null )) ? thePrey.getIndex() : -1;
	    st.seenThreat[s]   = ( theNearestPredator != null ) ? theNearestPredator.getIndex() : -1;
	    st.seenPredator[s] = st.seenThreat[s];
	    st.seenMate[s]     = ( mateChoice === undefined ) ? -2 : (( mateChoice != null ) ? mateChoice.getIndex() : -1 );
	    st.socialX[s] = st.socialY[s] = 0;
	    takeInLook( st, s, 0 );
	    this.handleEventsAfterLooking();
	    if ( _parent != null ) { _parent.collectKernelCounters(); }
	}

	this.handleEventsBeforeMoving = function()
	{
	    const events = _M[ _m + SS.M_EVENTS ];
	    _M[ _m + SS.M_EVENTS ] = events & ~( SS.EVENT_REGROW | SS.EVENT_SELF_FEED );

	    // a dropped part grows back
	    if (( events & SS.EVENT_REGROW ) && ( _M[ _m + SS.M_PARTS_LOST ] === 1 ) && ( _embryology != null ))
	    {
	        this.syncPartObjects();
	        _phenotype = _embryology.generatePhenotypeFromGenotype( _genotype );
	        this.processPhenotype();
	        _B[ _b + SS.B_ENERGY ] -= _M[ _m + SS.M_AUTOTOMY_LOSS ];
	        _M[ _m + SS.M_PARTS_LOST ] = 0;
	    }

	    // the brain chose to eat a part of my own body
	    if ( events & SS.EVENT_SELF_FEED ) { this.autotomize( true ); }
	}

	this.handleEventsAfterLooking = function()
	{
	    const events = _M[ _m + SS.M_EVENTS ];
	    _M[ _m + SS.M_EVENTS ] = events & ~( SS.EVENT_DECOY | SS.EVENT_CHOOSE_MATE );

	    // autotomy as a decoy: a hunter came too close - drop a part and leave it behind
	    if (( events & SS.EVENT_DECOY ) && ( _M[ _m + SS.M_PARTS_LOST ] !== 1 ))
	    {
	        const dropped = this.autotomize();
	        if ( dropped !== null )
	        {
	            _parent.spawnMeatWithEnergy( dropped.x, dropped.y, dropped.energy );
	            simCounters.autotomyThreatDrops ++;
	        }
	    }

	    // a mate by another criterion than similar color: the most attractive
	    // grown-up, not starving swimbot in sight with my diet that accepts me
	    if ( events & SS.EVENT_CHOOSE_MATE )
	    {
	        const st = _shared, count = st.seenCount[ _slot ], base = _slot * SS.MAX_SEEN;
	        let best = null, highest = -100.0;
	        for (let o = 0; o < count; o++)
	        {
	            const other = swimbotAt( st.seen[ base + o ] );
	            if (( other == null ) || !other.getAlive() ) continue;
	            const babeFactor = other.getAttractiveness( this );
	            if (( babeFactor > highest )
	            &&  ( babeFactor > TOO_UGLY_TO_CHOOSE )
	            &&  ( other.getAge() > YOUNG_AGE_DURATION )
	            &&  ( other.getEnergy() > STARVING )
	            &&  other.sameDiet( this )
	            &&  other.acceptsMate( this ))
	            {
	                highest = babeFactor;
	                best    = other;
	            }
	        }
	        if ( best !== null ) { _M[ _m + SS.M_MATE ] = best.getIndex(); _brain.setFoundSwimbot( true ); }
	        else                 { _brain.setFoundSwimbot( false ); }
	    }
	}

	//------------------------------------------------------------------------
	// Autotomy: drop the tip of a limb (which limb and how much: genes). The
	// dropped parts take the same share of my energy as of my body mass.
	// Returns { energy, x, y } (where the parts were), or null.
	//------------------------------------------------------------------------
	this.autotomize = function( selfFeeding = false )
	{
	    if ( _M[ _m + SS.M_PARTS_LOST ] || !environment.active ) return null;
	    if ( selfFeeding && ( !SELF_CANNIBALISM_ENABLED || ( _B[ _b + SS.B_ENERGY ] >= _M[ _m + SS.M_MAX_ENERGY ] ))) return null;
	    const n = _phenotype.numParts;
	    if ( n <= 4 ) return null;
	    this.syncPartObjects();
	    const parts = _phenotype.parts;

	    // parts that carry nothing (leaves); the mouth (0) and genital (1) stay
	    const children = new Array( n ).fill( 0 );
	    for (let p = 1; p < n; p++) { if ( parts[p].parent >= 0 ) children[ parts[p].parent ] ++; }
	    const leaves = [];
	    for (let p = 2; p < n; p++) { if ( children[p] === 0 ) leaves.push(p); }
	    if ( leaves.length === 0 ) return null;

	    const tissueWhich = selfFeeding ? _genotype.getGeneValue( GENES_SELF_FEED_WHICH[0] ) / 255 : _phenotype.autotomyWhich;
	    const tissueAmount = selfFeeding ? _genotype.getGeneValue( GENES_SELF_FEED_AMOUNT[0] ) / 255 : _phenotype.autotomyAmount;
	    const leaf  = leaves[ Math.min( leaves.length - 1, Math.floor( tissueWhich * leaves.length )) ];
	    const limit = Math.min( n - 3, Math.max( 1, Math.round( tissueAmount * ( n - 2 ))));

	    // climb from the leaf while the whole branch below stays within the limit
	    const subtree = ( r ) =>
	    {
	        const out = [];
	        for (let p = 2; p < n; p++)
	        {
	            let q = p;
	            while ( q > 1 && q !== r ) { q = parts[q].parent; }
	            if ( q === r ) out.push(p);
	        }
	        return out;
	    };
	    let root = leaf, drop = [ leaf ];
	    while ( parts[ root ].parent >= 2 )
	    {
	        const bigger = subtree( parts[ root ].parent );
	        if ( bigger.length > limit ) break;
	        root = parts[ root ].parent;
	        drop = bigger;
	    }

	    // how much of me goes, and where it lies
	    let droppedMass = ZERO, x = ZERO, y = ZERO;
	    for ( const p of drop ) { droppedMass += parts[p].mass; x += parts[p].midPosition.x * parts[p].mass; y += parts[p].midPosition.y * parts[p].mass; }
	    if ( droppedMass <= ZERO ) return null;
	    x /= droppedMass; y /= droppedMass;
	    const lost = _B[ _b + SS.B_ENERGY ] * ( droppedMass / _phenotype.mass );

	    // the body without them: keep the order, renumber parents and children
	    const isDropped = new Array( n ).fill( false );
	    for ( const p of drop ) isDropped[p] = true;
	    const newIndex = new Array( n ).fill( NULL_INDEX );
	    const kept = [], gone = [];
	    for (let p = 0; p < n; p++) { if ( isDropped[p] ) { gone.push( parts[p] ); } else { newIndex[p] = kept.length; kept.push( parts[p] ); } }
	    for ( const part of kept )
	    {
	        if ( part.parent >= 0 ) { part.parent = newIndex[ part.parent ]; }
	        if ( part.child  >= 0 ) { part.child  = newIndex[ part.child  ]; }   // a dropped child -> none (the end gets a cap)
	    }
	    const order = kept.concat( gone );
	    for (let p = n; p < parts.length; p++) { order.push( parts[p] ); }
	    _phenotype.parts    = order;
	    _phenotype.numParts = kept.length;

	    this.processPhenotype();

	    const tissueEnergy = droppedMass * PREY_BODY_ENERGY;
	    if ( selfFeeding )
	    {
	        // The organism retains its existing reserve and digests part of the
	        // removed tissue. The branch is permanently gone: no free regrowth.
	        const gained = Math.min( _M[ _m + SS.M_MAX_ENERGY ] - _B[ _b + SS.B_ENERGY ], tissueEnergy );
	        _B[ _b + SS.B_ENERGY ] += gained;
	        _M[ _m + SS.M_PARTS_LOST ] = 0;
	        _M[ _m + SS.M_AUTOTOMY_LOSS ] = ZERO;
	        _M[ _m + SS.M_REGROW ] = 0;
	        simCounters.selfCannibalismEvents ++;
	        simCounters.selfCannibalismEnergy += gained;
	        simCounters.selfCannibalismMass += droppedMass;
	    }
	    else
	    {
	        _B[ _b + SS.B_ENERGY ]      -= lost;
	        _M[ _m + SS.M_AUTOTOMY_LOSS ] = lost;
	        _M[ _m + SS.M_PARTS_LOST ]    = 1;
	        _M[ _m + SS.M_REGROW ]  = AUTOTOMY_REGROW_DELAY;
	    }
	    _partsDropped ++;
	    // the part itself is food too, like a killed prey's body
	    // (the same PREY_BODY_ENERGY per unit of mass), plus the energy it took
	    return { energy: selfFeeding ? tissueEnergy : lost + tissueEnergy, x, y };
	};

	// bitten: maybe drop a part instead of dying (chance = gene)
	this.tryAutotomyOnBite = function()
	{
	    if ( _M[ _m + SS.M_PARTS_LOST ] || ( _phenotype.autotomyBite <= ZERO ) || ( gpRandom() >= _phenotype.autotomyBite )) return null;
	    return this.autotomize();
	};

	this.getAutotomy = function()
	{
	    return { bite: _phenotype.autotomyBite, threat: _phenotype.autotomyThreat, amount: _phenotype.autotomyAmount,
	             partsLost: _M[ _m + SS.M_PARTS_LOST ] === 1, regrowIn: _M[ _m + SS.M_REGROW ], timesDropped: _partsDropped };
	};
	this.canSelfFeed = function()
	{
	    return SELF_CANNIBALISM_ENABLED && environment.active && !_M[ _m + SS.M_PARTS_LOST ]
	        && ( _phenotype.numParts > 4 ) && ( _B[ _b + SS.B_ENERGY ] < _M[ _m + SS.M_MAX_ENERGY ] );
	};
	this.getNumPartsEaten = function() { return _numPartsEaten; }

	//------------------------------------------------------------------------
	// predator search image (see Ecology.ts): learn from a meal, fade with time
	//------------------------------------------------------------------------
	this.learnSearchImage = function( prey )
	{
	    if ( _slot < 0 ) return;
	    const st = _shared, s = _slot, k = SEARCH_IMAGE_LEARNING;
	    const color = prey.getAverageColor();
	    const size  = sizeSignature( prey.getPhenotypeMass() );
	    if ( st.imageStrength[s] <= 0 )
	    {
	        st.imageR[s] = color.red; st.imageG[s] = color.green; st.imageB[s] = color.blue; st.imageSize[s] = size;
	    }
	    else
	    {
	        st.imageR   [s] += k * ( color.red   - st.imageR   [s] );
	        st.imageG   [s] += k * ( color.green - st.imageG   [s] );
	        st.imageB   [s] += k * ( color.blue  - st.imageB   [s] );
	        st.imageSize[s] += k * ( size        - st.imageSize[s] );
	    }
	    st.imageStrength[s] = Math.min( ONE, st.imageStrength[s] + SEARCH_IMAGE_GAIN );
	}

	this.getSearchImage = function()
	{
	    if ( _slot < 0 ) return null;
	    const st = _shared, s = _slot;
	    return { red: st.imageR[s], green: st.imageG[s], blue: st.imageB[s], size: st.imageSize[s], strength: st.imageStrength[s] };
	}

	// the numbers other threads read about me that change only with a new phenotype
	this.writeStaticPerception = function()
	{
	    if ( _slot < 0 ) return;
	    const st = _shared, s = _slot;
	    st.effWarm   [s] = this.getDigestionEfficiency( PLANT_TYPE_WARM );
	    st.effCold   [s] = this.getDigestionEfficiency( PLANT_TYPE_COLD );
	    st.preferred [s] = _phenotype.preferredFoodType;
	    st.choosiness[s] = _choosiness;
	    st.attraction[s] = _brain.getAttractionCriterion();
	    st.predator  [s] = this.getPredatorLevel();
	    st.brightness[s] = _brightness;
	    st.mass      [s] = _phenotype.mass;
	    st.eternal   [s] = this.isEternal() ? 1 : 0;
	    const color = this.getAverageColor();
	    st.colorR    [s] = color.red;
	    st.colorG    [s] = color.green;
	    st.colorB    [s] = color.blue;
	}



	// copy the numbers the physics needs into the shared state
	// the physics decided to die (old age / starvation): do it here
	this.applyPhysicsDeaths = function()
	{
	    const B = _shared.bots, b = _slot * SS.BOT_STRIDE;
	    const deaths = B[ b + SS.B_DEATHS ];
	    B[ b + SS.B_DEATHS ] = 0;
	    for (let d = 0; d < deaths; d++)
	        this.die( _B[ _b + SS.B_AGE ] > globalTweakers.maximumLifeSpan ? "old_age" : "starvation" );
	}



    //------------------------------------
    this.computeMomentFactors = function()
    {
        this.determinePartDecendents();

        let oneOverMass = ONE / _phenotype.mass;

        for (let p=2; p<_phenotype.numParts; p++)
        {
            let moment = _phenotype.parts[p].mass * oneOverMass;

            for (let d=1; d<=_phenotype.parts[p].numDecendents; d++)
            {
                let decendent = _phenotype.parts[p].decendent[d];
                moment += _phenotype.parts[ decendent ].mass * oneOverMass;
            }

            _phenotype.parts[p].momentFactor = moment;
        }
     }

	//-----------------------------------------
	// update body parts
	//-----------------------------------------
	this.updateBodyParts = function()
	{
        let oldAgeThreshold = this.getOldAgeThreshold();

        //----------------------------------
        // swimmer is not old yet
        // (eternal swimbots never get old)
        //----------------------------------
        if (( _B[ _b + SS.B_AGE ] < oldAgeThreshold ) || ( _B[ _b + SS.B_ETERNAL ] === 1 ) )
        {
            if ( _B[ _b + SS.B_AGE ] < YOUNG_AGE_DURATION )
            {
                //----------------------------------
                // swimmer is still growing
                //----------------------------------
                _B[ _b + SS.B_GROWTH ] = _B[ _b + SS.B_AGE ] / YOUNG_AGE_DURATION;
            }
            else
            {
                _B[ _b + SS.B_GROWTH ] = ONE;
            }

            assert( _B[ _b + SS.B_GROWTH ] >= 0.0, "assert swimbot.js:updateBodyParts: _B[ _b + SS.B_GROWTH ] >= 0.0" )
            assert( _B[ _b + SS.B_GROWTH ] <= 1.0, "assert swimbot.js:updateBodyParts: _B[ _b + SS.B_GROWTH ] <= 1.0" )

            //---------------------------------------
            // slowing down because starving,
            // but not slowing down to a full stop.
            //---------------------------------------
            if  ( _B[ _b + SS.B_ENERGY ] < STARVING )
            {
                _B[ _b + SS.B_TIMER_DELTA ] = _B[ _b + SS.B_ENERGY ] / STARVING;

                if ( _B[ _b + SS.B_TIMER_DELTA ] < STARVING_TIMER_DELTA )
                {
                    _B[ _b + SS.B_TIMER_DELTA ] = STARVING_TIMER_DELTA;
                }
            }
            else
            {
                _B[ _b + SS.B_TIMER_DELTA ] += TIMER_DELTA_INCREASE_RATE;

                if ( _B[ _b + SS.B_TIMER_DELTA ] > ONE )
                {
                    _B[ _b + SS.B_TIMER_DELTA ] = ONE;
                }
            }
        }
        else
        //----------------------------------
        // swimmer is past old age threshold
        //----------------------------------
        {
            //----------------------------------
            // dying of old age
            //----------------------------------
            if ( _B[ _b + SS.B_AGE ] > globalTweakers.maximumLifeSpan )
            {
                this.die( "old_age" );
            }
            else
            {
                //----------------------------------
                // slowing down because dying
                //----------------------------------
                //let earlyDeath = 200;
                //earlyDeath = 0;
                //let inc = ( _B[ _b + SS.B_AGE ] - OLD_AGE ) / ( oldAgeDuration - earlyDeath );

                //let inc = ( _B[ _b + SS.B_AGE ] - OLD_AGE ) / oldAgeDuration;

                /*
                if ( inc > ONE )
                {
                    inc = ONE;
                }
                */

                _B[ _b + SS.B_TIMER_DELTA ] = ONE - ( _B[ _b + SS.B_AGE ] - oldAgeThreshold ) / OLD_AGE_DURATION;

                assert( _B[ _b + SS.B_TIMER_DELTA ] >= 0.0, "assert swimbot.js:updateBodyParts: _B[ _b + SS.B_TIMER_DELTA ] >= 0.0" )
                assert( _B[ _b + SS.B_TIMER_DELTA ] <= 1.0, "assert swimbot.js:updateBodyParts: _B[ _b + SS.B_TIMER_DELTA ] <= 1.0" )
            }
        }

        _B[ _b + SS.B_TIMER ] += _B[ _b + SS.B_TIMER_DELTA ] * _B[ _b + SS.B_EFFORT ];

		//---------------------------------------------------------------
		// calculate the modulators as a function of the dot between the
		// heading and the perpendicular of the direction to the goal
		//---------------------------------------------------------------
		let radian = _B[ _b + SS.B_ANGLE ] * PI_OVER_180;

		_heading.x = Math.sin( radian );
		_heading.y = Math.cos( radian );

		let perpX =  _heading.y;
		let perpY = -_heading.x;

        let directionDot = _focusDirection.x * perpX + _focusDirection.y * perpY;

//test
//let perpDot      = _focusDirection.x * _heading.x + _focusDirection.y * _heading.y;

		//-----------------------------------------------------------------
		// set root position and angle
		//-----------------------------------------------------------------
		//-----------------------------------------------------------------
		// set root position and angle
		//-----------------------------------------------------------------
		const pd = _pd;
		pd[ ROOT_PART * PS + P_X ] = _position.x;
		pd[ ROOT_PART * PS + P_Y ] = _position.y;
		pd[ ROOT_PART * PS + C_A ] = _B[ _b + SS.B_ANGLE ] - this.getMomentAdjustment();

		//-----------------------------------------------------------------
		// loop through parts to determine angle and position
		//-----------------------------------------------------------------
		for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
		{
			const i      = p * PS;
			const parent = _pParent[p];
			const j      = parent * PS;

			// start at the parent's end (or at the body position)
			if ( parent == NULL_PART )
			{
				pd[ i + P_X ] = _position.x;
				pd[ i + P_Y ] = _position.y;
			}
			else
			{
				pd[ i + P_X ] = pd[ j + P_X ];
				pd[ i + P_Y ] = pd[ j + P_Y ];
			}

			//-----------------------------------
			// determine current angle
			//-----------------------------------
			pd[ i + C_A ] = pd[ j + C_A ] + _pAngle[p];

			//-----------------------------------
			// add motion
			//-----------------------------------
			if ( p > 1 ) // because part 1 has nothing to 'bend' off of
			{
				let ampModulator   = _pTurnAmp  [p] * directionDot;
				let phaseModulator = _pTurnPhase[p] * directionDot;

				let radian = _B[ _b + SS.B_TIMER ] * _B[ _b + SS.B_FREQUENCY ] + ( _pPhase[p] + phaseModulator );
				pd[ i + B_A ] = ( _pAmp[p] + ampModulator ) * Math.sin( radian );

				pd[ i + C_A ] += pd[ i + B_A ];
			}

			//-----------------------------------
			// determine position
			//-----------------------------------
			let radian = pd[ i + C_A ] * PI_OVER_180;
			let length = _pLength[p];

			if ( _B[ _b + SS.B_AGE ] < YOUNG_AGE_DURATION )
			{
                length *= _B[ _b + SS.B_GROWTH ];
			}

			let x = length * Math.sin( radian );
			let y = length * Math.cos( radian );
			pd[ i + Q_X ] = pd[ i + M_X ];
			pd[ i + Q_Y ] = pd[ i + M_Y ];
			pd[ i + M_X ] = pd[ i + P_X ];
			pd[ i + M_Y ] = pd[ i + P_Y ];
			pd[ i + P_X ] += x;
			pd[ i + P_Y ] += y;
			pd[ i + M_X ] += x * ONE_HALF;
			pd[ i + M_Y ] += y * ONE_HALF;

		    //---------------------------------------------------------
		    // part axis, and its perpendicular
		    //---------------------------------------------------------
            pd[ i + A_X ] = pd[ i + P_X ] - pd[ j + P_X ];
            pd[ i + A_Y ] = pd[ i + P_Y ] - pd[ j + P_Y ];
            pd[ i + N_X ] =  pd[ i + A_Y ] / length;
            pd[ i + N_Y ] = -pd[ i + A_X ] / length;

			//-----------------------------------------------------------
			// part velocity
			//-----------------------------------------------------------
            pd[ i + V_X ] = pd[ i + M_X ] - pd[ i + Q_X ];
            pd[ i + V_Y ] = pd[ i + M_Y ] - pd[ i + Q_Y ];
		}

		//-----------------------------
		// calculate center of mass
		//-----------------------------
		this.calculateCenterOfMass();

		//-----------------------------------------
		// here is where I shift all my body nodes
		// to keep my center of mass in place...
		//-----------------------------------------
        this.adjustToCenterOfMass();

		//------------------------------------
		// I need to do this again because I
		// just did an adjustToCenterOfMass
		//------------------------------------
		this.calculateCenterOfMass();

		//----------------------------------------
		// calculate select radius
		//
		// (this is a weird hacky solution)
		//----------------------------------------
		if ( _B[ _b + SS.B_AGE ] % 20 === 0 )
		{
            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                for (let o=1; o<_B[ _b + SS.B_NUM_PARTS ]; o++)
                {
                    if ( o != p )
                    {
                        let xx = pd[ p * PS + P_X ] - pd[ o * PS + P_X ];
                        let yy = pd[ p * PS + P_Y ] - pd[ o * PS + P_Y ];
                        let distance = Math.sqrt( xx * xx + yy * yy );

                        distance = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( distance );

                        if ( distance > _B[ _b + SS.B_SELECT_RADIUS ] )
                        {
                            _B[ _b + SS.B_SELECT_RADIUS ] = distance;
                        }
                    }
                }
            }
		}
	}




	//------------------------------------------------------------------
	// copy the Part objects (fresh from embryology) into the arrays
	//------------------------------------------------------------------
	this.loadPartArrays = function()
	{
		_B[ _b + SS.B_NUM_PARTS ]       = _phenotype.numParts;
		_B[ _b + SS.B_FREQUENCY ]      = _phenotype.frequency;
		_B[ _b + SS.B_SUM_LENGTHS ] = _phenotype.sumPartLengths;
		_B[ _b + SS.B_BODY_MASS ]       = _phenotype.mass;

		for (let p=0; p<_phenotype.numParts; p++)
		{
			const part = _phenotype.parts[p];
			const i = p * PS;
			_pLength   [p] = part.length;
			_pWidth    [p] = part.width;
			_pMass     [p] = part.mass;
			_pAngle    [p] = part.angle;
			_pAmp      [p] = part.amp;
			_pPhase    [p] = part.phase;
			_pTurnAmp  [p] = part.turnAmp;
			_pTurnPhase[p] = part.turnPhase;
			_pMoment   [p] = part.momentFactor;
			_pParent   [p] = part.parent;
			_pd[ i + P_X ] = part.position.x;       _pd[ i + P_Y ] = part.position.y;
			_pd[ i + M_X ] = part.midPosition.x;    _pd[ i + M_Y ] = part.midPosition.y;
			_pd[ i + Q_X ] = part.previousMid.x;    _pd[ i + Q_Y ] = part.previousMid.y;
			_pd[ i + A_X ] = part.axis.x;           _pd[ i + A_Y ] = part.axis.y;
			_pd[ i + N_X ] = part.perpendicular.x;  _pd[ i + N_Y ] = part.perpendicular.y;
			_pd[ i + V_X ] = part.velocity.x;       _pd[ i + V_Y ] = part.velocity.y;
			_pd[ i + C_A ] = part.currentAngle;
			_pd[ i + B_A ] = part.bendingAngle;
		}
	}

	//------------------------------------------------------------------
	// copy the arrays back into the Part objects (for drawing)
	//------------------------------------------------------------------
	this.syncPartObjects = function()
	{
		for (let p=0; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
		{
			const part = _phenotype.parts[p];
			const i = p * PS;
			part.position     .setXY( _pd[ i + P_X ], _pd[ i + P_Y ] );
			part.midPosition  .setXY( _pd[ i + M_X ], _pd[ i + M_Y ] );
			part.previousMid  .setXY( _pd[ i + Q_X ], _pd[ i + Q_Y ] );
			part.axis         .setXY( _pd[ i + A_X ], _pd[ i + A_Y ] );
			part.perpendicular.setXY( _pd[ i + N_X ], _pd[ i + N_Y ] );
			part.velocity     .setXY( _pd[ i + V_X ], _pd[ i + V_Y ] );
			part.currentAngle = _pd[ i + C_A ];
			part.bendingAngle = _pd[ i + B_A ];
		}
	}

    //------------------------------------
    this.getMomentAdjustment = function()
    {
        let momentAdjustment = ZERO;

        //--------------------------------
        // part 1 is not involved here..
        //--------------------------------
        for (let p=2; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
        {
            momentAdjustment += _pd[ p * PS + B_A ] * _pMoment[p];
        }

        return momentAdjustment;
     }


	//--------------------------------
	// calculate center of mass
	//--------------------------------
	this.calculateCenterOfMass = function()
	{
		_centerOfMass.clear();

		for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++ )
		{
			_centerOfMass.x += _pd[ p * PS + M_X ] * _pMass[p];
			_centerOfMass.y += _pd[ p * PS + M_Y ] * _pMass[p];
		}

		_centerOfMass.scale( ONE / _B[ _b + SS.B_BODY_MASS ] );
	}

	//--------------------------------
	// adjust to center of mass
	//--------------------------------
	this.adjustToCenterOfMass = function()
	{
		let offsetX = _position.x - _centerOfMass.x;
		let offsetY = _position.y - _centerOfMass.y;

		for (let  p=0; p<_B[ _b + SS.B_NUM_PARTS ]; p++ )
		{
		   const i = p * PS;
		   _pd[ i + P_X ] += offsetX;
		   _pd[ i + P_Y ] += offsetY;
		   _pd[ i + M_X ] += offsetX;
		   _pd[ i + M_Y ] += offsetY;
		}

		// the mouth and genital positions are read by other swimbots
		_mouthPosition  .setXY( _pd[ MOUTH_INDEX   * PS + P_X ], _pd[ MOUTH_INDEX   * PS + P_Y ] );
		_genitalPosition.setXY( _pd[ GENITAL_INDEX * PS + P_X ], _pd[ GENITAL_INDEX * PS + P_Y ] );
	}



	//------------------------------------------
	// determine part decendents
	//------------------------------------------
	this.determinePartDecendents = function()
	{
		//-----------------------------------------------------------
		// The purpose of this function is to determine all
		// the "child" parts that descend from each part....
		//-----------------------------------------------------------
		for (let p=1; p<_phenotype.numParts; p++)
		{
			_phenotype.parts[p].numDecendents = 0;

			//-----------------------------------------------------------
			// loop through all parts as potential decendents...
			//-----------------------------------------------------------
			for (let potentialDecendent  = 1;
					 potentialDecendent < _phenotype.numParts;
					 potentialDecendent ++)
			{
				let testing = true;
				let root = potentialDecendent;

				//-----------------------------------------------------------------------------
				// for each potential_decendent, see if it traces back to the part in question
				//-----------------------------------------------------------------------------
				while ( testing )
				{
					root = _phenotype.parts[ root ].parent; //trickle the root down the ancestral tree...

					//------------------------------------------
					// we have traced a decendent
					//------------------------------------------
					if ( root == p )
					{
						_phenotype.parts[p].numDecendents ++;
						_phenotype.parts[p].decendent[ _phenotype.parts[p].numDecendents ] = potentialDecendent;
						testing = false;
					}

					//--------------------------------------------------------------
					// quit if you have if traced all the way back to ROOT_PART
					//--------------------------------------------------------------
					if ( root == ROOT_PART )
					{
						testing = false;
					}
				}
			}
		}
	}




	//-----------------------------------------------------------------------------------
	// create
	//-----------------------------------------------------------------------------------
	this.create = function( index, age, position, angle, energy, genotype, embryology )
	{
	    _deathCause = "";      // (set again by die(); a newborn must not carry the last life of its slot)
	    // (healthy, and with no immunity: DISEASE_ENABLED)
	    _M[ _m + SS.M_DISEASE ] = 0; _M[ _m + SS.M_DISEASE_TIMER ] = 0;
	    for (let k = 0; k < SS.NUM_IMMUNE_MEMORY; k++) { _M[ _m + SS.M_IMMUNE_MEMORY + k ] = 0; }
	    // (a newborn starts as an egg; a founder of the pool is grown up)
	    _B[ _b + SS.B_GROWTH ] = Math.min( ONE, age / YOUNG_AGE_DURATION );
	    //---------------------------------------
	    // clear out everything for starters...
	    //---------------------------------------
	    this.clear();


        ///contents of clear...

	    /*
        _genotype.clear();

        _lastPositionForEfficiencyMeasurement.clear();
        _position.clear();
        _velocity.clear();
        _acceleration.clear();
        _heading.clear();
        _directionToGoal.clear();
        _focusDirection.clear();
        _centerOfMass.clear();
        _vectorUtility.clear();

        _M[ _m + SS.M_FOOD ] = NULL_INDEX;
        _M[ _m + SS.M_MATE ] = NULL_INDEX;
        _B[ _b + SS.B_AGE ] 	  		    = 0;
        _numOffspring       = 0;
        _numFoodBitsEaten   = 0;
        _index              = NULL_INDEX;
        _M[ _m + SS.M_MATE ]    = NULL_INDEX;
        _M[ _m + SS.M_FOOD ] = NULL_INDEX;
        _M[ _m + SS.M_LAST_MEAT ] = NULL_INDEX;
        _live[ _liveAt ] = 0;
        _M[ _m + SS.M_TRY_MATE ]       = 0;
        _M[ _m + SS.M_TRY_EAT ]        = 0;
        _B[ _b + SS.B_GROWTH ]        = ZERO;
        _torque             = ZERO;
        _B[ _b + SS.B_ANGLE ]			    = ZERO;
        _B[ _b + SS.B_SPIN ]			    = ZERO;
        _B[ _b + SS.B_ENERGY ]			    = ZERO;
        _B[ _b + SS.B_TIMER ]              = ZERO;
        _B[ _b + SS.B_TIMER_DELTA ]         = ZERO;
        _B[ _b + SS.B_EFFICIENCY ]   = ZERO;
        _B[ _b + SS.B_SELECT_RADIUS ]       = ZERO;
        _B[ _b + SS.B_LAST_ENERGY ] = ZERO;
        _M[ _m + SS.M_READY ] = 0;
        */

/// if the clear routine above takes care of it, I can delete the assignments below...

		//----------------------------
		// set some basic properties
		//----------------------------
//_position.set( position );
_position.copyFrom( position );

		//_velocity.clear();
		_index              = index;
		_B[ _b + SS.B_ANGLE ] 		        = angle;
		_B[ _b + SS.B_AGE ]		        = age;
		_B[ _b + SS.B_ENERGY ]             = energy;
		_live[ _liveAt ] = 1;
		_M[ _m + SS.M_EVENTS ] = 0;
		_M[ _m + SS.M_INDEX ]  = index;
		// my own random numbers (for the decision kernel), from the pool's
		if ( _slot >= 0 ) { _shared.random[ _slot ] = Math.floor( gpRandom() * 4294967296 ) >>> 0; }
		_B[ _b + SS.B_GROWTH ]        = ONE;

		// whole body
		_M[ _m + SS.M_PARTS_LOST ] = 0; _M[ _m + SS.M_AUTOTOMY_LOSS ] = ZERO; _M[ _m + SS.M_REGROW ] = 0; _partsDropped = 0; _M[ _m + SS.M_SELF_FEED_CD ] = 0;

		// nothing learned yet
		if ( _slot >= 0 ) { _shared.imageStrength[ _slot ] = ZERO; }

		// the neural brain is used in the environment pool (stage 6)
		_M[ _m + SS.M_NEURAL ]         = ( environment.active && NEURAL_BRAIN_ENABLED ) ? 1 : 0;
		_nnInputs.fill( ZERO );
		_nnHidden.fill( ZERO );
		_nnNewHidden.fill( ZERO );
		_nnOutputs.fill( ZERO );
		_B[ _b + SS.B_EFFORT ]         = ONE;
		_M[ _m + SS.M_CLIMATE_W ]  = ZERO;
		_M[ _m + SS.M_SOCIAL_W ]   = ZERO;
		_M[ _m + SS.M_COMFORT_TREND ]   = ZERO;
		_M[ _m + SS.M_STEER ]          = ZERO;
		_M[ _m + SS.M_NEAREST_SEEN ]    = NULL_INDEX;
		_M[ _m + SS.M_THREAT_CLOSE ] = _M[ _m + SS.M_PRED_CLOSE ] = ZERO;
		_M[ _m + SS.M_CALM_PRED ] = NULL_INDEX;
		_brain.setGoal( -1 );
		//_maximumLifeSpan    = DEFAULT_MAXIMUM_LIFESPAN;

		//_B[ _b + SS.B_SPIN ]		        = ZERO;
        //_numOffspring       = 0;
		//_numFoodBitsEaten   = 0;
		//_torque             = ZERO;
        //_B[ _b + SS.B_SELECT_RADIUS ]       = ZERO;
		//_acceleration.clear();



//make sure all variables are initialized!!! (to be safe and stuff)

	/*
	let _heading		    = new Vector2D();
	const _directionToGoal = new SharedVector2D( _B, SS.B_GOAL_X );
	const _focusDirection = new SharedVector2D( _B, SS.B_FOCUS_X );
	const _centerOfMass = new SharedVector2D( _B, SS.B_COM_X );
	let _vectorUtility      = new Vector2D();
	*/






        //-----------------------------------------
		// copy genotype values to this swimbot...
		//-----------------------------------------
        _genotype.copyFromGenotype( genotype );
		assert( _genotype != null, "_genotype != null" );

 		//--------------------------------
		// generate phenotype
		//--------------------------------
		_phenotype = embryology.generatePhenotypeFromGenotype( _genotype );

 		//--------------------------------
		// important
		//--------------------------------
		this.processPhenotype();

		//------------------------------------------------
		// initialize energy efficiency-related stuff
		//------------------------------------------------
	    _lastPositionForEfficiencyMeasurement.set( _position );
	    _B[ _b + SS.B_LAST_ENERGY ] = _B[ _b + SS.B_ENERGY ];

	    //console.log( "_lastPositionForEfficiencyMeasurement = " + _lastPositionForEfficiencyMeasurement );
	    //console.log( "_B[ _b + SS.B_LAST_ENERGY ] = " + _B[ _b + SS.B_LAST_ENERGY ] );
	    //console.log( "_B[ _b + SS.B_EFFICIENCY ] = " + _B[ _b + SS.B_EFFICIENCY ] );

    	//--------------------------------
	    // initialize brain
	    //--------------------------------
        _embryology = embryology;

        _brain.initialize();
        // the pool's hunger setting (was always the default 50, even after the
        // slider moved) times this swimbot's inherited factor
        _baseHungerThreshold = globalTweakers.hungerThreshold;
        _brain.setHungerThreshold( _baseHungerThreshold * this.getHungerFactor() );
        _brain.setPredatorLevel( this.getPredatorLevel() );
        _brain.setEnergyLevel( _B[ _b + SS.B_ENERGY ] );
        _brain.update();
	}


	//-----------------------------------
    this.setHungerThreshold = function(t)
    {
        // the pool's setting t, times this swimbot's own (inherited) factor
        _baseHungerThreshold = t;
        t = t * this.getHungerFactor();
        _brain.setHungerThreshold(t);
    }


	//---------------------------------------------------------------
	// should be called after "generatePhenotypeFromGenotype"
	//---------------------------------------------------------------
    this.processPhenotype = function()
    {
        // limb tips (parts nobody grows from)
        _numTips = 0;
        for (let p=1; p<_phenotype.numParts; p++)
        {
            let hasChild = false;
            for (let q=1; q<_phenotype.numParts; q++) { if ( _phenotype.parts[q].parent === p ) { hasChild = true; break; } }
            if ( !hasChild ) { _numTips ++; }
        }

        // part colours and the width at the part's start (a "splined" part
        // grows from its parent's width, as the detailed drawing shows it),
        // in dense arrays, for drawing on the graphics card
        for (let p=0; p<_phenotype.numParts; p++)
        {
            _partRGB[ p * 3     ] = _phenotype.parts[p].red;
            _partRGB[ p * 3 + 1 ] = _phenotype.parts[p].green;
            _partRGB[ p * 3 + 2 ] = _phenotype.parts[p].blue;
            const parent = _phenotype.parts[p].parent;
            // (never thinner than half its own width: a part growing from the
            // zero-width root would be a needle, and from afar a body of two or
            // three such needles reads as a thin tick)
            _partStartWidth[p] = ( _phenotype.parts[p].splined && ( parent >= 0 ) && ( parent < _phenotype.numParts ))
                               ? Math.max( 0.5 * _phenotype.parts[p].width, _phenotype.parts[ parent ].width ) : _phenotype.parts[p].width;
        }

		//-----------------------------------------------------
		// calculate masses and total part length
		//-----------------------------------------------------
        _phenotype.mass = ZERO;
		assert( _phenotype.numParts > 0, "_phenotype.numParts > 0" );

		_phenotype.sumPartLengths = ZERO;

		for (let p=1; p<_phenotype.numParts; p++)
		{
			_phenotype.sumPartLengths += _phenotype.parts[p].length;

			assert( _phenotype.parts[p].length > ZERO, "_phenotype.parts[p].length > ZERO" );
			assert( _phenotype.parts[p].width  > ZERO, "_phenotype.parts[p].width  > ZERO" );

			_phenotype.parts[p].mass = _phenotype.parts[p].length * _phenotype.parts[p].width;

			assert( _phenotype.parts[p].mass > ZERO, "_phenotype.parts[p].mass > ZERO" );

			_phenotype.mass += _phenotype.parts[p].mass;
		}

        assert( _phenotype.mass > ZERO, "_phenotype.mass > ZERO" );

		//--------------------------------
		// compute moment factors
		//--------------------------------
		this.computeMomentFactors();

		//--------------------------------
		// copy the parts into the arrays
		//--------------------------------
		this.loadPartArrays();

    	//--------------------------------
	    // create that body...now
	    //--------------------------------
        this.updateBodyParts();

/*
		//----------------------------
		// calculate select radius
		//----------------------------

//fix!  doesn't work on infants!

		_B[ _b + SS.B_SELECT_RADIUS ] = ZERO;

		for (let p=1; p<_phenotype.numParts; p++)
		{
		    for (let o=1; o<_phenotype.numParts; o++)
	    	{
	    	    if ( o != p )
	    	    {
	    	        let distance = _phenotype.parts[p].position.getDistanceTo( _phenotype.parts[o].position );
	    	        if ( distance > _B[ _b + SS.B_SELECT_RADIUS ] )
	    	        {
	    	            _B[ _b + SS.B_SELECT_RADIUS ] = distance;
	    	        }
	    	    }
    		}
		}

		//-------------------------------------------------------------------------
		// HACK...
		// I don't know why - but this makes is come out basically okay...
		//-------------------------------------------------------------------------
		//_B[ _b + SS.B_SELECT_RADIUS ] = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( _B[ _b + SS.B_SELECT_RADIUS ] );

		if ( _B[ _b + SS.B_SELECT_RADIUS ] < MIN_SELECT_RADIUS )
		{
		    _B[ _b + SS.B_SELECT_RADIUS ] = MIN_SELECT_RADIUS;
		}
*/
		//--------------------------------
		// do this
		//--------------------------------
        _B[ _b + SS.B_TIMER_DELTA ] = ZERO;

        //-----------------------------------------------------
        // bigger bodies cost more to keep alive (Kleiber's law)
        //-----------------------------------------------------
        _B[ _b + SS.B_BASAL ] = BASAL_METABOLISM * Math.pow( _phenotype.mass, 0.75 );
        _averageColor    = null;

        //-----------------------------------------------------
        // ecology traits
        //-----------------------------------------------------
        _M[ _m + SS.M_THERMAL_OPT ] = ( _phenotype.thermalOptimum !== undefined ) ? _phenotype.thermalOptimum : ONE_HALF;
        _M[ _m + SS.M_THERMAL_WIDTH ]   = ( _phenotype.thermalWidth   !== undefined ) ? _phenotype.thermalWidth   : 0.4;
        _digestion      = ( _phenotype.digestion      !== undefined ) ? _phenotype.digestion      : ONE_HALF;
        _brightness     = ( _phenotype.brightness     !== undefined ) ? _phenotype.brightness     : ONE_HALF;
        _choosiness     = ( _phenotype.choosiness     !== undefined ) ? _phenotype.choosiness     : ZERO;
        _M[ _m + SS.M_THERMAL_PEAK ]    = thermalPeak( _M[ _m + SS.M_THERMAL_WIDTH ] );
        const size      = bodySize( _phenotype.mass );
        _efficiencyWarm = digestionEfficiency( _digestion, PLANT_TYPE_WARM ) * sizeDietFactor( size, PLANT_TYPE_WARM );
        _efficiencyCold = digestionEfficiency( _digestion, PLANT_TYPE_COLD ) * sizeDietFactor( size, PLANT_TYPE_COLD );
        _M[ _m + SS.M_COMFORT ]        = -ONE;
        this.updateThermalFit();
        this.writeStaticPerception();

        // what the decision kernel needs from the phenotype and the genes
        _M[ _m + SS.M_AUTOTOMY_THREAT ] = _phenotype.autotomyThreat || 0;
        _M[ _m + SS.M_PHENO_PARTS ]     = _phenotype.numParts;
        _M[ _m + SS.M_PERSIST ]         = geneAverage( _genotype, GENES_PERSISTENCE );
        _M[ _m + SS.M_INVEST ]          = 0.15 + 0.7 * geneAverage( _genotype, GENES_INVESTMENT );
        _M[ _m + SS.M_SIZE_PICKY ]      = geneAverage( _genotype, GENES_SIZE_PICKINESS );
        _M[ _m + SS.M_DEFERENCE ]       = geneAverage( _genotype, GENES_DEFERENCE );
        _M[ _m + SS.M_WEAK_PREF ]       = geneAverage( _genotype, GENES_WEAK_PREY );
        _M[ _m + SS.M_CANNIBAL_GENE ]   = geneAverage( _genotype, GENES_CANNIBAL );
        _M[ _m + SS.M_CURRENT_W ]       = geneAverage( _genotype, GENES_CURRENT );
        for (let k = 0; k < 4; k++) { _M[ _m + SS.M_IMMUNE_0 + k ] = _genotype.getGeneValue( GENES_IMMUNE[k] ) / 255; }
        _B[ _b + SS.B_RUDDER ]          = RUDDER_MAX_TURN * geneAverage( _genotype, GENES_RUDDER );
        _M[ _m + SS.M_MATURE_AGE ]      = SIZE_MATURITY_ENABLED
            ? YOUNG_AGE_DURATION * Math.min( 4, Math.max( 0.5, _phenotype.mass / 410 ))
            : YOUNG_AGE_DURATION;
        _M[ _m + SS.M_VIEW_RADIUS ]     = SIZE_SCALED_VISION_ENABLED ? SWIMBOT_VIEW_RADIUS * Math.pow( Math.max( 1, _phenotype.mass ) / 410, 0.2 ) : SWIMBOT_VIEW_RADIUS;
        _M[ _m + SS.M_GRAB_RADIUS ]     = SIZE_SCALED_GRAB_ENABLED ? FOOD_BIT_GRAB_RADIUS * Math.pow( Math.max( 1, _phenotype.mass ) / 410, 0.25 ) : FOOD_BIT_GRAB_RADIUS;
        _M[ _m + SS.M_MAX_ENERGY ]      = MASS_SCALED_STOMACH_ENABLED
            ? Math.max( 60, SWIMBOT_MAX_ENERGY * Math.pow( _phenotype.mass / 410, 0.75 ))
            : BIG_BODY_STOMACH_ENABLED
                ? SWIMBOT_MAX_ENERGY * Math.max( 1, _phenotype.mass / STOMACH_REFERENCE_MASS )
                : SWIMBOT_MAX_ENERGY;
        if ( _slot >= 0 ) { _shared.brainWeights.set( _genotype.getBrain(), _slot * BRAIN_SIZE ); }

        // the inherited hunger threshold (environment pool; classic pools: the setting)
        _brain.setHungerThreshold( _baseHungerThreshold * this.getHungerFactor() );

        //-----------------------------------------------------
        // the predator gene may have changed (zap, gene tweak)
        //-----------------------------------------------------
        _brain.setPredatorLevel( this.getPredatorLevel() );
    }


	//---------------------------------------------------------------------
	// apply predator level: rewrites the predator genes and regrows the phenotype,
	// so the change is also inherited by offspring
	//---------------------------------------------------------------------
	this.applyPredatorLevel = function( level )
	{
	    assert( _embryology != null, "Swimbot:applyPredatorLevel: _embryology != null" );

	    setTrait( _genotype, GENES_PREDATOR, Math.max( ZERO, Math.min( ONE, level ) ) );
	    _phenotype = _embryology.generatePhenotypeFromGenotype( _genotype );
	    this.processPhenotype();

	    _M[ _m + SS.M_PREY ] = NULL_INDEX;
	    _M[ _m + SS.M_NEAR_PRED ] = NULL_INDEX;
	    _M[ _m + SS.M_TRY_HUNT ]    = 0;
	    _brain.setFoundPrey( false );
	    _brain.setNearbyPredatorThreat( false );
	}


	//-----------------------------------------
	this.zap = function( embryology, amount )
	{
	    _genotype.zap( amount );
		assert( _genotype != null, "_genotype != null" );

 		//--------------------------------
		// generate phenotype
		//--------------------------------
		_phenotype = embryology.generatePhenotypeFromGenotype( _genotype );

 		//--------------------------------
		// important
		//--------------------------------
        this.processPhenotype();
     }


	//---------------------------------------------------------------
	this.setGeneValue = function( geneIndex, geneValue, embryology )
	{
	    console.log( geneIndex  + ", " + geneValue );

 		//--------------------------------
		// set gene value
		//--------------------------------
    	_genotype.setGeneValue( geneIndex, geneValue );

 		//--------------------------------
		// generate phenotype
		//--------------------------------
		_phenotype = embryology.generatePhenotypeFromGenotype( _genotype );

 		//--------------------------------
		// important
		//--------------------------------
		this.processPhenotype();
	}






	this.cancelEating     = function() { _M[ _m + SS.M_TRY_EAT ] = 0; }
	this.getChosenFoodBit = function() { return chosenFoodBit(); }








	this.getUsesNeuralBrain = function() { return _M[ _m + SS.M_NEURAL ] === 1;        }

	this.getEffort          = function() { return _B[ _b + SS.B_EFFORT ];        }
	this.getClimateWeight   = function() { return _M[ _m + SS.M_CLIMATE_W ]; }
	this.getSocialWeight    = function() { return _M[ _m + SS.M_SOCIAL_W ];  }
	this.getDrives          = function() { return _nnOutputs;     }


	//------------------------------------------------------------------------
	this.updateThermalFit = function()
	{
	    _M[ _m + SS.M_THERMAL_FIT ] = environment.active
	        ? thermalFit( this.getBodyTemperature(), _M[ _m + SS.M_THERMAL_OPT ], _M[ _m + SS.M_THERMAL_WIDTH ] )
	        : ONE;
	}

	this.updateBodyTemperature = function()
	{
	    const ambient = this.feltTemperature( _position.x, _position.y );
	    const meanBodyWidth = _B[ _b + SS.B_SUM_LENGTHS ] > ZERO ? _phenotype.mass / _B[ _b + SS.B_SUM_LENGTHS ] : ZERO;
	    if ( !BODY_TEMPERATURE_INERTIA_ENABLED )
	    {
	        _M[ _m + SS.M_BODY_TEMP ] = ambient;
	        _M[ _m + SS.M_BODY_TEMP_SET ] = 0;
	        return;
	    }

	    if ( !_M[ _m + SS.M_BODY_TEMP_SET ] )
	    {
	        _M[ _m + SS.M_BODY_TEMP ] = advanceBodyTemperature( ambient, ambient, _phenotype.mass, meanBodyWidth );
	        _M[ _m + SS.M_BODY_TEMP_SET ] = 1;
	    }
	    else
	    {
	        _M[ _m + SS.M_BODY_TEMP ] = advanceBodyTemperature( _M[ _m + SS.M_BODY_TEMP ], ambient, _phenotype.mass, meanBodyWidth );
	    }
	}

	// Current water temperature as sensed by the existing pigmentation model.
	this.feltTemperature = function( x, y )
	{
	    return environment.temperatureAt( x, y ) + THERMOMELANISM * ( ONE - 2 * _brightness );
	}

	this.getBodyTemperature = function()
	{
	    return BODY_TEMPERATURE_INERTIA_ENABLED && _M[ _m + SS.M_BODY_TEMP_SET ]
	        ? _M[ _m + SS.M_BODY_TEMP ]
	        : this.feltTemperature( _position.x, _position.y );
	}

	this.getAmbientTemperature = function()	{ return this.feltTemperature( _position.x, _position.y ); }

	//------------------------------------------------------------------------
	// does this swimbot accept the suitor as a mate? The more different their
	// brightness and the choosier I am, the less likely (fixed for a pair)
	//------------------------------------------------------------------------
	this.acceptsMate = function( suitor )
	{
	    if ( RANDOM_MATING_CONTROL ) return true;
	    if ( !environment.active ) return true;
	    const db = Math.abs( suitor.getBrightness() - _brightness );
	    return pairRandom( suitor.getIndex(), _index ) < mateAcceptance( db, _choosiness );
	}

	this.getBrightness      = function() { return _brightness;      }
	this.getHungerFactor    = function() { return ( _phenotype.hungerFactor !== undefined ) ? _phenotype.hungerFactor : ONE; }   // (inherited in every pool)

	// predators mate only with predators, herbivores with herbivores
	this.sameDiet = function( other )
	{
	    return ( this.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD ) === ( other.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD );
	}
	this.getAttractionCriterion = function() { return _brain.getAttractionCriterion(); }
	this.getChoosiness      = function() { return _choosiness;      }

	this.getDigestionEfficiency = function( type )
	{
	    if ( type === 2 ) return ONE;
	    return ( type === PLANT_TYPE_WARM ) ? _efficiencyWarm : _efficiencyCold;
	}

	this.getThermalFit      = function() { return _M[ _m + SS.M_THERMAL_FIT ];      }
	this.getThermalOptimum  = function() { return _M[ _m + SS.M_THERMAL_OPT ];  }
	this.getThermalWidth    = function() { return _M[ _m + SS.M_THERMAL_WIDTH ];    }
	this.getDigestion       = function() { return _digestion;       }
	this.getComfort         = function() { return _M[ _m + SS.M_COMFORT ];         }



    //---------------------------------------------------------------------------
    // swimbot creates its own linear and angular forces via moving parts
    //---------------------------------------------------------------------------
	this.calculateFluidForces = function()
	{
        //-----------------------------------------------------
        // clear these out - they will be filled-in below...
        //-----------------------------------------------------
	    _acceleration.clear();
	    _torque = ZERO;
	    const motion = bodyMotionFactors( _phenotype.mass, _B[ _b + SS.B_SUM_LENGTHS ] > ZERO ? _phenotype.mass / _B[ _b + SS.B_SUM_LENGTHS ] : ZERO );

        //----------------------------------------
        // loop through parts...
        //----------------------------------------
        assert( _B[ _b + SS.B_NUM_PARTS ] > 0, "_B[ _b + SS.B_NUM_PARTS ] > 0" );

		for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
		{
		    //---------------------------------------------------------
		    // calculate this part's fraction of the total length
		    //---------------------------------------------------------
            const i = p * PS;
            let fractionOfWhole = _pLength[p] / _B[ _b + SS.B_SUM_LENGTHS ];

		    //---------------------------------------------------------
		    // calculate velocity
		    //---------------------------------------------------------
            _pd[ i + V_X ] = _pd[ i + M_X ] - _pd[ i + Q_X ];
            _pd[ i + V_Y ] = _pd[ i + M_Y ] - _pd[ i + Q_Y ];

            /*
		    //---------------------------------------------------------
		    // get part axis
		    //---------------------------------------------------------
            _phenotype.parts[p].axis.x = _phenotype.parts[p].position.x - _phenotype.parts[ _phenotype.parts[p].parent ].position.x;
            _phenotype.parts[p].axis.y = _phenotype.parts[p].position.y - _phenotype.parts[ _phenotype.parts[p].parent ].position.y;

		    //---------------------------------------------------------
		    // get perpendicular of part axis
		    //---------------------------------------------------------
            _phenotype.parts[p].perpendicular.setXY( _phenotype.parts[p].axis.y / _phenotype.parts[p].length, -_phenotype.parts[p].axis.x / _phenotype.parts[p].length );
            */

		    //---------------------------------------------------------
		    // get stroke amplitude
		    //---------------------------------------------------------
            let strokeAmplitude = ( _pd[ i + V_X ] * _pd[ i + N_X ] + _pd[ i + V_Y ] * _pd[ i + N_Y ] ) * fractionOfWhole;

            let strokeForceX = _pd[ i + N_X ] * strokeAmplitude;
            let strokeForceY = _pd[ i + N_Y ] * strokeAmplitude;

            //-------------------------------------------------
            // calcualte energy lost from stroke
		    //
		    // hey: this might be more accurate to nature if
		    // it were something like angle bend times mass.
            //--------------------------------------------------
            if ( motion.enabled )
                _B[ _b + SS.B_ENERGY ] -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING * motion.strokeCost;
            else
                _B[ _b + SS.B_ENERGY ] -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING;

            if ( _B[ _b + SS.B_ENERGY ] < ZERO )
            {
                _B[ _b + SS.B_ENERGY ] = ZERO;
            }

            //-------------------------------------------------
            // calculate part vector from center
            //-------------------------------------------------
            let partVectorFromCenterX = _pd[ i + M_X ] - _position.x;
            let partVectorFromCenterY = _pd[ i + M_Y ] - _position.y;

            //-------------------------------------------------
            // calculate part distance from center
            //-------------------------------------------------
            let xx = partVectorFromCenterX * partVectorFromCenterX;
            let yy = partVectorFromCenterY * partVectorFromCenterY;
            let distance = Math.sqrt( xx*xx + yy*yy );

            if ( distance > ZERO )
            {
                //-------------------------------------------------
                // calculate part direction from center
                //-------------------------------------------------
                let partDirectionFromCenterX = partVectorFromCenterX / distance;
                let partDirectionFromCenterY = partVectorFromCenterY / distance;

/*
//---------------------------------------------------------------
// get dot of strokeForce with partDirectionFromCenter
//---------------------------------------------------------------
let dot = strokeForceX * partDirectionFromCenterX + strokeForceY * partDirectionFromCenterY;
//let dot = ONE - ( strokeForceX * partDirectionFromCenterX + strokeForceY * partDirectionFromCenterY );
//let dot = -ONE + ( strokeForceX * partDirectionFromCenterX + strokeForceY * partDirectionFromCenterY );
//let dot = 1.0; //strokeForceX * partDirectionFromCenterX + strokeForceY * partDirectionFromCenterY;
//let dot = -ONE;

//--------------------------------------------------------
// set part acceleration
//--------------------------------------------------------
let partAccelerationX = partDirectionFromCenterX * dot;
let partAccelerationY = partDirectionFromCenterY * dot;
*/

let partAccelerationX = motion.enabled ? -strokeForceX * motion.acceleration : -strokeForceX;
let partAccelerationY = motion.enabled ? -strokeForceY * motion.acceleration : -strokeForceY;

                //-------------------------------
                // accumulate acceleration
                //-------------------------------
                _acceleration.x += partAccelerationX;
                _acceleration.y += partAccelerationY;

                //------------------------------------------------
                // calculate perpendicular
                //------------------------------------------------
                let partPerpendicularX =  partVectorFromCenterY;
                let partPerpendicularY = -partVectorFromCenterX;

                //let partPerpendicularX =  partDirectionFromCenterY;
                //let partPerpendicularY = -partDirectionFromCenterX;

                //---------------------------------------------------------------
                // get dot of strokeForce with partPerpendicular
                //---------------------------------------------------------------
                let perpDot = ( strokeForceX * partPerpendicularX + strokeForceY * partPerpendicularY ) / _B[ _b + SS.B_SUM_LENGTHS ];

                //-------------------------------
                // accumulate torque
                //-------------------------------
                let previousTorque = _torque;
                _torque -= perpDot;

                /*
                //------------------------------------------------------------------
                // contradictory torque (cancelling-out) goes into acceleration...
                //------------------------------------------------------------------
                let torqueBecameSmaller = false;

                if ( Math.abs( _torque ) < Math.abs( previousTorque ) )
                {
                    partAccelerationX += 0.0;
                    partAccelerationY += 0.0;
                }
                */
            }
        }

        //-----------------------------------------------------------------
        // apply linear and angular forces to velocity and spin
        //-----------------------------------------------------------------
        _velocity.add( _acceleration );
        if ( motion.enabled )
        {
            const drag = applyWaterDrag( _velocity.x, _velocity.y, _phenotype.mass, motion.drag );
            _velocity.setXY( drag.velocityX, drag.velocityY );
            _B[ _b + SS.B_ENERGY ] = Math.max( ZERO, _B[ _b + SS.B_ENERGY ] - drag.energyCost );
        }
        _B[ _b + SS.B_SPIN ] += _torque;// * SPIN_SCALAR;
//_B[ _b + SS.B_SPIN ] *= SPIN_DECAY;

		//--------------------------------------------------
		// update position by velocity, and angle by spin
		//--------------------------------------------------
        _position.add( _velocity );
        _B[ _b + SS.B_ANGLE ] += _B[ _b + SS.B_SPIN ];
    }





	//----------------------------------------
	// calculate energy efficiency
	//----------------------------------------
	this.calculateEnergyEfficiency = function()
	{
	    //-----------------------------------------------
        // measure distance traveled and energy lost
	    //-----------------------------------------------
        let distanceTraveled = _position.getDistanceTo( _lastPositionForEfficiencyMeasurement );
        //console.log( distanceTraveled );

        let averageSpeed = distanceTraveled / ENERGY_EFFICIENCY_MEASUREMENT_PERIOD;
        let energyLost   = _B[ _b + SS.B_LAST_ENERGY ] - _B[ _b + SS.B_ENERGY ];

        //----------------------------------------------------------
        //if swimbot ate food, energy went up, so cancel that....
        //----------------------------------------------------------
        if ( energyLost < ZERO )
        {
            energyLost = ZERO;
        }

        //------------------------------
        // calculate efficiency
        //------------------------------
        _B[ _b + SS.B_EFFICIENCY ] = averageSpeed / ( ONE + energyLost );

        // reset these values for the next go-round...
        _lastPositionForEfficiencyMeasurement.set( _position );
        _B[ _b + SS.B_LAST_ENERGY ] = _B[ _b + SS.B_ENERGY ];
    }


	//----------------------------------------
	// update wall collisions
	//----------------------------------------
	this.updateWallCollisions = function()
	{
        //--------------------------------------------------------------------
        // left wall
        //--------------------------------------------------------------------
        if ( _position.x < POOL_LEFT + _B[ _b + SS.B_SUM_LENGTHS ] * ONE_HALF )
        {
            //console.log( "left " );
            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                let radius = _pLength[p] + _pWidth[p];
                let limit = POOL_LEFT + radius;

                if ( _pd[ p * PS + P_X ] < limit )
                {
                    let penetration = limit - _pd[ p * PS + P_X ];

                    _position.x         += penetration * WALL_BOUNCE;
                    _velocity.x         += penetration * WALL_BOUNCE;
                    _directionToGoal.x  += penetration * WALL_BOUNCE;
                    _directionToGoal.normalize();
                }
            }
        }
        //-------------------------------------------------------------------------
        // right wall
        //-------------------------------------------------------------------------
        else if ( _position.x > POOL_RIGHT - _B[ _b + SS.B_SUM_LENGTHS ] * ONE_HALF )
        {
            //console.log( "right " );
            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                let radius = _pLength[p] + _pWidth[p];
                let limit = POOL_RIGHT - radius;

                if ( _pd[ p * PS + P_X ] > limit )
                {
                    let penetration = limit - _pd[ p * PS + P_X ];

                    _position.x         += penetration * WALL_BOUNCE;
                    _velocity.x         += penetration * WALL_BOUNCE;
                    _directionToGoal.x  += penetration * WALL_BOUNCE;
                    _directionToGoal.normalize();
                }
            }
        }

        //------------------------------------------------------------------------------
        // top wall
        //------------------------------------------------------------------------------
        if ( _position.y < POOL_TOP + _B[ _b + SS.B_SUM_LENGTHS ] * ONE_HALF )
        {
            //console.log( "top" );

            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                let radius = _pLength[p] + _pWidth[p];
                let limit = POOL_TOP + radius;

                if ( _pd[ p * PS + P_Y ] < limit )
                {
                    let penetration = limit - _pd[ p * PS + P_Y ];

                    _position.y         += penetration * WALL_BOUNCE;
                    _velocity.y         += penetration * WALL_BOUNCE;
                    _directionToGoal.y  += penetration * WALL_BOUNCE;
                    _directionToGoal.normalize();
                }
            }
        }
        //------------------------------------------------------------------------------
        // bottom wall
        //------------------------------------------------------------------------------
        else if ( _position.y > POOL_BOTTOM - _B[ _b + SS.B_SUM_LENGTHS ] * ONE_HALF )
        {
            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                let radius = _pLength[p] + _pWidth[p];
                let limit = POOL_BOTTOM - radius;

                if ( _pd[ p * PS + P_Y ] > limit )
                {
                    let penetration = limit - _pd[ p * PS + P_Y ];

                    _position.y         += penetration * WALL_BOUNCE;
                    _velocity.y         += penetration * WALL_BOUNCE;
                    _directionToGoal.y  += penetration * WALL_BOUNCE;
                    _directionToGoal.normalize();
                }
            }
        }
    }

	//---------------------------
	// set position
	//---------------------------
	this.setPosition = function(p)
	{
        _position.set(p);

		//-----------------------------------------
		// here is where I shift all my body nodes
		// to keep my center of mass in place...
		//-----------------------------------------
        this.adjustToCenterOfMass();

		//------------------------------------
		// I need to do this again because I
		// just did an adjustToCenterOfMass
		//------------------------------------
		this.calculateCenterOfMass();
    }


	//---------------------------
	// set velocity
	//---------------------------
	this.setVelocity = function(v)
	{
        _velocity.set(v);
    }

	//---------------------------------
	// add to velocity
	//---------------------------------
	this.addForce = function( force )
	{
	    _velocity.add( force );
    }


	//---------------------------
	// set energy
	//---------------------------
	this.setEnergy = function(e)
	{
        _B[ _b + SS.B_ENERGY ] = e;
    }

	//---------------------------
	// set angle
	//---------------------------
	this.setAngle = function(a)
	{
        _B[ _b + SS.B_ANGLE ] = a;
    }


	//--------------------------------------------------------------------------------------------------------
	// get functions
	//--------------------------------------------------------------------------------------------------------
	this.getIsTryingToEat               = function() { return _M[ _m + SS.M_TRY_EAT ] === 1;                                 }
	this.getIsTryingToMate              = function() { return _M[ _m + SS.M_TRY_MATE ] === 1;                                }
	this.getIndex                       = function() { return _index;                                       }
	this.getAge                         = function() { return _B[ _b + SS.B_AGE ];                                         }
	this.getAlive                       = function() { return _live[ _liveAt ] === 1;                       }
	this.getEnergy                      = function() { return _B[ _b + SS.B_ENERGY ];                                      }
	this.getAngle                       = function() { return _B[ _b + SS.B_ANGLE ];                                       }
	this.getEnergyEfficiency            = function() { return _B[ _b + SS.B_EFFICIENCY ];                            }
	this.getPosition                    = function() { return _position;                                    }
	this.getSpeed                       = function() { return _velocity.getMagnitude();                     }
	this.getBoundingRadius              = function() { return _phenotype.sumPartLengths;                    }
	this.getNumParts                    = function() { return _phenotype.numParts;                          }
	this.getIsLookingForSensoryInput    = function() { return _M[ _m + SS.M_READY ] === 1;                 }
	this.getGenitalPosition             = function() { return _genitalPosition;                             }
	this.getMouthPosition               = function() { return _mouthPosition;                               }
	this.getChosenMateIndex             = function() { return _M[ _m + SS.M_MATE ];                             }
	this.getChosenFoodBitIndex          = function() { return _M[ _m + SS.M_FOOD ];                          }
	this.getNumOffspring                = function() { return _numOffspring;                                }
	this.getNumFoodBitsEaten            = function() { return _numFoodBitsEaten;                            }
    this.getBrainState                  = function() { return _brain.getState();                            }
    this.getGenotype                    = function() { return _genotype;                                    }
	this.getPreyValueWeight             = function() { return sigmoid( _nnOutputs[ OUT_PREY_VALUE ] ); }
	this.getPreyTravelWeight            = function() { return sigmoid( _nnOutputs[ OUT_PREY_TRAVEL ] ); }
	this.getPreyBaitBias                = function() { return Math.tanh( _nnOutputs[ OUT_PREY_BAIT ] ); }
	this.getSelectRadius                = function() { return _B[ _b + SS.B_SELECT_RADIUS ];                                }
	this.getPreferredFoodType           = function() { return _phenotype.preferredFoodType;                 }
	this.getDigestibleFoodType          = function() { return _phenotype.digestibleFoodType;                }
	this.getIsTryingToHunt              = function() { return _M[ _m + SS.M_TRY_HUNT ] === 1;                                }
	this.getNumPreyEaten                = function() { return _numPreyEaten;                                }
	this.getPhenotypeMass               = function() { return _phenotype.mass;                              }
	this.getFrequency                   = function() { return _B[ _b + SS.B_FREQUENCY ];                    }
	this.getInvestment                  = function() { return _M[ _m + SS.M_INVEST ];                       }
	this.getCannibalGene                = function() { return _M[ _m + SS.M_CANNIBAL_GENE ];                }
	this.getCurrentAwareness            = function() { return _M[ _m + SS.M_CURRENT_W ];                    }
	let _deathCause = "";
	this.getIsSick = function() { return _M[ _m + SS.M_DISEASE ] > 0; }
	this.getDeathCause                  = function() { return _deathCause; }

	//------------------------------------------------------------------------
	// saving and loading a world (GenePool.saveWorld / loadWorld): what a
	// swimbot keeps outside the shared arrays
	//------------------------------------------------------------------------
	const DEATH_CAUSES = [ "", "other", "starvation", "old_age", "predation" ];
	this.PRIVATE_STATE_SIZE = 12;
	this.getPrivateState = function( out, at )
	{
	    out[ at     ] = _numOffspring;     out[ at + 1 ] = _numFoodBitsEaten; out[ at + 2 ] = _numPreyEaten;
	    out[ at + 3 ] = _numPartsEaten;    out[ at + 4 ] = _numCannibalized;  out[ at + 5 ] = _partsDropped;
	    out[ at + 6 ] = _numFilterMeals;   out[ at + 7 ] = _species;          out[ at + 8 ] = _torque;
	    out[ at + 9 ] = _baseHungerThreshold;
	    out[ at + 10 ] = Math.max( 0, DEATH_CAUSES.indexOf( _deathCause ));
	    out[ at + 11 ] = 0;
	}
	this.setPrivateState = function( src, at )
	{
	    _numOffspring = src[ at ];         _numFoodBitsEaten = src[ at + 1 ]; _numPreyEaten = src[ at + 2 ];
	    _numPartsEaten = src[ at + 3 ];    _numCannibalized = src[ at + 4 ];  _partsDropped = src[ at + 5 ];
	    _numFilterMeals = src[ at + 6 ];   _species = src[ at + 7 ];          _torque = src[ at + 8 ];
	    _baseHungerThreshold = src[ at + 9 ];
	    _deathCause = DEATH_CAUSES[ src[ at + 10 ] ] || "";
	}

	// the first numbers of the parts that are left, in their order (-1 = no part)
	this.getPhenotypeOrigins = function( out, at )
	{
	    for (let p = 0; p < MAX_PARTS; p++) { out[ at + p ] = ( p < _phenotype.numParts ) ? _phenotype.parts[p].origin : -1; }
	}

	// a body grown from the genes (create) is put back as it was after autotomy:
	// the parts that are left, in their order, the others behind them
	this.restorePhenotypeOrder = function( origins, at )
	{
	    const kept = [];
	    for (let p = 0; p < MAX_PARTS && origins[ at + p ] >= 0; p++) { kept.push( origins[ at + p ] ); }
	    const fresh = _phenotype.parts;
	    let identity = ( kept.length === _phenotype.numParts );
	    for (let p = 0; identity && p < kept.length; p++) { identity = ( kept[p] === p ); }
	    if ( identity || kept.length < 2 ) return;

	    const newIndex = new Array( fresh.length ).fill( NULL_INDEX );
	    kept.forEach( ( o, i ) => { newIndex[ o ] = i; } );
	    const order = kept.map( o => fresh[ o ] );
	    for ( const part of order )
	    {
	        part.parent = ( part.parent >= 0 ) ? newIndex[ part.parent ] : part.parent;
	        part.child  = ( part.child  >= 0 ) ? newIndex[ part.child  ] : part.child;
	    }
	    for (let p = 0; p < fresh.length; p++) { if ( newIndex[p] === NULL_INDEX ) { order.push( fresh[p] ); } }
	    _phenotype.parts    = order;
	    _phenotype.numParts = kept.length;
	    this.processPhenotype();
	}
	// the family numbers (KIN_NOT_EATEN_ENABLED)
	this.setFamily = function( serial, parentA, parentB ) { _M[ _m + SS.M_SERIAL ] = serial; _M[ _m + SS.M_PARENT_A ] = parentA; _M[ _m + SS.M_PARENT_B ] = parentB; }
	this.getSerial = function() { return _M[ _m + SS.M_SERIAL ]; }
	this.getGrowthScale                 = function() { return _B[ _b + SS.B_GROWTH ]; }   // (0 an egg .. 1 grown up)
	this.getMorphologySummary           = function()
	{
	    const numParts = _phenotype.numParts;
	    let widthSum = ZERO, maxWidth = ZERO, meanLength = ZERO, branchParts = 0;
	    for (let p = 0; p < numParts; p++)
	    {
	        const part = _phenotype.parts[p];
	        widthSum += part.width;
	        meanLength += part.length;
	        if ( part.width > maxWidth ) maxWidth = part.width;
	        if ( part.branch ) branchParts ++;
	    }
	    return {
	        numParts,
	        mass       : _phenotype.mass,
	        meanWidth  : numParts ? widthSum / numParts : ZERO,
	        maxWidth,
	        meanLength : numParts ? meanLength / numParts : ZERO,
	        branchParts,
	        branchFraction : numParts ? branchParts / numParts : ZERO,
	    };
	}
	this.getEvolutionTraits = function()
	{
	    const morphology = this.getMorphologySummary();
	    return {
	        mass: morphology.mass,
	        meanWidth: morphology.meanWidth,
	        numParts: morphology.numParts,
	        branchFraction: morphology.branchFraction,
	        thermalOptimum: _M[ _m + SS.M_THERMAL_OPT ],
	        thermalWidth: _M[ _m + SS.M_THERMAL_WIDTH ],
	        digestion: _digestion,
	        brightness: _phenotype.brightness,
	        choosiness: _choosiness,
	        predatorLevel: _phenotype.predatorLevel,
	        hungerThreshold: _brain.getHungerThreshold(),
	        autotomyBite: _phenotype.autotomyBite,
	        autotomyThreat: _phenotype.autotomyThreat,
	        effort: _B[ _b + SS.B_EFFORT ],
	    };
	}
	this.getHungerThreshold             = function() { return _brain.getHungerThreshold();                  }
	this.getMaxEnergy                   = function() { return _M[ _m + SS.M_MAX_ENERGY ];                     }
	this.getMaxAge                      = function() { return globalTweakers.maximumLifeSpan;               }
	this.getOldAgeThreshold             = function() { return globalTweakers.maximumLifeSpan - OLD_AGE_DURATION; }
	this.getDynamicScanRadius           = function() { return _M[ _m + SS.M_SCAN_RADIUS ];                                  }
	this.getEternal                     = function() { return ( _B[ _b + SS.B_ETERNAL ] === 1 );                                     }
	this.isEternal                      = function() { return ( _B[ _b + SS.B_ETERNAL ] === 1 );                                     }
	this.setEternal                     = function(e) { _B[ _b + SS.B_ETERNAL ] = e ? 1 : 0; if ( _slot >= 0 ) { _shared.eternal[ _slot ] = e ? 1 : 0; } }

	//---------------------------------------
	this.getPredatorLevel = function()
	{
	    if (( _phenotype == null ) || ( _phenotype.predatorLevel === undefined ))
	    {
	        return ZERO;
	    }

	    return _phenotype.predatorLevel;
	}

	//---------------------------------------
	this.getChosenPreyIsValid = function()
	{
	    return (( chosenPrey() != null ) && chosenPrey().getAlive() );
	}

	//---------------------------------------
	this.getChosenMeatIsValid = function()
	{
	    return (( chosenFoodBit() != null ) && chosenFoodBit().getAlive() && ( chosenFoodBit().getType() === 2 ));
	}



	//---------------------------------------------------------
	// a predator just tried to bite me - flee from it now
	//---------------------------------------------------------
	this.notifyAttackedBy = function( predator )
	{
	    _M[ _m + SS.M_NEAR_PRED ] = indexOf( predator );
	    _brain.setNearbyPredatorThreat( true );
	}

	//---------------------------------------
	this.notifyTargetFound = function()
	{
	    _M[ _m + SS.M_SCAN_CD ] = PREY_SCAN_COOLDOWN;
	}


	//---------------------------------------
    this.getGoalDescription = function()
    {
        let brainState = _brain.getState();

             if ( brainState ===  BRAIN_STATE_RESTING            ) { return "resting";              }
        else if ( brainState ===  BRAIN_STATE_LOOKING_FOR_MATE   ) { return "looking for mate";     }
        else if ( brainState ===  BRAIN_STATE_PURSUING_MATE      ) { return "pursuing mate";        }
        else if ( brainState ===  BRAIN_STATE_LOOKING_FOR_FOOD   ) { return "looking for food bit"; }
        else if ( brainState ===  BRAIN_STATE_PURSUING_FOOD      ) { return "pursuing food bit";    }
        else if ( brainState ===  BRAIN_STATE_LOOKING_FOR_PREY   ) { return "looking for prey";     }
        else if ( brainState ===  BRAIN_STATE_PURSUING_PREY      ) { return "pursuing prey";        }
        else if ( brainState ===  BRAIN_STATE_FLEEING_PREDATOR   ) { return "fleeing predator";     }
        else if ( brainState ===  BRAIN_STATE_SELF_FEED          ) { return "consuming own tissue";  }

        return "(no goal identified)";
    }


	//---------------------------------------
    this.getAttractionDescription = function()
    {
        let a = _brain.getAttractionCriterion();

             if ( a === ATTRACTION_COLORFUL         ) { return "colorful";          }
        else if ( a === ATTRACTION_BIG              ) { return "big";               }
        else if ( a === ATTRACTION_HYPER            ) { return "hyper";             }
        else if ( a === ATTRACTION_LONG             ) { return "long";              }
        else if ( a === ATTRACTION_STRAIGHT         ) { return "straight";          }
        else if ( a === ATTRACTION_NO_COLOR         ) { return "no color";          }
        else if ( a === ATTRACTION_SMALL            ) { return "small";             }
        else if ( a === ATTRACTION_STILL            ) { return "still";             }
        else if ( a === ATTRACTION_SHORT            ) { return "short";             }
        else if ( a === ATTRACTION_CROOKED          ) { return "crooked";           }
        else if ( a === ATTRACTION_SIMILAR_COLOR    ) { return "similar color";     }
        else if ( a === ATTRACTION_SIMILAR_SIZE     ) { return "similar size";      }
        else if ( a === ATTRACTION_SIMILAR_HYPER    ) { return "similar hyper";     }
        else if ( a === ATTRACTION_SIMILAR_LENGTH   ) { return "similar length";    }
        else if ( a === ATTRACTION_SIMILAR_STRAIGHT ) { return "similar straight";  }
        else if ( a === ATTRACTION_RANDOM           ) { return "random";            }
        else if ( a === ATTRACTION_CLOSEST          ) { return "closest";           }

        return "(no attraction identified)";
    }


	//---------------------------
	// get part parent position
	//---------------------------
	this.getPartParentPosition = function(p)
	{
		const parent = _pParent[p];
		if ( parent == NULL_PART )
		{
			return _position;
		}

		_vectorUtility.setXY( _pd[ parent * PS + P_X ], _pd[ parent * PS + P_Y ] );
		return _vectorUtility;
	}



	//---------------------------
	// eatChosenFoodBit
	//---------------------------
	this.eatChosenFoodBit = function()
	{
    	//let foodBitIndex = NULL_INDEX;

    	//console.log( "let's eat this" );

        assert( chosenFoodBit() != null, "Swimbot:eatChosenFoodBit: chosenFoodBit() != null" );
        assert( chosenFoodBit().getAlive(), "Swimbot:eatChosenFoodBit: chosenFoodBit().getAlive()" );

        if (( chosenFoodBit() != null )
        &&  ( chosenFoodBit().getAlive() ))
        {
            let energyFromFoodBit = chosenFoodBit().getEnergy();

            if ( globalTweakers.numFoodTypes > 1 )
            {
                /*
                console.log( "-------------------------------" );
                console.log( " eating....." );
                console.log( "chosenFoodBit().getType() = " + chosenFoodBit().getType() );
                console.log( "_phenotype.digestibleFoodType  = " + _phenotype.digestibleFoodType  );
                console.log( " " );
                console.log( "-------------------------------" );
                */

                //----------------------------------------------------------------------
                // If the type of the chosen food bit is not compatible with the
                // digestible type of the swimbot, then it gets less energy...
                //----------------------------------------------------------------------
                // (meat, type 2, is always fully digestible for predators)
                if (( chosenFoodBit().getType() != 2 )
                &&  ( chosenFoodBit().getType() != _phenotype.digestibleFoodType ))
                {
                    //console.log( "decrease energy from food bit..." );
                    energyFromFoodBit *= FOOD_TYPE_OFFSET;
                }
            }

            // (a plant's age counts in the classic pools too)
            if ( !environment.active && ( chosenFoodBit().getType() !== 2 )) { energyFromFoodBit *= this.plantStageFactor( chosenFoodBit() ); }

            //----------------------------------------------------------------------
            // with the environment on: digestion and climate decide how much
            // of the food's energy I actually get
            //----------------------------------------------------------------------
            if ( environment.active )
            {
                // (meat: exactly the energy it holds, e.g. a dropped tail)
                energyFromFoodBit = ( chosenFoodBit().getType() === 2 ) ? chosenFoodBit().getEnergy()
                                  : chosenFoodBit().getEnergy()
                                  * this.plantStageFactor( chosenFoodBit() )
                                  * this.getDigestionEfficiency( chosenFoodBit().getType() )
                                  * climateFoodFactor( _M[ _m + SS.M_THERMAL_FIT ], _M[ _m + SS.M_THERMAL_PEAK ] );
            }

            // PLANT_SIZE_ENABLED: a bite off the plant, as much as the mouth takes
            // and the stomach has room for; the plant lives on with the rest
            let bitten = false;
            if ( PLANT_SIZE_ENABLED && environment.active && ( chosenFoodBit().getType() !== 2 ))
            {
                const plant  = chosenFoodBit();
                const gain   = Math.max( 0.05, energyFromFoodBit / Math.max( 1e-9, plant.getEnergy() ));     // (digestion and climate)
                const room   = Math.max( ZERO, _M[ _m + SS.M_MAX_ENERGY ] - _B[ _b + SS.B_ENERGY ] );
                const bite   = Math.min( biteEnergy( _phenotype.mass, plant.getAge(), plant.getEnergy() ), room / gain );
                if ( bite <= ZERO ) { _M[ _m + SS.M_TRY_EAT ] = 0; return _M[ _m + SS.M_FOOD ]; }      // too tough for my mouth, or full
                energyFromFoodBit = bite * gain;
                plant.setEnergy( plant.getEnergy() - bite );
                bitten = plant.getEnergy() >= PLANT_SPROUT_ENERGY * 0.1;
            }

            // (meat: only part of it is kept - the food pyramid)
            if ( chosenFoodBit().getType() === 2 ) { energyFromFoodBit *= MEAT_ASSIMILATION; }
            _B[ _b + SS.B_ENERGY ] += energyFromFoodBit;

            _numFoodBitsEaten ++;
            if ( chosenFoodBit().getType() === 2 )
            {
                simCounters.meatMeals ++;
                if ( _brain.getState() === BRAIN_STATE_PURSUING_PREY ) simCounters.meatMealsWhilePursuing ++;
                if ( chosenFoodBit().getAutotomyDecoy && chosenFoodBit().getAutotomyDecoy() ) simCounters.autotomyDecoysEaten ++;
            }
            else { simCounters.plantMeals ++; }

            assert( chosenFoodBit().getEnergy() >= ZERO, "Swimbot:eatChosenFoodBit: chosenFoodBit().getEnergy() >= ZERO" );

            _M[ _m + SS.M_TRY_EAT ] = 0;

            _B[ _b + SS.B_TIMER_DELTA ] = ZERO;

            //foodBitIndex = chosenFoodBit().getIndex();

            assert( _M[ _m + SS.M_FOOD ] != NULL_INDEX, "Swimbot:eatChosenFoodBit: _M[ _m + SS.M_FOOD ] != NULL_INDEX" );

            if ( !bitten )
            {
                _parent.plantEaten( chosenFoodBit() );
                chosenFoodBit().kill();
            }

// somehow, the swimbot is still looking for food even when it is too far away
// not sure if this is the right place to fix, but it needs fixing
            //_brain.setFoundFoodBit( false );
        }

        return _M[ _m + SS.M_FOOD ];
    }


	//------------------------------------------------------------------------
	// huntEatChosenPrey: the prey dies and its energy goes to the predator.
	// Whatever doesn't fit under the max energy drops as red meat.
	//------------------------------------------------------------------------
	this.huntEatChosenPrey = function()
	{
	    _M[ _m + SS.M_TRY_HUNT ] = 0;

	    if (( !this.getChosenPreyIsValid() )
	    ||  ( chosenPrey().isEternal() ))
	    {
	        return;
	    }

	    _M[ _m + SS.M_HUNT_CD ] = ATTACK_COOLDOWN;

	    //-----------------------------------------------
	    // missed! the prey gets away and starts fleeing
	    //-----------------------------------------------
	    // PREDATOR_GAPE_CURVE_ENABLED: big prey is harder to catch and takes longer
	    const sizeRatio = chosenPrey().getPhenotypeMass() / Math.max( 1, _phenotype.mass );
	    let gape = PREDATOR_GAPE_CURVE_ENABLED ? Math.min( ONE, Math.max( GAPE_SUCCESS_FLOOR, 1.5 - sizeRatio )) : ONE;
	    // LIMB_SPINES_ENABLED: every limb tip beyond two is a spine in the throat
	    if ( LIMB_SPINES_ENABLED ) { gape *= Math.max( LIMB_SPINE_FLOOR, ONE - LIMB_SPINE_EFFECT * Math.max( 0, chosenPrey().getNumLimbTips() - 2 )); }
	    if ( PREDATOR_GAPE_CURVE_ENABLED ) { _M[ _m + SS.M_HUNT_CD ] = ATTACK_COOLDOWN * ( 1 + GAPE_COOLDOWN_SLOPE * sizeRatio ); }
	    if ( gpRandom() > ( environment.active ? ENVIRONMENT_ATTACK_SUCCESS_CHANCE : ATTACK_SUCCESS_CHANCE ) * gape )
	    {
	        simCounters.failedAttacks ++;
	        chosenPrey().notifyAttackedBy( this );
	        return;
	    }

	    let preyPosition = new Vector2D();
	    preyPosition.set( chosenPrey().getPosition() );

	    // autotomy: the prey may drop a part and get away; I eat the part
	    const dropped = chosenPrey().tryAutotomyOnBite();
	    if ( dropped !== null )
	    {
	        simCounters.autotomyBiteDrops ++;
	        _B[ _b + SS.B_ENERGY ] += Math.min( Math.max( ZERO, _M[ _m + SS.M_MAX_ENERGY ] - _B[ _b + SS.B_ENERGY ] ), dropped.energy * MEAT_ASSIMILATION );
	        chosenPrey().notifyAttackedBy( this );
	        _numPartsEaten ++;
	        _B[ _b + SS.B_TIMER_DELTA ] = ZERO;
	        return;
	    }

	    // the prey's energy (a part) and its body
	    // (its body as it is now: a young one has grown only part of its mass -
	    //  counting the grown-up mass made energy out of nothing, and bodies that
	    //  bred and ate their young multiplied without food)
	    // (MEAT_ASSIMILATION is applied to what I eat of it; what I cannot eat
	    //  stays as meat for others, whole)
	    let energyFromPrey = chosenPrey().getEnergy() * PREDATION_ENERGY_TRANSFER
	                       + chosenPrey().getPhenotypeMass() * Math.min( ONE, chosenPrey().getGrowthScale() ) * PREY_BODY_ENERGY;

	    this.learnSearchImage( chosenPrey() );
	    chosenPrey().die( "predation" );

	    simCounters.attackCount ++;
	    _numPreyEaten ++;

	    if ( _M[ _m + SS.M_CANNIBAL ] === 1 ) { simCounters.youngCannibalism ++; _numCannibalized ++; }
	    let room = Math.max( ZERO, _M[ _m + SS.M_MAX_ENERGY ] - _B[ _b + SS.B_ENERGY ] );
	    // I eat as much of it as fills me (keeping MEAT_ASSIMILATION of what I eat);
	    // what I cannot eat falls apart into pieces around (others may eat them)
	    const eaten = Math.min( energyFromPrey, room / MEAT_ASSIMILATION );
	    _B[ _b + SS.B_ENERGY ] += eaten * MEAT_ASSIMILATION;
	    if ( energyFromPrey > eaten ) { _parent.spawnCarcass( preyPosition.x, preyPosition.y, energyFromPrey - eaten ); }
	    _M[ _m + SS.M_CANNIBAL ] = 0;

	    _B[ _b + SS.B_TIMER_DELTA ] = ZERO;
	    _M[ _m + SS.M_PREY ] = NULL_INDEX;
	    _brain.setFoundPrey( false );
	}


 //setEnvironmentalStimuli



	//-----------------------------------------------------------------
	// abortMating: the mating attempt failed (incompatible, pool full,
	// mate gone) - give up on this mate and look for another one
	//-----------------------------------------------------------------
	this.abortMating = function()
	{
	    _M[ _m + SS.M_TRY_MATE ]    = 0;
	    _M[ _m + SS.M_MATE ] = NULL_INDEX;
	    _M[ _m + SS.M_MATE ] = NULL_INDEX;
	    _brain.setFoundSwimbot( false );
	}


	//-----------------------------------------
	// set attraction
	//-----------------------------------------
	this.setAttraction = function( attraction )
	{
	    _brain.setAttraction( attraction );
	    if ( _slot >= 0 ) { _shared.attraction[ _slot ] = attraction; }

//here I need to tell the brain to stop pursuing its current chosen mate (if it is)...

	}



	//-----------------------------------------
	// get attractiveness
	//-----------------------------------------
	this.getAttractiveness = function( judge )
	{
        let attractiveness = gpRandom();

        let attractionCriterion = _brain.getAttractionCriterion();

        //console.log( "attractionCriterion = " + attractionCriterion );

        if ( attractionCriterion === ATTRACTION_COLORFUL        ) { attractiveness =        this.getColorSaturation         (); }
        if ( attractionCriterion === ATTRACTION_BIG             ) { attractiveness =        this.getCurrentBodyBigness      (); }
        if ( attractionCriterion === ATTRACTION_HYPER           ) { attractiveness =        this.getCurrentBodyHyperness    (); }
        if ( attractionCriterion === ATTRACTION_LONG            ) { attractiveness =        this.getCurrentBodyLongness     (); }
        if ( attractionCriterion === ATTRACTION_STRAIGHT        ) { attractiveness =        this.getCurrentBodyStraightness (); }

        if ( attractionCriterion === ATTRACTION_NO_COLOR        ) { attractiveness = ONE -  this.getColorSaturation         (); }
        if ( attractionCriterion === ATTRACTION_SMALL           ) { attractiveness = ONE -  this.getCurrentBodyBigness      (); }
        if ( attractionCriterion === ATTRACTION_STILL           ) { attractiveness = ONE -  this.getCurrentBodyHyperness    (); }
        if ( attractionCriterion === ATTRACTION_SHORT           ) { attractiveness = ONE -  this.getCurrentBodyLongness     (); }
        if ( attractionCriterion === ATTRACTION_CROOKED         ) { attractiveness = ONE -  this.getCurrentBodyStraightness (); }

        if ( attractionCriterion === ATTRACTION_SIMILAR_COLOR   ) { attractiveness =        this.getColorSimilarity         ( judge ); }
        if ( attractionCriterion === ATTRACTION_SIMILAR_SIZE    ) { attractiveness =        this.getBignessSimilarity       ( judge ); }
        if ( attractionCriterion === ATTRACTION_SIMILAR_HYPER   ) { attractiveness =        this.getHypernessSimilarity     ( judge ); }
        if ( attractionCriterion === ATTRACTION_SIMILAR_LENGTH  ) { attractiveness =        this.getLengthSimilarity        ( judge ); }
        if ( attractionCriterion === ATTRACTION_SIMILAR_STRAIGHT) { attractiveness =        this.getStraightessSimilarity   ( judge ); }

        if ( attractionCriterion === ATTRACTION_CLOSEST         ) { attractiveness =        this.getCloseness               ( judge ); }
        if ( attractionCriterion === ATTRACTION_RANDOM          ) { attractiveness =        gpRandom(); }

        return attractiveness;
    }


	//-------------------------------------
	// get color saturation
	//-------------------------------------
	this.getColorSaturation = function()
	{
        //console.log( "getColorSaturation" );

        let saturation = ZERO;

        let accumulatedMass = ZERO;

        for (let p=1; p<_phenotype.numParts; p++)
        {
            //console.log( _phenotype.parts[p].red + ", " + _phenotype.parts[p].green + ", " + _phenotype.parts[p].blue );

            accumulatedMass += _phenotype.parts[p].mass;

            let rgDiff = Math.abs( _phenotype.parts[p].red     - _phenotype.parts[p].green  );
            let rbDiff = Math.abs( _phenotype.parts[p].red     - _phenotype.parts[p].blue   );
            let gbDiff = Math.abs( _phenotype.parts[p].green   - _phenotype.parts[p].blue   );

            //console.log( rgDiff + ", " + rbDiff + ", " + gbDiff );

            let thisPartSaturation = ( rgDiff + rbDiff + gbDiff ) / 3;

            assert( thisPartSaturation <= ONE, "thisPartSaturation <= ONE" );

            thisPartSaturation *= _phenotype.parts[p].mass

            saturation += thisPartSaturation;
        }

        assert( accumulatedMass > ZERO, "getColorSaturation: accumulatedMass > ZERO" );

        saturation /= accumulatedMass;

        assert( saturation <= ONE, "getColorSaturation: saturation <= ONE" );

        return saturation;
    }



	//-----------------------------------------
	// get closeness
	//-----------------------------------------
	this.getCloseness = function( judge )
	{
	    //console.log( "getCloseness" );

        let closest = SWIMBOT_VIEW_RADIUS; //maximum

        let distance = _position.getDistanceTo( judge.getPosition() );

        /*
        if ( distance > SWIMBOT_VIEW_RADIUS )
        {
            console.log( distance + ", " + SWIMBOT_VIEW_RADIUS );
        }

        //assert( distance <= SWIMBOT_VIEW_RADIUS, "swimbot.js: getCloseness: distance <= SWIMBOT_VIEW_RADIUS" );
        */

        if ( distance < closest )
        {
            closest = distance;
        }

        return ONE - ( closest / SWIMBOT_VIEW_RADIUS );
    }




	//-----------------------------------------
	// get similarity
	//-----------------------------------------
	this.getSimilarity = function( judge )
	{
	    let amount
	    = this.getColorSimilarity       ( judge )
	    + this.getBignessSimilarity     ( judge )
	    + this.getHypernessSimilarity   ( judge )
	    + this.getLengthSimilarity      ( judge )
	    + this.getStraightessSimilarity ( judge );

	    amount /= 5;

	    return amount;
    }


	//-----------------------------------------
	// get color similarity
	//-----------------------------------------
	this.getColorSimilarity = function( judge )
	{
	    let amount = ZERO;

	    let c1 = judge.getAverageColor();
	    let c2 = this.getAverageColor();

	    //console.log( "judge color = " + c1.red + ", " + c1.green + ", " + c1.blue );
	    //console.log( "my color    = " + c2.red + ", " + c2.green + ", " + c2.blue );

        let rDiff = Math.abs( c2.red    - c1.red    );
        let gDiff = Math.abs( c2.green  - c1.green  );
        let bDiff = Math.abs( c2.blue   - c1.blue   );

        amount = ONE - ( ( rDiff + gDiff + bDiff ) * ONE_THIRD );

	    return amount;
    }


	//--------------------------------------------
	// get bigness similarity
	//--------------------------------------------
	this.getBignessSimilarity = function( judge )
	{
	    let amount = ZERO;

	    let b1 = judge.getCurrentBodyBigness();
	    let b2 = this.getCurrentBodyBigness();

        amount = ONE - Math.abs( b1 - b2 );

        //console.log( "bigness similarity = " + amount );

	    return amount;
    }


	//--------------------------------------------
	// get hyperness similarity
	//--------------------------------------------
	this.getHypernessSimilarity = function( judge )
	{
	    let amount = ZERO;

	    let b1 = judge.getCurrentBodyHyperness();
	    let b2 = this.getCurrentBodyHyperness();

        amount = ONE - Math.abs( b1 - b2 );

	    return amount;
    }


	//--------------------------------------------
	// get length similarity
	//--------------------------------------------
	this.getLengthSimilarity = function( judge )
	{
	    let amount = ZERO;

	    let b1 = judge.getCurrentBodyLongness();
	    let b2 = this.getCurrentBodyLongness();

        amount = ONE - Math.abs( b1 - b2 );

	    return amount;
    }


	//--------------------------------------------
	// get straightness similarity
	//--------------------------------------------
	this.getStraightessSimilarity = function( judge )
	{
	    let amount = ZERO;

	    let b1 = judge.getCurrentBodyStraightness();
	    let b2 = this.getCurrentBodyStraightness();

        amount = ONE - Math.abs( b1 - b2 );

	    return amount;
    }




    //---------------------------------------
    this.getCurrentBodyBigness = function()
    {
        let amount = _phenotype.mass / GREATEST_POSSIBLE_SWIMBOT_MASS;

        return amount;
    }


    //---------------------------------------
    this.getCurrentBodyLongness = function()
    {
        let amount = ZERO;

        for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
        {
            for (let pp=1; pp<_B[ _b + SS.B_NUM_PARTS ]; pp++)
            {
                if ( pp != p )
                {
                    let xx = _pd[ p * PS + M_X ] - _pd[ pp * PS + M_X ];
                    let yy = _pd[ p * PS + M_Y ] - _pd[ pp * PS + M_Y ];
                    let d = Math.sqrt( xx * xx + yy * yy );

                    if ( d > amount )
                    {
                        amount = d;
                    }
                }
            }
        }

        amount /= GREATEST_POSSIBLE_SWIMBOT_LENGTH;

        return amount;
    }





    //-------------------------------------------
    this.getCurrentBodyStraightness = function()
    {
        let amount = ZERO;

        //-------------------------------------------------------------------
        // normalized vectors for each part axis
        //-------------------------------------------------------------------
        for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
        {
            _unitAxisX[p] = _pd[ p * PS + A_X ] / _pLength[p];
            _unitAxisY[p] = _pd[ p * PS + A_Y ] / _pLength[p];

        }

        //---------------------------------------------------------------------------
        // finding the dot products between each pair of these vectors...
        //---------------------------------------------------------------------------
        if ( _B[ _b + SS.B_NUM_PARTS ] < 3 )
        {
            amount = ONE;
        }
        else
        {
            let numTests = 0;
            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                for (let pp=p+1; pp<_B[ _b + SS.B_NUM_PARTS ]; pp++)
                {
                    numTests ++;
                    assert ( p != pp, "Swimbot:getCurrentBodyStraightness: p != pp" );
                    amount += Math.abs( _unitAxisX[p] * _unitAxisX[pp] + _unitAxisY[p] * _unitAxisY[pp] );
                }
            }

            amount /= numTests;
        }

        //-----------------------------------------------
        // let's favor swimbots with more parts....
        //-----------------------------------------------
        amount *= 0.7;
        amount += ( _B[ _b + SS.B_NUM_PARTS ] / MAX_PARTS ) * 0.3;

        if ( amount > ONE )
        {
            amount = ONE;
        }

        return amount;
    }




    //-------------------------------------------
    this.getCurrentBodyHyperness = function()
    {
        let amount = ZERO;

        for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
        {
            amount += Math.sqrt( _pd[ p * PS + V_X ] * _pd[ p * PS + V_X ] + _pd[ p * PS + V_Y ] * _pd[ p * PS + V_Y ] );
        }

        let FugdeFactorToScaleHyperAttraction = 0.4;

        amount *= FugdeFactorToScaleHyperAttraction;

        if ( amount > ONE )
        {
            amount = ONE;
        }

        return amount;
    }



	//---------------------------------
	// get average color
	//---------------------------------
	this.getAverageColor = function()
	{
        // the colors only change with a new phenotype, so remember the result
        if ( _averageColor !== null ) { return _averageColor; }

        let r = ZERO;
        let g = ZERO;
        let b = ZERO;
        let accumulatedMass = ZERO;

        for (let p=1; p<_phenotype.numParts; p++)
        {
            accumulatedMass += _phenotype.parts[p].mass;

            r += _phenotype.parts[p].red    * _phenotype.parts[p].mass;
            g += _phenotype.parts[p].green  * _phenotype.parts[p].mass;
            b += _phenotype.parts[p].blue   * _phenotype.parts[p].mass;
        }

        assert( accumulatedMass > ZERO, "getAverageColor: accumulatedMass > ZERO" );

        r /= accumulatedMass;
        g /= accumulatedMass;
        b /= accumulatedMass;

        assert( r <= ONE, "getAverageColor: r <= ONE" );
        assert( g <= ONE, "getAverageColor: g <= ONE" );
        assert( b <= ONE, "getAverageColor: b <= ONE" );

        let c = new Color();
        c.red   = r;
        c.green = g;
        c.blue  = b;

        _averageColor = c;
        return c;
    }



	//-----------------------
	// die
	//----------------------
	this.die = function( cause = "other" )
	{
	    _deathCause = cause;
	    if ( _live[ _liveAt ] === 1 )
	    {
	        simCounters.numDeadSwimbots ++;
	        if ( cause === "starvation" ) simCounters.starvationDeaths ++;
	        else if ( cause === "old_age" ) simCounters.oldAgeDeaths ++;
	        else if ( cause === "predation" ) simCounters.predationDeaths ++;
	        else simCounters.otherDeaths ++;
	    }
        _live[ _liveAt ] = 0;

	    //assert( _index != NULL_INDEX, "Swimbot.js: this.die: _index != NULL_INDEX" )
	    if ( _index != NULL_INDEX )
	    {
	        // this is used for updating the FamilyTree
            _parent.notifySwimbotDeathTime( _index );
        }
    }


//-----------------------
	// clear all data
	//----------------------
	this.clear = function()
	{
        _lastPositionForEfficiencyMeasurement.clear();
        _genotype.clear();
        _position.clear();
        _velocity.clear();
        _acceleration.clear();
        _heading.clear();
        _directionToGoal.clear();
        _focusDirection.clear();
        _centerOfMass.clear();
        _vectorUtility.clear();

        _M[ _m + SS.M_FOOD ] = NULL_INDEX;
        _M[ _m + SS.M_MATE ] = NULL_INDEX;
        _B[ _b + SS.B_AGE ] 	  		    = 0;
        _numOffspring       = 0;
        _numFoodBitsEaten   = 0;
        _index              = NULL_INDEX;
        _M[ _m + SS.M_MATE ]    = NULL_INDEX;
        _M[ _m + SS.M_FOOD ] = NULL_INDEX;
        _M[ _m + SS.M_LAST_MEAT ] = NULL_INDEX;
        _live[ _liveAt ] = 0;
        _M[ _m + SS.M_TRY_MATE ]       = 0;
        _M[ _m + SS.M_TRY_EAT ]        = 0;
        _B[ _b + SS.B_GROWTH ]        = ZERO;
        _torque             = ZERO;
        _B[ _b + SS.B_ANGLE ]			    = ZERO;
        _B[ _b + SS.B_SPIN ]			    = ZERO;
        _B[ _b + SS.B_ENERGY ]			    = ZERO;
        _B[ _b + SS.B_TIMER ]              = ZERO;
        _B[ _b + SS.B_TIMER_DELTA ]         = ZERO;
        _B[ _b + SS.B_EFFICIENCY ]   = ZERO;
        _B[ _b + SS.B_SELECT_RADIUS ]       = ZERO;
        _B[ _b + SS.B_LAST_ENERGY ] = ZERO;
        _M[ _m + SS.M_READY ] = 0;

        _M[ _m + SS.M_PREY ] = NULL_INDEX;
        _M[ _m + SS.M_NEAR_PRED ] = NULL_INDEX;
        _M[ _m + SS.M_TRY_HUNT ]       = 0;
        _numPreyEaten       = 0;
        _M[ _m + SS.M_SCAN_RADIUS ]         = SWIMBOT_VIEW_RADIUS;
        _M[ _m + SS.M_SCAN_CD ]       = 0;
        _B[ _b + SS.B_ETERNAL ] = 0;
        _M[ _m + SS.M_HUNT_CD ]       = 0;
    }


	//--------------------------
	// contribute to offspring
	//--------------------------
	this.contributeToOffspring = function()
	{
        //console.log( "" );
        //console.log( "-------------------------" );
        //console.log( "swimbot has energy of " + _B[ _b + SS.B_ENERGY ] );

/*
        assert( _childEnergyRatio >= ZERO, "_childEnergyRatio >= ZERO" );
        assert( _childEnergyRatio <= ONE, "_childEnergyRatio <= ONE"  );

console.log( "contributeToOffspring: _childEnergyRatio = " + _childEnergyRatio );
*/

//let energyToContribute = _B[ _b + SS.B_ENERGY ] * _childEnergyRatio;
        // the share: the pool's setting, or my own gene (INHERITED_INVESTMENT_ENABLED)
        const share = INHERITED_INVESTMENT_ENABLED ? _M[ _m + SS.M_INVEST ] : globalTweakers.childEnergyRatio;
        let energyToContribute = _B[ _b + SS.B_ENERGY ] * share;

//GLOBAL_childEnergyRatio
//console.log( "GLOBAL_childEnergyRatio = " + GLOBAL_childEnergyRatio );

        //console.log( "contributeToOffspring: energyToContribute " + energyToContribute );

/*
        //----------------------------------------------------------------------
        // I think I did this to keep babies hungry as soon as born...
        //----------------------------------------------------------------------
	    if ( energyToContribute > DEFAULT_SWIMBOT_HUNGER_THRESHOLD * ONE_HALF )
	    {
	        energyToContribute = DEFAULT_SWIMBOT_HUNGER_THRESHOLD * ONE_HALF;
	    }
*/

	    _B[ _b + SS.B_ENERGY ] -= energyToContribute;

        assert( _B[ _b + SS.B_ENERGY ] >= ZERO, "Swimbot: contributeToOffspring: _B[ _b + SS.B_ENERGY ] >= ZERO" );

	    _numOffspring ++;

        _B[ _b + SS.B_TIMER_DELTA ]         = ZERO;
        _M[ _m + SS.M_TRY_MATE ]       = 0;
        _M[ _m + SS.M_MATE ] = NULL_INDEX;
        _M[ _m + SS.M_MATE ]    = NULL_INDEX
        _brain.setFoundSwimbot( false );

	    return energyToContribute;


	    //previous version that uses half of the swimbot's energy
        /*
	    _numOffspring ++;

        let energyBeforeContribution = _B[ _b + SS.B_ENERGY ];

        if (( _childEnergyRatio < ZERO )
        ||  ( _childEnergyRatio > ONE  ))
        {
            assert( _childEnergyRatio >= ZERO, "_childEnergyRatio >= ZERO" );
            assert( _childEnergyRatio <= ONE, "_childEnergyRatio <= ONE"  );
        }

        //console.log( _childEnergyRatio );

        _B[ _b + SS.B_ENERGY ] *= ( ONE - _childEnergyRatio );

        _B[ _b + SS.B_TIMER_DELTA ] = ZERO;

        let energyToContribute = energyBeforeContribution - _B[ _b + SS.B_ENERGY ];

        //cancel out all mate-related data so it doesn't get in the way next time..
        _M[ _m + SS.M_TRY_MATE ] = 0;
        _M[ _m + SS.M_MATE ] = NULL_INDEX;
        _M[ _m + SS.M_MATE ] = NULL_INDEX
        _brain.setFoundSwimbot( false );

        //printf( "swimbot %d just gave %f to %d, leaving it with %f\n", index, energyToContribute, energy );

	    return energyToContribute;
	    */

    }



	//-------------------------------------------
	// set rendering goals
	//-------------------------------------------
	this.setRenderingGoals = function(r)
	{
	    _swimbotRenderer.setRenderingGoals(r);
    }

	//-------------------------------------
	// render
	//-------------------------------------
	//-------------------------------------------------------------------
	// hand the body to the graphics-card renderer: one capsule per part
	// (or a single dot when far away)
	//-------------------------------------------------------------------
	// the block the physics threads wrote for drawing (RenderData.ts): its
	// start in st.renderParts and its length (numbers)
	this.getRenderBlockStart  = function() { return _slot * MAX_PARTS * RENDER_FLOATS; }
	this.getRenderBlockLength = function() { return Math.max( 0, _B[ _b + SS.B_NUM_PARTS ] - 1 ) * RENDER_FLOATS; }

	this.writeCapsules = function( capsules, asDot )
	{
	    _swimbotRenderer.prepareColors( _phenotype, _B[ _b + SS.B_AGE ], _B[ _b + SS.B_ENERGY ], _B[ _b + SS.B_GROWTH ], this );

	    if ( asDot )
	    {
	        const c = _swimbotRenderer.calculatePartColor(1);
	        const x = _pd[ ROOT_PART * PS + P_X ], y = _pd[ ROOT_PART * PS + P_Y ];
	        capsules.add( x, y, x, y, SWIMBOT_DOT_RENDER_RADIUS, c.red, c.green, c.blue, 1 );
	        return;
	    }

	    // the whole body straight into the renderer's array; the colour mix
	    // (newborn white, dying grey) is worked out once for the body
	    _swimbotRenderer.getColorMix( _colorMix );
	    const white = _colorMix.white, dead = _colorMix.dead, keep = ONE - white - dead;
	    const greyR = white + dead * _swimbotRenderer.deadRed, greyG = white + dead * _swimbotRenderer.deadGreen, greyB = white + dead * _swimbotRenderer.deadBlue;

	    const numParts = _B[ _b + SS.B_NUM_PARTS ];
	    if ( numParts <= 1 ) { return; }
	    let i = capsules.reserve( numParts - 1 );
	    const d = capsules.reserved(), stride = capsules.floatsPerCapsule;
	    // (a newborn grows from an egg: its widths too, as in the detailed drawing)
	    const growth = Math.min( ONE, _B[ _b + SS.B_GROWTH ] ), egg = 5.0 * ( ONE - growth );
	    for (let p=1; p<numParts; p++)
	    {
	        const parent = _pParent[p];
	        if ( parent == NULL_PART ) { d[ i ] = _position.x; d[ i + 1 ] = _position.y; }
	        else { d[ i ] = _pd[ parent * PS + P_X ]; d[ i + 1 ] = _pd[ parent * PS + P_Y ]; }
	        d[ i + 2 ] = _pd[ p * PS + P_X ];
	        d[ i + 3 ] = _pd[ p * PS + P_Y ];
	        d[ i + 4 ] = _partStartWidth[p] * growth + egg;
	        d[ i + 5 ] = _pWidth[p]         * growth + egg;
	        d[ i + 6 ] = greyR + _partRGB[ p * 3     ] * keep;
	        d[ i + 7 ] = greyG + _partRGB[ p * 3 + 1 ] * keep;
	        d[ i + 8 ] = greyB + _partRGB[ p * 3 + 2 ] * keep;
	        d[ i + 9 ] = 1;
	        i += stride;
	    }
	}
	const _colorMix = { white: 0, dead: 0 };
	// (part colours and start widths live in the shared state, bound with the slot)

	// up close with the body on the graphics card: only mouth and genital in 2D
	this.renderDetails = function()
	{
	    this.syncPartObjects();
	    _swimbotRenderer.renderDetails( _phenotype, _brain, _B[ _b + SS.B_GROWTH ], _focusDirection, this );
	}

	this.render = function( levelOfDetail )
	{
	    this.syncPartObjects();

	    _swimbotRenderer.render
	    (
	        _phenotype,
	        _brain,
	        _B[ _b + SS.B_AGE ],
	        _B[ _b + SS.B_ENERGY ],
	        _B[ _b + SS.B_GROWTH ],
	        _focusDirection,
	        levelOfDetail,
	        this
	    );




/// debug test!!!!!
// I'm adding these colored circles to visualize food preferences...
/*
canvas.lineWidth = 2;

if ( _phenotype.preferredFoodType == 0 )
{
    canvas.strokeStyle = "rgb( 100, 255, 100 )";
    canvas.beginPath();
    canvas.arc( _position.x, _position.y, 60, 0, PI2, false );
    canvas.stroke();
    canvas.closePath();
}
else
{
    canvas.strokeStyle = "rgb( 100, 150, 255 )";
    canvas.beginPath();
    canvas.arc( _position.x, _position.y, 60, 0, PI2, false );
    canvas.stroke();
    canvas.closePath();
}

if (_phenotype.digestibleFoodType == 0 )
{
    canvas.strokeStyle = "rgb( 100, 255, 100 )";
    canvas.beginPath();
    canvas.arc( _position.x, _position.y, 45, 0, PI2, false );
    canvas.stroke();
    canvas.closePath();
}
else
{
    canvas.strokeStyle = "rgb( 100, 150, 255 )";
    canvas.beginPath();
    canvas.arc( _position.x, _position.y, 45, 0, PI2, false );
    canvas.stroke();
    canvas.closePath();
}
*/


	    /*
		//-------------------------------------
		// show position
		//-------------------------------------
		canvas.fillStyle = "rgb( 244, 244, 244 )";
		canvas.beginPath();
		canvas.arc( _position.x, _position.y, 2.0, 0, PI2, false );
		canvas.fill();
		canvas.closePath();

		//-----------------------------------------
		// show heading
		//-----------------------------------------
        canvas.strokeStyle = "rgb( 233, 233, 233 )";

        canvas.lineWidth = 1;
        canvas.beginPath();
        canvas.moveTo( _position.x, _position.y );
        canvas.lineTo( _position.x + _heading.x * 40.0, _position.y + _heading.y * 40.0 );
        canvas.closePath();
        canvas.stroke();
	    */
	}


}//end of entire Swimbots function -------------------------







