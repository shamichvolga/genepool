import { WORLD_AREA_FACTOR, WORLD_SCALE } from "./World";
import { DEFAULT_FOOD_BIT_ENERGY, DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS } from "./FoodBit";
import { ONE, ONE_HALF, ZERO } from "./MathConstants";
import { ATTRACTION_SIMILAR_COLOR } from "./SwimbotTypes";

export const FOOD_TYPE_OFFSET = 0.2;

export const DEFAULT_NUM_FOOD_TYPES = 1;

export const SWIMBOT_LEVEL_OF_DETAIL_DOT  = 0;
export const SWIMBOT_LEVEL_OF_DETAIL_LOW  = 1;
export const SWIMBOT_LEVEL_OF_DETAIL_HIGH = 2;

export const DEFAULT_GARDEN_OF_EDEN_RADIUS = 2000;
export const GARDEN_OF_EDEN_RADIUS = DEFAULT_GARDEN_OF_EDEN_RADIUS;

export const MIN_FOOD_REGENERATION_PERIOD      = 1;
export const DEFAULT_FOOD_REGENERATION_PERIOD  = 20;
export const MAX_FOOD_REGENERATION_PERIOD      = 200;

export const DEFAULT_CHILD_ENERGY_RATIO = ONE_HALF;

export const MIN_CHILD_ENERGY_RATIO                = ZERO;
export const MAX_CHILD_ENERGY_RATIO                = ONE;
export const MIN_SWIMBOT_HUNGER_THRESHOLD          = ZERO;

// Unified parent world template (scale = 1 is unit 8000x8000 world, cell size = 62.5)
export const BASE_WORLD_TEMPLATE = {
    width: 8000,
    height: 8000,
    soilGridN: 128,
    patchCount: 6,
    worldEnergy: 1.5,
    initialPlants: 3000,
    initialBots: 375,
    maxSwimbotsBase: 750,
    maxFoodBitsBase: 20000,
};

export function createWorldConfig(scale: number)
{
    const s = Math.max(1, scale || 1);
    const areaFactor = s * s;
    const maxSwimbots = Math.min(4500, Math.max(1000, Math.round(BASE_WORLD_TEMPLATE.maxSwimbotsBase * areaFactor)));
    const maxFoodBits = Math.min(120000, Math.max(20000, Math.round(BASE_WORLD_TEMPLATE.maxFoodBitsBase * areaFactor)));
    return {
        scale: s,
        areaFactor,
        width: BASE_WORLD_TEMPLATE.width * s,
        height: BASE_WORLD_TEMPLATE.height * s,
        soilGridN: BASE_WORLD_TEMPLATE.soilGridN * s,
        patchCount: Math.max(4, Math.round(BASE_WORLD_TEMPLATE.patchCount * areaFactor)),
        worldEnergy: BASE_WORLD_TEMPLATE.worldEnergy * areaFactor,
        initialPlants: Math.min(80000, Math.max(3000, Math.round(BASE_WORLD_TEMPLATE.initialPlants * areaFactor))),
        initialBots: Math.min(3500, Math.max(150, Math.round(BASE_WORLD_TEMPLATE.initialBots * areaFactor))),
        maxSwimbots,
        maxFoodBits,
    };
}

const _ACTIVE_WORLD_CFG = createWorldConfig(WORLD_SCALE);

export const POPULATION_LIMIT       = _ACTIVE_WORLD_CFG.maxSwimbots;
export const MAX_SWIMBOTS           = _ACTIVE_WORLD_CFG.maxSwimbots;
export const INITIAL_NUM_SWIMBOTS   = _ACTIVE_WORLD_CFG.initialBots;

export const MAX_FOODBITS           = _ACTIVE_WORLD_CFG.maxFoodBits;
export const MEAT_SLOT_SHARE        = 0.25;
export const MAX_FOODBITS_PER_TYPE  = Math.floor(MAX_FOODBITS * (1 - MEAT_SLOT_SHARE) * 0.5);
export const INITIAL_NUM_FOODBITS   = _ACTIVE_WORLD_CFG.initialPlants;

