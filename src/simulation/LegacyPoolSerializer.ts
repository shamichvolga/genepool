//------------------------------------------------------------------------------
// LegacyPoolSerializer — JSON snapshot export/import (getPoolData / setPoolData)
// extracted from GenePool.ts.
//------------------------------------------------------------------------------
import { TWO_PLANT_TYPES } from "./Ecology";
import { convertOldGenes, GENE_LAYOUT_VERSION } from "./EcologyGenes";
import { environment } from "./Environment";
import { Genotype } from "./Genotype";
import { globalTweakers } from "./Globals";
import { NULL_INDEX, ZERO } from "./MathConstants";
import { MAX_FOODBITS, MAX_SWIMBOTS } from "./Parameters";
import { Vector2D } from "./Vector2D";

export function setLegacyPoolData( ctx: any, data: any ): void
{
    const st = ctx.st, foodBits = ctx.foodBits, swimbots = ctx.swimbots;
    environment.setState( data.environment );
    if ( environment.active ) { environment.copyBackgroundTo( st.background ); }
    ctx.clock = ( typeof data.clock === "number" ) ? data.clock : 0;
    environment.setTime( ctx.clock );
    ctx.seedDebt = 0;
    globalTweakers.numFoodTypes = environment.active ? ( TWO_PLANT_TYPES ? 2 : 1 ) : globalTweakers.numFoodTypes;
    ctx.setEnvironmentImage( environment.active ? environment.makeImage() : null );
    ctx.pool.setBackgroundImage( environment.active ? environment.makeImage() : null );
    ctx.setPopulationLimitEnabled( data.populationLimitEnabled !== false );
    ctx.setMaximumSwimbotParts( typeof data.maximumSwimbotParts === "number" ? data.maximumSwimbotParts : 16 );

    ctx.simulationRunning = data.simulationRunning;

    for ( let f = 0; f < MAX_FOODBITS; f++ ) { foodBits[f].kill(); }

    for ( let f = 0; f < data.numFoodBits; f++ )
    {
        const saved = data.foodBitArray[f];
        const id = saved.id;
        foodBits[ id ].initialize( id );
        if ( typeof saved.age    === "number" ) { st.foodBorn[ id ] = ctx.clock - saved.age; }
        if ( typeof saved.growth === "number" ) { st.plantGrowth[ id ] = saved.growth; st.plantSpread[ id ] = saved.spread; }
        if ( typeof saved.energy === "number" && Number.isFinite( saved.energy )) { st.foodEnergy[ id ] = saved.energy; }
        if ( typeof saved.wood   === "number" && Number.isFinite( saved.wood ))   { st.foodWood[ id ] = saved.wood; }
        else { st.foodWood[ id ] = Math.max( 0, st.foodEnergy[ id ] ); }
        if ( typeof saved.fruit  === "number" && Number.isFinite( saved.fruit ))  { st.foodFruit[ id ] = saved.fruit ? 1 : 0; }
        if ( typeof saved.nextFruitAt === "number" && Number.isFinite( saved.nextFruitAt )) { st.foodFruitAt[ id ] = saved.nextFruitAt; }

        const type = saved.type;
        foodBits[ id ].setType(( type === 1 || type === 2 ) ? type : 0 );
        const pos = new Vector2D();
        pos.setXY( saved.x, saved.y );
        foodBits[ id ].setPosition( pos );
    }

    for ( let s = 0; s < MAX_SWIMBOTS; s++ ) { swimbots[s].die(); }
    ctx.familyTree.reset();

    for ( let s = 0; s < data.numSwimbots; s++ )
    {
        const saved = data.swimbotArray[s];
        const id = saved.id;
        const pos = new Vector2D();
        pos.setXY( saved.x, saved.y );

        const loadedGenotype = new Genotype();
        const genes = saved.genes.slice();
        if ( !data.geneLayout ) { convertOldGenes( genes ); }
        loadedGenotype.setGenes( genes );
        loadedGenotype.setBrain( saved.brain );

        swimbots[ id ].create( id, saved.age, pos, saved.angle, saved.energy, loadedGenotype, ctx.embryology );
        if ( Array.isArray( saved.privateState )) { swimbots[id].setPrivateState( saved.privateState, 0 ); }
        ctx.familyTree.addNode( id, NULL_INDEX, NULL_INDEX, ctx.clock, ctx.getSwimbotGenes( id ));
    }

    const cameraPosition = new Vector2D();
    cameraPosition.setXY( data.cameraX, data.cameraY );
    ctx.camera.setPosition( cameraPosition );
    ctx.camera.setScale( data.cameraScale );
    ctx.resetViewTracking();

    ctx.setFoodGrowthDelay     ( data.foodRegenerationPeriod );
    ctx.setFoodSpread          ( data.foodSpread );
    ctx.setFoodBitEnergy       ( data.foodBitEnergy );
    for ( let f = 0; f < data.numFoodBits; f++ )
    {
        const saved = data.foodBitArray[f], id = saved.id;
        if ( typeof saved.energy === "number" && Number.isFinite( saved.energy )) { st.foodEnergy[id] = saved.energy; }
        if ( typeof saved.wood   === "number" && Number.isFinite( saved.wood ))   { st.foodWood[id] = saved.wood; }
        else { st.foodWood[id] = Math.max( 0, st.foodEnergy[id] ); }
        st.foodFruit[id] = ( typeof saved.fruit === "number" && Number.isFinite( saved.fruit ) && saved.fruit !== 0 ) ? 1 : 0;
        if ( typeof saved.nextFruitAt === "number" && Number.isFinite( saved.nextFruitAt )) { st.foodFruitAt[id] = saved.nextFruitAt; }
    }
    ctx.setHungerThreshold     ( data.hungerThreshold );
    ctx.setAttraction          ( data.attractionCriterion );
    ctx.setOffspringEnergyRatio( data.childEnergyRatio );
    ctx.renderingGoals = data.renderingGoals;

    const end1 = new Vector2D(), end2 = new Vector2D();
    if (( data.obstacleEnd1X != undefined ) && ( data.obstacleEnd1Y != undefined )
    &&  ( data.obstacleEnd2X != undefined ) && ( data.obstacleEnd2Y != undefined ))
    {
        end1.setXY( data.obstacleEnd1X, data.obstacleEnd1Y );
        end2.setXY( data.obstacleEnd2X, data.obstacleEnd2Y );
    }
    else
    {
        end1.setXY( 100, 100 );
        end2.setXY( 200, 100 );
    }
    ctx.obstacle.setEndpointPositions( end1, end2 );
    if ( data.obstacleSegments && ( data.obstacleSegments.length > 0 ))
    {
        ctx.obstacle.setSegments( data.obstacleSegments );
    }

    ctx.pool.initialize( ZERO );
    ctx.setSelectedSwimbot( NULL_INDEX );
    ctx.rebuildAliveIndexCaches();
    ctx.refreshCounts();
}

