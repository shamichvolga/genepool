//------------------------------------------------------------------------------
// MatingSystem — post-perception interaction phase: eating, filter feeding,
// hunting, reproductive compatibility, offspring birth, and family tree logging.
//------------------------------------------------------------------------------
import { BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_PURSUING_MATE } from "./Brain";
import { geneAverage, GENES_PREDATOR, setTrait } from "./EcologyGenes";
import { environment } from "./Environment";
import { gpRandom, simCounters } from "./Globals";
import { NULL_INDEX, ONE_HALF } from "./MathConstants";
import { DIET_SWITCH_RATE, KILL_WINNER_REPRO_MULT, killWinnerPressure, PREDATOR_LEVEL_THRESHOLD, rStrategyCooldownFactor, rStrategyReproductionEnergyFactor } from "./Parameters";
import { PROFILER_ENABLED, profEnter, profExit, PROF_INTERACT } from "./Profiler";
import * as SS from "./SharedState";
import { MATING_COOLDOWN_STEPS } from "./SharedState";
import { getRandomAngleInDegrees } from "./Utility";

export interface MatingContext {
    readonly st: SS.SharedState;
    readonly swimbots: any[];
    readonly foodBits: any[];
    readonly embryology: any;
    readonly familyTree: any;
    readonly pool: any;
    readonly vectorUtility: any;
    readonly childGenotype: any;
    readonly clock: number;
    readonly seconds: number;
    findLowestDeadSwimbotInArray(): number;
    getJunkDnaSimilarity( g1: any, g2: any ): number;
    syncSwimbot( s: number ): void;
    nextSerial(): number;
    recordMating( parentA: any, parentB: any ): void;
    getSwimbotGenes( s: number ): any;
    getSwimbotEvolutionTraits( s: number ): any;
}

function adjustOffspringContribution( bot: any, amount: number, vitality: number ): number
{
    const target = amount * vitality;
    let actual = amount;
    const reserve = bot.getEnergy();
    if ( target > actual )
    {
        const extra = Math.min( target - actual, reserve );
        bot.setEnergy( reserve - extra );
        actual += extra;
    }
    else if ( target < actual )
    {
        bot.setEnergy( reserve + ( actual - target ));
        actual = target;
    }
    return actual;
}