export const NON_REPRODUCING_JUNK_DNA_LIMIT    = 0.1;

export const SPAWN_FOOD_RANDOMLY_IN_POOL = false;

export const MUTATION_RATE = 0.01;

export const CROSSOVER_RATE = 0.1;

export const MAX_SWIMBOT_HUNGER_THRESHOLD      = 200;
export const DEFAULT_SWIMBOT_HUNGER_THRESHOLD	=  50;

//---------------------------------------------------------------------------
// Хищничество — все настройки в одном месте
//---------------------------------------------------------------------------
export const PREDATOR_LEVEL_THRESHOLD      = 0.6;

export const SWIMBOT_MAX_ENERGY            = MAX_SWIMBOT_HUNGER_THRESHOLD;

export const PREDATION_ENERGY_TRANSFER     = 0.3;
export const PREY_BODY_ENERGY              = 0.06;

export const AUTOTOMY_REGROW_DELAY         = 2000;
export const AUTOTOMY_DECOY_SPAN           = 0.8;

export const PREY_SCAN_RADIUS_MAX_SCALE    = 2.5;
export const PREDATOR_VISION_SCALE        = 3.0;
export const PREY_SCAN_RADIUS_GROWTH       = 10.0;
export const PREY_SCAN_COOLDOWN            = 50;

export const PREY_MAX_MASS_RATIO           = 1.0;

export const ATTACK_SUCCESS_CHANCE         = 0.25;
export const ENVIRONMENT_ATTACK_SUCCESS_CHANCE = 0.35;
export const ATTACK_COOLDOWN               = 60;

export const INITIAL_PREDATOR_FRACTION     = 0.1;

export const GARDEN_RADIUS                 = 600 * WORLD_SCALE;
export const DIET_SWITCH_RATE              = 0.004;

export const PERCEPTION_CHECK              = false;

export const INTERLEAVED_STEP              = false;

export const RANDOM_MATING_CONTROL          = false;
export const BARRIER_EXPERIMENT             = false;
export const OBSTACLE_ENABLED               = true;

export const NEURAL_BRAIN_ENABLED          = true;
export const TEMPERATURE_ENABLED           = false;
export const CLIMATE_STEERING              = 1.0;
export const SOCIAL_STEERING               = 0.6;
export const CLIMATE_PROBE_DISTANCE        = 150;

export const CLASSIC_NUM_SWIMBOTS          = 1000;
export const CLASSIC_NUM_FOODBITS          = 1000;

export const ENVIRONMENT_SEEDS_PER_PERIOD  = 5 * WORLD_AREA_FACTOR;
export const PLANT_CELL_CAPACITY           = 30;
export const PLANT_PARENT_SEED_FRACTION    = 0.7;
export const ENVIRONMENT_PLANT_SPREAD_RATE = 0.0035;
export const LOCAL_ENVIRONMENT_PLANT_GROWTH = true;
export const PLANT_SEED_MIN_DISTANCE       = 300;
export const PLANT_SEED_MAX_DISTANCE       = 600;

export const PREDATOR_FLEE_RADIUS          = 250.0;

//---------------------------------------------------------------------------
// Экология — рост растений, гниение мяса, обмен веществ
//---------------------------------------------------------------------------
export const LOCAL_PLANT_GROWTH            = false;

export const FOOD_SPROUT_RATE              = 0.03;
export const FOOD_LOCAL_RADIUS             = 250.0;
export const FOOD_LOCAL_CAPACITY           = 40;
export const LOCAL_PLANT_SEED_RADIUS       = 1200.0;

export const FOOD_RANDOM_SEED_CHANCE       = 0.10;

export const MEAT_DECAY_TIME               = 6000;

export const CLOSED_ENERGY_CYCLE_ENABLED   = true;
export const ATMOSPHERE_RESERVE_WORLDS     = 1.0;

export const BASAL_METABOLISM              = 0;

export const BODY_HYDRODYNAMICS_ENABLED    = false;

