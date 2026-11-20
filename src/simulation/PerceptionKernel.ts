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
import { areKin } from "./Kin";
import { currentAt, currentDriftX, currentDriftY, currentTravelFactor } from "./Currents";
import { CURRENT_AWARENESS_ENABLED, CURRENT_AWARE_MIN_SPEED } from "./Parameters";
import { biteEfficiency, biteForce } from "./PlantSize";
import { BITE_ENERGY, BITE_MARGIN, PLANT_MAX_TOUGHNESS, PLANT_SIZE_ENABLED, PLANT_SPROUT_ENERGY, PLANT_TREE_ENERGY, VISION_WEIGHT_BY_BITE_EFFICIENCY } from "./Parameters";
import { BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_PREY } from "./Brain";
import { IGNORE_FOOD_EFFICIENCY, mateAcceptance, pairRandom, preyVisibility, searchImageFactor } from "./Ecology";
import { PLANT_TYPE_WARM } from "./Environment";
import { ONE, ONE_THIRD } from "./MathConstants";
import { ATTACK_SUCCESS_CHANCE, ENVIRONMENT_ATTACK_SUCCESS_CHANCE, PREDATOR_LEVEL_THRESHOLD, PREY_MAX_MASS_RATIO, PREY_SCAN_COOLDOWN, SWIMBOT_MAX_ENERGY, PREDATION_ENERGY_TRANSFER, PREY_BODY_ENERGY, YOUNG_AGE_DURATION, PREDATOR_TARGET_SELECTION_ENABLED } from "./Parameters";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { ATTRACTION_SIMILAR_COLOR, STARVING, SWIMBOT_MOUTH_LENGTH, SWIMBOT_VIEW_RADIUS } from "./SwimbotTypes";
import { FOOD_BIT_GRAB_RADIUS } from "./FoodBit";
import { PROFILER_ENABLED, profEnter, profExit, PROF_PERCEIVE, PROF_PERC_SWIMBOTS, PROF_PERC_FOOD, PROF_PERC_OBSTRUCTED } from "./Profiler";
import { PREDATOR_DEFERENCE_ENABLED, KIN_NOT_EATEN_ENABLED, OLD_AGE_DURATION, WEAK_PREY_ENABLED, WEAK_STARVING_SHARE, JUVENILE_PREDATION_ENABLED, CROWD_AWARE_FOOD_CHOICE_ENABLED, FOOD_TARGET_PERSISTENCE_ENABLED, FOOD_SWITCH_RATIO_MIN, FOOD_KEEP_RADIUS_SCALE, SIZE_ASSORTATIVE_MATING_ENABLED } from "./Parameters";
import { M_CURRENT_W, M_DISEASE, M_WEAK_PREF, MIND_STRIDE, M_VIEW_RADIUS, M_GRAB_RADIUS, M_DEFERENCE, M_FOOD, M_PERSIST, M_MATE, M_MATURE_AGE, M_SIZE_PICKY, M_MAX_ENERGY } from "./MindLayout";
import { preyTargetScore } from "./EcologyGenes";
import {
    BACKGROUND_SIZE, PARAM_MAX_LIFESPAN, B_NUM_PARTS, B_GROWTH, B_VEL_X, B_VEL_Y, BOT_STRIDE, MAX_SEEN, PARAM_ENV_ACTIVE, PARAM_STEP, PARAM_CURRENT, PARAM_ENV_FIELDS, PARAM_FOOD_TYPES,
    PARAM_WALL_COUNT, PARAM_WALL_BASE, PARAM_WALL_MIN_X, PARAM_WALL_MAX_X, PARAM_WALL_MIN_Y, PARAM_WALL_MAX_Y,
    PARAM_SDF_READY, SDF_SIZE, SCENT_GRID_N, SharedState
} from "./SharedState";

export const STARVING_FOOD_CHOICE = 15;   // below this energy a swimbot eats anything
const TOUGHNESS_PER_WOOD = PLANT_MAX_TOUGHNESS / PLANT_TREE_ENERGY;

// the SDF geometry never changes during a run
const SDF_CELL_W = POOL_WIDTH  / SDF_SIZE;
const SDF_CELL_H = POOL_HEIGHT / SDF_SIZE;
const SDF_MARGIN = 0.5 * Math.sqrt( SDF_CELL_W * SDF_CELL_W + SDF_CELL_H * SDF_CELL_H );

// Octagonal norm: a cheap Euclidean approximation (within about 6%).
// Hot loops compare candidates, so no Math.sqrt is needed.
function fastDist( dx: number, dy: number ): number
{
    const ax = dx < 0 ? -dx : dx;
    const ay = dy < 0 ? -dy : dy;
    return ax > ay ? ( ax + 0.337 * ay ) : ( ay + 0.337 * ax );
}

const SCENT_CELL_W = POOL_WIDTH  / SCENT_GRID_N;
const SCENT_CELL_H = POOL_HEIGHT / SCENT_GRID_N;

//------------------------------------------------------------
// scratch arrays: one set per thread
//------------------------------------------------------------
export class PerceptionScratch
{
    readonly foodGridResult     : Int32Array;
    readonly nearbyIndices      : Int32Array;
    readonly predatorIndices    : Int32Array;   // compact list of hunting rivals
    readonly candidateIndices   : Int32Array;
    readonly candidateDistances : Float64Array;
    readonly nearestIndices     = new Int32Array  ( MAX_SEEN );
    readonly nearestDistances   = new Float64Array( MAX_SEEN );

