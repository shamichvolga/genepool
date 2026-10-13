import { setTrait, GENES_PREDATOR } from "./EcologyGenes";
import { think, sigmoid, NUM_INPUTS, NUM_HIDDEN, NUM_OUTPUTS, NUM_DRIVES, THINK_PERIOD, DRIVE_HYSTERESIS, EFFORT_MIN, EFFORT_RANGE, IN_BIAS, IN_HUNGER, IN_ENERGY, IN_AGE, IN_FIT, IN_TREND, IN_FOOD, IN_MATE, IN_THREAT, IN_PREY, IN_CROWD, IN_PREDATOR, OUT_FOOD, OUT_MATE, OUT_FLEE, OUT_HUNT, OUT_CLIMATE, OUT_SOCIAL, OUT_EFFORT } from "./NeuralBrain";
import { NEURAL_BRAIN_ENABLED, CLIMATE_STEERING, SOCIAL_STEERING, CLIMATE_PROBE_DISTANCE } from "./Parameters";
import { environment, PLANT_TYPE_WARM, PLANT_TYPE_COLD } from "./Environment";
import { climateFoodFactor, digestionEfficiency, thermalFit, thermalPeak, THERMAL_MISMATCH_DRAIN, THERMAL_FIT_UPDATE_PERIOD, THERMOMELANISM, mateAcceptance, pairRandom, KINESIS_PERIOD, KINESIS_TURN_CHANCE, KINESIS_MAX_TURN, EMERGENCY_THERMAL_FIT, EMERGENCY_PROBE_DISTANCE } from "./Ecology";
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
import { BRAIN_FOCUS_TARGET_SHIFT_STRENGTH, BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD, BRAIN_SENSORY_UPDATE_PERIOD, BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_FOOD, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_FOOD, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY, BRAIN_STATE_RESTING, BRAIN_WANDER_AMOUNT, Brain } from "./Brain";
import { GREATEST_POSSIBLE_SWIMBOT_LENGTH, GREATEST_POSSIBLE_SWIMBOT_MASS } from "./Embryology";
import { DEFAULT_FOOD_BIT_ENERGY, FoodBit } from "./FoodBit";
import { Genotype } from "./Genotype";
import { globalTweakers, gpRandom, simCounters } from "./Globals";
import { NULL_INDEX, ONE, ONE_HALF, ONE_THIRD, PI_OVER_180, ZERO } from "./MathConstants";
import { ATTACK_COOLDOWN, ATTACK_SUCCESS_CHANCE, BASAL_METABOLISM, DEFAULT_SWIMBOT_HUNGER_THRESHOLD, FOOD_TYPE_OFFSET, OLD_AGE_DURATION, PREDATION_ENERGY_TRANSFER, PREDATOR_FLEE_RADIUS, PREDATOR_LEVEL_THRESHOLD, PREY_SCAN_COOLDOWN, PREY_SCAN_RADIUS_GROWTH, PREY_SCAN_RADIUS_MAX_SCALE, SWIMBOT_MAX_ENERGY, SWIMBOT_SELECT_RADIUS_SCALAR, YOUNG_AGE_DURATION } from "./Parameters";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { SwimbotRenderer } from "./SwimbotRenderer";
import { ATTRACTION_BIG, ATTRACTION_CLOSEST, ATTRACTION_COLORFUL, ATTRACTION_CROOKED, ATTRACTION_HYPER, ATTRACTION_LONG, ATTRACTION_NO_COLOR, ATTRACTION_RANDOM, ATTRACTION_SHORT, ATTRACTION_SIMILAR_COLOR, ATTRACTION_SIMILAR_HYPER, ATTRACTION_SIMILAR_LENGTH, ATTRACTION_SIMILAR_SIZE, ATTRACTION_SIMILAR_STRAIGHT, ATTRACTION_SMALL, ATTRACTION_STILL, ATTRACTION_STRAIGHT, CONTINUAL_ENERGY_DRAIN, ENERGY_EFFICIENCY_MEASUREMENT_PERIOD, ENERGY_USED_UP_SWIMMING, GENITAL_INDEX, MAX_PARTS, MOUTH_INDEX, NULL_PART, Phenotype, ROOT_PART, STARVING, STARVING_TIMER_DELTA, SWIMBOT_GENITAL_LENGTH, SWIMBOT_MOUTH_LENGTH, SWIMBOT_VIEW_RADIUS, TIMER_DELTA_INCREASE_RATE, WALL_BOUNCE } from "./SwimbotTypes";
import { Color, assert } from "./Utility";
import { Vector2D } from "./Vector2D";


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

	//-----------------------------------------
	// variables
	//-----------------------------------------
	let _genotype		    = new Genotype();
	let _phenotype		    = new Phenotype();
	let _brain  		    = new Brain();
	let _position 		    = new Vector2D();
	let _velocity 		    = new Vector2D();
	let _acceleration       = new Vector2D();
	let _heading		    = new Vector2D();
	let _directionToGoal    = new Vector2D();
	let _focusDirection	    = new Vector2D();
	let _centerOfMass	    = new Vector2D();
	let _vectorUtility      = new Vector2D();
	let _chosenFoodBit      = new FoodBit();
	let _swimbotRenderer  	= new SwimbotRenderer();
	let _chosenMate         = null; // must start as null!
	let _age 	  		    = 0;
	let _numOffspring       = 0;
	let _numFoodBitsEaten   = 0;
	//let _maximumLifeSpan    = 0;
	let _index              = NULL_INDEX;
	let _chosenMateIndex    = NULL_INDEX;
	let _chosenFoodBitIndex = NULL_INDEX;
	let _alive 	  		    = false;
	let _tryingToMate       = false;
	let _tryingToEat        = false;
	let _growthScale        = ZERO;
	let _torque             = ZERO;
	let _angle			    = ZERO;
	let _spin			    = ZERO;
	let _energy			    = ZERO;
	let _timer              = ZERO;
	let _timerDelta         = ZERO;
	let _colorUtility       = new Color();
	let _previousFocusDirection = new Vector2D(); // scratch, reused every update
	let _energyEfficiency   = ZERO;
	let _selectRadius       = ZERO;
	let _species            = NULL_INDEX;

	let _lastPositionForEfficiencyMeasurement = new Vector2D();
    let _lastEnergyForEfficiencyMeasurement = ZERO;
	let _readyforSensoryInputToBrain = false;

	//-----------------------------------------
	// predation
	//-----------------------------------------
	let _embryology         = null;  // kept so the phenotype can be regrown (applyPredatorLevel)
	let _chosenPrey         = null;
	let _nearestPredator    = null;
	let _tryingToHunt       = false;
	let _numPreyEaten       = 0;
	let _scanRadius         = SWIMBOT_VIEW_RADIUS;
	let _scanCooldown       = 0;
	let _eternal            = false;
	let _basalMetabolism    = ZERO;  // energy per step just to stay alive (grows with body mass)

	//-----------------------------------------------------------------------
	// ecology (stage 5): how this swimbot copes with the temperature and the
	// two kinds of plants (see Ecology.ts)
	//-----------------------------------------------------------------------
	let _thermalOptimum     = ONE_HALF;
	let _thermalWidth       = 0.4;
	let _thermalPeak        = ONE;
	let _digestion          = ONE_HALF;
	let _efficiencyWarm     = ONE;
	let _efficiencyCold     = ONE;
	let _brightness         = ONE_HALF;  // body brightness: camouflage and mating signal
	let _choosiness         = ZERO;
	let _thermalFit         = ONE;    // 0..1, how well the place suits me (updated every few steps)
	let _comfort            = -ONE;   // last "how good is it here" (for kinesis)
	let _comfortTrend       = ZERO;   // +1 it got better here, -1 worse

	//-----------------------------------------------------------------------
	// neural brain (stage 6, see NeuralBrain.ts)
	//-----------------------------------------------------------------------
	let _neural             = false;
	const _nnInputs         = new Float64Array( NUM_INPUTS  );
	const _nnHidden         = new Float64Array( NUM_HIDDEN  );
	const _nnNewHidden      = new Float64Array( NUM_HIDDEN  );
	const _nnOutputs        = new Float64Array( NUM_OUTPUTS );
	let _effort             = ONE;    // how hard I swim (stroke speed)
	let _climateWeight      = ZERO;   // how strongly I follow the better temperature
	let _socialWeight       = ZERO;   // + towards the others, - away from them
	let _climateDirX        = ZERO;
	let _climateDirY        = ZERO;
	let _socialDirX         = ZERO;   // towards the middle of the swimbots I see
	let _socialDirY         = ZERO;
	let _seenFood           = false;
	let _seenPrey           = false;
	let _numSeen            = 0;

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
	let _numParts       = 0;
	let _frequency      = ZERO;
	let _sumPartLengths = ZERO;
	let _bodyMass       = ZERO;

	let _pd          = new Float64Array( MAX_PARTS * PS );
	let _pLength     = new Float64Array( MAX_PARTS );
	let _pWidth      = new Float64Array( MAX_PARTS );
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
	let _mouthPosition   = new Vector2D();               // kept up to date from _pd
	let _genitalPosition = new Vector2D();
	let _huntCooldown       = 0;     // steps until the predator can bite again