export const BODY_TEMPERATURE_INERTIA_ENABLED = false;

export const SELF_CANNIBALISM_ENABLED = false;

export const PREDATOR_TARGET_SELECTION_ENABLED = false;

export const YOUNG_AGE_DURATION    = 1000;
export const OLD_AGE_DURATION      = 1000;
export const MIN_MAXIMUM_AGE       = YOUNG_AGE_DURATION + OLD_AGE_DURATION;
export const MAX_MAXIMUM_AGE       = 40000;

export const DEFAULT_MAXIMUM_AGE   = MAX_MAXIMUM_AGE;

export const SWIMBOT_SELECT_RADIUS_SCALAR  = 7.0;

export const RENDER_SWIMBOT_AS_DOT     = false;
export const SWIMBOT_DOT_RENDER_RADIUS = 20;

//---------------------------------------------------------------------------
// I'm trying something new here: these are global variables that are 
// meant to be adjustible via the ui (and maybe via other components).
//---------------------------------------------------------------------------
export function GlobalTweakers()
{
    this.childEnergyRatio       = DEFAULT_CHILD_ENERGY_RATIO;
    this.maximumLifeSpan        = DEFAULT_MAXIMUM_AGE;
    this.maximumParts           = 16;
    this.populationLimitEnabled = true;
    this.foodSpread             = DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS;
    this.foodBitEnergy          = DEFAULT_FOOD_BIT_ENERGY;
    this.foodRegenerationPeriod = DEFAULT_FOOD_REGENERATION_PERIOD;
    this.hungerThreshold        = DEFAULT_SWIMBOT_HUNGER_THRESHOLD;
    this.numFoodTypes           = DEFAULT_NUM_FOOD_TYPES;
    this.attractionCriterion    = ATTRACTION_SIMILAR_COLOR;
}

//------------------------------------------------------------------------------
// Food finding (bug fixes: on by default; see docs/для_комиссии/СВОД_ответов_комиссии.md)
//------------------------------------------------------------------------------
export const FOOD_TARGET_PERSISTENCE_ENABLED = true;
export const FOOD_SWITCH_RATIO_MIN          = 0.4;
export const FOOD_KEEP_RADIUS_SCALE         = 1.5;
export const CONTACT_EATING_ENABLED         = true;
export const BITE_AT_CONTACT_ENABLED        = true;
export const BITE_ALONG_PARTS_ENABLED       = true;

//------------------------------------------------------------------------------
// Experiments for different body forms (off by default)
//------------------------------------------------------------------------------
export const MASS_SCALED_STOMACH_ENABLED    = false;
export const BIG_BODY_STOMACH_ENABLED       = true;
export const STOMACH_REFERENCE_MASS         = 410;
export const ORIGINAL_FOOD_ENABLED          = true;
export const PLANT_STAGES_ENABLED           = false;
export const PLANT_SIZE_ENABLED             = true;
export const SOIL_NUTRIENT_PER_ENERGY        = 0.05;
export const PLANT_SPROUT_ENERGY            = 10;
export const PLANT_TREE_ENERGY              = 150;
export const PLANT_LEAF_REGROWTH            = 0.002;
export const PLANT_MAX_TOUGHNESS            = 0.8;
export const BITE_FORCE_AT_REFERENCE        = 0.5;
export const BITE_REFERENCE_MASS            = 410;
export const BITE_ENERGY                    = 25;
export const BITE_MARGIN                    = 0.15;
export const VISION_WEIGHT_BY_BITE_EFFICIENCY = true;
export const PLANT_SEEDS_BY_SIZE            = true;
export const PLANT_LIFESPAN                 = 12000;
export const WOOD_PER_FRUIT_TIER            = 40;
export const PLANT_FRUIT_PERIOD             = 600;
export const PLANT_FRUIT_ENERGY             = 10;
export const PLANT_CANOPY_RADIUS            = 300;
export const SHADED_PLANT_AGING_FACTOR      = 4;
export const WOOD_DECAY_STEPS               = 400;
export const PLANT_SEED_CARRY_CHANCE         = 0.35;
export const PLANT_SEED_GUT_MIN              = 500;
export const PLANT_SEED_GUT_MAX              = 1000;
export const PLANT_SPROUT_AGE               = 1500;
export const PLANT_OLD_AGE                  = 6000;
export const PLANT_ROT_AGE                  = 12000;
export const PLANT_ROT_ENABLED              = false;
export const PLANT_STAGE_ENERGY             = [ 0.35, 1.0, 1.6 ];
export const PLANT_STAGES_SHOWN             = false;
export const INHERITED_INVESTMENT_ENABLED   = true;
export const SIZE_MATURITY_ENABLED          = false;
export const SIZE_ASSORTATIVE_MATING_ENABLED = true;
export const PREDATOR_GAPE_CURVE_ENABLED    = false;
export const CROWD_AWARE_FOOD_CHOICE_ENABLED = true;

