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


export const MAX_SWIMBOTS = 1500 * WORLD_AREA_FACTOR;

export const INITIAL_NUM_SWIMBOTS =  500 * WORLD_AREA_FACTOR;

export const MAX_FOODBITS           = 4000 * WORLD_AREA_FACTOR;   // (x2 on 17.10: the first generation well fed)
export const MAX_FOODBITS_PER_TYPE  = 1000 * WORLD_AREA_FACTOR;
export const INITIAL_NUM_FOODBITS   = 1000 * WORLD_AREA_FACTOR;

export const NON_REPRODUCING_JUNK_DNA_LIMIT    = 0.1;

export const SPAWN_FOOD_RANDOMLY_IN_POOL = false;

export const MUTATION_RATE = 0.01;

export const CROSSOVER_RATE = 0.1;

export const MAX_SWIMBOT_HUNGER_THRESHOLD      = 200;
export const DEFAULT_SWIMBOT_HUNGER_THRESHOLD	=  50;


//---------------------------------------------------------------------------
// Хищничество — все настройки в одном месте
//---------------------------------------------------------------------------
// Уровень хищности (ген 51, от 0 до 1), выше которого бот считается хищником:
// охотится на травоядных, ест красное мясо, не ест растения, рисуется чёрным.
export const PREDATOR_LEVEL_THRESHOLD      = 0.6;

// Максимальная энергия бота. Если хищник съел добычу и энергия "не влезает",
// излишек выпадает из жертвы кусками красного мяса.
export const SWIMBOT_MAX_ENERGY            = MAX_SWIMBOT_HUNGER_THRESHOLD;

// Какая доля энергии жертвы достаётся хищнику (1.0 = вся; в природе 0.1–0.3).
export const PREDATION_ENERGY_TRANSFER     = 0.3;
// a kill also gives the prey's body: energy per unit of body mass
// (typical prey ~400 -> +24; a kill gives ~40 in all, before only 10-20.
//  0.12 with predators from the start: predators grew to 57% and the pool crashed)
export const PREY_BODY_ENERGY              = 0.06;

// autotomy (see Swimbot.autotomize): a dropped part grows back after this
// many steps, if the swimbot has the energy it lost (it pays it again)
export const AUTOTOMY_REGROW_DELAY         = 2000;
export const AUTOTOMY_DECOY_SPAN           = 0.8;    // genes 0..1 -> drop when the hunter is within 0..80% of the view

// "Радар" хищника: пока голодный хищник не видит добычу, радиус поиска
// постепенно растёт от обычного радиуса зрения до (обычный * MAX_SCALE).
// Когда добыча найдена, радиус замирает на PREY_SCAN_COOLDOWN шагов,
// а когда хищник сыт — плавно возвращается к обычному.
export const PREY_SCAN_RADIUS_MAX_SCALE    = 2.5;
export const PREY_SCAN_RADIUS_GROWTH       = 10.0;
export const PREY_SCAN_COOLDOWN            = 50;

// Хищник может напасть только на жертву не тяжелее (своя масса * PREY_MAX_MASS_RATIO):
// крупные травоядные в безопасности ("размерное убежище"), но содержать большое тело дорого.
export const PREY_MAX_MASS_RATIO           = 1.0;

// Укус удаётся не всегда. После любой атаки хищник ATTACK_COOLDOWN шагов
// не может кусать снова (переваривает или приходит в себя после промаха),
// а жертва после промаха бросается бежать.
export const ATTACK_SUCCESS_CHANCE         = 0.25;
// in the environment pool prey hides (camouflage) and the world is big;
// tests (tools/predators.cjs): at 0.25 and 0.4 predators dwindle to a few,
// at 0.6 they hold on with real predator-prey cycles
export const ENVIRONMENT_ATTACK_SUCCESS_CHANCE = 0.35;   // (0.5 with predators from the start: too many predators)
export const ATTACK_COOLDOWN               = 60;

// Доля хищников в стартовой популяции (у остальных ген хищности низкий).
export const INITIAL_PREDATOR_FRACTION     = 0.1;

