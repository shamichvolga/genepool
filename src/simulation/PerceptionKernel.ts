//------------------------------------------------------------------------------
// Perception kernel (stage 7): what one swimbot sees - the nearest swimbots,
// the best food bit, prey (for predators), the nearest hunting predator (for
// herbivores). It only reads the shared arrays (positions as they are now)
// and writes its answers into the swimbot's output slots, so many swimbots
// can look around at the same time in different threads.
//
// The arithmetic is the same as the old GenePool.giveSwimbotNearbyEnvironmentalStimuli
// (checked by comparing both on the same state, see GenePool PERCEPTION_CHECK).
//------------------------------------------------------------------------------
import { BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_PREY } from "./Brain";
import { IGNORE_FOOD_EFFICIENCY, mateAcceptance, pairRandom, preyVisibility, searchImageFactor, sizeSignature } from "./Ecology";
import { PLANT_TYPE_WARM } from "./Environment";
import { ONE, ONE_THIRD } from "./MathConstants";
import { PREDATOR_LEVEL_THRESHOLD, PREY_MAX_MASS_RATIO, YOUNG_AGE_DURATION } from "./Parameters";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { ATTRACTION_SIMILAR_COLOR, STARVING, SWIMBOT_VIEW_RADIUS } from "./SwimbotTypes";
import {
    BACKGROUND_SIZE, MAX_SEEN, PARAM_ENV_ACTIVE, PARAM_ENV_FIELDS, PARAM_FOOD_TYPES, PARAM_OBSTACLE_X1, PARAM_OBSTACLE_X2,
    PARAM_OBSTACLE_Y1, PARAM_OBSTACLE_Y2, SharedState
} from "./SharedState";

export const STARVING_FOOD_CHOICE = 15;   // below this energy a swimbot eats anything

//------------------------------------------------------------
// scratch arrays: one set per thread
//------------------------------------------------------------
export class PerceptionScratch
{
    readonly gridResult         : Int32Array;
    readonly foodGridResult     : Int32Array;
    readonly nearbyIndices      : Int32Array;
    readonly candidateIndices   : Int32Array;
    readonly candidateDistances : Float64Array;
    readonly nearestIndices     = new Int32Array  ( MAX_SEEN );
    readonly nearestDistances   = new Float64Array( MAX_SEEN );

    constructor( maxSwimbots: number, maxFoodBits: number )
    {
        this.gridResult         = new Int32Array  ( maxSwimbots * 2 );
        this.foodGridResult     = new Int32Array  ( maxFoodBits * 2 );
        this.nearbyIndices      = new Int32Array  ( maxSwimbots );
        this.candidateIndices   = new Int32Array  ( maxSwimbots );
        this.candidateDistances = new Float64Array( maxSwimbots );
    }
}

//------------------------------------------------------------
// helpers (same as in GenePool / Vector2D)
//------------------------------------------------------------
function isCloser( distanceA: number, indexA: number, distanceB: number, indexB: number ): boolean
{
    return ( distanceA < distanceB ) || ( distanceA === distanceB && indexA < indexB );
}

function sortCandidatesByDistance( count: number, sc: PerceptionScratch ): void
{
    const ci = sc.candidateIndices, cd = sc.candidateDistances;
    for (let i = 1; i < count; i++)
    {
        const index = ci[i];
        const d     = cd[i];
        let j = i - 1;
        while ( j >= 0 && isCloser( d, index, cd[j], ci[j] ))
        {
            ci[j + 1] = ci[j];
            cd[j + 1] = cd[j];
            j--;
        }
        ci[j + 1] = index;
        cd[j + 1] = d;
    }
}

function selectNearestCandidates( count: number, limit: number, sc: PerceptionScratch ): number
{
    const ci = sc.candidateIndices, cd = sc.candidateDistances;
    const ni = sc.nearestIndices,   nd = sc.nearestDistances;
    let kept = 0;
    for (let i = 0; i < count; i++)
    {
        const index = ci[i];
        const d     = cd[i];

        if (( kept === limit ) && !isCloser( d, index, nd[ kept - 1 ], ni[ kept - 1 ] )) continue;

        let j = ( kept < limit ) ? kept : kept - 1;
        if ( kept < limit ) kept ++;

        while ( j > 0 && isCloser( d, index, nd[j - 1], ni[j - 1] ))
        {
            ni[j] = ni[j - 1];
            nd[j] = nd[j - 1];
            j--;
        }
        ni[j] = index;
        nd[j] = d;
    }
    return kept;
}