// Missing constants that were referenced but not defined
export const QUADRATIC_WATER_ENABLED = false;
export const FOUNDER_ENERGY_FACTOR = 1;
export const LOD_MOUTH_MIN_SCALE = 0.36;
export const LOD_SEGMENT_DETAIL_MIN_SCALE = 0.28;
export const WAKE_GRID_ENABLED = false;
export function rStrategyCooldownFactor(...args: any[]): number { return 1; }
export function rStrategyReproductionEnergyFactor(...args: any[]): number { return 1; }
export function killWinnerPressure(...args: any[]): number { return 1; }
export const KILL_WINNER_REPRO_MULT = 1;
export const PREDATOR_HUNGRY_ENERGY_SHARE = 0.6;
export const PREDATOR_FRONT_DOT = -0.15;
export const PREDATOR_LATERAL_DOT = -0.65;
export const PREDATOR_LATERAL_RADIUS_SQ = 175 * 175;
export const PREDATOR_LATERAL_BONUS = 1.5;
export const KILL_WINNER_METABOLISM_MULT = 1;
export const NEWBORN_SIZE_SCALE = 0.35;
export const BODY_COLLISIONS_ENABLED = false;
export const BODY_COLLISION_PUSH = 1;
export const BODY_COLLISION_MAX_IMPULSE = 1;
export const TREE_OBSTACLES_ENABLED = false;
export const TREE_OBSTACLE_RADIUS_BASE = 1;
export const TREE_OBSTACLE_RADIUS_SCALE = 1;
export const CAVITY_JET_ENABLED = false;
export const CAVITY_JET_C = 1;
export const CAVITY_JET_MAX = 1;
export const CAVITY_SUCTION_RADIUS_SCALE = 1;
export const WAKE_GRID_SIZE = 64;
export const WAKE_DAMPING = 0.1;
export const WAKE_DIFFUSION = 0.1;
export const WAKE_MAX_SPEED = 1;
export const WAKE_IMPULSE_SHARE = 0.1;
export const JOINT_MIN_ANGLE = -1;
export const JOINT_MAX_ANGLE = 1;
export function morphBandOfParts(parts: number): number { return parts; }
export function rStrategyMaturityFactor(...args: any[]): number { return 1; }
export const FAILED_HUNT_COOLDOWN_FRACTION = 0.35;
export const PREDATOR_CAPTURE_RADIUS_SCALE = 1.12;
export function escapeTurnBonus(...args: any[]): number { return 1; }

//------------------------------------------------------------------------------
// The young (see docs/ТЗ_не_сделано.md)
//------------------------------------------------------------------------------
export const JUVENILE_PREDATION_ENABLED     = true;
export const MEAT_PIECE_ENERGY              = 25;
export const MEAT_PIECE_SCATTER             = 40;
export const YOUNG_CANNIBALISM_ENABLED      = true;
export const CLASSIC_SEED_RAIN_FRACTION     = 0.1;

//------------------------------------------------------------------------------
// Income of a big body (commission round 2, bundle B1; off by default)
//------------------------------------------------------------------------------
export const SIZE_SCALED_VISION_ENABLED     = false;
export const SIZE_SCALED_GRAB_ENABLED       = false;
export const GAPE_SUCCESS_FLOOR             = 0.3;
export const GAPE_COOLDOWN_SLOPE            = 0.5;