// (There is no scheduled "predators appear now" any more: predation is only a
//  gene. About INITIAL_PREDATOR_FRACTION of the founders are born predators,
//  and later predators come only from predator parents or from the rare diet
//  mutation of a newborn, DIET_SWITCH_RATE.)
export const GARDEN_RADIUS                 = 600 * WORLD_SCALE;   // (1200 in the normal world: same crowding in every size)

// Now and then a newborn switches diet (herbivore <-> predator): a big
// mutation of the predator genes, inherited by its children. In the old pool
// this happened by accident (the predator gene was a body gene with big
// mutation jumps, ~0.4% of births). It never changes a grown-up swimbot.
export const DIET_SWITCH_RATE              = 0.004;

// stage 7 test switch: compare the perception kernel with the old code
export const PERCEPTION_CHECK              = false;

// stage 7: true = the old order (each swimbot does its whole step before the
// next one); false = in phases (all decide, all move, all look, all act),
// which lets the moving and the looking run in several threads
export const INTERLEAVED_STEP              = false;

// Research controls used by tools/eco.cjs; disabled in normal simulations.
export const RANDOM_MATING_CONTROL          = false;
export const BARRIER_EXPERIMENT             = false;
export const OBSTACLE_ENABLED               = true;

// neural brain (stage 6): used in the environment ("random") pool
export const NEURAL_BRAIN_ENABLED          = true;
export const CLIMATE_STEERING              = 1.0;    // pull towards a better temperature (x brain output)
export const SOCIAL_STEERING               = 0.6;    // pull towards / push from the others (x brain output)
export const CLIMATE_PROBE_DISTANCE        = 150;

// the classic presets keep the original numbers (they don't use the environment)
export const CLASSIC_NUM_SWIMBOTS          = 1000;
export const CLASSIC_NUM_FOODBITS          = 1000;

// plants in the environment (see GenePool.regrowFoodEnvironment)
export const ENVIRONMENT_SEEDS_PER_PERIOD  = WORLD_AREA_FACTOR;   // seeds per "food growth delay" steps
export const PLANT_CELL_CAPACITY           = 6;                   // plants per 250 x 250 cell at most
export const PLANT_PARENT_SEED_FRACTION    = 0.7;                 // the rest is "seed rain" anywhere
// Per-plant seed production per regeneration period. At the default density
// (1000 plants per world-area unit) this matches the old 70% parent-seed rate.
export const ENVIRONMENT_PLANT_SPREAD_RATE = 0.0007;
// Research mode: local seed production grows with the number of parent plants.
// A fixed seed-rain component remains, so plants can recolonize after extinction.
export const LOCAL_ENVIRONMENT_PLANT_GROWTH = false;
export const PLANT_SEED_MIN_DISTANCE       = 300;
export const PLANT_SEED_MAX_DISTANCE       = 600;

// Травоядный убегает, если хищник ближе этого расстояния.
export const PREDATOR_FLEE_RADIUS          = 250.0;   // (was 150: prey noticed hunters too late)


//---------------------------------------------------------------------------
// Экология — рост растений, гниение мяса, обмен веществ
//---------------------------------------------------------------------------
// ЭКСПЕРИМЕНТ (по умолчанию выключен). true = растения растут пятнами (ниже),
// false = как в оригинале: один новый кусочек раз в "food growth delay" шагов
// рядом со случайным живым растением.
// Прогоны без браузера (tools/) показали, что в нынешнем виде пятнистый рост
// и базовый обмен веществ углубляют стартовое вымирание — нужна доработка.
export const LOCAL_PLANT_GROWTH            = false;

// Растения размножаются сами: каждый шаг каждое растение может дать росток
// с вероятностью FOOD_SPROUT_RATE / (ползунок "food growth delay", по умолчанию 20).
// Росток падает рядом (ползунок "food spread") и приживается, только если
// вокруг не тесно: в радиусе FOOD_LOCAL_RADIUS меньше FOOD_LOCAL_CAPACITY растений.
// Так растения растут пятнами, быстро — где их мало, и замирают — где густо.
export const FOOD_SPROUT_RATE              = 0.006;
export const FOOD_LOCAL_RADIUS             = 250.0;
export const FOOD_LOCAL_CAPACITY           = 8;
export const LOCAL_PLANT_SEED_RADIUS       = 1200.0;  // как далеко падают семена