let _parent = null;

//----------------------------------
this.setParent = function( parent )
{
    _parent = parent;
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
        if (( _age < oldAgeThreshold ) || _eternal )
        {
            if ( _age < YOUNG_AGE_DURATION )
            {
                //----------------------------------
                // swimmer is still growing
                //----------------------------------
                _growthScale = _age / YOUNG_AGE_DURATION;
            }
            else
            {
                _growthScale = ONE;
            }

            assert( _growthScale >= 0.0, "assert swimbot.js:updateBodyParts: _growthScale >= 0.0" )
            assert( _growthScale <= 1.0, "assert swimbot.js:updateBodyParts: _growthScale <= 1.0" )

            //---------------------------------------
            // slowing down because starving,
            // but not slowing down to a full stop.
            //---------------------------------------
            if  ( _energy < STARVING )
            {
                _timerDelta = _energy / STARVING;

                if ( _timerDelta < STARVING_TIMER_DELTA )
                {
                    _timerDelta = STARVING_TIMER_DELTA;
                }
            }
            else
            {
                _timerDelta += TIMER_DELTA_INCREASE_RATE;

                if ( _timerDelta > ONE )
                {
                    _timerDelta = ONE;
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
            if ( _age > globalTweakers.maximumLifeSpan )
            {
                this.die();
            }
            else
            {
                //----------------------------------
                // slowing down because dying
                //----------------------------------
                //let earlyDeath = 200;
                //earlyDeath = 0;
                //let inc = ( _age - OLD_AGE ) / ( oldAgeDuration - earlyDeath );

                //let inc = ( _age - OLD_AGE ) / oldAgeDuration;

                /*
                if ( inc > ONE )
                {
                    inc = ONE;
                }
                */

                _timerDelta = ONE - ( _age - oldAgeThreshold ) / OLD_AGE_DURATION;

                assert( _timerDelta >= 0.0, "assert swimbot.js:updateBodyParts: _timerDelta >= 0.0" )
                assert( _timerDelta <= 1.0, "assert swimbot.js:updateBodyParts: _timerDelta <= 1.0" )
            }
        }

        _timer += _timerDelta * _effort;

		//---------------------------------------------------------------
		// calculate the modulators as a function of the dot between the
		// heading and the perpendicular of the direction to the goal
		//---------------------------------------------------------------
		let radian = _angle * PI_OVER_180;

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
		pd[ ROOT_PART * PS + C_A ] = _angle - this.getMomentAdjustment();

		//-----------------------------------------------------------------
		// loop through parts to determine angle and position
		//-----------------------------------------------------------------
		for (let p=1; p<_numParts; p++)
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

				let radian = _timer * _frequency + ( _pPhase[p] + phaseModulator );
				pd[ i + B_A ] = ( _pAmp[p] + ampModulator ) * Math.sin( radian );

				pd[ i + C_A ] += pd[ i + B_A ];
			}

			//-----------------------------------
			// determine position
			//-----------------------------------
			let radian = pd[ i + C_A ] * PI_OVER_180;
			let length = _pLength[p];

			if ( _age < YOUNG_AGE_DURATION )
			{
                length *= _growthScale;
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
		if ( _age % 20 === 0 )
		{
            for (let p=1; p<_numParts; p++)
            {
                for (let o=1; o<_numParts; o++)
                {
                    if ( o != p )
                    {
                        let xx = pd[ p * PS + P_X ] - pd[ o * PS + P_X ];
                        let yy = pd[ p * PS + P_Y ] - pd[ o * PS + P_Y ];
                        let distance = Math.sqrt( xx * xx + yy * yy );

                        distance = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( distance );

                        if ( distance > _selectRadius )
                        {
                            _selectRadius = distance;
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
		_numParts       = _phenotype.numParts;
		_frequency      = _phenotype.frequency;
		_sumPartLengths = _phenotype.sumPartLengths;
		_bodyMass       = _phenotype.mass;

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
		for (let p=0; p<_numParts; p++)
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
        for (let p=2; p<_numParts; p++)
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

		for (let p=1; p<_numParts; p++ )
		{
			_centerOfMass.x += _pd[ p * PS + M_X ] * _pMass[p];
			_centerOfMass.y += _pd[ p * PS + M_Y ] * _pMass[p];
		}

		_centerOfMass.scale( ONE / _bodyMass );
	}

	//--------------------------------
	// adjust to center of mass
	//--------------------------------
	this.adjustToCenterOfMass = function()
	{
		let offsetX = _position.x - _centerOfMass.x;
		let offsetY = _position.y - _centerOfMass.y;

		for (let  p=0; p<_numParts; p++ )
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

        _chosenFoodBit      = null;
        _chosenMate         = null;
        _age 	  		    = 0;
        _numOffspring       = 0;
        _numFoodBitsEaten   = 0;
        _index              = NULL_INDEX;
        _chosenMateIndex    = NULL_INDEX;
        _chosenFoodBitIndex = NULL_INDEX;
        _alive 	  		    = false;
        _tryingToMate       = false;
        _tryingToEat        = false;
        _growthScale        = ZERO;
        _torque             = ZERO;
        _angle			    = ZERO;
        _spin			    = ZERO;
        _energy			    = ZERO;
        _timer              = ZERO;
        _timerDelta         = ZERO;
        _energyEfficiency   = ZERO;
        _selectRadius       = ZERO;
        _lastEnergyForEfficiencyMeasurement = ZERO;
        _readyforSensoryInputToBrain = false;
        */

/// if the clear routine above takes care of it, I can delete the assignments below...

		//----------------------------
		// set some basic properties
		//----------------------------
//_position.set( position );
_position.copyFrom( position );

		//_velocity.clear();
		_index              = index;
		_angle 		        = angle;
		_age		        = age;
		_energy             = energy;
		_alive		        = true;
		_growthScale        = ONE;

		// the neural brain is used in the environment pool (stage 6)
		_neural         = environment.active && NEURAL_BRAIN_ENABLED;
		_nnHidden.fill( ZERO );
		_effort         = ONE;
		_climateWeight  = ZERO;
		_socialWeight   = ZERO;
		_comfortTrend   = ZERO;
		_brain.setGoal( -1 );
		//_maximumLifeSpan    = DEFAULT_MAXIMUM_LIFESPAN;

		//_spin		        = ZERO;
        //_numOffspring       = 0;
		//_numFoodBitsEaten   = 0;
		//_torque             = ZERO;
        //_selectRadius       = ZERO;
		//_acceleration.clear();



//make sure all variables are initialized!!! (to be safe and stuff)

	/*
	let _heading		    = new Vector2D();
	let _directionToGoal    = new Vector2D();
	let _focusDirection	    = new Vector2D();
	let _centerOfMass	    = new Vector2D();
	let _vectorUtility      = new Vector2D();
	let _chosenFoodBit      = new FoodBit();
	let _chosenMate         = null; // must start as null!
	let _chosenMateIndex    = NULL_INDEX;
	let _chosenFoodBitIndex = NULL_INDEX;
	let _tryingToMate       = false;
	let _tryingToEat        = false;
	let _growthScale        = ZERO;
	let _timer              = ZERO;
	let _timerDelta         = ZERO;
	let _readyforSensoryInputToBrain = false;
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
	    _lastEnergyForEfficiencyMeasurement = _energy;

	    //console.log( "_lastPositionForEfficiencyMeasurement = " + _lastPositionForEfficiencyMeasurement );
	    //console.log( "_lastEnergyForEfficiencyMeasurement = " + _lastEnergyForEfficiencyMeasurement );
	    //console.log( "_energyEfficiency = " + _energyEfficiency );

    	//--------------------------------
	    // initialize brain
	    //--------------------------------
        _embryology = embryology;

        _brain.initialize();
        _brain.setHungerThreshold( DEFAULT_SWIMBOT_HUNGER_THRESHOLD );
        _brain.setPredatorLevel( this.getPredatorLevel() );
        _brain.setEnergyLevel( _energy );
        _brain.update();
	}


	//-----------------------------------
    this.setHungerThreshold = function(t)
    {
        _brain.setHungerThreshold(t);
    }


	//---------------------------------------------------------------
	// should be called after "generatePhenotypeFromGenotype"
	//---------------------------------------------------------------
    this.processPhenotype = function()
    {
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

		_selectRadius = ZERO;

		for (let p=1; p<_phenotype.numParts; p++)
		{
		    for (let o=1; o<_phenotype.numParts; o++)
	    	{
	    	    if ( o != p )
	    	    {
	    	        let distance = _phenotype.parts[p].position.getDistanceTo( _phenotype.parts[o].position );
	    	        if ( distance > _selectRadius )
	    	        {
	    	            _selectRadius = distance;
	    	        }
	    	    }
    		}
		}

		//-------------------------------------------------------------------------
		// HACK...
		// I don't know why - but this makes is come out basically okay...
		//-------------------------------------------------------------------------
		//_selectRadius = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( _selectRadius );

		if ( _selectRadius < MIN_SELECT_RADIUS )
		{
		    _selectRadius = MIN_SELECT_RADIUS;
		}
*/
		//--------------------------------
		// do this
		//--------------------------------
        _timerDelta = ZERO;

        //-----------------------------------------------------
        // bigger bodies cost more to keep alive (Kleiber's law)
        //-----------------------------------------------------
        _basalMetabolism = BASAL_METABOLISM * Math.pow( _phenotype.mass, 0.75 );

        //-----------------------------------------------------
        // ecology traits
        //-----------------------------------------------------
        _thermalOptimum = ( _phenotype.thermalOptimum !== undefined ) ? _phenotype.thermalOptimum : ONE_HALF;
        _thermalWidth   = ( _phenotype.thermalWidth   !== undefined ) ? _phenotype.thermalWidth   : 0.4;
        _digestion      = ( _phenotype.digestion      !== undefined ) ? _phenotype.digestion      : ONE_HALF;
        _brightness     = ( _phenotype.brightness     !== undefined ) ? _phenotype.brightness     : ONE_HALF;
        _choosiness     = ( _phenotype.choosiness     !== undefined ) ? _phenotype.choosiness     : ZERO;
        _thermalPeak    = thermalPeak( _thermalWidth );
        _efficiencyWarm = digestionEfficiency( _digestion, PLANT_TYPE_WARM );
        _efficiencyCold = digestionEfficiency( _digestion, PLANT_TYPE_COLD );
        _comfort        = -ONE;
        this.updateThermalFit();

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

	    _chosenPrey      = null;
	    _nearestPredator = null;
	    _tryingToHunt    = false;
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


	//--------------------------------
	// update
	//--------------------------------
	this.update = function()
	{
		//---------------------------
		// update age
		//---------------------------
		_age ++;

        if ( _huntCooldown > 0 )
        {
            _huntCooldown --;
        }

        if ( _age % BRAIN_SENSORY_UPDATE_PERIOD == 0 )
        {
            _readyforSensoryInputToBrain = true;
        }

        //-----------------------------
        // neural brain: think now and then
        //-----------------------------
        if ( _neural && (( _age + _index ) % THINK_PERIOD === 0 ))
        {
            this.think();
        }

        //-----------------------------
        // update brain
        //-----------------------------
        _brain.setEnergyLevel( _energy );
        _brain.update();

        //-------------------------------------
        // I wanna eat my chosen food bit...
        //-------------------------------------
        if ( _brain.getState() === BRAIN_STATE_PURSUING_FOOD )
        {
            if (( _chosenFoodBit != null )
            &&  ( _chosenFoodBit.getAlive()))
            {
                //let distanceSquared = _chosenFoodBit.getPosition().getDistanceSquaredTo( _phenotype.parts[ MOUTH_INDEX ].position );
                //if ( distanceSquared < SWIMBOT_MOUTH_LENGTH * SWIMBOT_MOUTH_LENGTH )

                let xx = _chosenFoodBit.getPosition().x - this.getMouthPosition().x;
                let yy = _chosenFoodBit.getPosition().y - this.getMouthPosition().y;
                let distance = Math.sqrt( xx*xx + yy*yy );

                if ( distance < SWIMBOT_MOUTH_LENGTH )
                {
                    _tryingToEat = true;
                    //console.log( "I'm trying to eat!" );
                }
            }
        }

        //------------------------------------------
        // I wanna have sex with my chosen swimbot
        //------------------------------------------
        else if ( _brain.getState() === BRAIN_STATE_PURSUING_MATE )
        {
            if (( _chosenMate != null )
            &&  ( _chosenMate.getAlive() ))
            {
                let xx = _chosenMate.getGenitalPosition().x - this.getGenitalPosition().x;
                let yy = _chosenMate.getGenitalPosition().y - this.getGenitalPosition().y;
                let distance = Math.sqrt( xx*xx + yy*yy );

                if ( distance < SWIMBOT_GENITAL_LENGTH )

                /*
                //fix!!!!!
                let distanceSquared = _chosenMate.getGenitalPosition().getDistanceSquaredTo( this.getGenitalPosition() );
                console.log( distanceSquared + ", " + SWIMBOT_GENITAL_LENGTH * SWIMBOT_GENITAL_LENGTH );
                if ( distanceSquared < SWIMBOT_GENITAL_LENGTH * SWIMBOT_GENITAL_LENGTH )
                */
                {
                    _tryingToMate = true;
                }
            }
        }

        //------------------------------------------
        // I wanna bite my chosen prey
        //------------------------------------------
        else if ( _brain.getState() === BRAIN_STATE_PURSUING_PREY )
        {
            if ( this.getChosenPreyIsValid() )
            {
                let biteDistance = SWIMBOT_MOUTH_LENGTH + _chosenPrey.getBoundingRadius() * ONE_HALF;

                if (( _huntCooldown === 0 )
                &&  ( this.getMouthPosition().getDistanceTo( _chosenPrey.getPosition() ) < biteDistance ))
                {
                    _tryingToHunt = true;
                }
            }
        }

        //------------------------------------------------------------
        // a hungry predator with no prey in sight eats meat it sees
        //------------------------------------------------------------
        else if ( _brain.getState() === BRAIN_STATE_LOOKING_FOR_PREY )
        {
            if ( this.getChosenMeatIsValid() )
            {
                if ( this.getMouthPosition().getDistanceTo( _chosenFoodBit.getPosition() ) < SWIMBOT_MOUTH_LENGTH )
                {
                    _tryingToEat = true;
                }
            }
        }

        //----------------------------------------------------------------------
        // determine the direction to the goal...
        //----------------------------------------------------------------------
        if ( _brain.getState() === BRAIN_STATE_LOOKING_FOR_PREY )
        {
            if ( this.getChosenMeatIsValid() )
            {
                _directionToGoal.set( _chosenFoodBit.getPosition() );
                _directionToGoal.subtract( _mouthPosition );
                _directionToGoal.normalize();
            }
            else
            {
                this.wanderFocus();
            }
        }
        else if ( _brain.getState() === BRAIN_STATE_PURSUING_PREY )
        {
            if ( this.getChosenPreyIsValid() )
            {
                _directionToGoal.set( _chosenPrey.getPosition() );
                _directionToGoal.subtract( _mouthPosition );
                _directionToGoal.normalize();
            }
        }
        else if ( _brain.getState() === BRAIN_STATE_FLEEING_PREDATOR )
        {
            if (( _nearestPredator != null ) && ( _nearestPredator.getAlive() ))
            {
                // swim directly away from the predator
                _directionToGoal.set( _position );
                _directionToGoal.subtract( _nearestPredator.getPosition() );
                _directionToGoal.normalize();
            }
        }
        else if (( _brain.getState() === BRAIN_STATE_LOOKING_FOR_FOOD )
        ||  ( _brain.getState() === BRAIN_STATE_LOOKING_FOR_MATE ))
        {
            this.wanderFocus();
        }
        else if ( _brain.getState() == BRAIN_STATE_PURSUING_MATE )
        {
            //console.log( "BRAIN_STATE_PURSUING_MATE");
            if ( _chosenMate != null )
            {
                _directionToGoal.set( _chosenMate.getGenitalPosition() );
                _directionToGoal.subtract( _genitalPosition );
                _directionToGoal.normalize();
            }
        }
        else if ( _brain.getState() === BRAIN_STATE_PURSUING_FOOD )
        {
            //console.log( "BRAIN_STATE_PURSUING_FOOD");
            if ( _chosenFoodBit != null )
            {
                _directionToGoal.set( _chosenFoodBit.getPosition() );
                _directionToGoal.subtract( _mouthPosition );
                _directionToGoal.normalize();
            }
        }


        //----------------------------------------------------------------------
        // neural brain: while searching, also follow the better temperature
        // and keep close to (or away from) the others, as the brain decides
        //----------------------------------------------------------------------
        if ( _neural )
        {
            const state = _brain.getState();
            if (( state === BRAIN_STATE_LOOKING_FOR_FOOD ) || ( state === BRAIN_STATE_LOOKING_FOR_MATE ) || ( state === BRAIN_STATE_LOOKING_FOR_PREY ))
            {
                _directionToGoal.x += CLIMATE_STEERING * _climateWeight * _climateDirX + SOCIAL_STEERING * _socialWeight * _socialDirX;
                _directionToGoal.y += CLIMATE_STEERING * _climateWeight * _climateDirY + SOCIAL_STEERING * _socialWeight * _socialDirY;
                _directionToGoal.normalize();
            }
        }

        //----------------------------------------------------------------------
        // continually push the focus direction towards the goal
        //----------------------------------------------------------------------
        let previousFocusDirection = _previousFocusDirection;
        previousFocusDirection.set( _focusDirection );

        _focusDirection.addScaled( _directionToGoal, BRAIN_FOCUS_TARGET_SHIFT_STRENGTH );

        _vectorUtility.setToDifference( _focusDirection, previousFocusDirection );

        if ( _vectorUtility.getMagnitudeSquared() > BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD * BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD )
        {
            _focusDirection.set( previousFocusDirection );
            _focusDirection.addScaled( _directionToGoal, BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD );
        }

        _focusDirection.normalize();

        //old version
        //_focusDirection.addScaled( _directionToGoal, BRAIN_FOCUS_TARGET_SHIFT_STRENGTH );
        //_focusDirection.normalize();

		//---------------------------
		// update body parts
		//---------------------------
		this.updateBodyParts();

		//---------------------------
		// update physics
		//---------------------------
        this.updatePhysics();
	}



	//----------------------------------------
	// wander focus
	//----------------------------------------
	this.wanderFocus = function()
	{
	    if ( environment.active && ( ( _age + _index ) % KINESIS_PERIOD === 0 ))
	    {
	        this.kinesis();
	    }

	    let length = _directionToGoal.getMagnitude();

	    if ( length === ZERO )
	    {
	        //console.log( "ZERO!!!" );
	        _directionToGoal.x = -ONE_HALF + gpRandom();
	        _directionToGoal.y = -ONE_HALF + gpRandom();
	        length = _directionToGoal.getMagnitude();
	    }

        _directionToGoal.x += ( -BRAIN_WANDER_AMOUNT * ONE_HALF + gpRandom() * BRAIN_WANDER_AMOUNT );
        _directionToGoal.y += ( -BRAIN_WANDER_AMOUNT * ONE_HALF + gpRandom() * BRAIN_WANDER_AMOUNT );

        _directionToGoal.x /= length;
        _directionToGoal.y /= length;

        //console.log( _directionToGoal.x + ", " + _directionToGoal.y );
    }




	//------------------------------------------------------------------------
	// one thought of the neural brain: what do I want, and how do I move?
	//------------------------------------------------------------------------
	this.think = function()
	{
	    const hunger    = _brain.getHungerThreshold();
	    const predator  = this.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD;
	    const threat    = ( _nearestPredator != null );
	    const x         = _nnInputs;

	    x[ IN_BIAS     ] = ONE;
	    x[ IN_HUNGER   ] = Math.max( -ONE, Math.min( ONE, ( hunger - _energy ) / Math.max( ONE, hunger )));
	    x[ IN_ENERGY   ] = Math.min( 2, _energy / 100 );
	    x[ IN_AGE      ] = _age / globalTweakers.maximumLifeSpan;
	    x[ IN_FIT      ] = _thermalFit;
	    x[ IN_TREND    ] = _comfortTrend;
	    x[ IN_FOOD     ] = _seenFood ? ONE : ZERO;
	    x[ IN_MATE     ] = ( _numSeen > 0 ) ? ONE : ZERO;
	    x[ IN_THREAT   ] = threat ? ONE : ZERO;
	    x[ IN_PREY     ] = _seenPrey ? ONE : ZERO;
	    x[ IN_CROWD    ] = Math.min( ONE, _numSeen / 10 );
	    x[ IN_PREDATOR ] = predator ? ONE : ZERO;

	    think( _genotype.getBrain(), x, _nnHidden, _nnNewHidden, _nnOutputs );

	    //------------------------------------------------------
	    // the strongest possible drive wins (the current goal
	    // gets a small bonus so the swimbot doesn't dither)
	    //------------------------------------------------------
	    const current = _brain.getGoal();
	    let best = OUT_MATE, bestValue = -Infinity;
	    for (let d = 0; d < NUM_DRIVES; d++)
	    {
	        if (( d === OUT_FLEE ) && ( !threat || predator )) continue;   // nothing to flee from
	        if (( d === OUT_HUNT ) && !predator ) continue;                // only predators hunt
	        if (( d === OUT_FOOD ) && predator ) continue;                 // predators don't eat plants
	        const value = _nnOutputs[d] + ( d === current ? DRIVE_HYSTERESIS : ZERO );
	        if ( value > bestValue ) { bestValue = value; best = d; }
	    }
	    _brain.setGoal( best );

	    //------------------------------------------------------
	    // how to move
	    //------------------------------------------------------
	    _effort        = EFFORT_MIN + EFFORT_RANGE * sigmoid( _nnOutputs[ OUT_EFFORT ] );
	    _socialWeight  = Math.tanh( _nnOutputs[ OUT_SOCIAL ] );
	    _climateWeight = environment.active ? sigmoid( _nnOutputs[ OUT_CLIMATE ] ) : ZERO;

	    if ( _climateWeight > 0.05 )
	    {
	        // which way does the temperature suit me better?
	        const d  = CLIMATE_PROBE_DISTANCE;
	        const gx = thermalFit( this.feltTemperature( _position.x + d, _position.y ), _thermalOptimum, _thermalWidth )
	                 - thermalFit( this.feltTemperature( _position.x - d, _position.y ), _thermalOptimum, _thermalWidth );
	        const gy = thermalFit( this.feltTemperature( _position.x, _position.y + d ), _thermalOptimum, _thermalWidth )
	                 - thermalFit( this.feltTemperature( _position.x, _position.y - d ), _thermalOptimum, _thermalWidth );
	        const length = Math.sqrt( gx * gx + gy * gy );
	        _climateDirX = ( length > 1e-4 ) ? gx / length : ZERO;
	        _climateDirY = ( length > 1e-4 ) ? gy / length : ZERO;
	    }
	    else
	    {
	        _climateDirX = _climateDirY = ZERO;
	    }
	}

	this.getUsesNeuralBrain = function() { return _neural;        }
	this.getEffort          = function() { return _effort;        }
	this.getClimateWeight   = function() { return _climateWeight; }
	this.getSocialWeight    = function() { return _socialWeight;  }
	this.getDrives          = function() { return _nnOutputs;     }

	//------------------------------------------------------------------------
	// kinesis ("run and tumble", like bacteria): now and then compare how good
	// it is here with how good it was; if it got worse, maybe turn. If the
	// temperature is really wrong, look around and head for the best way.
	//------------------------------------------------------------------------
	this.kinesis = function()
	{
	    this.updateThermalFit();

	    if ( _thermalFit < EMERGENCY_THERMAL_FIT )
	    {
	        let length = _directionToGoal.getMagnitude();
	        let dx = ( length > ZERO ) ? _directionToGoal.x / length : ONE;
	        let dy = ( length > ZERO ) ? _directionToGoal.y / length : ZERO;
	        let bestFit = -ONE, bestX = dx, bestY = dy;

	        for (let k = 0; k < 4; k++)
	        {
	            const fit = thermalFit( this.feltTemperature( _position.x + dx * EMERGENCY_PROBE_DISTANCE,
	                                                          _position.y + dy * EMERGENCY_PROBE_DISTANCE ), _thermalOptimum, _thermalWidth );
	            if ( fit > bestFit ) { bestFit = fit; bestX = dx; bestY = dy; }
	            const t = dx; dx = -dy; dy = t;   // turn 90 degrees
	        }

	        _directionToGoal.setXY( bestX, bestY );
	        _comfort = -ONE;
	        return;
	    }

	    const cell = environment.plantCellIndex( _position.x, _position.y );
	    const food = ( environment.plantCount[ PLANT_TYPE_WARM ][ cell ] * _efficiencyWarm
	                 + environment.plantCount[ PLANT_TYPE_COLD ][ cell ] * _efficiencyCold ) / 6;
	    const comfort = ( 0.05 + _thermalFit * _thermalPeak ) * ( 0.05 + food );

	    _comfortTrend = ( _comfort < ZERO ) ? ZERO : ( comfort > _comfort ? ONE : ( comfort < _comfort ? -ONE : ZERO ));

	    if (( _comfort >= ZERO ) && ( comfort < _comfort ) && ( gpRandom() < KINESIS_TURN_CHANCE ))
	    {
	        const turn = ( -ONE + 2 * gpRandom() ) * KINESIS_MAX_TURN * PI_OVER_180;
	        const c = Math.cos( turn ), sn = Math.sin( turn );
	        const x = _directionToGoal.x, y = _directionToGoal.y;
	        _directionToGoal.setXY( x * c - y * sn, x * sn + y * c );
	    }

	    _comfort = comfort;
	}

	//------------------------------------------------------------------------
	this.updateThermalFit = function()
	{
	    _thermalFit = environment.active
	        ? thermalFit( this.feltTemperature( _position.x, _position.y ), _thermalOptimum, _thermalWidth )
	        : ONE;
	}

	// the temperature as this swimbot feels it: dark bodies warm up a little more
	this.feltTemperature = function( x, y )
	{
	    return environment.temperatureAt( x, y ) + THERMOMELANISM * ( ONE - 2 * _brightness );
	}

	//------------------------------------------------------------------------
	// does this swimbot accept the suitor as a mate? The more different their
	// brightness and the choosier I am, the less likely (fixed for a pair)
	//------------------------------------------------------------------------
	this.acceptsMate = function( suitor )
	{
	    if ( !environment.active ) return true;
	    const db = Math.abs( suitor.getBrightness() - _brightness );
	    return pairRandom( suitor.getIndex(), _index ) < mateAcceptance( db, _choosiness );
	}

	this.getBrightness      = function() { return _brightness;      }
	this.getChoosiness      = function() { return _choosiness;      }

	this.getDigestionEfficiency = function( type )
	{
	    if ( type === 2 ) return ONE;
	    return ( type === PLANT_TYPE_WARM ) ? _efficiencyWarm : _efficiencyCold;
	}

	this.getThermalFit      = function() { return _thermalFit;      }
	this.getThermalOptimum  = function() { return _thermalOptimum;  }
	this.getThermalWidth    = function() { return _thermalWidth;    }
	this.getDigestion       = function() { return _digestion;       }
	this.getComfort         = function() { return _comfort;         }

	//----------------------------------------
	// update physics
	//----------------------------------------
	this.updatePhysics = function()
	{
        //---------------------------------------------------------------------------
        // a swimbot creates its own linear and angular forces via moving parts
        //---------------------------------------------------------------------------
        this.calculateFluidForces();

        if ( _age % ENERGY_EFFICIENCY_MEASUREMENT_PERIOD === 0 )
        {
            this.calculateEnergyEfficiency();
        }

        //---------------------------------------------
        // energy is always slowly draining
        //---------------------------------------------
        _energy -= CONTINUAL_ENERGY_DRAIN + _basalMetabolism;

        //---------------------------------------------
        // living at the wrong temperature costs energy
        //---------------------------------------------
        if ( environment.active )
        {
            if ( ( _age + _index ) % THERMAL_FIT_UPDATE_PERIOD === 0 ) { this.updateThermalFit(); }
            _energy -= THERMAL_MISMATCH_DRAIN * ( ONE - _thermalFit );
        }

        //---------------------------------------------
        // when energy hits zero, that means death
        //---------------------------------------------
        if ( _energy <= ZERO )
        {
            _energy = ZERO;

            // eternal swimbots don't starve to death
            if ( !_eternal )
            {
                this.die();
            }
        }

		//---------------------------
		// wall collisions
		//---------------------------
		this.updateWallCollisions();
	}


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

        //----------------------------------------
        // loop through parts...
        //----------------------------------------
        assert( _numParts > 0, "_numParts > 0" );

		for (let p=1; p<_numParts; p++)
		{
		    //---------------------------------------------------------
		    // calculate this part's fraction of the total length
		    //---------------------------------------------------------
            const i = p * PS;
            let fractionOfWhole = _pLength[p] / _sumPartLengths;

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
            _energy -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING;

            if ( _energy < ZERO )
            {
                _energy = ZERO;
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

let partAccelerationX = -strokeForceX;
let partAccelerationY = -strokeForceY;

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
                let perpDot = ( strokeForceX * partPerpendicularX + strokeForceY * partPerpendicularY ) / _sumPartLengths;

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
        _spin += _torque;// * SPIN_SCALAR;
//_spin *= SPIN_DECAY;

		//--------------------------------------------------
		// update position by velocity, and angle by spin
		//--------------------------------------------------
        _position.add( _velocity );
        _angle += _spin;
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
        let energyLost   = _lastEnergyForEfficiencyMeasurement - _energy;

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
        _energyEfficiency = averageSpeed / ( ONE + energyLost );

        // reset these values for the next go-round...
        _lastPositionForEfficiencyMeasurement.set( _position );
        _lastEnergyForEfficiencyMeasurement = _energy;
    }


	//----------------------------------------
	// update wall collisions
	//----------------------------------------
	this.updateWallCollisions = function()
	{
        //--------------------------------------------------------------------
        // left wall
        //--------------------------------------------------------------------
        if ( _position.x < POOL_LEFT + _sumPartLengths * ONE_HALF )
        {
            //console.log( "left " );
            for (let p=1; p<_numParts; p++)
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
        else if ( _position.x > POOL_RIGHT - _sumPartLengths * ONE_HALF )
        {
            //console.log( "right " );
            for (let p=1; p<_numParts; p++)
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
        if ( _position.y < POOL_TOP + _sumPartLengths * ONE_HALF )
        {
            //console.log( "top" );

            for (let p=1; p<_numParts; p++)
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
        else if ( _position.y > POOL_BOTTOM - _sumPartLengths * ONE_HALF )
        {
            for (let p=1; p<_numParts; p++)
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
        _energy = e;
    }

	//---------------------------
	// set angle
	//---------------------------
	this.setAngle = function(a)
	{
        _angle = a;
    }


	//--------------------------------------------------------------------------------------------------------
	// get functions
	//--------------------------------------------------------------------------------------------------------
	this.getIsTryingToEat               = function() { return _tryingToEat;                                 }
	this.getIsTryingToMate              = function() { return _tryingToMate;                                }
	this.getIndex                       = function() { return _index;                                       }
	this.getAge                         = function() { return _age;                                         }
	this.getAlive                       = function() { return _alive;                                       }
	this.getEnergy                      = function() { return _energy;                                      }
	this.getAngle                       = function() { return _angle;                                       }
	this.getEnergyEfficiency            = function() { return _energyEfficiency;                            }
	this.getPosition                    = function() { return _position;                                    }
	this.getBoundingRadius              = function() { return _phenotype.sumPartLengths;                    }
	this.getNumParts                    = function() { return _phenotype.numParts;                          }
	this.getIsLookingForSensoryInput    = function() { return _readyforSensoryInputToBrain;                 }
	this.getGenitalPosition             = function() { return _genitalPosition;                             }
	this.getMouthPosition               = function() { return _mouthPosition;                               }
	this.getChosenMateIndex             = function() { return _chosenMateIndex;                             }
	this.getChosenFoodBitIndex          = function() { return _chosenFoodBitIndex;                          }
	this.getNumOffspring                = function() { return _numOffspring;                                }
	this.getNumFoodBitsEaten            = function() { return _numFoodBitsEaten;                            }
    this.getBrainState                  = function() { return _brain.getState();                            }
    this.getGenotype                    = function() { return _genotype;                                    }
	this.getSelectRadius                = function() { return _selectRadius;                                }
	this.getPreferredFoodType           = function() { return _phenotype.preferredFoodType;                 }
	this.getDigestibleFoodType          = function() { return _phenotype.digestibleFoodType;                }
	this.getIsTryingToHunt              = function() { return _tryingToHunt;                                }
	this.getNumPreyEaten                = function() { return _numPreyEaten;                                }
	this.getPhenotypeMass               = function() { return _phenotype.mass;                              }
	this.getHungerThreshold             = function() { return _brain.getHungerThreshold();                  }
	this.getMaxEnergy                   = function() { return SWIMBOT_MAX_ENERGY;                           }
	this.getMaxAge                      = function() { return globalTweakers.maximumLifeSpan;               }
	this.getOldAgeThreshold             = function() { return globalTweakers.maximumLifeSpan - OLD_AGE_DURATION; }
	this.getDynamicScanRadius           = function() { return _scanRadius;                                  }
	this.getEternal                     = function() { return _eternal;                                     }
	this.isEternal                      = function() { return _eternal;                                     }
	this.setEternal                     = function(e) { _eternal = e;                                       }

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
	    return (( _chosenPrey != null ) && _chosenPrey.getAlive() );
	}

	//---------------------------------------
	this.getChosenMeatIsValid = function()
	{
	    return (( _chosenFoodBit != null ) && _chosenFoodBit.getAlive() && ( _chosenFoodBit.getType() === 2 ));
	}


	//------------------------------------------------------------------------
	// the predator's "radar": grows while a hungry predator sees no prey,
	// holds still for a while after prey is found, and relaxes back to
	// the normal view radius when the predator is not hunting.
	//------------------------------------------------------------------------
	this.updateScanRadius = function()
	{
	    let state = _brain.getState();
	    let hunting = ( this.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD )
	              && (( state === BRAIN_STATE_LOOKING_FOR_PREY ) || ( state === BRAIN_STATE_PURSUING_PREY ));

	    if ( _scanCooldown > 0 )
	    {
	        _scanCooldown -= BRAIN_SENSORY_UPDATE_PERIOD;
	    }
	    else if ( hunting && ( state === BRAIN_STATE_LOOKING_FOR_PREY ))
	    {
	        _scanRadius = Math.min( _scanRadius + PREY_SCAN_RADIUS_GROWTH, SWIMBOT_VIEW_RADIUS * PREY_SCAN_RADIUS_MAX_SCALE );
	    }
	    else if ( !hunting )
	    {
	        _scanRadius = Math.max( _scanRadius - PREY_SCAN_RADIUS_GROWTH, SWIMBOT_VIEW_RADIUS );
	    }
	}

	//---------------------------------------------------------
	// a predator just tried to bite me - flee from it now
	//---------------------------------------------------------
	this.notifyAttackedBy = function( predator )
	{
	    _nearestPredator = predator;
	    _brain.setNearbyPredatorThreat( true );
	}

	//---------------------------------------
	this.notifyTargetFound = function()
	{
	    _scanCooldown = PREY_SCAN_COOLDOWN;
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

        assert( _chosenFoodBit != null, "Swimbot:eatChosenFoodBit: _chosenFoodBit != null" );
        assert( _chosenFoodBit.getAlive(), "Swimbot:eatChosenFoodBit: _chosenFoodBit.getAlive()" );

        if (( _chosenFoodBit != null )
        &&  ( _chosenFoodBit.getAlive() ))
        {
            let energyFromFoodBit = _chosenFoodBit.getEnergy();

            if ( globalTweakers.numFoodTypes > 1 )
            {
                /*
                console.log( "-------------------------------" );
                console.log( " eating....." );
                console.log( "_chosenFoodBit.getType() = " + _chosenFoodBit.getType() );
                console.log( "_phenotype.digestibleFoodType  = " + _phenotype.digestibleFoodType  );
                console.log( " " );
                console.log( "-------------------------------" );
                */

                //----------------------------------------------------------------------
                // If the type of the chosen food bit is not compatible with the
                // digestible type of the swimbot, then it gets less energy...
                //----------------------------------------------------------------------
                // (meat, type 2, is always fully digestible for predators)
                if (( _chosenFoodBit.getType() != 2 )
                &&  ( _chosenFoodBit.getType() != _phenotype.digestibleFoodType ))
                {
                    //console.log( "decrease energy from food bit..." );
                    energyFromFoodBit *= FOOD_TYPE_OFFSET;
                }
            }

            //----------------------------------------------------------------------
            // with the environment on: digestion and climate decide how much
            // of the food's energy I actually get
            //----------------------------------------------------------------------
            if ( environment.active )
            {
                energyFromFoodBit = _chosenFoodBit.getEnergy()
                                  * this.getDigestionEfficiency( _chosenFoodBit.getType() )
                                  * climateFoodFactor( _thermalFit, _thermalPeak );
            }

            _energy += energyFromFoodBit;

            _numFoodBitsEaten ++;

            assert( _chosenFoodBit.getEnergy() >= ZERO, "Swimbot:eatChosenFoodBit: _chosenFoodBit.getEnergy() >= ZERO" );

            _tryingToEat = false;

            _timerDelta = ZERO;

            //foodBitIndex = _chosenFoodBit.getIndex();

            assert( _chosenFoodBitIndex != NULL_INDEX, "Swimbot:eatChosenFoodBit: _chosenFoodBitIndex != NULL_INDEX" );

            _chosenFoodBit.kill();

// somehow, the swimbot is still looking for food even when it is too far away
// not sure if this is the right place to fix, but it needs fixing
            //_brain.setFoundFoodBit( false );
        }

        return _chosenFoodBitIndex;
    }


	//------------------------------------------------------------------------
	// huntEatChosenPrey: the prey dies and its energy goes to the predator.
	// Whatever doesn't fit under the max energy drops as red meat.
	//------------------------------------------------------------------------
	this.huntEatChosenPrey = function()
	{
	    _tryingToHunt = false;

	    if (( !this.getChosenPreyIsValid() )
	    ||  ( _chosenPrey.isEternal() ))
	    {
	        return;
	    }

	    _huntCooldown = ATTACK_COOLDOWN;

	    //-----------------------------------------------
	    // missed! the prey gets away and starts fleeing
	    //-----------------------------------------------
	    if ( gpRandom() > ATTACK_SUCCESS_CHANCE )
	    {
	        _chosenPrey.notifyAttackedBy( this );
	        return;
	    }

	    let preyPosition = new Vector2D();
	    preyPosition.set( _chosenPrey.getPosition() );

	    let energyFromPrey = _chosenPrey.getEnergy() * PREDATION_ENERGY_TRANSFER;

	    _chosenPrey.die();

	    simCounters.attackCount ++;
	    _numPreyEaten ++;

	    let room = Math.max( ZERO, SWIMBOT_MAX_ENERGY - _energy );

	    if ( energyFromPrey > room )
	    {
	        _energy += room;

	        let numMeatBits = Math.floor( ( energyFromPrey - room ) / DEFAULT_FOOD_BIT_ENERGY );
	        _parent.spawnMeatFoodBits( preyPosition, numMeatBits );
	    }
	    else
	    {
	        _energy += energyFromPrey;
	    }

	    _timerDelta = ZERO;
	    _chosenPrey = null;
	    _brain.setFoundPrey( false );
	}



	//--------------------------------------------
	// setEnvironmentalStimuli
	//--------------------------------------------
	this.setEnvironmentalStimuli = function( numNearbySwimbots, nearbySwimbotArray, foodBitWasFound, theFoodBit, preyWasFound, thePrey, theNearestPredator )
    {
        //------------------------------------------------------------
        // predator threat (herbivores only - genepool only passes
        // a nearest predator to herbivores)
        //------------------------------------------------------------
        _nearestPredator = null;

        //------------------------------------------------------------
        // remember what I see, for the neural brain
        //------------------------------------------------------------
        _seenFood = foodBitWasFound && ( theFoodBit != null ) && ( theFoodBit.getType() !== 2 );
        _seenPrey = ( preyWasFound && ( thePrey != null )) || ( foodBitWasFound && ( theFoodBit != null ) && ( theFoodBit.getType() === 2 ));
        _numSeen  = numNearbySwimbots;

        if ( _neural )
        {
            let sx = ZERO, sy = ZERO;
            for (let o = 0; o < numNearbySwimbots; o++)
            {
                const p = nearbySwimbotArray[o].getPosition();
                sx += p.x - _position.x;
                sy += p.y - _position.y;
            }
            const length = Math.sqrt( sx * sx + sy * sy );
            _socialDirX = ( length > ZERO ) ? sx / length : ZERO;
            _socialDirY = ( length > ZERO ) ? sy / length : ZERO;
        }

        if (( theNearestPredator != null )
        &&  ( theNearestPredator.getPosition().getDistanceTo( _position ) < PREDATOR_FLEE_RADIUS ))
        {
            _nearestPredator = theNearestPredator;
        }

        _brain.setNearbyPredatorThreat( _nearestPredator != null );

        //------------------------------------------------------------
        // if hunting, choose the prey that was found
        //------------------------------------------------------------
        _chosenPrey = null;

        if (( _brain.getState() == BRAIN_STATE_LOOKING_FOR_PREY )
        ||  ( _brain.getState() == BRAIN_STATE_PURSUING_PREY ))
        {
            let preyIsValid = ( preyWasFound === true ) && ( thePrey != null );

            _brain.setFoundPrey( preyIsValid );

            if ( preyIsValid )
            {
                _chosenPrey = thePrey;
            }
        }

        //------------------------------------------------------------
        // if looking for a food bit, choose the one that was found
        // (a hunting predator with no prey in sight takes meat)
        //------------------------------------------------------------
        _chosenFoodBit = null;
        _chosenFoodBitIndex = NULL_INDEX;

        if (( _brain.getState() == BRAIN_STATE_LOOKING_FOR_PREY )
        &&  ( _chosenPrey == null )
        &&  ( foodBitWasFound )
        &&  ( theFoodBit != null )
        &&  ( theFoodBit.getType() === 2 ))
        {
            _chosenFoodBit = theFoodBit;
            _chosenFoodBitIndex = _chosenFoodBit.getIndex();
        }

        if (( _brain.getState() == BRAIN_STATE_LOOKING_FOR_FOOD )
        ||  ( _brain.getState() == BRAIN_STATE_PURSUING_FOOD ))
        {
            _brain.setFoundFoodBit( foodBitWasFound );

            if ( foodBitWasFound )
            {
                //console.log( "foodBitWasFound" );
                assert( theFoodBit != null, "swimbot.js: setEnvironmentalStimuli: theFoodBit != null" );
                _chosenFoodBit = theFoodBit;
                _chosenFoodBitIndex = _chosenFoodBit.getIndex();
            }
        }

        // nothing to eat anymore - cancel any pending bite
        if ( _chosenFoodBit == null )
        {
            _tryingToEat = false;
        }

        //------------------------------------------------------------------------------------------------
        // if looking for mate, scan the nearby swimbots and choose the most attractive...
        //------------------------------------------------------------------------------------------------
        if ( _brain.getState() === BRAIN_STATE_LOOKING_FOR_MATE )
        {
            //console.log( "horny" );

            let mostAttractiveFound = null;
            let atLeastOneBabeIsVisible = false;
            let highestBabeFactor = -100.0;

            for (let o=0; o<numNearbySwimbots; o++)
            {
                let babeFactor = nearbySwimbotArray[o].getAttractiveness( this );

                if (( babeFactor > highestBabeFactor )
                &&  ( babeFactor > TOO_UGLY_TO_CHOOSE )
                &&  ( nearbySwimbotArray[o].getAge() > YOUNG_AGE_DURATION )
                &&  ( nearbySwimbotArray[o].getEnergy() > STARVING )
                &&  nearbySwimbotArray[o].acceptsMate( this ))
                {
                    //console.log( "ok" );
                    highestBabeFactor = babeFactor;
                    mostAttractiveFound = nearbySwimbotArray[o];
                    assert( mostAttractiveFound != null, "mostAttractiveFound != null" );
                    atLeastOneBabeIsVisible = true;
                }
            }

            if ( atLeastOneBabeIsVisible )
            {
                _chosenMate = mostAttractiveFound;
                assert( _chosenMate != null, "_chosenMate != null" );

                _chosenMateIndex = mostAttractiveFound.getIndex();
                assert( _chosenMateIndex != NULL_INDEX, "_chosenMateIndex != NULL_INDEX" );

                _brain.setFoundSwimbot( true );
            }
            else
            {
                _brain.setFoundSwimbot( false );
            }
        }
        else if ( _brain.getState() == BRAIN_STATE_PURSUING_MATE )
        {
            //console.log( "pursuing mate" );

            let ICanStillSeeYou = false;

            for (let o=0; o<numNearbySwimbots; o++)
            {
                let index = nearbySwimbotArray[o].getIndex();
                if ( index === _chosenMateIndex )
                {
                    ICanStillSeeYou = true;
                    _chosenMate = nearbySwimbotArray[o];
                }
            }

            if ( ICanStillSeeYou )
            {
                /*
                assert( chosenMate != NULL );
                if ( chosenMate->getEnergy() < STARVING )
                {
                    state.brain.setFoundSwimbot( false );
                    chosenMate = NULL;
                    state.chosenMateIndex = -1;
                }
                */
            }
            else
            {
                //console.log( "can't see you anymore" );
                _brain.setFoundSwimbot( false );
                _chosenMate = null;
                _chosenMateIndex = NULL_INDEX;
            }
        }

    	//--------------------------------------------
    	// reset this to false for next time around
    	//--------------------------------------------
    	_readyforSensoryInputToBrain = false;

    } //setEnvironmentalStimuli



	//-----------------------------------------------------------------
	// abortMating: the mating attempt failed (incompatible, pool full,
	// mate gone) - give up on this mate and look for another one
	//-----------------------------------------------------------------
	this.abortMating = function()
	{
	    _tryingToMate    = false;
	    _chosenMate      = null;
	    _chosenMateIndex = NULL_INDEX;
	    _brain.setFoundSwimbot( false );
	}


	//-----------------------------------------
	// set attraction
	//-----------------------------------------
	this.setAttraction = function( attraction )
	{
	    _brain.setAttraction( attraction );

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

        for (let p=1; p<_numParts; p++)
        {
            for (let pp=1; pp<_numParts; pp++)
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
        for (let p=1; p<_numParts; p++)
        {
            _unitAxisX[p] = _pd[ p * PS + A_X ] / _pLength[p];
            _unitAxisY[p] = _pd[ p * PS + A_Y ] / _pLength[p];

        }

        //---------------------------------------------------------------------------
        // finding the dot products between each pair of these vectors...
        //---------------------------------------------------------------------------
        if ( _numParts < 3 )
        {
            amount = ONE;
        }
        else
        {
            let numTests = 0;
            for (let p=1; p<_numParts; p++)
            {
                for (let pp=p+1; pp<_numParts; pp++)
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
        amount += ( _numParts / MAX_PARTS ) * 0.3;

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

        for (let p=1; p<_numParts; p++)
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

        return c;
    }



	//-----------------------
	// die
	//----------------------
	this.die = function()
	{
        _alive = false;

        simCounters.numDeadSwimbots ++;

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

        _chosenFoodBit      = null;
        _chosenMate         = null;
        _age 	  		    = 0;
        _numOffspring       = 0;
        _numFoodBitsEaten   = 0;
        _index              = NULL_INDEX;
        _chosenMateIndex    = NULL_INDEX;
        _chosenFoodBitIndex = NULL_INDEX;
        _alive 	  		    = false;
        _tryingToMate       = false;
        _tryingToEat        = false;
        _growthScale        = ZERO;
        _torque             = ZERO;
        _angle			    = ZERO;
        _spin			    = ZERO;
        _energy			    = ZERO;
        _timer              = ZERO;
        _timerDelta         = ZERO;
        _energyEfficiency   = ZERO;
        _selectRadius       = ZERO;
        _lastEnergyForEfficiencyMeasurement = ZERO;
        _readyforSensoryInputToBrain = false;

        _chosenPrey         = null;
        _nearestPredator    = null;
        _tryingToHunt       = false;
        _numPreyEaten       = 0;
        _scanRadius         = SWIMBOT_VIEW_RADIUS;
        _scanCooldown       = 0;
        _eternal            = false;
        _huntCooldown       = 0;
    }


	//--------------------------
	// contribute to offspring
	//--------------------------
	this.contributeToOffspring = function()
	{
        //console.log( "" );
        //console.log( "-------------------------" );
        //console.log( "swimbot has energy of " + _energy );

/*
        assert( _childEnergyRatio >= ZERO, "_childEnergyRatio >= ZERO" );
        assert( _childEnergyRatio <= ONE, "_childEnergyRatio <= ONE"  );

console.log( "contributeToOffspring: _childEnergyRatio = " + _childEnergyRatio );
*/

//let energyToContribute = _energy * _childEnergyRatio;
        let energyToContribute = _energy * globalTweakers.childEnergyRatio;

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

	    _energy -= energyToContribute;

        assert( _energy >= ZERO, "Swimbot: contributeToOffspring: _energy >= ZERO" );

	    _numOffspring ++;

        _timerDelta         = ZERO;
        _tryingToMate       = false;
        _chosenMate         = null;
        _chosenMateIndex    = NULL_INDEX
        _brain.setFoundSwimbot( false );

	    return energyToContribute;


	    //previous version that uses half of the swimbot's energy
        /*
	    _numOffspring ++;

        let energyBeforeContribution = _energy;

        if (( _childEnergyRatio < ZERO )
        ||  ( _childEnergyRatio > ONE  ))
        {
            assert( _childEnergyRatio >= ZERO, "_childEnergyRatio >= ZERO" );
            assert( _childEnergyRatio <= ONE, "_childEnergyRatio <= ONE"  );
        }

        //console.log( _childEnergyRatio );

        _energy *= ( ONE - _childEnergyRatio );

        _timerDelta = ZERO;

        let energyToContribute = energyBeforeContribution - _energy;

        //cancel out all mate-related data so it doesn't get in the way next time..
        _tryingToMate = false;
        _chosenMate = null;
        _chosenMateIndex = NULL_INDEX
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
	this.writeCapsules = function( capsules, asDot )
	{
	    _swimbotRenderer.prepareColors( _phenotype, _age, _energy, _growthScale, this );

	    if ( asDot )
	    {
	        const c = _swimbotRenderer.calculatePartColor(1);
	        const x = _pd[ ROOT_PART * PS + P_X ], y = _pd[ ROOT_PART * PS + P_Y ];
	        capsules.add( x, y, x, y, SWIMBOT_DOT_RENDER_RADIUS, c.red, c.green, c.blue, 1 );
	        return;
	    }

	    for (let p=1; p<_numParts; p++)
	    {
	        const parent = _pParent[p];
	        let ax, ay;
	        if ( parent == NULL_PART ) { ax = _position.x; ay = _position.y; }
	        else { ax = _pd[ parent * PS + P_X ]; ay = _pd[ parent * PS + P_Y ]; }

	        const c = _swimbotRenderer.calculatePartColor(p);
	        capsules.add( ax, ay, _pd[ p * PS + P_X ], _pd[ p * PS + P_Y ], _pWidth[p], c.red, c.green, c.blue, 1 );
	    }
	}

	this.render = function( levelOfDetail )
	{
	    this.syncPartObjects();

	    _swimbotRenderer.render
	    (
	        _phenotype,
	        _brain,
	        _age,
	        _energy,
	        _growthScale,
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







