//------------------------------------------------------------------------------
// FoodEcology — plants, fruit, seeds and the closed energy loop around them.
// GenePool keeps the step clock and the grid caches; this module owns what a
// plant does once a step begins. All state is reached through FoodContext, the
// same live-view pattern used by the world serializer.
//------------------------------------------------------------------------------
import { currentAt, currentDriftX, currentDriftY } from "./Currents";
import { drawFromAtmosphere } from "./EnergyBudget";
import { NUTRIENT_CYCLE_ENABLED, PLANT_TYPE_WARM, SOIL_DIFFUSION_INTERVAL } from "./Environment";
import { globalTweakers, gpRandom, simCounters } from "./Globals";
import { FOOD_BIT_BOUNDARY_MARGIN } from "./FoodBit";
import { inheritPlantGenes, plantOldAge, plantRotAge, plantSeedDistance } from "./PlantGenes";
import { plantCrown, plantLifespan } from "./PlantSize";
import { CLASSIC_SEED_RAIN_FRACTION, FOOD_LOCAL_CAPACITY, FOOD_LOCAL_RADIUS,
         FOOD_RANDOM_SEED_CHANCE, FOOD_SPROUT_RATE, LOCAL_PLANT_GROWTH, LOCAL_PLANT_SEED_RADIUS,
         MAX_FOODBITS_PER_TYPE, ORIGINAL_FOOD_ENABLED, PLANT_CANOPY_RADIUS, PLANT_EVOLUTION_ENABLED,
         PLANT_FRUIT_ENERGY, PLANT_FRUIT_PERIOD, PLANT_LIFESPAN, PLANT_ROT_ENABLED, PLANT_ROT_AGE, PLANT_SIZE_ENABLED,
         PLANT_SEED_PARENT_TRIES, PLANT_SPROUT_ENERGY, PLANT_STAGES_ENABLED, PLANT_TREE_ENERGY,
         SHADED_PLANT_AGING_FACTOR, WOOD_DECAY_STEPS, WOOD_PER_FRUIT_TIER } from "./Parameters";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { PROFILER_ENABLED, profEnter, profExit, PROF_UPDATE_FOOD } from "./Profiler";
import * as SS from "./SharedState";
import { decayMeat, plantStageCap, soilPlantGrowth } from "./SoilEcology";
import { NULL_INDEX, PI2 } from "./MathConstants";
import { assert } from "./Utility";
import { WORLD_AREA_FACTOR } from "./World";

export interface FoodContext
{
    st: any; foodBits: any[]; aliveFoodBitIndices: number[];
    plantShade: Float32Array; foodBitGrid: any; foodGridResult: Int32Array;
    vectorUtility: any; seedSource: any; obstacle: any; environment: any;
    ambientEnergy: number; mapMeatRate: number; clock: number; currentSpeed: number;
    classicSeedDebt: number;
    api: {
        buildCanopyShade(): void; killPlant(f: number): void;
        findLowestDeadFoodBitInArray(meat?: boolean): number;
        randomPointInPool(v: any): void; choosePlantTypeAt(x: number, y: number): number; plantCanGrowAt(x: number, y: number, type: number): boolean;
        findRandomLivingPlant(): any; findRandomLivingFoodBit(type: number): number;
        findSeedParent(type: number): number; placeSeed(child: any, parent: any, distance: number): void;
        rainMapMeat(): void; regrowFoodOriginal(plants: number): void;
        regrowFoodEnvironment(type0: number, type1: number): void;
    };
}