// Изредка семя заносится в случайное место бассейна —
// чтобы растения не вымерли совсем даже после полного выедания.
export const FOOD_RANDOM_SEED_CHANCE       = 0.02;    // вероятность за шаг

// Мясо гниёт и исчезает через столько шагов.
export const MEAT_DECAY_TIME               = 2000;

// Базовый обмен веществ: каждый шаг бот тратит
// BASAL_METABOLISM * (масса тела)^0.75 энергии — большое тело дороже в содержании
// (закон Клайбера). При 0.000025 для типичного бота это примерно столько же, сколько плавание.
export const BASAL_METABOLISM              = 0;   // ЭКСПЕРИМЕНТ: попробуйте 0.000008 – 0.000025

// C8 experiment: let body mass and breadth change thrust response, water drag,
// and the energy dissipated while swimming. Disabled in ordinary simulations.
export const BODY_HYDRODYNAMICS_ENABLED    = false;

// C9 experiment: internal temperature approaches the local felt-temperature
// signal; body mass and width change the equilibration rate, not its endpoint.
export const BODY_TEMPERATURE_INERTIA_ENABLED = false;

// C11 experiment: allow the inherited neural brain to choose self-consumption.
// Ordinary simulations keep this off; the behavior competes with the other drives.
export const SELF_CANNIBALISM_ENABLED = false;

// C12 experiment: inherited neural weights choose live prey or meat by
// expected energy, attack chance and pursuit cost. Off in ordinary runs.
export const PREDATOR_TARGET_SELECTION_ENABLED = false;


export const YOUNG_AGE_DURATION    = 1000;
export const OLD_AGE_DURATION      = 1000;
export const MIN_MAXIMUM_AGE       = YOUNG_AGE_DURATION + OLD_AGE_DURATION;
export const MAX_MAXIMUM_AGE       = 40000;

export const DEFAULT_MAXIMUM_AGE   = MAX_MAXIMUM_AGE;

export const SWIMBOT_SELECT_RADIUS_SCALAR  = 7.0;


export const RENDER_SWIMBOT_AS_DOT     = false;
export const SWIMBOT_DOT_RENDER_RADIUS = 20;

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
export function GlobalTweakers()
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






//------------------------------------------------------------------------------
// Food finding (bug fixes: on by default; see docs/для_комиссии/СВОД_ответов_комиссии.md)
//------------------------------------------------------------------------------
export const FOOD_TARGET_PERSISTENCE_ENABLED = true;   // keep the chosen plant unless a new one is clearly nearer (gene "persistence")
export const FOOD_SWITCH_RATIO_MIN          = 0.4;    // most persistent: switch only to food 0.4 x as far
export const FOOD_KEEP_RADIUS_SCALE         = 1.5;    // a chosen plant is kept up to 1.5 x the view radius away
export const CONTACT_EATING_ENABLED         = true;   // the mouth touches edible food: eat it, whatever the brain is doing
export const BITE_AT_CONTACT_ENABLED        = true;   // a bite needs the mouth at a body part of the prey, not near its center