//------------------------------------------------------------------------------
// The rudder (experiment, off): every body may turn as a whole towards where
// it wants to go, as fast as its gene allows, paying energy for each degree.
// Without it turning comes only from how the parts' strokes change, which a
// body of many parts rarely gets right (complex bodies steer almost randomly).
//------------------------------------------------------------------------------
export const RUDDER_ENABLED                 = false;
export const RUDDER_MAX_TURN                = 1.5;
export const RUDDER_COST_PER_DEGREE         = 0.0004;
export const STEER_BY_SWIM_DIRECTION_ENABLED = false;
export const SWIM_DIRECTION_SMOOTHING       = 0.05;

//------------------------------------------------------------------------------
// Currents (off at the start; the C key): a few big ring-shaped streams, like
// the Gulf Stream (see Currents.ts). Swimbots and meat drift; plants stay
// rooted. With body hydrodynamics a heavy body is pushed less than a light one.
//------------------------------------------------------------------------------
export const CURRENTS_ENABLED               = false;
export const CURRENT_SPEED                  = 0.3;
export const CURRENT_AWARENESS_ENABLED      = true;
export const CURRENT_AWARE_MIN_SPEED        = 0.15;
export const CURRENT_TRIGGER_CHANGE_MIN     = 0.15;
export const CURRENT_TRIGGER_CHANGE_MAX     = 0.75;

//------------------------------------------------------------------------------
// Plant genes (see PlantGenes.ts): one species, inherited growth speed and
// seed distance; only grown-up plants make seeds. Grown-up much later than
// before (1500 steps): 4000 (fast) .. 16000 (slow) steps.
//------------------------------------------------------------------------------
export const PLANT_EVOLUTION_ENABLED        = false;
export const PLANT_MATURE_AGE_FAST          = 4000;
export const PLANT_MATURE_AGE_SLOW          = 16000;
export const PLANT_OLD_AGE_FACTOR           = 2.5;
export const PLANT_ROT_AGE_FACTOR           = 4;
export const PLANT_SEED_DISTANCE_NEAR       = 40;
export const PLANT_SEED_DISTANCE_FAR        = 1500;
export const PLANT_GENE_MUTATION            = 0.05;
export const PLANT_SEED_PARENT_TRIES        = 8;

//------------------------------------------------------------------------------
// Ways for limbs to pay (experiments, off). No bonus "for N parts": each
// limb does something, and costs strokes as before.
//------------------------------------------------------------------------------
export const FILTER_FEEDING_ENABLED         = false;
export const FILTER_FEEDING_EFFICIENCY      = 0.6;
export const FILTER_FEEDING_PERIOD          = 4;
export const FILTER_FEEDING_REACH           = 6;
export const LIMB_SPINES_ENABLED            = false;
export const LIMB_SPINE_EFFECT              = 0.1;
export const LIMB_SPINE_FLOOR               = 0.4;

//------------------------------------------------------------------------------
// Nursery: the gardens where the first swimbots start get much more food at
// first, so that complex, still clumsy forms are not starved out "in the
// cradle" by simple cheap ones. Fades out over NURSERY_STEPS.
//------------------------------------------------------------------------------
export const NURSERY_ENABLED                = true;
export const NURSERY_STEPS                  = 40000;
export const START_FOOD_FILL                 = 0.5;
export const START_FOOD_CLUMP               = 5;
export const START_FOOD_CLUMP_RADIUS        = 30;
export const NURSERY_START_FOOD_FACTOR      = 10;
export const NURSERY_EXTRA_SEEDS            = 1.0;

//------------------------------------------------------------------------------
// (18.10) A body near starving to death may eat anyone lighter than
// DESPERATE_PREY_MASS_SHARE of its mass, young or grown up. And the young
// one a hungry body is after is caught by any of its limbs too, like a sieve.
//------------------------------------------------------------------------------
export const DESPERATE_CANNIBALISM_ENABLED  = true;
export const DESPERATE_ENERGY_SHARE         = 0.1;
export const LIMBS_CATCH_YOUNG_ENABLED      = false;