// A plant is a pump, not a printer: its energy comes from the atmosphere or
// from the parent that dropped the seed. Either way the world total is kept.
export function fundPlant( ctx: FoodContext, f: number, requested: number, donor: number = NULL_INDEX ): boolean
{
    const st = ctx.st;
    const needed = ( PLANT_SIZE_ENABLED && ctx.environment.active && ( st.foodType[f] !== 2 )) ? PLANT_SPROUT_ENERGY : requested;
    let funded: number;
    if ( donor !== NULL_INDEX )
    {
        const available = ctx.foodBits[ donor ].getEnergy();
        if ( available < needed ) { ctx.foodBits[f].setEnergy( 0 ); ctx.foodBits[f].kill(); return false; }
        ctx.foodBits[ donor ].setEnergy( available - needed );
        funded = needed;
    }
    else { funded = drawFromAtmosphere( needed ); }
    if ( funded <= 0 ) { ctx.foodBits[f].setEnergy( 0 ); ctx.foodBits[f].kill(); return false; }
    ctx.foodBits[f].setEnergy( funded );
    return true;
}

function spawnFruit( ctx: FoodContext, parent: number ): boolean
{
    const st = ctx.st;
    const child = ctx.api.findLowestDeadFoodBitInArray();
    if ( child === NULL_INDEX ) return false;
    const energy = Math.min( PLANT_FRUIT_ENERGY, Math.max( 0, st.foodEnergy[parent] - PLANT_SPROUT_ENERGY ));
    if ( energy <= 0 ) return false;
    const radius = PLANT_CANOPY_RADIUS * ( 0.25 + 0.75 * plantCrown( st.foodEnergy[parent] )) * Math.sqrt( gpRandom() );
    const angle = gpRandom() * PI2;
    ctx.foodBits[child].initialize( child );
    ctx.foodBits[child].setType( st.foodType[parent] );
    if ( PLANT_EVOLUTION_ENABLED ) inheritPlantGenes( child, parent );
    ctx.foodBits[child].setFruit( true );
    ctx.foodBits[child].setEnergy( energy );
    ctx.vectorUtility.setXY( st.foodX[parent] + Math.cos( angle ) * radius, st.foodY[parent] + Math.sin( angle ) * radius );
    ctx.foodBits[child].setPosition( ctx.vectorUtility );
    st.foodEnergy[parent] -= energy;
    ctx.foodBitGrid.addExtra( child );
    return true;
}

