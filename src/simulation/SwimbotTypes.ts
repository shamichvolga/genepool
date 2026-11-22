import { ZERO } from "./MathConstants";
import { Vector2D } from "./Vector2D";

//-------------------------------------------
//  time-related constants
//-------------------------------------------
export const TIMER_DELTA_INCREASE_RATE = 0.02;
export const STARVING_TIMER_DELTA = 0.05;

//----------------------------------------
//  part indices
//----------------------------------------
export const NULL_PART       = -1;
export const ROOT_PART       =  0;
export const MOUTH_INDEX	  =  0;
export const GENITAL_INDEX   =  1;
export const MIN_PARTS 	  =  2;
export const MAX_PARTS 	  = 64;

//-------------------------------------------
//  max swimbot population size
//-------------------------------------------

//------------------------------------------
// attraction
//------------------------------------------
export const ATTRACTION_NULL               = -1;
export const ATTRACTION_COLORFUL           =  0;
export const ATTRACTION_BIG                =  1;
export const ATTRACTION_HYPER              =  2;
export const ATTRACTION_LONG               =  3;
export const ATTRACTION_STRAIGHT           =  4;
export const ATTRACTION_NO_COLOR           =  5;
export const ATTRACTION_SMALL              =  6;
export const ATTRACTION_STILL              =  7;
export const ATTRACTION_SHORT              =  8;
export const ATTRACTION_CROOKED            =  9;
export const ATTRACTION_SIMILAR_COLOR      = 10;
export const ATTRACTION_SIMILAR_SIZE       = 11;
export const ATTRACTION_SIMILAR_HYPER      = 12;
export const ATTRACTION_SIMILAR_LENGTH     = 13;
export const ATTRACTION_SIMILAR_STRAIGHT   = 14;
export const ATTRACTION_CLOSEST            = 15;
export const ATTRACTION_RANDOM             = 16;
export const ATTRACTION_HIGH_ENERGY 		= 17;
export const ATTRACTION_YOUNG 				= 18;
export const ATTRACTION_PROLIFIC 			= 19;
export const ATTRACTION_DIFFERENT 			= 20;
export const NUM_ATTRACTIONS				= 21;



//-----------------------------------
//  metrics 
//-----------------------------------
export const SWIMBOT_MIN_MOUTH_WIDTH   = 4.0;
export const SWIMBOT_MIN_MOUTH_LENGTH  = 8.0;
export const SWIMBOT_MOUTH_LENGTH      = 10.0;
export const SWIMBOT_GENITAL_LENGTH    = 20.0;   // mating reach of a full-grown body
export const SWIMBOT_MOUTH_WIDTH       = 1.0;
export const SWIMBOT_GENITAL_WIDTH     = 1.0;
export const SWIMBOT_VIEW_RADIUS	    = 300.0;
export const SWIMBOT_EGG_RADIUS	    = 6.0;


//--------------------
//  physics constants
//--------------------

export const WALL_BOUNCE = 0.1;


//---------------------------------------------------
//  graphics 
//---------------------------------------------------


//---------------------------------------------------
//  energy 
//---------------------------------------------------
export const ENERGY_USED_UP_SWIMMING				= 0.01;
export const STARVING								= 4.0;
export const CONTINUAL_ENERGY_DRAIN				= 0.0001;



export const ENERGY_EFFICIENCY_MEASUREMENT_PERIOD  = 200;

//--------------------
//  Part 
//--------------------
export function Part()
{	
	this.category			= 0;
	this.origin				= 0;                 // its number when the body was grown from the genes (a saved world puts the parts back in order)
	this.position			= new Vector2D();   //dynamic
	this.velocity			= new Vector2D();   //dynamic
	this.axis 		        = new Vector2D();   //dynamic
	this.previousMid 		= new Vector2D();   //dynamic
	this.midPosition 		= new Vector2D();   //dynamic
	this.perpendicular		= new Vector2D();   //dynamic
	this.bendingAngle		= ZERO;             //dynamic
	this.currentAngle		= ZERO;             //dynamic
	this.parent 			= NULL_PART;
	this.child              = NULL_PART; // only valid if it is the continuation of a single-category section
	this.mass				= ZERO;
	this.length				= ZERO;
	this.width				= ZERO;
    this.angle		        = ZERO;
	this.frequency			= ZERO;
	this.phase				= ZERO;
	this.amp			    = ZERO;
	this.turnAmp		    = ZERO;
	this.turnPhase	        = ZERO;
	this.momentFactor		= ZERO;
	this.red				= ZERO;
	this.green				= ZERO;
	this.blue				= ZERO;
    this.endCapSpline       = ZERO;     // how pointy the splined end-cap is for parts that terminate body sequence
	this.branch             = false;    // set to true if this part branches off (not a continuation of a category)
    this.splined		    = false;
    this.jointMin           = -75;
    this.jointMax           = 75;
	this.numDecendents		= 0;
	this.decendent			= new Array( MAX_PARTS );

	for (let p=0; p<MAX_PARTS; p++)
	{
		this.decendent[p] = 0; 
	}
}

//--------------------
//  Phenotype 
//--------------------
export function Phenotype()
{	
	this.numParts           = 0;
	this.frequency          = ZERO;
	this.parts              = new Array( MAX_PARTS ); 
	this.sumPartLengths     = ZERO;
	this.mass               = ZERO;
	this.preferredFoodType  = 0;
	this.digestibleFoodType = 0;
	this.predatorLevel      = 0;
	this.thermalOptimum     = 0.5;   // ecology (stage 5)
	this.thermalWidth       = 0.4;
	this.digestion          = 0.5;
	this.brightness         = 0.5;
	this.glideFactor        = 0;
	this.choosiness         = 0;
	this.hungerFactor       = 1;
	this.autotomyBite       = 0;
	this.autotomyThreat     = 0;
	this.autotomyAmount     = 0;
	this.autotomyWhich      = 0;
	for (let p=0; p<MAX_PARTS; p++)
	{
		this.parts[p] = new Part(); 
	}

}


