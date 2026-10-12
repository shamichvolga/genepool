


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


//---------------------------------------------------------------------------
// Хищничество — все настройки в одном месте
//---------------------------------------------------------------------------
// Уровень хищности (ген 51, от 0 до 1), выше которого бот считается хищником:
// охотится на травоядных, ест красное мясо, не ест растения, рисуется чёрным.
const PREDATOR_LEVEL_THRESHOLD      = 0.6;

// Максимальная энергия бота. Если хищник съел добычу и энергия "не влезает",
// излишек выпадает из жертвы кусками красного мяса.
const SWIMBOT_MAX_ENERGY            = MAX_SWIMBOT_HUNGER_THRESHOLD;

// Какая доля энергии жертвы достаётся хищнику (1.0 = вся; в природе 0.1–0.3).
const PREDATION_ENERGY_TRANSFER     = 0.3;

// "Радар" хищника: пока голодный хищник не видит добычу, радиус поиска
// постепенно растёт от обычного радиуса зрения до (обычный * MAX_SCALE).
// Когда добыча найдена, радиус замирает на PREY_SCAN_COOLDOWN шагов,
// а когда хищник сыт — плавно возвращается к обычному.
const PREY_SCAN_RADIUS_MAX_SCALE    = 2.5;
const PREY_SCAN_RADIUS_GROWTH       = 10.0;
const PREY_SCAN_COOLDOWN            = 50;

// Хищник может напасть только на жертву не тяжелее (своя масса * PREY_MAX_MASS_RATIO):
// крупные травоядные в безопасности ("размерное убежище"), но содержать большое тело дорого.
const PREY_MAX_MASS_RATIO           = 1.0;

// Укус удаётся не всегда. После любой атаки хищник ATTACK_COOLDOWN шагов
// не может кусать снова (переваривает или приходит в себя после промаха),
// а жертва после промаха бросается бежать.
const ATTACK_SUCCESS_CHANCE         = 0.25;
const ATTACK_COOLDOWN               = 60;

// Доля хищников в стартовой популяции (у остальных ген хищности низкий).
const INITIAL_PREDATOR_FRACTION     = 0.1;

// Травоядный убегает, если хищник ближе этого расстояния.
const PREDATOR_FLEE_RADIUS          = 150.0;


//---------------------------------------------------------------------------
// Экология — рост растений, гниение мяса, обмен веществ
//---------------------------------------------------------------------------
// ЭКСПЕРИМЕНТ (по умолчанию выключен). true = растения растут пятнами (ниже),
// false = как в оригинале: один новый кусочек раз в "food growth delay" шагов
// рядом со случайным живым растением.
// Прогоны без браузера (tools/) показали, что в нынешнем виде пятнистый рост
// и базовый обмен веществ углубляют стартовое вымирание — нужна доработка.
const LOCAL_PLANT_GROWTH            = false;

// Растения размножаются сами: каждый шаг каждое растение может дать росток
// с вероятностью FOOD_SPROUT_RATE / (ползунок "food growth delay", по умолчанию 20).
// Росток падает рядом (ползунок "food spread") и приживается, только если
// вокруг не тесно: в радиусе FOOD_LOCAL_RADIUS меньше FOOD_LOCAL_CAPACITY растений.
// Так растения растут пятнами, быстро — где их мало, и замирают — где густо.
const FOOD_SPROUT_RATE              = 0.006;
const FOOD_LOCAL_RADIUS             = 250.0;
const FOOD_LOCAL_CAPACITY           = 8;
const LOCAL_PLANT_SEED_RADIUS       = 1200.0;  // как далеко падают семена

// Изредка семя заносится в случайное место бассейна —
// чтобы растения не вымерли совсем даже после полного выедания.
const FOOD_RANDOM_SEED_CHANCE       = 0.02;    // вероятность за шаг

// Мясо гниёт и исчезает через столько шагов.
const MEAT_DECAY_TIME               = 2000;

// Базовый обмен веществ: каждый шаг бот тратит
// BASAL_METABOLISM * (масса тела)^0.75 энергии — большое тело дороже в содержании
// (закон Клайбера). При 0.000025 для типичного бота это примерно столько же, сколько плавание.
const BASAL_METABOLISM              = 0;   // ЭКСПЕРИМЕНТ: попробуйте 0.000008 – 0.000025


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