export function getLegacyPoolData( ctx: any )
{
    const st = ctx.st, foodBits = ctx.foodBits, swimbots = ctx.swimbots;
    const foodBitDataArray: any[] = [];
    for ( let f = 0; f < MAX_FOODBITS; f++ )
    {
        if ( foodBits[f].getAlive() )
        {
            foodBitDataArray.push({
                id: f,
                x: foodBits[f].getPosition().x,
                y: foodBits[f].getPosition().y,
                type: foodBits[f].getType(),
                age: foodBits[f].getAge(),
                growth: st.plantGrowth[f],
                spread: st.plantSpread[f],
                energy: st.foodEnergy[f],
                wood: st.foodWood[f],
                fruit: st.foodFruit[f],
                nextFruitAt: st.foodFruitAt[f],
            });
        }
    }

    const swimbotDataArray: any[] = [];
    for ( let s = 0; s < MAX_SWIMBOTS; s++ )
    {
        if ( swimbots[s].getAlive() )
        {
            const privateState = new Float64Array( swimbots[s].PRIVATE_STATE_SIZE );
            swimbots[s].getPrivateState( privateState, 0 );
            swimbotDataArray.push({
                id: s,
                x: swimbots[s].getPosition().x,
                y: swimbots[s].getPosition().y,
                angle: swimbots[s].getAngle(),
                age: swimbots[s].getAge(),
                energy: swimbots[s].getEnergy(),
                genes: ctx.getSwimbotGenes( s ),
                brain: Array.from( swimbots[s].getGenotype().getBrain() ),
                privateState: Array.from( privateState ),
            });
        }
    }

    return {
        simulationRunning      : ctx.simulationRunning,
        numFoodBits            : foodBitDataArray.length,
        numSwimbots            : swimbotDataArray.length,
        foodBitArray           : foodBitDataArray,
        swimbotArray           : swimbotDataArray,
        cameraX                : ctx.camera.getPosition().x,
        cameraY                : ctx.camera.getPosition().y,
        cameraScale            : ctx.camera.getScale(),
        foodRegenerationPeriod : globalTweakers.foodRegenerationPeriod,
        foodSpread             : globalTweakers.foodSpread,
        foodBitEnergy          : globalTweakers.foodBitEnergy,
        hungerThreshold        : globalTweakers.hungerThreshold,
        attractionCriterion    : globalTweakers.attractionCriterion,
        childEnergyRatio       : globalTweakers.childEnergyRatio,
        populationLimitEnabled : globalTweakers.populationLimitEnabled,
        maximumSwimbotParts    : globalTweakers.maximumParts,
        renderingGoals         : ctx.renderingGoals,
        obstacleEnd1X          : ctx.obstacle.getEnd1Position().x,
        obstacleEnd1Y          : ctx.obstacle.getEnd1Position().y,
        obstacleEnd2X          : ctx.obstacle.getEnd2Position().x,
        obstacleEnd2Y          : ctx.obstacle.getEnd2Position().y,
        obstacleSegments       : ctx.obstacle.getSegments(),
        geneLayout             : GENE_LAYOUT_VERSION,
        environment            : environment.getState(),
        clock                  : ctx.clock,
    };
}