// is the line from (a0x, a0y) to (a1x, a1y) blocked by the obstacle?
function obstructed( st: SharedState, a0x: number, a0y: number, a1x: number, a1y: number ): boolean
{
    const P = st.params;
    const b0x = P[ PARAM_OBSTACLE_X1 ], b0y = P[ PARAM_OBSTACLE_Y1 ];
    const b1x = P[ PARAM_OBSTACLE_X2 ], b1y = P[ PARAM_OBSTACLE_Y2 ];

    const aX = a1x - a0x, aY = a1y - a0y;
    const bX = b1x - b0x, bY = b1y - b0y;
    const aPerpX = -aY, aPerpY = aX;
    const bPerpX = -bY, bPerpY = bX;
    const a0b0x = b0x - a0x, a0b0y = b0y - a0y;
    const a0b1x = b1x - a0x, a0b1y = b1y - a0y;
    const b0a0x = a0x - b0x, b0a0y = a0y - b0y;
    const b0a1x = a1x - b0x, b0a1y = a1y - b0y;
    const a0Dotb0 = aPerpX * a0b0x + aPerpY * a0b0y;
    const a0Dotb1 = aPerpX * a0b1x + aPerpY * a0b1y;
    const b0Dota0 = bPerpX * b0a0x + bPerpY * b0a0y;
    const b0Dota1 = bPerpX * b0a1x + bPerpY * b0a1y;

    return (((( a0Dotb0 > 0 ) && ( a0Dotb1 < 0 )) || (( a0Dotb1 > 0 ) && ( a0Dotb0 < 0 )))
        &&  ((( b0Dota0 > 0 ) && ( b0Dota1 < 0 )) || (( b0Dota1 > 0 ) && ( b0Dota0 < 0 ))));
}

// brightness of the bottom (as Environment.backgroundAt)
function backgroundAt( st: SharedState, x: number, y: number ): number
{
    if ( st.params[ PARAM_ENV_FIELDS ] === 0 ) return 0.5;
    const n = BACKGROUND_SIZE;
    const i = Math.min( n - 1, Math.max( 0, Math.floor( ( x - POOL_LEFT ) / ( POOL_RIGHT  - POOL_LEFT ) * n )));
    const j = Math.min( n - 1, Math.max( 0, Math.floor( ( y - POOL_TOP  ) / ( POOL_BOTTOM - POOL_TOP  ) * n )));
    return st.background[ j * n + i ];
}