    constructor( maxSwimbots: number, maxFoodBits: number )
    {
        this.foodGridResult     = new Int32Array  ( maxFoodBits * 2 );
        this.nearbyIndices      = new Int32Array  ( maxSwimbots );
        this.predatorIndices    = new Int32Array  ( maxSwimbots );
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

    // Keep the worst of the retained candidates at the root of a max-heap.
    // Unlike insertion into a sorted 20-element list, a new candidate moves
    // only O(log limit) entries. The comparator (including the index tie-break)
    // and the final ascending order are exactly the same as before.
    let kept = 0;
    for (let i = 0; i < count; i++)
    {
        const index = ci[i];
        const d     = cd[i];

        if ( kept < limit )
        {
            let j = kept++;
            while ( j > 0 )
            {
                const parent = ( j - 1 ) >> 1;
                if ( isCloser( d, index, nd[parent], ni[parent] )) break;
                ni[j] = ni[parent];
                nd[j] = nd[parent];
                j = parent;
            }
            ni[j] = index;
            nd[j] = d;
            continue;
        }

        if ( !isCloser( d, index, nd[0], ni[0] )) continue;
        let j = 0;
        while ( true )
        {
            const left = j * 2 + 1;
            if ( left >= limit ) break;
            const right = left + 1;
            let worst = left;
            if (( right < limit ) && isCloser( nd[left], ni[left], nd[right], ni[right] )) worst = right;
            if ( !isCloser( d, index, nd[worst], ni[worst] )) break;
            ni[j] = ni[worst];
            nd[j] = nd[worst];
            j = worst;
        }
        ni[j] = index;
        nd[j] = d;
    }

    // The consumers expect nearest-first order, not heap order.
    for (let i = 1; i < kept; i++)
    {
        const index = ni[i], d = nd[i];
        let j = i - 1;
        while (( j >= 0 ) && isCloser( d, index, nd[j], ni[j] ))
        {
            ni[j + 1] = ni[j];
            nd[j + 1] = nd[j];
            j--;
        }
        ni[j + 1] = index;
        nd[j + 1] = d;
    }
    return kept;
}

// is the line from (a0x, a0y) to (a1x, a1y) blocked by any of the walls?
// (no clock calls here: with 60 000 existences a step they cost more than the
//  segment test itself; the visibility loop is timed as a whole instead)
function obstructed( st: SharedState, a0x: number, a0y: number, a1x: number, a1y: number ): boolean
{
    const P = st.params;
    const count = P[ PARAM_WALL_COUNT ];
    if ( count <= 0 ) return false;

    // a sight line entirely on one side of the walls' bounding box is free
    if ( ( a0x < P[ PARAM_WALL_MIN_X ] && a1x < P[ PARAM_WALL_MIN_X ] )
      || ( a0x > P[ PARAM_WALL_MAX_X ] && a1x > P[ PARAM_WALL_MAX_X ] )
      || ( a0y < P[ PARAM_WALL_MIN_Y ] && a1y < P[ PARAM_WALL_MIN_Y ] )
      || ( a0y > P[ PARAM_WALL_MAX_Y ] && a1y > P[ PARAM_WALL_MAX_Y ] ) ) return false;

    const aX = a1x - a0x, aY = a1y - a0y;

    // Triangle inequality on the wall distance field: if both ends of the line
    // are farther from every wall than half the line is long, no wall can cross
    // it. Subtracting half a cell diagonal keeps the test conservative.
    if ( P[ PARAM_SDF_READY ] === 1 )
    {
        const sdf = st.wallSdf;
        const i0 = Math.max( 0, Math.min( SDF_SIZE - 1, Math.floor(( a0x - POOL_LEFT ) / SDF_CELL_W )));
        const j0 = Math.max( 0, Math.min( SDF_SIZE - 1, Math.floor(( a0y - POOL_TOP  ) / SDF_CELL_H )));
        const i1 = Math.max( 0, Math.min( SDF_SIZE - 1, Math.floor(( a1x - POOL_LEFT ) / SDF_CELL_W )));
        const j1 = Math.max( 0, Math.min( SDF_SIZE - 1, Math.floor(( a1y - POOL_TOP  ) / SDF_CELL_H )));
        const gap = ( sdf[ j0 * SDF_SIZE + i0 ] - SDF_MARGIN ) + ( sdf[ j1 * SDF_SIZE + i1 ] - SDF_MARGIN );
        if (( gap > 0 ) && ( gap * gap > aX * aX + aY * aY )) return false;
    }

    const aPerpX = -aY, aPerpY = aX;

    for ( let w = 0; w < count; w++ )
    {
        const p = PARAM_WALL_BASE + w * 4;
        const b0x = P[ p ], b0y = P[ p + 1 ];
        const b1x = P[ p + 2 ], b1y = P[ p + 3 ];

        const bX = b1x - b0x, bY = b1y - b0y;
        const bPerpX = -bY, bPerpY = bX;
        const a0b0x = b0x - a0x, a0b0y = b0y - a0y;
        const a0b1x = b1x - a0x, a0b1y = b1y - a0y;
        const b0a0x = a0x - b0x, b0a0y = a0y - b0y;
        const b0a1x = a1x - b0x, b0a1y = a1y - b0y;
        const a0Dotb0 = aPerpX * a0b0x + aPerpY * a0b0y;
        const a0Dotb1 = aPerpX * a0b1x + aPerpY * a0b1y;
        const b0Dota0 = bPerpX * b0a0x + bPerpY * b0a0y;
        const b0Dota1 = bPerpX * b0a1x + bPerpY * b0a1y;

        if (((( a0Dotb0 > 0 ) && ( a0Dotb1 < 0 )) || (( a0Dotb1 > 0 ) && ( a0Dotb0 < 0 )))
        &&  ((( b0Dota0 > 0 ) && ( b0Dota1 < 0 )) || (( b0Dota1 > 0 ) && ( b0Dota0 < 0 ))))
        {
            return true;
        }
    }

    return false;
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
// WEAK_PREY_ENABLED: old (its colour already darkening) or starving
function isWeak( st: SharedState, o: number ): boolean
{
    if ( st.eternal[o] === 1 ) return false;
    if ( st.mind[ o * MIND_STRIDE + M_DISEASE ] > 0 ) return true;          // sick (DISEASE_ENABLED)
    if ( st.age[o] > st.params[ PARAM_MAX_LIFESPAN ] - OLD_AGE_DURATION ) return true;
    return st.energy[o] < st.mind[ o * MIND_STRIDE + M_MAX_ENERGY ] * WEAK_STARVING_SHARE;
}

export function perceive( s: number, st: SharedState, sc: PerceptionScratch ): void
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_PERCEIVE ) : 0;
    try
    {
    const viewRadius            = st.mind[ s * MIND_STRIDE + M_VIEW_RADIUS ];   // (grows with mass when SIZE_SCALED_VISION_ENABLED)
    const viewRadiusSquared     = viewRadius * viewRadius;
    const preyViewRadius        = st.scanRadius[s];
    const predatorLevel         = st.predator[s];
    const myMass                = st.mass[s];
    const myBiteForce           = PLANT_SIZE_ENABLED ? biteForce( myMass ) : 0;
    const myX                   = st.botX[s];
    const myY                   = st.botY[s];
    const myGenitalX            = st.genitalX[s];
    const myGenitalY            = st.genitalY[s];
    const myMouthX              = st.mouthX[s];
    const myMouthY              = st.mouthY[s];
    const iAmPredator           = predatorLevel > PREDATOR_LEVEL_THRESHOLD;

    const botX = st.botX, botY = st.botY;   // the grid walks the original arrays
    const hot = st.botHot;   // [x, y, genitalX, genitalY] packed for cache locality
    const alive = st.alive, predator = st.predator;

    //------------------------------------------------------------------
    // everybody within the search radius (wider for a hunting predator)
    //------------------------------------------------------------------
    const profSwimT0 = PROFILER_ENABLED ? profEnter( PROF_PERC_SWIMBOTS ) : 0;
    const searchRadius = Math.min( 380, iAmPredator ? preyViewRadius : viewRadius );
    const nearby = sc.nearbyIndices;
    let numNearby = 0;
    // A dense cell can hold hundreds of bots while the brain keeps only
    // MAX_SEEN of them: sample it instead of copying every index.
    const numInCells = st.swimbotGrid.collect( myX, myY, searchRadius, nearby, botX, botY, 96 );

    // Keep the grid's order while removing this swimbot itself.
    for (let k = 0; k < numInCells; k++)
    {
        const o = nearby[k];
        if ( o !== s ) nearby[ numNearby ++ ] = o;
    }

    //------------------------------------------------------------------
    // the NEAREST swimbots within normal view, in order of distance
    //------------------------------------------------------------------
    let numCandidates = 0;
    // In a dense school hundreds of neighbours compete for MAX_SEEN = 20 slots.
    // Strided sampling keeps the work bounded (~64 candidates) without sorting
    // all of them; the nearest-first selection below is otherwise unchanged.
    const stride = numNearby > 96 ? Math.ceil( numNearby / 64 ) : 1;
    for (let i = 0; i < numNearby; i += stride)
    {
        const o = nearby[i];
        const h = o * 4;
        // the grid is rebuilt from live bots only, so no alive[] test is needed
        const dx = myGenitalX - hot[ h + 2 ];
        const dy = myGenitalY - hot[ h + 3 ];
        const distanceSquared = dx * dx + dy * dy;
        if ( distanceSquared < viewRadiusSquared )
        {
            sc.candidateIndices  [ numCandidates ] = o;
            sc.candidateDistances[ numCandidates ] = distanceSquared;
            numCandidates ++;
        }
    }

    let numNearest = selectNearestCandidates( numCandidates, MAX_SEEN, sc );
    let nearestList: Int32Array = sc.nearestIndices;

    for (let i = 0; i < numNearest; i++)
    {
        const o = sc.nearestIndices[i];
        const h = o * 4;
        if ( obstructed( st, myGenitalX, myGenitalY, hot[ h + 2 ], hot[ h + 3 ] ) && ( numCandidates > numNearest ))
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
    // one clock reading for the whole visibility loop instead of one per wall test
    const profObstructedT0 = PROFILER_ENABLED ? profEnter( PROF_PERC_OBSTRUCTED ) : 0;
    for (let i = 0; i < numNearest && numSeen < MAX_SEEN; i++)
    {
        const o = nearestList[i];
        const h = o * 4;
        if ( !obstructed( st, myGenitalX, myGenitalY, hot[ h + 2 ], hot[ h + 3 ] ))
        {
            st.seen[ seenBase + numSeen ] = o;
            numSeen ++;
            socialX += hot[h] - myX;
            socialY += hot[ h + 1 ] - myY;
        }
    }
    if ( PROFILER_ENABLED ) { profExit( PROF_PERC_OBSTRUCTED, profObstructedT0 ); }
    st.seenCount[s] = numSeen;
    st.socialX[s]   = socialX;
    st.socialY[s]   = socialY;
    if ( PROFILER_ENABLED ) { profExit( PROF_PERC_SWIMBOTS, profSwimT0 ); }

    const profFoodT0 = PROFILER_ENABLED ? profEnter( PROF_PERC_FOOD ) : 0;

    //------------------------------------------------------------------
    // the best food bit
    //------------------------------------------------------------------
    const environmentOn    = st.params[ PARAM_ENV_ACTIVE ] !== 0;
    const myEfficiencyWarm = environmentOn ? st.effWarm[s] : ONE;
    const myEfficiencyCold = environmentOn ? st.effCold[s] : ONE;
    const iAmStarving      = st.energy[s] < STARVING_FOOD_CHOICE;
    const twoFoodTypes     = st.params[ PARAM_FOOD_TYPES ] === 2;
    const preferredFoodType = st.preferred[s];
    // the plant/meat this bot is already after: a small loyalty bonus stops
    // the indicator flickering between two nearly equally good targets
    const currentFood      = st.mind[ s * MIND_STRIDE + M_FOOD ];
    const foodX = st.foodX, foodY = st.foodY, foodType = st.foodType, foodAlive = st.foodAlive;
    const botOffset = s * BOT_STRIDE;
    const bvx = st.bots[ botOffset + B_VEL_X ], bvy = st.bots[ botOffset + B_VEL_Y ];
    const swimSpeed = Math.max( 0.05, Math.sqrt( bvx * bvx + bvy * bvy ));

    // CURRENT_AWARENESS_ENABLED: the drift here. How the way along the stream
    // counts in choosing a target is a gene (-1 .. +1): + down the stream counts
    // as nearer, - up the stream does, 0 the stream is not noticed; founders
    // differ at random, selection decides
    const currentNow = st.params[ PARAM_CURRENT ];
    let awareness = ( CURRENT_AWARENESS_ENABLED && ( currentNow > 0 )) ? st.mind[ s * MIND_STRIDE + M_CURRENT_W ] : 0;
    let driftX = 0, driftY = 0;
    if ( awareness !== 0 )
    {
        currentAt( myX, myY );
        driftX = currentNow * currentDriftX(); driftY = currentNow * currentDriftY();
        if (( driftX === 0 ) && ( driftY === 0 )) awareness = 0;        // (still water here)
    }
    const ownSpeed = Math.max( CURRENT_AWARE_MIN_SPEED, swimSpeed );

    let chosenFood = -1;
    let smallestDistanceSquared = Number.MAX_SAFE_INTEGER;
    // AABB of the current best: candidates further out on any axis are skipped
    // before their distance, wood hardness or line of sight is evaluated.
    let bestDist = viewRadius;
    let bestDistSq = viewRadiusSquared;
    let bestMeatScore = -Infinity;
    let bestMeatBase = 0, bestMeatD = 0;   // only the chosen bait needs a distance
    const meatTravelWeight = st.preyTravelWeight[s];
    const meatRewardWeight = st.preyValueWeight[s];
    const meatBaitBias = st.preyBaitBias[s];
    const meatReach = swimSpeed * Math.max( 1, PREY_SCAN_COOLDOWN );
    let baitFound = false;
    let baitDistance = 0, baitReward = 0;
    // Search from the mouth with the same reach as before (body radius plus
    // mouth length and grab reach), then apply the normal view-radius test.
    const foodSearchRadius = viewRadius + SWIMBOT_MOUTH_LENGTH + st.mind[ s * MIND_STRIDE + M_GRAB_RADIUS ];
    // the grid is rebuilt only every 4 steps; +16 covers the small drift of
    // sprouts and new extras until the next rebuild
    const numFoodInCells = st.foodGrid.collect( myMouthX, myMouthY, foodSearchRadius + 16, sc.foodGridResult );

    for (let k = 0; k < numFoodInCells; k++)
    {
        const f  = sc.foodGridResult[k];
        const dx = foodX[f] - myMouthX, dy = foodY[f] - myMouthY;
        if (( dx >= bestDist ) || ( dx <= -bestDist ) || ( dy >= bestDist ) || ( dy <= -bestDist )) continue;
        const viewDistanceSquared = dx * dx + dy * dy;
        if (( viewDistanceSquared >= bestDistSq ) && ( viewDistanceSquared >= smallestDistanceSquared )) continue;
        const fx = foodX[f] - myX;
        const fy = foodY[f] - myY;
        const type = foodType[f];
        const bodyDistanceSquared = fx * fx + fy * fy;
        if ( type === 2 )
        {
            if ( viewDistanceSquared >= viewRadiusSquared ) continue;
        }
        else if ( bodyDistanceSquared >= viewRadiusSquared ) continue;

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
        if ( PLANT_SIZE_ENABLED && VISION_WEIGHT_BY_BITE_EFFICIENCY && ( type !== 2 )
        &&   ( myBiteForce <= Math.min( PLANT_MAX_TOUGHNESS, st.foodWood[f] * TOUGHNESS_PER_WOOD ) )) continue;

        if ( type === 2 && foodAlive[f] === 1 && PREDATOR_TARGET_SELECTION_ENABLED )
        {
            const room = Math.max( 0, st.mind[ s * MIND_STRIDE + M_MAX_ENERGY ] - st.energy[s] );
            const loyalty = ( f === currentFood ) ? 1.30 : 1;
            const reward = Math.min( room, st.foodEnergy[f] ) / SWIMBOT_MAX_ENERGY * loyalty;
            const base = reward * meatRewardWeight;
            // score = base - bias - travel * min(1, fastDist/reach).
            // Compare candidates by squared distance; the octagonal distance
            // is computed only when a candidate actually becomes the best one.
            let better = false;
            if ( bestMeatScore === -Infinity ) better = true;
            else if ( meatTravelWeight > 0 )
            {
                const bestChase = Math.min( 1, bestMeatD / meatReach );
                const threshold = bestChase + ( base - bestMeatBase ) / meatTravelWeight;
                better = threshold > 1 || ( threshold > 0 && viewDistanceSquared < threshold * threshold * meatReach * meatReach );
            }
            else better = base > bestMeatBase;

            if ( better && !obstructed( st, myMouthX, myMouthY, foodX[f], foodY[f] ))
            {
                const distance = fastDist( dx, dy );
                const distanceCost = distance / Math.max( 1, viewRadius );
                const chaseCost = Math.min( 1, distance / meatReach );
                const score = preyTargetScore( reward, chaseCost, meatRewardWeight, meatTravelWeight, meatBaitBias, true );
                bestMeatScore = score;
                bestMeatBase = base;
                bestMeatD = distance;
                // keep a margin: the octagonal norm may be slightly shorter
                // than the true Euclidean reach of the shrinking AABB filter
                bestDist = distance * 1.02;
                bestDistSq = viewDistanceSquared;
                baitFound = true;
                chosenFood = f;
                baitDistance = distanceCost;
                baitReward = reward;
            }
            continue;
        }

        // in the environment, better food counts as nearer
        if ( environmentOn && ( type !== 2 ))
        {
            if ( viewDistanceSquared >= viewRadiusSquared ) continue;
            const e = ( type === PLANT_TYPE_WARM ) ? myEfficiencyWarm : myEfficiencyCold;
            const e2 = e * e;
            const loyalty2 = ( f === currentFood && foodAlive[f] === 1 ) ? 1.69 : 1;   // 1.30²
            // (worth <= 5 and e <= 1: beyond that reach this plant can no longer win)
            if ( viewDistanceSquared >= smallestDistanceSquared * 25 * e2 * loyalty2 ) continue;
            let scaled = viewDistanceSquared / ( e2 * loyalty2 );
            if ( PLANT_SIZE_ENABLED )
            {
                const tough = Math.min( PLANT_MAX_TOUGHNESS, st.foodWood[f] * TOUGHNESS_PER_WOOD );
                if ( myBiteForce <= tough ) continue;
                const eff = Math.min( 1, ( myBiteForce - tough ) / BITE_MARGIN );
                const bite = Math.min( st.foodEnergy[f], BITE_ENERGY * myBiteForce * eff );
                const worth = Math.min( 5, Math.max( 0.2, bite / PLANT_SPROUT_ENERGY ));
                scaled /= worth * worth;
            }
            if ( awareness !== 0 )
            {
                const k = currentTravelFactor( driftX, driftY, foodX[f] - myMouthX, foodY[f] - myMouthY, ownSpeed, awareness );
                scaled *= k * k;
            }
            if ( scaled >= smallestDistanceSquared || foodAlive[f] !== 1 ) continue;
            if ( CROWD_AWARE_FOOD_CHOICE_ENABLED )
            {
                let rivals = 0;
                for (let i = 0; i < numSeen; i++)
                {
                    const o = st.seen[ seenBase + i ];
                    if ( predator[o] > PREDATOR_LEVEL_THRESHOLD ) continue;
                    const ox = st.mouthX[o] - foodX[f], oy = st.mouthY[o] - foodY[f];
                    if ( ox * ox + oy * oy < viewDistanceSquared ) rivals ++;
                }
                if ( rivals > 0 )
                {
                    const k = 1 + st.mind[ s * MIND_STRIDE + M_DEFERENCE ] * rivals;
                    scaled *= k * k;
                }
            }
            if ( scaled < smallestDistanceSquared && !obstructed( st, myMouthX, myMouthY, foodX[f], foodY[f] ))
            {
                smallestDistanceSquared = scaled;
                bestDist = fastDist( dx, dy ) * 1.02;
                bestDistSq = viewDistanceSquared;
                chosenFood = f;
            }
            continue;
        }

        const loyalty2 = ( f === currentFood && foodAlive[f] === 1 ) ? 1.69 : 1;
        if ( viewDistanceSquared < viewRadiusSquared && viewDistanceSquared < loyalty2 * smallestDistanceSquared && foodAlive[f] === 1 )
        {
            if ( !obstructed( st, myMouthX, myMouthY, foodX[f], foodY[f] ))
            {
                smallestDistanceSquared = viewDistanceSquared / loyalty2;
                bestDist = fastDist( dx, dy ) * 1.02;
                bestDistSq = viewDistanceSquared;
                chosenFood = f;
            }
        }
    }
    //------------------------------------------------------------------
    // keep the plant I am already after, unless another one is clearly
    // nearer (how clearly: the gene "persistence"); otherwise the target
    // jumped every look and most chases were never finished
    //------------------------------------------------------------------
    if ( FOOD_TARGET_PERSISTENCE_ENABLED && !iAmPredator )
    {
        const current = st.mind[ s * MIND_STRIDE + M_FOOD ];
        if (( current >= 0 ) && ( current !== chosenFood ) && ( foodAlive[ current ] === 1 ) && ( foodType[ current ] !== 2 )
        &&  ( !PLANT_SIZE_ENABLED || !VISION_WEIGHT_BY_BITE_EFFICIENCY || ( biteEfficiency( myMass, st.foodWood[current] ) > 0 ))
        &&  !obstructed( st, myMouthX, myMouthY, foodX[ current ], foodY[ current ] ))
        {
            const cx = myMouthX - foodX[ current ], cy = myMouthY - foodY[ current ];
            const currentSquared = cx * cx + cy * cy;
            if ( currentSquared < FOOD_KEEP_RADIUS_SCALE * FOOD_KEEP_RADIUS_SCALE * viewRadiusSquared )   // (a plant once chosen is kept a little beyond sight)
            {
                let newSquared = Infinity;
                if ( chosenFood >= 0 ) { const nx = myMouthX - foodX[ chosenFood ], ny = myMouthY - foodY[ chosenFood ]; newSquared = nx * nx + ny * ny; }
                const ratio = 1 - ( 1 - FOOD_SWITCH_RATIO_MIN ) * st.mind[ s * MIND_STRIDE + M_PERSIST ];
                if ( newSquared >= ratio * ratio * currentSquared ) { chosenFood = current; }
            }
        }
    }

    st.seenFood[s] = chosenFood;
    st.targetBaitPresent[s] = baitFound ? 1 : 0;
    st.targetBaitDistance[s] = baitDistance;
    st.targetBaitReward[s] = baitReward;
    if ( PROFILER_ENABLED ) { profExit( PROF_PERC_FOOD, profFoodT0 ); }

    //------------------------------------------------------------------
    // prey (predators only): the nearest herbivore it can notice
    //------------------------------------------------------------------
    let chosenPrey = -1;
    if ( iAmPredator )
    {
        const imageStrength = st.imageStrength[s];
        const imageR = st.imageR[s], imageG = st.imageG[s], imageB = st.imageB[s], imageSize = st.imageSize[s];
        let bestPreyValue = -Infinity;
        let bestPreyReward = 0, bestPreyDistance = 0, bestPreySuccess = 0, bestPreyChase = 0;
        const attackChance = environmentOn ? ENVIRONMENT_ATTACK_SUCCESS_CHANCE : ATTACK_SUCCESS_CHANCE;
        const preyRadiusSq = preyViewRadius * preyViewRadius;

        // One compact pass over the rivals, instead of rescanning every neighbour
        // once for every possible prey (the old O(N*K²) innermost loop).
        let numPredators = 0;
        if ( PREDATOR_DEFERENCE_ENABLED )
        {
            const pi = sc.predatorIndices;
            for (let j = 0; j < numNearby; j++)
            {
                const q = nearby[j];
                if (( alive[q] === 1 ) && ( predator[q] > PREDATOR_LEVEL_THRESHOLD ) && ( q !== s )) pi[ numPredators ++ ] = q;
            }
        }

        for (let i = 0; i < numNearby; i++)
        {
            const o = nearby[i];
            if ( alive[o] === 0 ) continue;
            if ( predator[o] > PREDATOR_LEVEL_THRESHOLD ) continue;      // predators don't hunt predators
            if ( st.eternal[o] === 1 ) continue;                        // immortals are not eaten
            // too big to bite (a not yet grown-up one can be bitten anyway)
            const young = JUVENILE_PREDATION_ENABLED && ( st.age[o] < st.mind[ o * MIND_STRIDE + M_MATURE_AGE ] );
            // WEAK_PREY_ENABLED: old or starving prey can be taken whatever its size
            const weak = WEAK_PREY_ENABLED && isWeak( st, o );
            if (( st.mass[o] > myMass * PREY_MAX_MASS_RATIO ) && !young && !weak ) continue;

            const h = o * 4;
            const px = myMouthX - hot[h];
            const py = myMouthY - hot[ h + 1 ];
            const distSq = px * px + py * py;
            if ( !weak && ( distSq > preyRadiusSq )) continue;   // the common case needs no square root
            const realDistance = fastDist( px, py );             // octagonal, no Math.sqrt
            // (a predator that prefers the weak - its gene - sees them as nearer)
            let distance = weak ? realDistance / ( 1 + 2 * st.mind[ s * MIND_STRIDE + M_WEAK_PREF ] ) : realDistance;
            if ( distance > preyViewRadius ) continue;

            // PREDATOR_DEFERENCE_ENABLED: other hunters nearer to this prey make it
            // look farther (the same deference gene as with plants): many hunters
            // get in each other's way, so they do not eat the prey out all at once
            if ( PREDATOR_DEFERENCE_ENABLED )
            {
                let rivals = 0;
                const realDistanceSq = realDistance * realDistance;
                for (let j = 0; j < numPredators; j++)
                {
                    const q = sc.predatorIndices[j];
                    const qx = st.mouthX[q] - hot[h];
                    if ( Math.abs( qx ) >= realDistance ) continue;   // cheap reject before the square
                    const qy = st.mouthY[q] - hot[ h + 1 ];
                    if ( qx * qx + qy * qy < realDistanceSq ) rivals ++;
                }
                distance *= 1 + st.mind[ s * MIND_STRIDE + M_DEFERENCE ] * rivals;
            }
            if ( distance > preyViewRadius ) continue;
            if ( obstructed( st, myMouthX, myMouthY, hot[h], hot[ h + 1 ] )) continue;   // (no seeing through the wall)
            // Kinship is pure and comparatively costly: check it only after the
            // cheap distance, size and visibility tests have accepted the prey.
            if ( KIN_NOT_EATEN_ENABLED && areKin( st, s, o )) continue;   // not my parent, child, brother or sister

            // camouflage: prey that matches the bottom is seen only up close;
            // the search image: prey like the last meals is seen from farther
            if ( environmentOn )
            {
                const image = searchImageFactor( imageStrength,
                    st.colorR[o] - imageR, st.colorG[o] - imageG, st.colorB[o] - imageB, st.sizeSignature[o] - imageSize );
                if ( distance > preyViewRadius * image * preyVisibility( st.brightness[o], backgroundAt( st, hot[h], hot[ h + 1 ] ))) continue;
            }

            // (the way down the stream is shorter in time: the gene "feel for the current")
            const travel = ( awareness !== 0 ) ? distance * currentTravelFactor( driftX, driftY, hot[h] - myMouthX, hot[ h + 1 ] - myMouthY, ownSpeed, awareness ) : distance;
            let value = -travel + st.energy[o] * 0.001;
            if ( PREDATOR_TARGET_SELECTION_ENABLED )
            {
                const room = Math.max( 0, st.mind[ s * MIND_STRIDE + M_MAX_ENERGY ] - st.energy[s] );
                const potential = st.energy[o] * PREDATION_ENERGY_TRANSFER + st.mass[o] * PREY_BODY_ENERGY;
                const reward = Math.min( room, potential ) / SWIMBOT_MAX_ENERGY;
                const distanceCost = distance / Math.max( 1, preyViewRadius );
                const chaseCost = Math.min( 1, travel / swimSpeed / Math.max( 1, PREY_SCAN_COOLDOWN ));
                value = preyTargetScore( reward * attackChance, chaseCost, st.preyValueWeight[s],
                                         st.preyTravelWeight[s], st.preyBaitBias[s], false );
                if ( value > bestPreyValue )
                {
                    bestPreyReward = reward;
                    bestPreyDistance = distanceCost;
                    bestPreySuccess = attackChance;
                    bestPreyChase = chaseCost;
                }
            }
            if ( value > bestPreyValue )
            {
                bestPreyValue = value;
                chosenPrey = o;
            }
        }
        if ( PREDATOR_TARGET_SELECTION_ENABLED )
        {
            st.targetPreyReward[s] = bestPreyReward;
            st.targetPreyDistance[s] = bestPreyDistance;
            st.targetPreySuccess[s] = bestPreySuccess;
            st.targetPreyChase[s] = bestPreyChase;
            if ( bestMeatScore > bestPreyValue ) chosenPrey = -1;
            else if ( chosenPrey >= 0 && chosenFood >= 0 && foodType[ chosenFood ] === 2 )
            {
                chosenFood = -1;
                st.seenFood[s] = -1;
            }
        }
    }
    else
    {
        st.targetPreyReward[s] = st.targetPreyDistance[s] = st.targetPreySuccess[s] = st.targetPreyChase[s] = 0;
    }
    st.seenPrey[s] = chosenPrey;

    //------------------------------------------------------------------
    // the nearest hunting predator (herbivores only)
    //------------------------------------------------------------------
    // (all predators within view count, not only the nearest few swimbots:
    //  in a crowd a predator was easily "not seen")
    let threat = -1, anyPredator = -1;
    const iAmYoung = JUVENILE_PREDATION_ENABLED && ( st.age[s] < st.mind[ s * MIND_STRIDE + M_MATURE_AGE ] );
    const iAmWeak  = WEAK_PREY_ENABLED && isWeak( st, s );
    if ( !iAmPredator )
    {
        let threatDistanceSq = Infinity, anyDistanceSq = Infinity;
        for (let i = 0; i < numNearby; i++)
        {
            const o = nearby[i];
            if ( alive[o] === 0 ) continue;
            if ( predator[o] <= PREDATOR_LEVEL_THRESHOLD ) continue;

            // a predator that could not eat me (I am too heavy for it, and not
            // young any more) is no danger to me: the same rule it hunts by
            if ( !iAmYoung && !iAmWeak && ( st.mass[s] > st.mass[o] * PREY_MAX_MASS_RATIO )) continue;

            const h = o * 4;
            const gx = myGenitalX - hot[ h + 2 ];
            const gy = myGenitalY - hot[ h + 3 ];
            const distanceSq = gx * gx + gy * gy;   // squares keep the order, no square root needed
            if ( distanceSq > viewRadiusSquared ) continue;
            if ( obstructed( st, myGenitalX, myGenitalY, hot[ h + 2 ], hot[ h + 3 ] )) continue;   // (no seeing through the wall)

            if ( distanceSq < anyDistanceSq ) { anyDistanceSq = distanceSq; anyPredator = o; }

            // the danger is a hunting predator (a fed one is calmer)
            const state = st.brainState[o];
            if (( state !== BRAIN_STATE_LOOKING_FOR_PREY ) && ( state !== BRAIN_STATE_PURSUING_PREY )) continue;
            if ( distanceSq < threatDistanceSq ) { threatDistanceSq = distanceSq; threat = o; }
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
        const currentMate = st.mind[ s * MIND_STRIDE + M_MATE ];
        // keep an already chosen partner a little beyond the normal view,
        // so its indicator does not flicker at the edge of the search circle
        let keepMate = false;
        if (( currentMate >= 0 ) && ( st.liveSwimbot[currentMate] === 1 ))
        {
            const h = currentMate * 4;
            const mx = myGenitalX - hot[ h + 2 ];
            const my = myGenitalY - hot[ h + 3 ];
            keepMate = fastDist( mx, my ) < viewRadius * 1.25;
        }
        const scoreMate = ( o: number ): number =>
        {
            const rDiff = Math.abs( r[o] - r[s] );
            const gDiff = Math.abs( g[o] - g[s] );
            const bDiff = Math.abs( b[o] - b[s] );
            let attractiveness = ONE - ( ( rDiff + gDiff + bDiff ) * ONE_THIRD );
            if ( SIZE_ASSORTATIVE_MATING_ENABLED )
            {
                // how much a similar size counts: my own gene
                const w = st.mind[ s * MIND_STRIDE + M_SIZE_PICKY ];
                // (the form: size and number of parts)
                const massSimilarity  = ONE - Math.min( ONE, Math.abs( Math.log( Math.max( 1, st.mass[o] ) / Math.max( 1, st.mass[s] ))) / 1.5 );
                const partsSimilarity = ONE - Math.min( ONE, Math.abs( st.bots[ o * BOT_STRIDE + B_NUM_PARTS ] - st.bots[ s * BOT_STRIDE + B_NUM_PARTS ] ) / 8 );
                const sizeSimilarity  = 0.5 * ( massSimilarity + partsSimilarity );
                attractiveness = ( ONE - w ) * attractiveness + w * sizeSimilarity;
            }
            if ( st.brainState[o] !== BRAIN_STATE_FLEEING_PREDATOR ) attractiveness *= 1.05;
            return attractiveness;
        };
        const mateIsEligible = ( o: number ): boolean =>
        {
            return ( st.age[o] > st.mind[ o * MIND_STRIDE + M_MATURE_AGE ] )
                && ( st.bots[ o * BOT_STRIDE + B_GROWTH ] >= ONE )                 // (grown up: a stunted body does not mate)
                && ( st.energy[o] > STARVING )
                && (( predator[o] > PREDATOR_LEVEL_THRESHOLD ) === iAmPredator )  // predators mate with predators only
                && accepts( st, o, s, environmentOn );
        };
        for (let i = 0; i < numSeen; i++)
        {
            const o = st.seen[ seenBase + i ];
            let attractiveness = scoreMate( o );
            // Hysteresis: a partner already chosen keeps a clear bonus, so
            // score jitter cannot swap the indicator to a nearby candidate.
            if ( keepMate && ( o === currentMate )) attractiveness *= 1.40;
            if (( attractiveness > highest ) && ( attractiveness > 0 ) && mateIsEligible( o ))
            {
                highest = attractiveness;
                mate = o;
            }
        }
        // The old partner may be just outside the normal view circle; give
        // it the same bonus so it is not dropped at the boundary.
        if ( keepMate && ( mate !== currentMate ) && mateIsEligible( currentMate ))
        {
            const attractiveness = scoreMate( currentMate ) * 1.40;
            if (( attractiveness > highest ) && ( attractiveness > 0 ))
            {
                highest = attractiveness;
                mate = currentMate;
            }
        }
    }
    st.seenMate[s] = mate;

    //------------------------------------------------------------------
    // Fast central difference on the 64x64 fields: four neighbour reads,
    // then the same exponential smoothing as before. Food for a hungry
    // herbivore, prey for a hunter, the density of its own trophic level
    // while looking for a mate, away from danger while fleeing.
    //------------------------------------------------------------------
    const stateNow = st.brainState[s];
    let field: Float32Array;
    let sign = ONE;
    if ( stateNow === BRAIN_STATE_FLEEING_PREDATOR ) { field = st.predField; sign = -ONE; }
    else if ( stateNow === BRAIN_STATE_LOOKING_FOR_MATE ) { field = iAmPredator ? st.predField : st.preyField; }
    else if ( iAmPredator )                          { field = st.preyField; }
    else                                             { field = st.foodField; }
    const ix = Math.max( 1, Math.min( SCENT_GRID_N - 2, Math.floor(( myX - POOL_LEFT ) / SCENT_CELL_W )));
    const iy = Math.max( 1, Math.min( SCENT_GRID_N - 2, Math.floor(( myY - POOL_TOP  ) / SCENT_CELL_H )));
    const fidx = iy * SCENT_GRID_N + ix;
    let gx = sign * ( field[ fidx + 1 ] - field[ fidx - 1 ] );
    let gy = sign * ( field[ fidx + SCENT_GRID_N ] - field[ fidx - SCENT_GRID_N ] );
    const glen = Math.sqrt( gx * gx + gy * gy );
    if ( glen > 1e-5 ) { gx /= glen; gy /= glen; } else { gx = 0; gy = 0; }
    if (( gx === 0 ) && ( gy === 0 ))
    {
        st.scentGradX[s] *= 0.75;
        st.scentGradY[s] *= 0.75;
    }
    else
    {
        st.scentGradX[s] += 0.25 * ( gx - st.scentGradX[s] );
        st.scentGradY[s] += 0.25 * ( gy - st.scentGradY[s] );
    }
    }
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_PERCEIVE, profT0 ); } }
}

// does swimbot o accept swimbot s as a mate? (as Swimbot.acceptsMate)
function accepts( st: SharedState, o: number, s: number, environmentOn: boolean ): boolean
{
    if ( !environmentOn ) return true;
    const db = Math.abs( st.brightness[s] - st.brightness[o] );
    return pairRandom( s, o ) < mateAcceptance( db, st.choosiness[o] );
}
