//------------------------------------------------------------------------------
// WorldSpawner — founding a world: presets, positions and the 14 oasis colonies.
// GenePool resets the world and drives the clock; this module decides where a
// founder starts and what genes it carries at the first step. Founder energy is
// scaled with the world-energy slider; the atmosphere pays for everything else.
//------------------------------------------------------------------------------
import { gaussian, GENES_ASYMMETRY, GENES_AUTOTOMY_AMOUNT, GENES_AUTOTOMY_BITE, GENES_AUTOTOMY_THREAT,
         GENES_AUTOTOMY_WHICH, GENES_BRIGHTNESS, GENES_CANNIBAL, GENES_CHOOSINESS, GENES_CURRENT,
         GENES_DEFERENCE, GENES_DIGESTION, GENES_HUNGER, GENES_IMMUNE, GENES_INVESTMENT, GENES_PREDATOR,
         GENES_PERSISTENCE, GENES_RUDDER, GENES_SIZE_PICKINESS, GENES_THERMAL_OPTIMUM, GENES_THERMAL_WIDTH,
         GENES_WEAK_PREY, setTrait, thermalWidthToGene } from "./EcologyGenes";
import { asymmetryFromGene, isExperimentalEmbryologyGene } from "./Embryology";
import { gpRandom, globalTweakers, NUM_GENES_USED, SimulationStartMode } from "./Globals";
import { NUM_GENES, PRESET_GENOTYPE_DARWIN, PRESET_GENOTYPE_DENNETT, PRESET_GENOTYPE_MENDEL,
         PRESET_GENOTYPE_TURING, PRESET_GENOTYPE_WILSON } from "./Genotype";