//------------------------------------------------------------------------------
// Experiments for different body forms (off by default)
//------------------------------------------------------------------------------
export const MASS_SCALED_STOMACH_ENABLED    = false;  // maximum energy = 200 x (mass / 410)^0.75, at least 60
export const PLANT_STAGES_ENABLED           = true;   // sprout / mature / old plant; small bodies digest sprouts, big ones old plants better
export const PLANT_SPROUT_AGE               = 1500;
export const PLANT_OLD_AGE                  = 6000;
export const PLANT_ROT_AGE                  = 12000;
export const PLANT_ROT_ENABLED              = false;  // (off since 17.10: the author - food should not vanish by itself)
export const PLANT_STAGE_ENERGY             = [ 0.35, 1.0, 1.6 ];
export const PLANT_STAGES_SHOWN             = false;  // draw sprouts small and old plants as stars (off: every plant a plain dot)
export const INHERITED_INVESTMENT_ENABLED   = true;   // gene: share of energy given to a child (0.15..0.85) instead of the pool setting
export const SIZE_MATURITY_ENABLED          = false;  // grown up (may mate) at 1000 x clamp( mass / 410, 0.5, 4 ) steps
export const SIZE_ASSORTATIVE_MATING_ENABLED = false; // mates chosen by color AND size (gene: how much size counts)
export const PREDATOR_GAPE_CURVE_ENABLED    = false;  // attack success falls with prey/predator mass, big prey takes longer to eat
export const CROWD_AWARE_FOOD_CHOICE_ENABLED = true;   // (on since 17.10: the commission 4 of 4, round 3: diversity 4.6 vs 3.1) // a plant others are nearer to looks farther (gene "deference": how much)

//------------------------------------------------------------------------------
// The young (see docs/ТЗ_не_сделано.md)
//------------------------------------------------------------------------------
export const JUVENILE_PREDATION_ENABLED     = true;   // a predator may bite a not yet grown-up prey even if it is heavier
export const MEAT_PIECE_ENERGY              = 25;     // a body that is not eaten whole falls apart into pieces of this much
export const MEAT_PIECE_SCATTER             = 40;     // ... lying this far around the place of death
export const YOUNG_CANNIBALISM_ENABLED      = true;   // (on since 18.10)  // a hungry herbivore may eat a young one of its kind with fewer body parts
export const CLASSIC_SEED_RAIN_FRACTION     = 0.1;    // classic pools: share of new food landing anywhere (not next to other food)

//------------------------------------------------------------------------------
// Income of a big body (commission round 2, bundle B1; off by default)
//------------------------------------------------------------------------------
export const SIZE_SCALED_VISION_ENABLED     = false;  // view radius = 300 x (mass / 410)^0.2  (about 240 .. 380)
export const SIZE_SCALED_GRAB_ENABLED       = false;  // food grab radius = 20 x (mass / 410)^0.25 (about 15 .. 25)
export const GAPE_SUCCESS_FLOOR             = 0.3;    // PREDATOR_GAPE_CURVE: success never below 0.3 x the normal
export const GAPE_COOLDOWN_SLOPE            = 0.5;    // PREDATOR_GAPE_CURVE: cooldown x ( 1 + 0.5 x prey/predator mass )

//------------------------------------------------------------------------------
// The rudder (experiment, off): every body may turn as a whole towards where
// it wants to go, as fast as its gene allows, paying energy for each degree.
// Without it turning comes only from how the parts' strokes change, which a
// body of many parts rarely gets right (complex bodies steer almost randomly).
//------------------------------------------------------------------------------
export const RUDDER_ENABLED                 = false;
export const RUDDER_MAX_TURN                = 1.5;    // degrees per step at the strongest gene
export const RUDDER_COST_PER_DEGREE         = 0.0004; // energy
// Steer by where I swim, not where my "nose" (root part) points (experiment,
// off): most bodies swim tail first or sideways, so turning the nose to the
// goal sends them past it. With this, the turning compares the goal with the
// smoothed swimming direction (the genes still decide how to turn).
export const STEER_BY_SWIM_DIRECTION_ENABLED = false;
export const SWIM_DIRECTION_SMOOTHING       = 0.05;   // how fast the remembered swimming direction follows the velocity

//------------------------------------------------------------------------------
// Currents (off at the start; the C key): a few big ring-shaped streams, like
// the Gulf Stream (see Currents.ts). Swimbots and meat drift; plants stay
// rooted. With body hydrodynamics a heavy body is pushed less than a light one.
//------------------------------------------------------------------------------
export const CURRENTS_ENABLED               = false;
export const CURRENT_SPEED                  = 0.3;    // per step in the middle of a stream (the median swimbot swims ~0.25)