export function interactSwimbot( ctx: MatingContext, s: number ): void
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_INTERACT ) : 0;
    try
    {
        const st = ctx.st, bots = ctx.swimbots, foods = ctx.foodBits;
        const m = s * SS.MIND_STRIDE;
        const M = st.mind;

        if ( bots[s].hasCarriedSeed() ) { bots[s].updateCarriedSeed(); }

        if ( M[ m + SS.M_TRY_EAT ] === 1 )
        {
            const food = bots[s].getChosenFoodBit();
            if (( food != null ) && food.getAlive()) { bots[s].eatChosenFoodBit(); }
            else                                     { bots[s].cancelEating(); }
        }

        const sprout = M[ m + SS.M_FILTER_FOOD ];
        if (( sprout >= 0 ) && foods[ sprout ].getAlive() && ( foods[ sprout ].getType() !== 2 ))
        {
            bots[s].filterFeed( foods[ sprout ] );
        }

        if ( M[ m + SS.M_TRY_HUNT ] === 1 )
        {
            bots[s].huntEatChosenPrey();
        }

        if ( M[ m + SS.M_TRY_MATE ] === 1 )
        {
            const newBornSwimbotIndex = ctx.findLowestDeadSwimbotInArray();
            const chosenMateIndex = bots[s].getChosenMateIndex();

            if (( newBornSwimbotIndex != NULL_INDEX ) && ( chosenMateIndex != NULL_INDEX ))
            {
                const mate = bots[ chosenMateIndex ];
                if ( mate && mate.getAlive() )
                {
                    const mb = chosenMateIndex * SS.MIND_STRIDE;
                    const myState   = bots[s].getBrainState();
                    const mateState = mate.getBrainState();
                    const readyToMate =
                           M[ m + SS.M_REPRO_CD ] === 0
                        && M[ mb + SS.M_REPRO_CD ] === 0
                        && ( myState === BRAIN_STATE_LOOKING_FOR_MATE || myState === BRAIN_STATE_PURSUING_MATE )
                        && ( mateState === BRAIN_STATE_LOOKING_FOR_MATE || mateState === BRAIN_STATE_PURSUING_MATE )
                        && ( bots[s].getEnergy() > bots[s].getHungerThreshold() * rStrategyReproductionEnergyFactor( bots[s].getNumParts() ) )
                        && ( mate.getEnergy() > mate.getHungerThreshold() * rStrategyReproductionEnergyFactor( mate.getNumParts() ) );

                    if ( !readyToMate )
                    {
                        bots[s].abortMating();
                        mate.abortMating();
                    }
                    else
                    {
                        simCounters.reproductivePairAttempts++;
                        if ( !mate.sameDiet( bots[s] ))
                        {
                            simCounters.reproductiveDietMismatches++;
                        }
                        else
                        {
                            const myGenotype   = bots[s].getGenotype();
                            const mateGenotype = mate.getGenotype();

                            const junkSimilarity = ctx.getJunkDnaSimilarity( myGenotype, mateGenotype );
                            simCounters.reproductiveJunkChecks++;
                            simCounters.reproductiveJunkSimilaritySum += junkSimilarity;
                            const similarityBin = Math.min( 9, Math.floor( junkSimilarity * 10 ));
                            simCounters.reproductiveJunkSimilarityBins[ similarityBin ]++;

                            const dJunk  = 1 - junkSimilarity;
                            const dParts = Math.abs( bots[s].getNumParts() - mate.getNumParts() ) / 12;
                            const dMass  = Math.min( 1, Math.abs( Math.log( Math.max( 1, bots[s].getPhenotypeMass() ) / Math.max( 1, mate.getPhenotypeMass() ))) / 1.5 );
                            const dTotal = 0.65 * dJunk + 0.20 * dParts + 0.15 * dMass;
                            let compatProb = Math.exp( -( dTotal * dTotal ) / ( 2 * 0.42 * 0.42 ));

                            const myMorph = bots[s].getMorphologySummary();
                            const myBucket = SS.getMorphBucket( myMorph.numParts, myMorph.branchFraction > 0, myMorph.meanWidth );
                            const mateMorph = mate.getMorphologySummary();
                            const mateBucket = SS.getMorphBucket( mateMorph.numParts, mateMorph.branchFraction > 0, mateMorph.meanWidth );
                            const mateShare = st.morphBucketShare[ mateBucket ];

                            if ( myBucket === mateBucket )
                            {
                                if ( mateShare < 0.12 ) compatProb = Math.min( 1, compatProb * 1.35 );
                            }
                            else compatProb *= 0.75;

                            const avgEnergyRatio = 0.5 * ( bots[s].getEnergy() / Math.max( 1, bots[s].getMaxEnergy() )
                                                        + mate.getEnergy() / Math.max( 1, mate.getMaxEnergy() ));
                            const mutScale = avgEnergyRatio < 0.35 ? 1.45 : ( avgEnergyRatio > 0.75 ? 0.8 : 1.0 );

                            if ( gpRandom() < compatProb )
                            {
                                simCounters.reproductiveJunkPasses++;
                                const childGenotype = ctx.childGenotype;
                                childGenotype.setAsOffspring( myGenotype, mateGenotype, mutScale );

                                if ( environment.active && ( gpRandom() < DIET_SWITCH_RATE ))
                                {
                                    const wasPredator = geneAverage( childGenotype, GENES_PREDATOR ) > PREDATOR_LEVEL_THRESHOLD;
                                    setTrait( childGenotype, GENES_PREDATOR, wasPredator ? 0.3 * gpRandom() : 0.75 + 0.25 * gpRandom() );
                                }

                                let myEnergyContribution   = bots[s].contributeToOffspring();
                                let mateEnergyContribution = mate.contributeToOffspring();
                                if ( environment.active )
                                {
                                    const mateOffset = chosenMateIndex * SS.MIND_STRIDE;
                                    const avgFit = 0.5 * ( M[ m + SS.M_THERMAL_FIT ] + M[ mateOffset + SS.M_THERMAL_FIT ] );
                                    const vitality = Math.max( 0.85, Math.min( 1.12, 0.85 + avgFit * 0.32 ));
                                    myEnergyContribution   = adjustOffspringContribution( bots[s], myEnergyContribution, vitality );
                                    mateEnergyContribution = adjustOffspringContribution( mate, mateEnergyContribution, vitality );
                                }
                                const energyToOffspring = myEnergyContribution + mateEnergyContribution;

                                const diffX = mate.getGenitalPosition().x - bots[s].getGenitalPosition().x;
                                const diffY = mate.getGenitalPosition().y - bots[s].getGenitalPosition().y;
                                const v = ctx.vectorUtility;
                                v.x = bots[s].getGenitalPosition().x + diffX * ONE_HALF;
                                v.y = bots[s].getGenitalPosition().y + diffY * ONE_HALF;

                                ctx.pool.endTouch( v, ctx.seconds );

                                const initialAngle = getRandomAngleInDegrees();
                                bots[ newBornSwimbotIndex ].create( newBornSwimbotIndex, 0, v, initialAngle, energyToOffspring, childGenotype, ctx.embryology );
                                ctx.syncSwimbot( newBornSwimbotIndex );

                                const parts = bots[s].getNumParts(), mateParts = mate.getNumParts();
                                const crownPressure = killWinnerPressure( st.params[ SS.PARAM_PART_SHARE_BASE + Math.max( 0, Math.min( 15, parts - 1 )) ]);
                                const matePressure  = killWinnerPressure( st.params[ SS.PARAM_PART_SHARE_BASE + Math.max( 0, Math.min( 15, mateParts - 1 )) ]);
                                const cooldownFactor     = rStrategyCooldownFactor( parts ) * ( 1 + KILL_WINNER_REPRO_MULT * crownPressure );
                                const mateCooldownFactor = rStrategyCooldownFactor( mateParts ) * ( 1 + KILL_WINNER_REPRO_MULT * matePressure );

                                bots[ newBornSwimbotIndex ].setMatingCooldown( Math.round( MATING_COOLDOWN_STEPS * cooldownFactor ));
                                bots[s].setMatingCooldown( Math.round( MATING_COOLDOWN_STEPS * cooldownFactor ));
                                mate.setMatingCooldown( Math.round( MATING_COOLDOWN_STEPS * mateCooldownFactor ));
                                bots[s].abortMating();
                                mate.abortMating();

                                if ( bots[s].getSerial() <= 0 ) { bots[s].setFamily( ctx.nextSerial(), 0, 0 ); }
                                if ( mate.getSerial() <= 0 ) { mate.setFamily( ctx.nextSerial(), 0, 0 ); }
                                bots[ newBornSwimbotIndex ].setFamily( ctx.nextSerial(), bots[s].getSerial(), mate.getSerial() );
                                simCounters.births++;

                                ctx.recordMating( bots[s], mate );
                                ctx.familyTree.addNode( newBornSwimbotIndex, s, chosenMateIndex, ctx.clock, ctx.getSwimbotGenes( newBornSwimbotIndex ), ctx.getSwimbotEvolutionTraits( newBornSwimbotIndex ) );
                            }
                            else
                            {
                                simCounters.reproductiveJunkBlocks++;
                            }
                        }
                    }
                }
            }

            if ( bots[s].getIsTryingToMate() )
            {
                bots[s].abortMating();
            }
        }
    }
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_INTERACT, profT0 ); } }
}