import { BYTE_SIZE, NULL_INDEX, ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { seedPredatorChoiceBrain } from "./NeuralBrain";
import { MAX_FOOD_BIT_MAX_SPAWN_RADIUS, MIN_FOOD_BIT_MAX_SPAWN_RADIUS } from "./FoodBit";
import { DEFAULT_FOOD_REGENERATION_PERIOD, FOUNDER_ENERGY_FACTOR, INITIAL_PREDATOR_FRACTION,
         MAX_FOOD_REGENERATION_PERIOD, PREDATOR_LEVEL_THRESHOLD, PREDATOR_TARGET_SELECTION_ENABLED,
         SWIMBOT_MAX_ENERGY, YOUNG_AGE_DURATION } from "./Parameters";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { petriStartZone } from "./Petri";
import { Vector2D } from "./Vector2D";
import { assert, getRandomAngleInDegrees } from "./Utility";

const START_SPAWN_SPREAD = 2.5;
const FOUNDER_SPAWN_MARGIN = 200;
const COLONY_COUNT = 14;
const COLONY_RADIUS = 550;
const COLONY_MIN_DISTANCE = 45;
const NEIGHBORHOOD_FREQ = 5.0;

export interface SpawnContext
{
    mode: number; numSwimbots: number; poolCenter: any; gardenOfEdenRadius: number;
    swimbots: any[]; genotype: any; embryology: any; familyTree: any; clock: number;
    map: any; environment: any; petri: boolean; energyMult: number;
    colonyCenters: { x: number, y: number, energy: number }[];
    colonySites: { x: number, y: number }[][];
    neighborhoodAxis: boolean[]; neighborhoodX: number[]; neighborhoodY: number[];
    api: {
        randomPointInZone(v: any, zone: any): void;
        setEcologyGenesForPlace(g: any, x: number, y: number): void;
        growFounderForSeed(seed: number): void;
        narrowFounderTolerance(g: any, x: number, y: number): void;
        getSwimbotGenes(i: number): any;
        getSwimbotEvolutionTraits(i: number): any;
    };
}

// Fresh founders of Random and Neighborhood pools start in 14 colonies on
// the richest oases: radius 550, never closer than 45 to a nestmate.
export function randomFounderPoint( ctx: SpawnContext, v: any, founderIndex: number ): void
{
    if ( ctx.colonyCenters.length === 0 )
    {
        v.x = POOL_LEFT + FOUNDER_SPAWN_MARGIN + gpRandom() * Math.max( 1, POOL_WIDTH - FOUNDER_SPAWN_MARGIN * 2 );
        v.y = POOL_TOP + FOUNDER_SPAWN_MARGIN + gpRandom() * Math.max( 1, POOL_HEIGHT - FOUNDER_SPAWN_MARGIN * 2 );
        return;
    }
    const colony = Math.min( COLONY_COUNT - 1, Math.floor( founderIndex * COLONY_COUNT / Math.max( 1, ctx.numSwimbots )));
    const center = ctx.colonyCenters[colony], sites = ctx.colonySites[colony], minSq = COLONY_MIN_DISTANCE * COLONY_MIN_DISTANCE;
    let x = center.x, y = center.y;
    for ( let attempt = 0; attempt < 200; attempt++ )
    {
        const angle = gpRandom() * PI2, radius = COLONY_RADIUS * Math.sqrt( gpRandom() );
        x = center.x + Math.cos( angle ) * radius;
        y = center.y + Math.sin( angle ) * radius;
        let clear = true;
        for ( let k = 0; k < sites.length; k++ )
        {
            const dx = x - sites[k].x, dy = y - sites[k].y;
            if ( dx * dx + dy * dy < minSq ) { clear = false; break; }
        }
        if ( clear ) break;
    }
    v.x = Math.max( POOL_LEFT + FOUNDER_SPAWN_MARGIN, Math.min( POOL_RIGHT - FOUNDER_SPAWN_MARGIN, x ));
    v.y = Math.max( POOL_TOP + FOUNDER_SPAWN_MARGIN, Math.min( POOL_BOTTOM - FOUNDER_SPAWN_MARGIN, y ));
    sites.push({ x: v.x, y: v.y });
}

export function spawnFounders( ctx: SpawnContext ): void
{
    const mode = ctx.mode, g = ctx.genotype, bots = ctx.swimbots, env = ctx.environment;
    for ( let i = 0; i < ctx.numSwimbots; i++ )
    {
        const initialPosition = new Vector2D();
        initialPosition.setToRandomLocationInDisk( ctx.poolCenter, ctx.gardenOfEdenRadius * START_SPAWN_SPREAD );

        if ( mode === SimulationStartMode.SPECIES )
        {
            const s = POOL_WIDTH * 0.4;
            let x = gpRandom() * s;
            const y = POOL_HEIGHT * ONE_HALF - s * ONE_HALF + + gpRandom() * s;
            if ( gpRandom() < ONE_HALF ) { x = POOL_WIDTH - x; }
            initialPosition.setXY( x, y );
        }
        else if ( mode === SimulationStartMode.TEST_MINI_POOL )
        {
            const dx = ( i % 2 === 0 ) ? -800 : 800;
            const dy = ( i < 2 ) ? -800 : 800;
            initialPosition.setXY( ctx.poolCenter.x + dx, ctx.poolCenter.y + dy );
        }

        const weightedRandomNormal = gpRandom();
        const initialAge = YOUNG_AGE_DURATION + Math.floor( ( globalTweakers.maximumLifeSpan - YOUNG_AGE_DURATION ) * weightedRandomNormal );
        assert( initialAge >= YOUNG_AGE_DURATION, "Genepool.js: startSimulation: ( initialAge >= YOUNG_AGE_DURATION )" );
        assert( initialAge <= globalTweakers.maximumLifeSpan, "Genepool.js: startSimulation: ( initialAge <= maximumLifeSpan )" );
        const initialAngle = getRandomAngleInDegrees();
        // The slider pays for the world; founders are part of that same endowment.
        const initialEnergy = SWIMBOT_MAX_ENERGY * FOUNDER_ENERGY_FACTOR * ctx.energyMult;

        if ( mode === SimulationStartMode.NEIGHBORHOOD )
        {
            const sqrt = Math.floor( Math.sqrt( ctx.numSwimbots ) );
            const xMod = i % sqrt, yMod = Math.floor( ( i / ctx.numSwimbots ) * sqrt );
            const xFraction = xMod / sqrt, yFraction = yMod / sqrt;
            randomFounderPoint( ctx, initialPosition, i );
            for ( let k = 0; k < NUM_GENES; k++ )
            {
                let value = ZERO;
                // The smooth gene axes were seeded once in GenePool before spawning.
                if ( ctx.neighborhoodAxis[k] ) { value = ONE_HALF + ONE_HALF * Math.sin( ( ctx.neighborhoodX[k] + ( -ONE_HALF + xFraction )) * NEIGHBORHOOD_FREQ ); }
                else                           { value = ONE_HALF + ONE_HALF * Math.sin( ( ctx.neighborhoodY[k] + ( -ONE_HALF + yFraction )) * NEIGHBORHOOD_FREQ ); }
                if ( value < ZERO ) { value = ZERO; }
                if ( value > ONE ) { value = ONE; }
                g.setGeneValue( k, Math.floor( ( BYTE_SIZE - 1 ) * value ));
            }
        }
        else if ( mode === SimulationStartMode.FROGGIES ) { g.setToFroggy(); }
        else if ( mode === SimulationStartMode.TANGO )
        {
            if ( i === 0 ) { g.setToPreset( PRESET_GENOTYPE_DARWIN ); }
            if ( i === 1 ) { g.setToPreset( PRESET_GENOTYPE_MENDEL ); }
            if ( i === 0 ) { initialPosition.setXY( ctx.poolCenter.x - 200 * ONE_HALF, ctx.poolCenter.y ); }
            if ( i === 1 ) { initialPosition.setXY( ctx.poolCenter.x + 200 * ONE_HALF, ctx.poolCenter.y ); }
        }
        else if ( mode === SimulationStartMode.RACE )
        {
            if ( i === 0 ) { g.setToPreset( PRESET_GENOTYPE_WILSON ); }
            if ( i === 1 ) { g.setToPreset( PRESET_GENOTYPE_WILSON ); }
            if ( i === 2 ) { g.setToPreset( PRESET_GENOTYPE_DENNETT ); }
            if ( i === 3 ) { g.setToPreset( PRESET_GENOTYPE_DENNETT ); }
            if ( i === 0 ) { initialPosition.setXY( ctx.poolCenter.x - 1000, ctx.poolCenter.y + 1000 ); }
            if ( i === 1 ) { initialPosition.setXY( ctx.poolCenter.x - 1000, ctx.poolCenter.y + 940 ); }
            if ( i === 2 ) { initialPosition.setXY( ctx.poolCenter.x + 1000, ctx.poolCenter.y + 1000 ); }
            if ( i === 3 ) { initialPosition.setXY( ctx.poolCenter.x + 1000, ctx.poolCenter.y + 940 ); }
        }
        else if ( mode === SimulationStartMode.BIG_BANG )
        {
            initialPosition.setXY( ctx.poolCenter.x, ctx.poolCenter.y );
            g.randomize();
        }
        else if ( mode === SimulationStartMode.BAD_PARENTS )
        {
            if ( i === 0 ) { g.setToPreset( PRESET_GENOTYPE_TURING ); }
            if ( i === 1 ) { g.setToPreset( PRESET_GENOTYPE_TURING ); }
            if ( i === 0 ) { initialPosition.setXY( ctx.poolCenter.x - 100, ctx.poolCenter.y ); }
            if ( i === 1 ) { initialPosition.setXY( ctx.poolCenter.x + 100, ctx.poolCenter.y ); }
        }
        else { g.randomize(); }

        for ( let k = NUM_GENES_USED; k < NUM_GENES; k++ )
        {
            if ( !isExperimentalEmbryologyGene( k )) { g.setGeneValue( k, 0 ); }
        }
        g.setGeneValue( GENES_ASYMMETRY[0], Math.floor( gpRandom() * BYTE_SIZE ));

        if ( ctx.map ) { ctx.api.growFounderForSeed( ctx.map.seeds[ i * 3 + 2 ] ); }

        if ( env.active )
        {
            if ( ctx.map )
            {
                initialPosition.setXY( ctx.map.seeds[ i * 3 ], ctx.map.seeds[ i * 3 + 1 ] );
                ctx.api.setEcologyGenesForPlace( g, initialPosition.x, initialPosition.y );
            }
            else if ( ctx.petri )
            {
                ctx.api.randomPointInZone( initialPosition, petriStartZone( env.petri.zones ));
                ctx.api.setEcologyGenesForPlace( g, initialPosition.x, initialPosition.y );
                ctx.api.narrowFounderTolerance( g, initialPosition.x, initialPosition.y );
            }
            else
            {
                randomFounderPoint( ctx, initialPosition, i );
                ctx.api.setEcologyGenesForPlace( g, initialPosition.x, initialPosition.y );
            }
            let bornPredator = gpRandom() < INITIAL_PREDATOR_FRACTION;
            const diet = ( ctx.map && ctx.map.diets ) ? ( ctx.map.diets[i] || 0 ) : 0;
            if ( diet === 1 ) { bornPredator = false; } else if ( diet === 2 ) { bornPredator = true; }
            setTrait( g, GENES_PREDATOR, bornPredator ? 0.7 + 0.3 * gpRandom() : gpRandom() * PREDATOR_LEVEL_THRESHOLD * 0.8 );
        }
        else if ( mode === SimulationStartMode.RANDOM )
        {
            const thresholdGeneValue = PREDATOR_LEVEL_THRESHOLD * 255;
            const predatorGeneValue = ( gpRandom() < INITIAL_PREDATOR_FRACTION )
                ? thresholdGeneValue + 1 + gpRandom() * ( 254 - thresholdGeneValue )
                : gpRandom() * thresholdGeneValue;
            setTrait( g, GENES_PREDATOR, Math.floor( predatorGeneValue ) / 255 );
        }
        else if ( mode === SimulationStartMode.TEST_MINI_POOL )
        {
            setTrait( g, GENES_PREDATOR, i < 2 ? 0.1 * gpRandom() : 0.8 + 0.2 * gpRandom() );
        }

        if ( PREDATOR_TARGET_SELECTION_ENABLED )
        {
            const founderKey = ( Math.floor( initialPosition.x * 16 )
                ^ Math.imul( Math.floor( initialPosition.y * 16 ), 0x45d9f3b )
                ^ Math.imul( i + 1, 0x27d4eb2d )
                ^ Math.floor(( initialAngle + 180 ) * 1000 )) >>> 0;
            seedPredatorChoiceBrain( g.getBrain(), founderKey );
        }

        bots[i].create( i, initialAge, initialPosition, initialAngle, initialEnergy, g, ctx.embryology );
        ctx.familyTree.addNode( i, NULL_INDEX, NULL_INDEX, ctx.clock, ctx.api.getSwimbotGenes( i ), ctx.api.getSwimbotEvolutionTraits( i ));
    }
}

// The food layouts of the classic presets belong with their founder layouts.
export interface PresetFoodContext
{
    numFoodBits: number; foodBits: any[]; poolCenter: any; aliveFoodBitIndices: number[];
    setFoodSpread(v: number): void;
    setFoodGrowthDelay(v: number): void;
}
const FOOD_RACE_SIZE = 1000;

export function setFoodToBarrierConfiguration( ctx: PresetFoodContext ): void
{
    ctx.numFoodBits = 40;
    const spread = 500, p = new Vector2D();
    for ( let f = 0; f < ctx.numFoodBits; f++ )
    {
        ctx.foodBits[f].initialize( f );
        p.x = ctx.poolCenter.x + ( -spread * ONE_HALF + gpRandom() * spread );
        p.y = ctx.poolCenter.y + ( -spread * ONE_HALF + gpRandom() * spread );
        ctx.foodBits[f].setPosition( p );
    }
    ctx.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS + ( MAX_FOOD_BIT_MAX_SPAWN_RADIUS - MIN_FOOD_BIT_MAX_SPAWN_RADIUS ) * 0.2 );
}