export function updateFood( ctx: FoodContext ): void
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_UPDATE_FOOD ) : 0;
    try
    {
    const st = ctx.st, api = ctx.api, env = ctx.environment;
    st.foodSucking.fill( 0 );
    if ( ctx.mapMeatRate > 0 ) { api.rainMapMeat(); }
    let numType0FoodBits = 0, numType1FoodBits = 0, treeCount = 0;
    const counting = env.active;
    if ( counting )
    {
        env.clearPlantCounts();
        if ( NUTRIENT_CYCLE_ENABLED && ( ctx.clock % SOIL_DIFFUSION_INTERVAL === 0 )) env.diffuseSoilNutrients();
    }
    api.buildCanopyShade();

    const live = st.liveFood, foodType = st.foodType, foodX = st.foodX, foodY = st.foodY, born = st.foodBorn;
    for ( let i = 0; i < ctx.aliveFoodBitIndices.length; i++ )
    {
        const f = ctx.aliveFoodBitIndices[i];
        if ( live[f] !== 1 ) continue;
        const type = foodType[f];
        if ( PLANT_EVOLUTION_ENABLED && ( ctx.clock === 1 ) && ( type !== 2 )) { born[f] = 1 - gpRandom() * plantOldAge( f ); }
        if ( PLANT_STAGES_ENABLED && PLANT_ROT_ENABLED && ( type !== 2 ) && ( ctx.clock - born[f] > plantRotAge( f ))) { ctx.foodBits[f].kill(); continue; }

        if ( PLANT_SIZE_ENABLED && env.active && ( type !== 2 ) && ( st.foodFruit[f] !== 1 ))
        {
            const cell = env.plantCellIndex( foodX[f], foodY[f] );
            const shade = ( st.foodWood[f] < WOOD_PER_FRUIT_TIER ) ? ctx.plantShade[cell] : 0;
            let e = st.foodEnergy[f];
            const full = plantStageCap( st, foodX[f], foodY[f], e );
            const age = ( ctx.clock - born[f] ) / ( 1 + ( SHADED_PLANT_AGING_FACTOR - 1 ) * shade );
            if (( PLANT_LIFESPAN > 0 ) && ( age > plantLifespan( f, born[f] ))) { api.killPlant( f ); continue; }
            const grown = soilPlantGrowth( st, foodX[f], foodY[f], e, full );
            if ( grown > 0 ) { e += grown; st.foodEnergy[f] = e; }
            st.foodSucking[f] = grown > 0 ? Math.min( 1, grown / 0.085 ) : 0;
            st.plantAge[f] = Math.max( 0, ctx.clock - born[f] );
            st.foodWood[f] = Math.max( st.foodWood[f], e );
            const crownStarved = e < st.foodWood[f] * 0.05
                || (( st.foodWood[f] > PLANT_SPROUT_ENERGY ) && ( full <= PLANT_SPROUT_ENERGY ) && ( e <= PLANT_SPROUT_ENERGY + 1e-6 ));
            if ( crownStarved && ( st.foodWood[f] > 0 ))
            {
                st.foodWood[f] = Math.max( 0, st.foodWood[f] - PLANT_TREE_ENERGY / WOOD_DECAY_STEPS );
                if ( st.foodWood[f] <= PLANT_SPROUT_ENERGY ) { api.killPlant( f ); continue; }
            }
            const maxFruits = Math.min( 3, Math.floor( st.foodWood[f] / WOOD_PER_FRUIT_TIER ));
            if (( maxFruits > 0 ) && ( ctx.clock >= st.foodFruitAt[f] ) && ( e > PLANT_SPROUT_ENERGY + PLANT_FRUIT_ENERGY ))
            {
                st.foodFruitAt[f] = ctx.clock + PLANT_FRUIT_PERIOD * ( 0.8 + 0.4 * gpRandom() );
                const radius = PLANT_CANOPY_RADIUS * ( 0.25 + 0.75 * plantCrown( e ));
                const nearby = ctx.foodBitGrid.collect( foodX[f], foodY[f], radius, ctx.foodGridResult );
                let fruits = 0;
                for ( let k = 0; k < nearby; k++ )
                {
                    const other = ctx.foodGridResult[k];
                    if (( live[other] === 1 ) && ( st.foodFruit[other] === 1 )) fruits ++;
                }
                if ( fruits < maxFruits ) spawnFruit( ctx, f );
            }
        }

        if (( type !== 2 ) && ( st.foodFruit[f] !== 1 ) && ( st.foodWood[f] >= WOOD_PER_FRUIT_TIER )
        &&  ( treeCount < st.matureTrees.length )) { st.matureTrees[ treeCount ++ ] = f; }

        if ( type === 0 ) { numType0FoodBits ++; }
        else if ( type === 1 ) { numType1FoodBits ++; }
        else
        {
            const decay = decayMeat( st, foodX[f], foodY[f], st.foodEnergy[f] );
            st.foodEnergy[f] = decay.e;
            if ( decay.dead )
            {
                simCounters.meatDecayEvents ++;
                if ( counting && NUTRIENT_CYCLE_ENABLED )
                {
                    simCounters.nutrientsFromMeatDecay += env.returnMeatDetritusAt( foodX[f], foodY[f], decay.remains );
                }
                ctx.foodBits[f].kill();
            }
            else if ( ctx.currentSpeed > 0 )
            {
                currentAt( foodX[f], foodY[f] );
                foodX[f] = Math.max( POOL_LEFT + 1, Math.min( POOL_RIGHT - 1, foodX[f] + ctx.currentSpeed * currentDriftX() ));
                foodY[f] = Math.max( POOL_TOP + 1, Math.min( POOL_BOTTOM - 1, foodY[f] + ctx.currentSpeed * currentDriftY() ));
            }
        }
        if ( counting && ( type !== 2 ) && ( live[f] === 1 ))
        {
            env.plantCount[ type ][ env.plantCellIndex( foodX[f], foodY[f] ) ] ++;
        }
    }
    st.params[ SS.PARAM_MATURE_TREE_COUNT ] = treeCount;

    if ( env.active )
    {
        if ( ORIGINAL_FOOD_ENABLED ) { api.regrowFoodOriginal( numType0FoodBits + numType1FoodBits ); return; }
        api.regrowFoodEnvironment( numType0FoodBits, numType1FoodBits );
        return;
    }
    if ( !LOCAL_PLANT_GROWTH ) { regrowFoodClassic( ctx, numType0FoodBits, numType1FoodBits ); return; }

    assert( globalTweakers.foodRegenerationPeriod > 0, "GenePool:updateFood:globalTweakers.foodRegenerationPeriod > 0" );
    const numPlants = numType0FoodBits + numType1FoodBits;
    const expectedSeeds = numPlants * FOOD_SPROUT_RATE / globalTweakers.foodRegenerationPeriod;
    let numSeeds = Math.floor( expectedSeeds );
    if ( gpRandom() < expectedSeeds - numSeeds ) { numSeeds ++; }
    for ( let n = 0; n < numSeeds; n++ )
    {
        const parent = api.findRandomLivingPlant();
        if ( parent === null ) break;
        spawnPlant( ctx, parent.getPosition(), parent.getType(), numType0FoodBits, numType1FoodBits, true, parent.getIndex() );
    }
    if ( gpRandom() < FOOD_RANDOM_SEED_CHANCE )
    {
        ctx.vectorUtility.x = POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN + gpRandom() * ( POOL_WIDTH - FOOD_BIT_BOUNDARY_MARGIN * 2 );
        ctx.vectorUtility.y = POOL_TOP + FOOD_BIT_BOUNDARY_MARGIN + gpRandom() * ( POOL_HEIGHT - FOOD_BIT_BOUNDARY_MARGIN * 2 );
        const type = ( globalTweakers.numFoodTypes === 2 ) ? Math.floor( gpRandom() * 2 ) : 0;
        spawnPlant( ctx, ctx.vectorUtility, type, numType0FoodBits, numType1FoodBits, false );
    }
    }
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_UPDATE_FOOD, profT0 ); } }
}


