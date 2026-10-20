import { GlobalTweakers } from "./Parameters";


export const SimulationStartMode = 
{
    RANDOM       : 0,
    FROGGIES     : 1,
    TANGO        : 2,
    RACE         : 3,
    NEIGHBORHOOD : 4,
    BIG_BANG     : 5,
    BAD_PARENTS  : 6,
    BARRIER      : 7,
    EMPTY        : 8,
    FILE         : 9,
    SPECIES      : 10,
    PETRI        : 11      // "petri": zones of rising temperature, life starts in the mildest one
};

export const CameraNavigationAction = 
{
    LEFT    : 0,
    RIGHT   : 1,
    UP      : 2,
    DOWN    : 3,
    IN      : 4,
    OUT     : 5
}





//---------------------------------------------------------------
// The random numbers of the simulation: mulberry32 (the same as the
// swimbots' own, DecisionKernel.botRandom, and as tools/headless.cjs).
// Its state is one number that can be read and set, so a saved world
// (GenePool.saveWorld) goes on with the same numbers.
//---------------------------------------------------------------
const rngState = new Uint32Array( 1 );
{
    // (an unpredictable start; headless.cjs and loadWorld set their own)
    const fresh = new Uint32Array( 1 );
    if ( typeof crypto !== "undefined" && crypto.getRandomValues ) { crypto.getRandomValues( fresh ); }
    else                                                           { fresh[0] = ( Math.random() * 4294967296 ) >>> 0; }
    rngState[0] = fresh[0];
}
export function setRandomSeed( seed: number ): void { rngState[0] = seed >>> 0; }
export function getRandomState(): number            { return rngState[0]; }
export function setRandomState( state: number ): void { rngState[0] = state >>> 0; }

export function gpRandom()
{
    let t = ( rngState[0] = ( rngState[0] + 0x6D2B79F5 ) >>> 0 );
    t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
    t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
    return (( t ^ ( t >>> 14 )) >>> 0 ) / 4294967296;
}




// this needs to be the same as the corresponding value in Embryology.js !!!!
export const NUM_GENES_USED = 113;
export const HUNGER_THRESHOLD_GENE_INDEX = 113;  // новый ген для порога голода
//---------------------------------------------------------------
// The global tweakers are all adjustable through the UI.
//---------------------------------------------------------------
export var globalTweakers = new GlobalTweakers();
//---------------------------------------------------------------
// counters that several modules update
//---------------------------------------------------------------
// the simulation's step counter (GenePool keeps it up to date)
export const simClock = { step: 0 };

export const simCounters = {
    numDeadSwimbots: 0,
    attackCount: 0,
    births: 0,
    localPlantSprouts: 0,
    seedRainPlantSprouts: 0,
    nurserySprouts: 0,
    diseaseInfections: 0,
    diseaseOutbreaks: 0,
    nutrientLimitedPlantSeeds: 0,
    meatDecayEvents: 0,
    nutrientsFromMeatDecay: 0,
    plantMeals: 0,
    meatMeals: 0,
    autotomyThreatDrops: 0,
    autotomyBiteDrops: 0,
    youngCannibalism: 0,
    autotomyDecoysEaten: 0,
    selfCannibalismEvents: 0,
    selfCannibalismEnergy: 0,
    selfCannibalismMass: 0,
    preyTargetChoices: 0,
    preyTargetLiveChoices: 0,
    preyTargetMeatChoices: 0,
    preyTargetLiveDistanceSum: 0,
    preyTargetLiveRewardSum: 0,
    preyTargetMeatDistanceSum: 0,
    preyTargetMeatRewardSum: 0,
    preyTargetDistanceSum: 0,
    preyTargetRewardSum: 0,
    reproductivePairAttempts: 0,
    reproductiveDietMismatches: 0,
    reproductiveJunkChecks: 0,
    reproductiveJunkPasses: 0,
    reproductiveJunkBlocks: 0,
    reproductiveJunkSimilaritySum: 0,
    reproductiveJunkSimilarityBins: new Array(10).fill(0),
    meatTargetsWhilePursuing: 0,
    meatMealsWhilePursuing: 0,
    failedAttacks: 0,
    starvationDeaths: 0,
    oldAgeDeaths: 0,
    predationDeaths: 0,
    otherDeaths: 0,
};

export function resetSimulationCounters(): void
{
    simCounters.numDeadSwimbots = 0;
    simCounters.attackCount = 0;
    simCounters.births = 0;
    simCounters.localPlantSprouts = 0;
    simCounters.seedRainPlantSprouts = 0;
    simCounters.nutrientLimitedPlantSeeds = 0;
    simCounters.meatDecayEvents = 0;
    simCounters.nutrientsFromMeatDecay = 0;
    simCounters.plantMeals = 0;
    simCounters.meatMeals = 0;
    simCounters.autotomyThreatDrops = 0;
    simCounters.autotomyBiteDrops = 0;
    simCounters.autotomyDecoysEaten = 0;
    simCounters.selfCannibalismEvents = 0;
    simCounters.selfCannibalismEnergy = 0;
    simCounters.selfCannibalismMass = 0;
    simCounters.preyTargetChoices = 0;
    simCounters.preyTargetLiveChoices = 0;
    simCounters.preyTargetMeatChoices = 0;
    simCounters.preyTargetLiveDistanceSum = 0;
    simCounters.preyTargetLiveRewardSum = 0;
    simCounters.preyTargetMeatDistanceSum = 0;
    simCounters.preyTargetMeatRewardSum = 0;
    simCounters.preyTargetDistanceSum = 0;
    simCounters.preyTargetRewardSum = 0;
    simCounters.reproductivePairAttempts = 0;
    simCounters.reproductiveDietMismatches = 0;
    simCounters.reproductiveJunkChecks = 0;
    simCounters.reproductiveJunkPasses = 0;
    simCounters.reproductiveJunkBlocks = 0;
    simCounters.reproductiveJunkSimilaritySum = 0;
    simCounters.reproductiveJunkSimilarityBins.fill( 0 );
    simCounters.meatTargetsWhilePursuing = 0;
    simCounters.meatMealsWhilePursuing = 0;
    simCounters.failedAttacks = 0;
    simCounters.starvationDeaths = 0;
    simCounters.oldAgeDeaths = 0;
    simCounters.predationDeaths = 0;
    simCounters.otherDeaths = 0;
}