export const START_ENERGY_FACTOR            = 1.5;

//------------------------------------------------------------------------------
// Event-driven looking (18.10): a swimbot looks around every
// BRAIN_SENSORY_UPDATE_PERIOD steps (2). When it is swimming steadily to a
// food bit or a mate that is still there and far, and saw no predator last
// time, it looks only every EVENT_CALM_LOOK_PERIOD steps; it looks at once
// when something changes (its state changed, the target is gone, the target
// came near).
//------------------------------------------------------------------------------
export const EVENT_DRIVEN_LOOK_ENABLED      = true;
export const EVENT_CALM_LOOK_PERIOD         = 6;
export const EVENT_CALM_MIN_DISTANCE        = 150;

//------------------------------------------------------------------------------
// (19.10) What fits in the mouth: a young one can be eaten only while it is
// still small - its current mass (it grows from an egg) below
// CANNIBAL_PREY_MASS_SHARE of the eater's. It grows, so the chance passes by
// itself; the number of parts does not matter, only mass (which costs upkeep).
// A body starving to death may eat anyone lighter than DESPERATE_PREY_MASS_SHARE
// of its mass. (The "fewer parts" rule made every body grow to 14-16 parts.)
//------------------------------------------------------------------------------
export const CANNIBAL_PREY_MASS_SHARE       = 0.33;
export const DESPERATE_PREY_MASS_SHARE      = 0.5;

//------------------------------------------------------------------------------
// (19.10) Growing a body costs energy. Before, a newborn grew to its full
// mass for free (growth = age / 1000): a pair split its energy with a child,
// the child grew a whole body out of nothing, and numbers exploded without
// food. Now each bit of mass grown costs GROWTH_ENERGY_PER_MASS (the same
// energy a predator gets back from that mass); with too little energy the
// growing pauses, and only a grown-up body may mate.
//------------------------------------------------------------------------------
export const GROWTH_COSTS_ENERGY_ENABLED    = true;
export const GROWTH_ENERGY_PER_MASS         = 0.06;

//------------------------------------------------------------------------------
// Coexistence of forms (19.10, docs/идеи_сосуществования.md, ideas 1-7)
//------------------------------------------------------------------------------
export const KIN_NOT_EATEN_ENABLED          = true;
export const ONLY_GROWN_EAT_YOUNG_ENABLED   = true;
export const WEAK_PREY_ENABLED              = true;
export const WEAK_STARVING_SHARE            = 0.15;
export const CARCASS_ENABLED                = true;

//------------------------------------------------------------------------------
// Diseases (19.10, idea 12; see Disease.ts and docs/концепт_болезни.md)
//------------------------------------------------------------------------------
export const DISEASE_ENABLED                = true;
export const DISEASE_SPAWN_PERIOD           = 20000;
export const DISEASE_TRANSMISSION           = 0.3;
export const DISEASE_CONTACT_SCALE          = 0.3;
export const DISEASE_DURATION               = 2000;
export const DISEASE_DRAIN                  = 0.015;
export const DISEASE_KEY_WIDTH              = 0.3;
export const DISEASE_MUTATION_CHANCE        = 0.05;
export const DISEASE_IMMUNITY_LIKENESS      = 0.7;
export const DISEASE_CROWD_NEIGHBOURS       = 8;

export const CANNIBAL_GENE_THRESHOLD        = 0.5;
export const CANNIBAL_GENE_FOUNDER_MAX      = 0.4;

export const PREDATOR_DEFERENCE_ENABLED     = false;

export const MEAT_ASSIMILATION              = 0.55;

export const PLANT_REGROW_CHANCE            = 0;
export const PLANT_REGROW_DELAY             = 1500;

// Soil grid scales linearly with world scale for invariant physical cell size (62.5)
export const SOIL_GRID_N = 128 * WORLD_SCALE;