export function spawnPlant( ctx: FoodContext, position: any, type: number, numType0: number, numType1: number,
                            scatter: boolean, donor: number = NULL_INDEX ): boolean
{
    const st = ctx.st;
    if ( globalTweakers.numFoodTypes === 2 )
    {
        if (( type === 0 ) && ( numType0 >= MAX_FOODBITS_PER_TYPE )) return false;
        if (( type === 1 ) && ( numType1 >= MAX_FOODBITS_PER_TYPE )) return false;
    }
    const child = ctx.api.findLowestDeadFoodBitInArray();
    if ( child === NULL_INDEX ) return false;
    ctx.foodBits[child].initialize( child );
    ctx.foodBits[child].setType( type );
    ctx.foodBits[child].setMaxSpawnRadius( LOCAL_PLANT_SEED_RADIUS );
    if ( !fundPlant( ctx, child, globalTweakers.foodBitEnergy, donor )) return false;
    ctx.seedSource.getPosition().set( position );
    if ( scatter )
    {
        for ( let attempt = 0; attempt < 10; attempt++ )
        {
            ctx.foodBits[child].randomizeSpawnPosition( ctx.seedSource );
            if ( !ctx.obstacle.getObstruction( position, ctx.foodBits[child].getPosition() )) break;
        }
    }
    else { ctx.foodBits[child].setPosition( position ); }
    const childPosition = ctx.foodBits[child].getPosition();
    st.foodX[child] = childPosition.x; st.foodY[child] = childPosition.y; st.foodType[child] = type;
    const numInCells = ctx.foodBitGrid.collect( childPosition.x, childPosition.y, FOOD_LOCAL_RADIUS, ctx.foodGridResult );
    let numPlantNeighbors = 0;
    for ( let k = 0; k < numInCells; k++ )
    {
        const f = ctx.foodGridResult[k];
        if ( f === child ) continue;
        const neighbor = ctx.foodBits[f], p = neighbor.getPosition();
        const dx = p.x - childPosition.x, dy = p.y - childPosition.y;
        if (( dx * dx + dy * dy < FOOD_LOCAL_RADIUS * FOOD_LOCAL_RADIUS ) && neighbor.getAlive() && ( neighbor.getType() !== 2 )) { numPlantNeighbors ++; }
    }
    if ( numPlantNeighbors >= FOOD_LOCAL_CAPACITY ) { ctx.foodBits[child].kill(); return false; }
    ctx.foodBitGrid.addExtra( child );
    return true;
}