//------------------------------------------------------------------------------
// what swimbot s sees now
//------------------------------------------------------------------------------
export function perceive( s: number, st: SharedState, sc: PerceptionScratch ): void
{
    const viewRadius            = SWIMBOT_VIEW_RADIUS;
    const viewRadiusSquared     = viewRadius * viewRadius;
    const preyViewRadius        = st.scanRadius[s];
    const predatorLevel         = st.predator[s];
    const myMass                = st.mass[s];
    const myX                   = st.botX[s];
    const myY                   = st.botY[s];
    const myGenitalX            = st.genitalX[s];
    const myGenitalY            = st.genitalY[s];
    const myMouthX              = st.mouthX[s];
    const myMouthY              = st.mouthY[s];
    const iAmPredator           = predatorLevel > PREDATOR_LEVEL_THRESHOLD;

    const botX = st.botX, botY = st.botY, genitalX = st.genitalX, genitalY = st.genitalY;
    const alive = st.alive, predator = st.predator;

    //------------------------------------------------------------------
    // everybody within the search radius (wider for a hunting predator)
    //------------------------------------------------------------------
    const searchRadius        = iAmPredator ? preyViewRadius : viewRadius;
    const searchRadiusSquared = searchRadius * searchRadius;
    const nearby = sc.nearbyIndices;
    let numNearby = 0;
    const numInCells = st.swimbotGrid.collect( myX, myY, searchRadius, sc.gridResult );

    for (let k = 0; k < numInCells; k++)
    {
        const o = sc.gridResult[k];
        if ( o === s ) continue;
        const dx = botX[o] - myX;
        const dy = botY[o] - myY;
        if ( dx * dx + dy * dy < searchRadiusSquared ) { nearby[ numNearby ++ ] = o; }
    }

    //------------------------------------------------------------------
    // the NEAREST swimbots within normal view, in order of distance
    //------------------------------------------------------------------
    let numCandidates = 0;
    for (let i = 0; i < numNearby; i++)
    {
        const o = nearby[i];
        if ( alive[o] === 1 )
        {
            const dx = myGenitalX - genitalX[o];
            const dy = myGenitalY - genitalY[o];
            const distanceSquared = dx * dx + dy * dy;
            if ( distanceSquared < viewRadiusSquared )
            {
                sc.candidateIndices  [ numCandidates ] = o;
                sc.candidateDistances[ numCandidates ] = distanceSquared;
                numCandidates ++;
            }
        }
    }

    let numNearest = selectNearestCandidates( numCandidates, MAX_SEEN, sc );
    let nearestList: Int32Array = sc.nearestIndices;

    for (let i = 0; i < numNearest; i++)
    {
        const o = sc.nearestIndices[i];
        if ( obstructed( st, myGenitalX, myGenitalY, genitalX[o], genitalY[o] ) && ( numCandidates > numNearest ))
        {
            sortCandidatesByDistance( numCandidates, sc );
            nearestList = sc.candidateIndices;
            numNearest  = numCandidates;
            break;
        }
    }

    const seenBase = s * MAX_SEEN;
    let numSeen = 0;
    let socialX = 0, socialY = 0;
    for (let i = 0; i < numNearest && numSeen < MAX_SEEN; i++)
    {
        const o = nearestList[i];
        if ( !obstructed( st, myGenitalX, myGenitalY, genitalX[o], genitalY[o] ))
        {
            st.seen[ seenBase + numSeen ] = o;
            numSeen ++;
            socialX += botX[o] - myX;
            socialY += botY[o] - myY;
        }
    }
    st.seenCount[s] = numSeen;
    st.socialX[s]   = socialX;
    st.socialY[s]   = socialY;

    //------------------------------------------------------------------
    // the best food bit
    //------------------------------------------------------------------
    const environmentOn    = st.params[ PARAM_ENV_ACTIVE ] !== 0;
    const myEfficiencyWarm = environmentOn ? st.effWarm[s] : ONE;
    const myEfficiencyCold = environmentOn ? st.effCold[s] : ONE;
    const iAmStarving      = st.energy[s] < STARVING_FOOD_CHOICE;
    const twoFoodTypes     = st.params[ PARAM_FOOD_TYPES ] === 2;
    const preferredFoodType = st.preferred[s];
    const foodX = st.foodX, foodY = st.foodY, foodType = st.foodType, foodAlive = st.foodAlive;

    let chosenFood = -1;
    let smallestDistanceSquared = Number.MAX_SAFE_INTEGER;
    const numFoodInCells = st.foodGrid.collect( myX, myY, viewRadius, sc.foodGridResult );

    for (let k = 0; k < numFoodInCells; k++)
    {
        const f  = sc.foodGridResult[k];
        const fx = foodX[f] - myX;
        const fy = foodY[f] - myY;
        if ( fx * fx + fy * fy >= viewRadiusSquared ) continue;

        const type = foodType[f];
        let okay = true;

        if ( type === 2 )
        {
            if ( !iAmPredator ) okay = false;            // meat: predators only
        }
        else if ( iAmPredator )
        {
            okay = false;                                // predators don't eat plants
        }
        else if ( environmentOn )
        {
            if ((( type === PLANT_TYPE_WARM ) ? myEfficiencyWarm : myEfficiencyCold ) < IGNORE_FOOD_EFFICIENCY && !iAmStarving ) okay = false;
        }
        else if ( twoFoodTypes )
        {
            if ( type != preferredFoodType ) okay = false;
        }
        if ( !okay ) continue;

        const mx = myMouthX - foodX[f];
        const my = myMouthY - foodY[f];
        const viewDistanceSquared = mx * mx + my * my;

        // in the environment, better food counts as nearer
        if ( environmentOn && ( type !== 2 ))
        {
            if ( viewDistanceSquared >= viewRadiusSquared ) continue;
            const e = ( type === PLANT_TYPE_WARM ) ? myEfficiencyWarm : myEfficiencyCold;
            const scaled = viewDistanceSquared / ( e * e );
            if ( scaled < smallestDistanceSquared && foodAlive[f] === 1 && !obstructed( st, myMouthX, myMouthY, foodX[f], foodY[f] ))
            {
                smallestDistanceSquared = scaled;
                chosenFood = f;
            }
            continue;
        }

        if ( viewDistanceSquared < viewRadiusSquared && viewDistanceSquared < smallestDistanceSquared && foodAlive[f] === 1 )
        {
            if ( !obstructed( st, myMouthX, myMouthY, foodX[f], foodY[f] ))
            {
                smallestDistanceSquared = viewDistanceSquared;
                chosenFood = f;
            }
        }
    }
    st.seenFood[s] = chosenFood;

    //------------------------------------------------------------------
    // prey (predators only): the nearest herbivore it can notice
    //------------------------------------------------------------------
    let chosenPrey = -1;
    if ( iAmPredator )
    {
        const imageStrength = st.imageStrength[s];
        const imageR = st.imageR[s], imageG = st.imageG[s], imageB = st.imageB[s], imageSize = st.imageSize[s];
        let bestPreyValue = -Infinity;
        for (let i = 0; i < numNearby; i++)
        {
            const o = nearby[i];
            if ( alive[o] === 0 ) continue;
            if ( predator[o] > PREDATOR_LEVEL_THRESHOLD ) continue;      // predators don't hunt predators
            if ( st.eternal[o] === 1 ) continue;                        // immortals are not eaten
            if ( st.mass[o] > myMass * PREY_MAX_MASS_RATIO ) continue;  // too big to bite

            const px = myMouthX - botX[o];
            const py = myMouthY - botY[o];
            const distance = Math.sqrt( px * px + py * py );
            if ( distance > preyViewRadius ) continue;

            // camouflage: prey that matches the bottom is seen only up close;
            // the search image: prey like the last meals is seen from farther
            if ( environmentOn )
            {
                const image = searchImageFactor( imageStrength,
                    st.colorR[o] - imageR, st.colorG[o] - imageG, st.colorB[o] - imageB, sizeSignature( st.mass[o] ) - imageSize );
                if ( distance > preyViewRadius * image * preyVisibility( st.brightness[o], backgroundAt( st, botX[o], botY[o] ))) continue;
            }

            const value = -distance + st.energy[o] * 0.001;
            if ( value > bestPreyValue )
            {
                bestPreyValue = value;
                chosenPrey = o;
            }
        }
    }
    st.seenPrey[s] = chosenPrey;

    //------------------------------------------------------------------
    // the nearest hunting predator (herbivores only)
    //------------------------------------------------------------------
    // (all predators within view count, not only the nearest few swimbots:
    //  in a crowd a predator was easily "not seen")
    let threat = -1, anyPredator = -1;
    if ( !iAmPredator )
    {
        let threatDistance = Infinity, anyDistance = Infinity;
        for (let i = 0; i < numNearby; i++)
        {
            const o = nearby[i];
            if ( alive[o] === 0 ) continue;
            if ( predator[o] <= PREDATOR_LEVEL_THRESHOLD ) continue;

            const gx = myGenitalX - genitalX[o];
            const gy = myGenitalY - genitalY[o];
            const distance = Math.sqrt( gx * gx + gy * gy );
            if ( distance > viewRadius ) continue;

            if ( distance < anyDistance ) { anyDistance = distance; anyPredator = o; }

            // the danger is a hunting predator (a fed one is calmer)
            const state = st.brainState[o];
            if (( state !== BRAIN_STATE_LOOKING_FOR_PREY ) && ( state !== BRAIN_STATE_PURSUING_PREY )) continue;
            if ( distance < threatDistance ) { threatDistance = distance; threat = o; }
        }
    }
    st.seenThreat[s]   = threat;
    st.seenPredator[s] = anyPredator;

    //------------------------------------------------------------------
    // a mate (when looking for one, by similar color): the most similar
    // grown-up, not starving swimbot in sight that accepts me
    // (as Swimbot.setEnvironmentalStimuli; other criteria: main thread)
    //------------------------------------------------------------------
    let mate = -2;
    if (( st.brainState[s] === BRAIN_STATE_LOOKING_FOR_MATE ) && ( st.attraction[s] === ATTRACTION_SIMILAR_COLOR ))
    {
        mate = -1;
        let highest = -100.0;
        const r = st.colorR, g = st.colorG, b = st.colorB;
        for (let i = 0; i < numSeen; i++)
        {
            const o = st.seen[ seenBase + i ];
            const rDiff = Math.abs( r[o] - r[s] );
            const gDiff = Math.abs( g[o] - g[s] );
            const bDiff = Math.abs( b[o] - b[s] );
            const attractiveness = ONE - ( ( rDiff + gDiff + bDiff ) * ONE_THIRD );

            if (( attractiveness > highest )
            &&  ( attractiveness > 0 )
            &&  ( st.age[o] > YOUNG_AGE_DURATION )
            &&  ( st.energy[o] > STARVING )
            &&  (( predator[o] > PREDATOR_LEVEL_THRESHOLD ) === iAmPredator )     // predators mate with predators only
            &&  accepts( st, o, s, environmentOn ))
            {
                highest = attractiveness;
                mate = o;
            }
        }
    }
    st.seenMate[s] = mate;
}

// does swimbot o accept swimbot s as a mate? (as Swimbot.acceptsMate)
function accepts( st: SharedState, o: number, s: number, environmentOn: boolean ): boolean
{
    if ( !environmentOn ) return true;
    const db = Math.abs( st.brightness[s] - st.brightness[o] );
    return pairRandom( s, o ) < mateAcceptance( db, st.choosiness[o] );
}