export function setFoodToBadParentsConfiguration( ctx: PresetFoodContext ): void
{
    ctx.numFoodBits = 5;
    const spread = 100, p = new Vector2D();
    let f = -1;
    for ( const m of [ -1, -0.5, 0, 0.5, 1 ])
    {
        f ++; ctx.foodBits[f].initialize( f );
        p.setXY( ctx.poolCenter.x, ctx.poolCenter.y + spread * m );
        ctx.foodBits[f].setPosition( p );
    }
    ctx.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS );
}

export function setFoodToBangConfiguration( ctx: PresetFoodContext ): void
{
    ctx.numFoodBits = 500;
    let radius = 0, fraction = 0;
    const thirdNum = ctx.numFoodBits / 3.0, p = new Vector2D();
    for ( let f = 0; f < ctx.numFoodBits; f++ )
    {
        if ( f > ctx.numFoodBits * 0.66666 ) { fraction = ( f - ctx.numFoodBits * 0.66666 ) / thirdNum; radius = 600; }
        else if ( f > ctx.numFoodBits * 0.333333 ) { fraction = ( f - ctx.numFoodBits * 0.333333 ) / thirdNum; radius = 900; }
        else { fraction = f / thirdNum; radius = 300; }
        const radian = fraction * Math.PI * 2.0;
        p.setXY( ctx.poolCenter.x + radius * Math.sin( radian ), ctx.poolCenter.y + radius * Math.cos( radian ));
        ctx.foodBits[f].initialize( f );
        ctx.foodBits[f].setPosition( p );
    }
    ctx.setFoodGrowthDelay( DEFAULT_FOOD_REGENERATION_PERIOD );
    ctx.setFoodSpread( 20 );
}