export function regrowFoodClassic( ctx: FoodContext, numType0: number, numType1: number ): void
{
    ctx.classicSeedDebt += WORLD_AREA_FACTOR / globalTweakers.foodRegenerationPeriod;
    while ( ctx.classicSeedDebt >= 1 )
    {
        ctx.classicSeedDebt -= 1;
        regrowOneClassic( ctx, numType0, numType1 );
    }
}

export function regrowOneClassic( ctx: FoodContext, numType0: number, numType1: number ): void
{
    const api = ctx.api;
    const child = api.findLowestDeadFoodBitInArray();
    if ( child == NULL_INDEX ) return;
    let newFoodType = 0;
    let parent: number;
    if ( globalTweakers.numFoodTypes === 2 )
    {
        newFoodType = Math.floor( gpRandom() * 2 );
        if      ( numType0 >= MAX_FOODBITS_PER_TYPE ) { newFoodType = 1; }
        else if ( numType1 >= MAX_FOODBITS_PER_TYPE ) { newFoodType = 0; }
        parent = api.findRandomLivingFoodBit( newFoodType );
        if ( numType0 === 0 ) { newFoodType = 0; parent = api.findRandomLivingFoodBit(1); }
        if ( numType1 === 0 ) { newFoodType = 1; parent = api.findRandomLivingFoodBit(0); }
    }
    else { parent = PLANT_EVOLUTION_ENABLED ? api.findSeedParent( newFoodType ) : api.findRandomLivingFoodBit( newFoodType ); }

    if (( parent == NULL_INDEX ) || ( gpRandom() < CLASSIC_SEED_RAIN_FRACTION ))
    {
        ctx.foodBits[child].initialize( child );
        if ( PLANT_EVOLUTION_ENABLED && ( parent != NULL_INDEX )) { inheritPlantGenes( child, parent ); }
        ctx.foodBits[child].setType( newFoodType );
        fundPlant( ctx, child, globalTweakers.foodBitEnergy );
        return;
    }
    ctx.foodBits[child].spawnFromParent( ctx.foodBits[parent], child, newFoodType );
    if ( !fundPlant( ctx, child, ctx.foodBits[parent].getEnergy(), parent )) return;
    if ( PLANT_EVOLUTION_ENABLED )
    {
        inheritPlantGenes( child, parent );
        ctx.foodBits[child].tintByGenes();
        api.placeSeed( ctx.foodBits[child], ctx.foodBits[parent], plantSeedDistance( parent ));
        return;
    }
    for ( let attempt = 0; attempt < 10; attempt++ )
    {
        ctx.foodBits[child].randomizeSpawnPosition( ctx.foodBits[parent] );
        if ( !ctx.obstacle.getObstruction( ctx.foodBits[parent].getPosition(), ctx.foodBits[child].getPosition() )) break;
    }
}
