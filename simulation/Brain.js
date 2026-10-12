"use strict";

//----------------------------------------
// states
//----------------------------------------
const BRAIN_STATE_NULL                = -1;
const BRAIN_STATE_RESTING             =  0;
const BRAIN_STATE_LOOKING_FOR_MATE    =  1;
const BRAIN_STATE_PURSUING_MATE       =  2;
const BRAIN_STATE_LOOKING_FOR_FOOD    =  3;
const BRAIN_STATE_PURSUING_FOOD       =  4;
const BRAIN_STATE_LOOKING_FOR_PREY    =  5;
const BRAIN_STATE_PURSUING_PREY       =  6;
const BRAIN_STATE_FLEEING_PREDATOR    =  7;
const NUM_BRAIN_STATES                =  8;

//--------------------------------------------
// perceiving
//--------------------------------------------
const BRAIN_SENSORY_UPDATE_PERIOD           = 2;
const BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS   = 20;

//const BRAIN_FOCUS_TARGET_SHIFT_STRENGTH	    = 0.2;
const BRAIN_FOCUS_TARGET_SHIFT_STRENGTH	    = 0.1;
const BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD    = 0.07;
const BRAIN_WANDER_AMOUNT					= 0.2;
//const BRAIN_WALL_BOUNCE_SHIFT_AMOUNT	    = 0.1;


//----------------------------------------
// Brain!
//----------------------------------------
function Brain()
{
	let _state               = BRAIN_STATE_NULL;
	let _energy              = ZERO;
	let _foundFoodBit        = false;
	let _foundSwimbot        = false;
	let _foundPrey           = false;
	let _hungerThreshold     = ZERO;
	let _attractionCriterion = ATTRACTION_SIMILAR_COLOR;
	let _predatorLevel          = ZERO; // 0..1
	let _nearbyPredatorThreat   = false; // хищник в зоне экстренного бегства
	
	
    //-----------------------------
    this.initialize = function()
    {
	    _state = BRAIN_STATE_NULL;
	    
	    /*
	    _energy                 = ZERO;
	    _foundFoodBit           = false;
	    _foundSwimbot           = false;
	    _foundPrey              = false;
	    _hungerThreshold        = ZERO;
	    _attractionCriterion    = ATTRACTION_SIMILAR_COLOR;
	    */
		_predatorLevel        = ZERO;
		_foundPrey            = false;
		_nearbyPredatorThreat = false;
    }

    //-----------------------
    this.update = function()
    {   
        //----------------------------------------------------------------------
        // if low energy:
        //   - predators: look for prey
        //   - otherwise: look for food
        // if enough energy: look for sex
        //----------------------------------------------------------------------
        // ВЫСШИЙ ПРИОРИТЕТ: бегство от хищника в упор
        // Перекрывает и голод, и поиск партнёра.
        // Только для травоядных; только пока угроза активна.
        if ( _nearbyPredatorThreat && _predatorLevel <= PREDATOR_LEVEL_THRESHOLD )
        {
            _state = BRAIN_STATE_FLEEING_PREDATOR;
            return;
        }

        if ( _energy < _hungerThreshold )
        {
            if ( _predatorLevel > PREDATOR_LEVEL_THRESHOLD )
            {
                if (( _state != BRAIN_STATE_PURSUING_PREY )
                &&  ( _state != BRAIN_STATE_LOOKING_FOR_PREY ))
                {
                    _state = BRAIN_STATE_LOOKING_FOR_PREY;
                }
            }
            else
            {
                if (( _state != BRAIN_STATE_PURSUING_FOOD )
                &&  ( _state != BRAIN_STATE_LOOKING_FOR_FOOD ))
                {
                    _state = BRAIN_STATE_LOOKING_FOR_FOOD;
                }       
            }
        }
        else 
        {
            if (( _state != BRAIN_STATE_PURSUING_MATE )
            &&  ( _state != BRAIN_STATE_LOOKING_FOR_MATE ))
            {
                _state = BRAIN_STATE_LOOKING_FOR_MATE;
            }        
        }
    
        //--------------------------------------------------------
        //  looking for food
        //--------------------------------------------------------
        if ( _state == BRAIN_STATE_LOOKING_FOR_FOOD )
        {
            if ( _foundFoodBit )
            {
                _state = BRAIN_STATE_PURSUING_FOOD;
            }
        }	      
        //--------------------------------------------------------
        //  pursuing food
        //--------------------------------------------------------
        else if ( _state == BRAIN_STATE_PURSUING_FOOD )
        {
            if ( !_foundFoodBit )
            {
                _state = BRAIN_STATE_LOOKING_FOR_FOOD;
            }
        }
        //--------------------------------------------------------
        //  looking for prey
        //--------------------------------------------------------
        else if ( _state == BRAIN_STATE_LOOKING_FOR_PREY )
        {
            if ( _foundPrey )
            {
                _state = BRAIN_STATE_PURSUING_PREY;
            }
        }
        //--------------------------------------------------------
        //  pursuing prey
        //--------------------------------------------------------
        else if ( _state == BRAIN_STATE_PURSUING_PREY )
        {
            if ( !_foundPrey )
            {
                // Стабилизация: не переключаемся мгновенно, иначе получается дрожание.
                // Небольшой шанс переключиться за тик.
                if ( gpRandom() < 0.1 )
                {
                    _state = BRAIN_STATE_LOOKING_FOR_PREY;
                }
            }

        }


        //--------------------------------------------------------
        //  Looking for mate
        //--------------------------------------------------------
        else if ( _state == BRAIN_STATE_LOOKING_FOR_MATE )
        {
            if ( _foundSwimbot )
            {
                _state = BRAIN_STATE_PURSUING_MATE;
            }
        }
        //--------------------------------------------------------
        //  pursuing mate
        //--------------------------------------------------------
        else if ( _state == BRAIN_STATE_PURSUING_MATE )
        {
            if ( !_foundSwimbot )
            {
                _state = BRAIN_STATE_LOOKING_FOR_MATE;
            }
        }

        //-----------------------------------------------------------------
        //  check for bogus brain state 
        //-----------------------------------------------------------------
        assert( _state < NUM_BRAIN_STATES, "_state < NUM_BRAIN_STATES" );        
        assert( _state > BRAIN_STATE_NULL, "_state > BRAIN_STATE_NULL" );        
    }

    //-------------------------------------------------------------------
    // setters
    //-------------------------------------------------------------------
    this.setEnergyLevel     = function(e) { _energy              = e; }   
    this.setHungerThreshold = function(h) { _hungerThreshold     = h; }		
    this.setFoundFoodBit    = function(f) { _foundFoodBit        = f; }
    this.setFoundSwimbot    = function(f) { _foundSwimbot        = f; }		
    this.setFoundPrey       = function(f) { _foundPrey    = f; };
    this.setPredatorLevel          = function(level) { _predatorLevel = level; };
    this.setNearbyPredatorThreat   = function(v)     { _nearbyPredatorThreat = v; };

    //--------------------------------
    this.setAttraction = function(a) 
    {
        //console.log( "setAttraction to " + a );
        
        _attractionCriterion = a; 

        // setting _foundSwimbot to false, causes the swimbot to search for a new potential mate
        _foundSwimbot = false;
    }


    //--------------------------------------------------------------------------
    // getters
    //--------------------------------------------------------------------------
    this.getHungerThreshold     = function() { return _hungerThreshold;     }	
    this.getAttractionCriterion = function() { return _attractionCriterion; }	
    this.getState               = function() { return _state;               }	
    this.getPredatorLevel       = function() { return _predatorLevel;       }
}