//------------------------------------------------------------------------------
// Plant genes (see PlantGenes.ts): one species, inherited growth speed and
// seed distance; only grown-up plants make seeds. Grown-up much later than
// before (1500 steps): 4000 (fast) .. 16000 (slow) steps.
//------------------------------------------------------------------------------
export const PLANT_EVOLUTION_ENABLED        = false;  // (off since 17.10: the author - the pool makes the seeds anyway, so the genes decide little)
export const PLANT_MATURE_AGE_FAST          = 4000;
export const PLANT_MATURE_AGE_SLOW          = 16000;
export const PLANT_OLD_AGE_FACTOR           = 2.5;    // old at 2.5 x the grown-up age
export const PLANT_ROT_AGE_FACTOR           = 4;      // rots at 4 x the grown-up age
export const PLANT_SEED_DISTANCE_NEAR       = 40;
export const PLANT_SEED_DISTANCE_FAR        = 1500;
export const PLANT_GENE_MUTATION            = 0.05;   // typical change of a gene from parent to seed
export const PLANT_SEED_PARENT_TRIES        = 8;      // grown-up parents looked for before taking any plant

//------------------------------------------------------------------------------
// Ways for limbs to pay (experiments, off). No bonus "for N parts": each
// limb does something, and costs strokes as before.
//   FILTER_FEEDING: any body part that brushes a sprout eats it (a sieve):
//     a big, branching body sweeps more water. Only sprouts (soft); grown-up
//     and old plants still need the mouth. Less energy than eating it whole.
//   LIMB_SPINES: every limb tip (a part with nothing growing from it) is a
//     spine in the throat of a predator: each tip beyond two makes a bite a
//     little less likely to succeed (but never below the floor).
//------------------------------------------------------------------------------
export const FILTER_FEEDING_ENABLED         = false;
export const FILTER_FEEDING_EFFICIENCY      = 0.6;    // of the sprout's energy
export const FILTER_FEEDING_PERIOD          = 4;      // each body checks its limbs every 4 steps
export const FILTER_FEEDING_REACH           = 6;      // beyond the part's width
export const LIMB_SPINES_ENABLED            = false;
export const LIMB_SPINE_EFFECT              = 0.1;    // bite success x ( 1 - 0.1 x ( tips - 2 ))
export const LIMB_SPINE_FLOOR               = 0.4;

//------------------------------------------------------------------------------
// Nursery: the gardens where the first swimbots start get much more food at
// first, so that complex, still clumsy forms are not starved out "in the
// cradle" by simple cheap ones. Fades out over NURSERY_STEPS.
//------------------------------------------------------------------------------
export const NURSERY_ENABLED                = true;
export const NURSERY_STEPS                  = 40000;
export const START_FOOD_FILL                 = 0.5;    // the world starts with this share of all food places filled (18.10: 0.95 made a boom and then famine for all)
export const START_FOOD_CLUMP               = 5;      // ... in little clumps of this many
export const START_FOOD_CLUMP_RADIUS        = 30;
export const NURSERY_START_FOOD_FACTOR      = 10;     // inside the starting gardens: 10 x as dense as elsewhere
export const NURSERY_EXTRA_SEEDS            = 1.0;    // + this many extra seeds per seed (at the start), all in the gardens

//------------------------------------------------------------------------------
// (18.10) A body near starving to death may eat anyone with at least
// DESPERATE_PARTS_MARGIN fewer body parts, young or grown up. And the young
// one a hungry body is after is caught by any of its limbs too, like a sieve.
//------------------------------------------------------------------------------
export const DESPERATE_CANNIBALISM_ENABLED  = true;
export const DESPERATE_ENERGY_SHARE         = 0.1;    // "near death": energy below this share of its full store
export const DESPERATE_PARTS_MARGIN         = 2;
export const LIMBS_CATCH_YOUNG_ENABLED      = true;

// (17.10) the first generation starts with this many times a full energy store
export const START_ENERGY_FACTOR            = 1.5;
