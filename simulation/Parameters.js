


const FOOD_TYPE_OFFSET = 0.2;

const DEFAULT_NUM_FOOD_TYPES = 1;


const SWIMBOT_LEVEL_OF_DETAIL_DOT  = 0;
const SWIMBOT_LEVEL_OF_DETAIL_LOW  = 1;
const SWIMBOT_LEVEL_OF_DETAIL_HIGH = 2;

const DEFAULT_GARDEN_OF_EDEN_RADIUS = 2000;
const GARDEN_OF_EDEN_RADIUS = DEFAULT_GARDEN_OF_EDEN_RADIUS;

const MIN_FOOD_REGENERATION_PERIOD      = 1;
const DEFAULT_FOOD_REGENERATION_PERIOD  = 20;
const MAX_FOOD_REGENERATION_PERIOD      = 200;


const DEFAULT_CHILD_ENERGY_RATIO = ONE_HALF;

const MIN_CHILD_ENERGY_RATIO                = ZERO;
const MAX_CHILD_ENERGY_RATIO                = ONE;
const MIN_SWIMBOT_HUNGER_THRESHOLD          = ZERO;


const MAX_SWIMBOTS = 2000;

const INITIAL_NUM_SWIMBOTS =  1000;

const MAX_FOODBITS           = 2000;
const MAX_FOODBITS_PER_TYPE  = 1000;
const INITIAL_NUM_FOODBITS   = 1000;

const NON_REPRODUCING_JUNK_DNA_LIMIT    = 0.1;

const SPAWN_FOOD_RANDOMLY_IN_POOL = false;

const MUTATION_RATE = 0.01;

const CROSSOVER_RATE = 0.1;

const MAX_SWIMBOT_HUNGER_THRESHOLD      = 200;
const DEFAULT_SWIMBOT_HUNGER_THRESHOLD	=  50;


const YOUNG_AGE_DURATION    = 1000;
const OLD_AGE_DURATION      = 1000;
const MIN_MAXIMUM_AGE       = YOUNG_AGE_DURATION + OLD_AGE_DURATION;
const MAX_MAXIMUM_AGE       = 40000;

const DEFAULT_MAXIMUM_AGE   = MAX_MAXIMUM_AGE;

const SWIMBOT_SELECT_RADIUS_SCALAR  = 7.0;


const RENDER_SWIMBOT_AS_DOT     = false;
const SWIMBOT_DOT_RENDER_RADIUS = 20;

// Line 348 of Genotype.js I've modified to:
// let amplitude = Math.floor( gpRandom() * gpRandom() * gpRandom() * BYTE_SIZE );
// gpRandom() is cubed instead of squared. This makes the mutation amplitude lower
// so that mutations don't appear totally random.

// Also changed line 726 of the saveload.js file to:
// for (let n=0; n<familyTree.getNumNodes(); n += 5) 
// so that the family tree only saves every fifth swimbot instead of all of them.
// This "random" subset of swimbots is all it takes to get enough data for meaningful
// analyses and evolutionary trees without slowing down Gene Pool to a stand-still.


//---------------------------------------------------------------------------
// I'm trying something new here: these are global variables that are 
// meant to be adjustible via the ui (and maybe via other components).
//---------------------------------------------------------------------------
function GlobalTweakers()
{
    this.childEnergyRatio       = DEFAULT_CHILD_ENERGY_RATIO;
    this.maximumLifeSpan        = DEFAULT_MAXIMUM_AGE;
	this.foodSpread             = DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS;
	this.foodBitEnergy          = DEFAULT_FOOD_BIT_ENERGY;
	this.foodRegenerationPeriod = DEFAULT_FOOD_REGENERATION_PERIOD;
	this.hungerThreshold        = DEFAULT_SWIMBOT_HUNGER_THRESHOLD;
	this.numFoodTypes           = DEFAULT_NUM_FOOD_TYPES;
	this.attractionCriterion    = ATTRACTION_SIMILAR_COLOR;
}





