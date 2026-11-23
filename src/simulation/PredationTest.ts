//------------------------------------------------------------------------------
// PredationTest — standalone headless predator/herbivore coexistence benchmark
// extracted from GenePool.ts.
//------------------------------------------------------------------------------
import { GENES_ASYMMETRY, GENES_PREDATOR, setTrait } from "./EcologyGenes";
import { isExperimentalEmbryologyGene } from "./Embryology";
import { NUM_GENES } from "./Genotype";
import { globalTweakers, gpRandom, NUM_GENES_USED, resetSimulationCounters, simClock, simCounters } from "./Globals";
import { BYTE_SIZE, NULL_INDEX } from "./MathConstants";
import { DEFAULT_GARDEN_OF_EDEN_RADIUS, DEFAULT_SWIMBOT_HUNGER_THRESHOLD, MAX_FOODBITS, MAX_SWIMBOTS, YOUNG_AGE_DURATION } from "./Parameters";
import * as RootNetwork from "./RootNetwork";
import { ATTRACTION_SIMILAR_COLOR } from "./SwimbotTypes";
import { getRandomAngleInDegrees } from "./Utility";
import { Vector2D } from "./Vector2D";

export function runPredationSelfTest( ctx: any )
{
    const HERB_COUNT = 50;
    const PRED_COUNT = 5;
    const TOTAL_TICKS = 10000;
    const LOG_PERIOD = 1000;

    globalTweakers.numFoodTypes = 1;
    ctx.randomizeFood();

    for ( let s = 0; s < MAX_SWIMBOTS; s++ ) { ctx.swimbots[s].die(); }
    for ( let f = 0; f < MAX_FOODBITS; f++ )
    {
        ctx.foodBits[f].kill();
        RootNetwork.unlinkChildren( ctx.st, f );
        if ( ctx.st.selectedPlantIndex === f ) { ctx.st.selectedPlantIndex = -1; }
    }

    ctx.setHungerThreshold( DEFAULT_SWIMBOT_HUNGER_THRESHOLD );
    ctx.setAttraction( ATTRACTION_SIMILAR_COLOR );

    const poolCenter = ctx.pool.getCenter();
    const gardenRadius = DEFAULT_GARDEN_OF_EDEN_RADIUS;
    ctx.familyTree.reset();
    ctx.clock = 0;
    simClock.step = 0;
    resetSimulationCounters();
    ctx.resetHistory();

    const createBot = ( index: number, pred255: number, posOffsetX: number ) =>
    {
        const g = ctx.myGenotype;
        g.randomize();
        for ( let k = NUM_GENES_USED; k < NUM_GENES; k++ )
        {
            if ( !isExperimentalEmbryologyGene( k )) { g.setGeneValue( k, 0 ); }
        }
        g.setGeneValue( GENES_ASYMMETRY[0], Math.floor( gpRandom() * BYTE_SIZE ));
        setTrait( g, GENES_PREDATOR, Math.floor( pred255 ) / 255 );

        const pos = new Vector2D();
        pos.setToRandomLocationInDisk( poolCenter, gardenRadius );
        pos.x += posOffsetX;

        ctx.swimbots[ index ].create( index, YOUNG_AGE_DURATION, pos, getRandomAngleInDegrees(), DEFAULT_SWIMBOT_HUNGER_THRESHOLD, g, ctx.embryology );
        ctx.familyTree.addNode( index, NULL_INDEX, NULL_INDEX, ctx.clock, ctx.getSwimbotGenes( index ));
    };

    let nextIndex = 0;
    for ( let i = 0; i < HERB_COUNT; i++ ) { createBot( nextIndex++, Math.random() * 55, -200 ); }
    for ( let i = 0; i < PRED_COUNT; i++ ) { createBot( nextIndex++, 200 + Math.random() * 55, 200 ); }

    const computeStats = () =>
    {
        let aliveHerb = 0, alivePred = 0, sumEnergy = 0, aliveTotal = 0;
        for ( let s = 0; s < MAX_SWIMBOTS; s++ )
        {
            if ( ctx.swimbots[s].getAlive() )
            {
                aliveTotal++;
                sumEnergy += ctx.swimbots[s].getEnergy();
                if ( ctx.swimbots[s].getPredatorLevel() > 0.6 ) alivePred++;
                else aliveHerb++;
            }
        }
        return { aliveHerb, alivePred, aliveTotal, avgEnergy: aliveTotal > 0 ? ( sumEnergy / aliveTotal ) : 0 };
    };

    ctx.simulationRunning = false;
    for ( let t = 1; t <= TOTAL_TICKS; t++ )
    {
        ctx.clock++;
        ctx.updateSwimbots();
        ctx.updateFood();
        if ( t % LOG_PERIOD === 0 )
        {
            const stats = computeStats();
            console.log( "[testPredation] tick=" + t + " predators=" + stats.alivePred + " herbivores=" + stats.aliveHerb + " avgEnergy=" + stats.avgEnergy.toFixed(4) + " attacks=" + simCounters.attackCount );
        }
    }

    const finalStats = computeStats();
    const predatorsSurvived = finalStats.alivePred > 0;
    const herbivoresSurvived = finalStats.aliveHerb > 0;
    console.log( "[testPredation] FINAL predatorsAlive=" + finalStats.alivePred + " herbivoresAlive=" + finalStats.aliveHerb + " attacksTotal=" + simCounters.attackCount );
    console.log( "[testPredation] survivalOK=" + (( predatorsSurvived && herbivoresSurvived ) ? "YES" : "NO") );
    ctx.simulationRunning = true;

    return {
        predatorsSurvived,
        herbivoresSurvived,
        predatorsAlive: finalStats.alivePred,
        herbivoresAlive: finalStats.aliveHerb,
        attacksTotal: simCounters.attackCount,
    };
}