export function setFoodToSpeciesConfiguration( ctx: PresetFoodContext ): void
{
    const p = new Vector2D(), s = POOL_WIDTH * 0.4;
    for ( let f = 0; f < ctx.numFoodBits; f++ )
    {
        p.x = gpRandom() * s;
        p.y = POOL_HEIGHT * ONE_HALF - s * ONE_HALF + + gpRandom() * s;
        ctx.foodBits[f].setType( Math.floor( gpRandom() * 2 ));
        if ( gpRandom() < ONE_HALF ) { p.x = POOL_WIDTH - p.x; }
        ctx.foodBits[f].setPosition( p );
    }
}

export function setFoodToRaceConfiguration( ctx: PresetFoodContext ): void
{
    ctx.numFoodBits = 0;
    const p = new Vector2D();
    let num = 200;
    let xx = ctx.poolCenter.x, yy = ctx.poolCenter.y + FOOD_RACE_SIZE * 0.9;
    for ( let f = 0; f < num; f++ )
    {
        const fraction = f / num;
        p.x = xx + FOOD_RACE_SIZE * Math.cos( fraction * Math.PI );
        p.y = yy - FOOD_RACE_SIZE * Math.sin( fraction * Math.PI );
        ctx.foodBits[ctx.numFoodBits].initialize( f );
        ctx.foodBits[ctx.numFoodBits].setPosition( p );
        ctx.numFoodBits ++;
    }
    num = 140;
    let r = 0;
    xx = ctx.poolCenter.x;
    yy = ctx.poolCenter.y - FOOD_RACE_SIZE * 0.4;
    for ( let f = 0; f < num; f++ )
    {
        const ff = f * 0.1;
        r += 2;
        p.x = xx + r * Math.cos( ff );
        p.y = yy + r * Math.sin( ff );
        ctx.foodBits[ctx.numFoodBits].initialize( f );
        ctx.foodBits[ctx.numFoodBits].setPosition( p );
        ctx.numFoodBits ++;
    }
    ctx.setFoodGrowthDelay( MAX_FOOD_REGENERATION_PERIOD );
    ctx.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS );
}

export function setFoodToTestMiniPool( ctx: PresetFoodContext ): void
{
    const oldCount = ctx.numFoodBits, p = new Vector2D(), num = 25;
    ctx.numFoodBits = 0;
    for ( let f = 0; f < num; f++ )
    {
        const angle = ( f / num ) * PI2;
        p.x = ctx.poolCenter.x + 520 * Math.cos( angle );
        p.y = ctx.poolCenter.y + 520 * Math.sin( angle );
        ctx.foodBits[ctx.numFoodBits].initialize( f );
        ctx.foodBits[ctx.numFoodBits].setPosition( p );
        ctx.numFoodBits ++;
    }
    for ( let f = num; f < oldCount; f++ ) { ctx.foodBits[f].kill(); }
    ctx.aliveFoodBitIndices.length = 0;
    for ( let f = 0; f < num; f++ ) { ctx.aliveFoodBitIndices.push( f ); }
    ctx.setFoodGrowthDelay( MAX_FOOD_REGENERATION_PERIOD );
    ctx.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS );
}
