//------------------------------------------------------------------------------
// Decision kernel (stage 7, part 3): what a swimbot's brain does in a step,
// working only on the shared arrays (SharedState) - so it can run in any
// thread, like the physics (PhysicsKernel.ts) and the looking around
// (PerceptionKernel.ts).
//
//   decideStep   - the start of a step: age, the neural brain thinking, the
//                  brain state, "am I close enough to eat / bite / mate",
//                  which way to swim, and the climate's energy drain
//                  (was Swimbot.decide, think, applyClimateDrain)
//   prepareLook  - after the physics: does it look around this step
//                  (was the middle part of GenePool.updateSwimbotsInPhases)
//   takeInLook   - after looking around: what it saw becomes its targets
//                  (was GenePool.applyPerception, Swimbot.setEnvironmentalStimuli)
//
// A swimbot writes only its own rows. Things that change other objects
// (growing a part back, dropping or eating a part, choosing a mate by other
// criteria than color) are left for the main thread as bits in M_EVENTS.
// Random numbers come from each swimbot's own generator (st.random), so the
// result does not depend on the number of threads.
//------------------------------------------------------------------------------
import { areKin } from "./Kin";
import { FILTER_FEEDING_ENABLED, FILTER_FEEDING_PERIOD, FILTER_FEEDING_REACH } from "./Parameters";
import { plantMatureAge } from "./PlantGenes";
import * as SS from "./SharedState";
import { SharedState } from "./SharedState";
import { BRAIN_FOCUS_TARGET_SHIFT_STRENGTH, BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD, BRAIN_SENSORY_UPDATE_PERIOD, BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_FOOD,
         BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_FOOD, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY,
         BRAIN_STATE_SELF_FEED, BRAIN_WANDER_AMOUNT, brainUpdate } from "./Brain";
import { BRAIN_SIZE, NUM_HIDDEN, NUM_INPUTS, NUM_OUTPUTS, DRIVE_OUTPUTS, THINK_PERIOD, DRIVE_HYSTERESIS, EFFORT_MIN, EFFORT_RANGE, STEER_MAX_DEGREES,
         IN_BIAS, IN_HUNGER, IN_ENERGY, IN_AGE, IN_FIT, IN_TREND, IN_FOOD, IN_MATE, IN_THREAT, IN_PREY, IN_CROWD, IN_PREDATOR,
         IN_FOOD_SIDE, IN_FOOD_AHEAD, IN_NEAR_SIDE, IN_NEAR_AHEAD, IN_THREAT_SIDE, IN_THREAT_AHEAD, IN_KIN, IN_SEASON, IN_PREDATOR_NEAR,
         IN_PREY_DISTANCE, IN_PREY_REWARD, IN_PREY_SUCCESS, IN_PREY_CHASE, IN_BAIT_PRESENT, IN_BAIT_DISTANCE, IN_BAIT_REWARD, IN_CURRENT_AHEAD, IN_CURRENT_SIDE,
         OUT_FOOD, OUT_MATE, OUT_FLEE, OUT_HUNT, OUT_CLIMATE, OUT_SOCIAL, OUT_EFFORT, OUT_STEER, OUT_SELF_EAT, OUT_PREY_VALUE, OUT_PREY_TRAVEL, OUT_PREY_BAIT,
         think, sigmoid } from "./NeuralBrain";
import { biteEnergy } from "./PlantSize";
import { currentAt, currentDriftX, currentDriftY, currentStrength } from "./Currents";
import { CURRENT_AWARENESS_ENABLED, CURRENT_SPEED, CURRENT_TRIGGER_CHANGE_MIN, CURRENT_TRIGGER_CHANGE_MAX } from "./Parameters";
import { PLANT_SIZE_ENABLED } from "./Parameters";
import { CANNIBAL_GENE_THRESHOLD, KIN_NOT_EATEN_ENABLED, ONLY_GROWN_EAT_YOUNG_ENABLED, EVENT_DRIVEN_LOOK_ENABLED, EVENT_CALM_LOOK_PERIOD, EVENT_CALM_MIN_DISTANCE, DESPERATE_CANNIBALISM_ENABLED, DESPERATE_ENERGY_SHARE, CANNIBAL_PREY_MASS_SHARE, DESPERATE_PREY_MASS_SHARE, LIMBS_CATCH_YOUNG_ENABLED, YOUNG_CANNIBALISM_ENABLED, BITE_AT_CONTACT_ENABLED, CONTACT_EATING_ENABLED, AUTOTOMY_DECOY_SPAN, CLIMATE_PROBE_DISTANCE, CLIMATE_STEERING, SOCIAL_STEERING, BODY_TEMPERATURE_INERTIA_ENABLED, SELF_CANNIBALISM_ENABLED,
         PREDATOR_TARGET_SELECTION_ENABLED, PREDATOR_FLEE_RADIUS, PREDATOR_LEVEL_THRESHOLD, PREY_SCAN_COOLDOWN, PREY_SCAN_RADIUS_GROWTH,
         PREY_SCAN_RADIUS_MAX_SCALE, PREDATOR_VISION_SCALE, SWIMBOT_MAX_ENERGY, BITE_ALONG_PARTS_ENABLED } from "./Parameters";
import { thermalFit, EMERGENCY_PROBE_DISTANCE, EMERGENCY_THERMAL_FIT, KINESIS_MAX_TURN, KINESIS_PERIOD, KINESIS_TURN_CHANCE,
         SEARCH_IMAGE_FORGETTING, THERMAL_FIT_UPDATE_PERIOD, THERMAL_MISMATCH_DRAIN, THERMOMELANISM } from "./Ecology";
import { advanceBodyTemperature } from "./ThermalPhysics";
import { FIELD_SIZE, PLANT_CELL_SIZE, SEASON_PERIOD, SEASON_AMPLITUDE_EQUATOR, SEASON_AMPLITUDE_POLES } from "./Environment";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { MAX_PARTS, NULL_PART, SWIMBOT_GENITAL_LENGTH, SWIMBOT_MOUTH_LENGTH, SWIMBOT_VIEW_RADIUS } from "./SwimbotTypes";
import { FOOD_BIT_GRAB_RADIUS } from "./FoodBit";
import { PROFILER_ENABLED, profEnter, profExit, PROF_DECIDE_STEP, PROF_NEURAL_THINK, PROF_EDIBLE_FOOD } from "./Profiler";
import { transferToAtmosphere } from "./EnergyBudget";

const PI_OVER_180 = Math.PI / 180;

//------------------------------------------------------------------------------
// each swimbot's own random numbers (mulberry32)
//------------------------------------------------------------------------------
export function seedRandom( st: SharedState, s: number, seed: number ): void { st.random[s] = seed >>> 0; }

export function botRandom( st: SharedState, s: number ): number
{
    let t = ( st.random[s] = ( st.random[s] + 0x6D2B79F5 ) >>> 0 );
    t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
    t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
    return (( t ^ ( t >>> 14 )) >>> 0 ) / 4294967296;
}

//------------------------------------------------------------------------------
// the environment, from the shared copies (as Environment.temperatureAt)
//------------------------------------------------------------------------------
export function temperatureAt( st: SharedState, x: number, y: number ): number
{
    const P = st.params;
    if ( P[ SS.PARAM_ENV_FIELDS ] !== 1 ) return 0.5;

    const fx = ( x - POOL_LEFT ) / ( POOL_RIGHT  - POOL_LEFT ) * FIELD_SIZE - 0.5;
    const fy = ( y - POOL_TOP  ) / ( POOL_BOTTOM - POOL_TOP  ) * FIELD_SIZE - 0.5;
    let i = Math.floor( fx ), j = Math.floor( fy );
    const ax = fx - i, ay = fy - j;
    const i0 = Math.min( FIELD_SIZE - 1, Math.max( 0, i     ));
    const i1 = Math.min( FIELD_SIZE - 1, Math.max( 0, i + 1 ));
    const j0 = Math.min( FIELD_SIZE - 1, Math.max( 0, j     ));
    const j1 = Math.min( FIELD_SIZE - 1, Math.max( 0, j + 1 ));
    const f = st.temperature;
    const base = ( f[ j0 * FIELD_SIZE + i0 ] * ( 1 - ax ) + f[ j0 * FIELD_SIZE + i1 ] * ax ) * ( 1 - ay )
               + ( f[ j1 * FIELD_SIZE + i0 ] * ( 1 - ax ) + f[ j1 * FIELD_SIZE + i1 ] * ax ) * ay;

    const latitude  = Math.abs( (( y - POOL_TOP ) / ( POOL_BOTTOM - POOL_TOP )) * 2 - 1 );
    const amplitude = ( P[ SS.PARAM_PETRI ] === 1 ) ? 0 : SEASON_AMPLITUDE_EQUATOR + ( SEASON_AMPLITUDE_POLES - SEASON_AMPLITUDE_EQUATOR ) * latitude;
    const t = base + amplitude * Math.sin( 2 * Math.PI * P[ SS.PARAM_TIME ] / SEASON_PERIOD );
    return t < 0 ? 0 : ( t > 1 ? 1 : t );
}

function seasonPhase( st: SharedState ): number { return Math.sin( 2 * Math.PI * st.params[ SS.PARAM_TIME ] / SEASON_PERIOD ); }

function plantCell( x: number, y: number ): number
{
    const c = Math.min( SS.PLANT_COLUMNS - 1, Math.max( 0, Math.floor( ( x - POOL_LEFT ) / PLANT_CELL_SIZE )));
    const r = Math.min( SS.PLANT_ROWS    - 1, Math.max( 0, Math.floor( ( y - POOL_TOP  ) / PLANT_CELL_SIZE )));
    return r * SS.PLANT_COLUMNS + c;
}

// the temperature a swimbot feels at a point (dark bodies feel warmer)
function feltTemperature( st: SharedState, s: number, x: number, y: number ): number
{
    return temperatureAt( st, x, y ) + THERMOMELANISM * ( 1 - 2 * st.brightness[s] );
}

function bodyTemperature( st: SharedState, s: number ): number
{
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    return ( BODY_TEMPERATURE_INERTIA_ENABLED && M[ m + SS.M_BODY_TEMP_SET ] === 1 )
        ? M[ m + SS.M_BODY_TEMP ]
        : feltTemperature( st, s, B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ] );
}

function updateThermalFit( st: SharedState, s: number ): void
{
    const M = st.mind, m = s * SS.MIND_STRIDE;
    M[ m + SS.M_THERMAL_FIT ] = ( st.params[ SS.PARAM_ENV_ACTIVE ] === 1 )
        ? thermalFit( bodyTemperature( st, s ), M[ m + SS.M_THERMAL_OPT ], M[ m + SS.M_THERMAL_WIDTH ] )
        : 1;
}

function updateBodyTemperature( st: SharedState, s: number, stepScale = 1 ): void
{
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    const ambient = feltTemperature( st, s, B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ] );
    const sumLengths = B[ b + SS.B_SUM_LENGTHS ];
    const meanBodyWidth = sumLengths > 0 ? st.mass[s] / sumLengths : 0;
    // Wide, heavy shells take longer to warm up or cool down: their thermal
    // inertia lets them forage across a sharper temperature boundary.
    const inertiaScale = ( st.mass[s] / Math.max( 1, sumLengths ) > 4.2 ) ? 0.70 : 1;
    if ( !BODY_TEMPERATURE_INERTIA_ENABLED )
    {
        M[ m + SS.M_BODY_TEMP ] = ambient;
        M[ m + SS.M_BODY_TEMP_SET ] = 0;
        return;
    }
    if ( M[ m + SS.M_BODY_TEMP_SET ] !== 1 )
    {
        M[ m + SS.M_BODY_TEMP ] = advanceBodyTemperature( ambient, ambient, st.mass[s], meanBodyWidth );
        M[ m + SS.M_BODY_TEMP_SET ] = 1;
    }
    else
    {
        const previousTemp = M[ m + SS.M_BODY_TEMP ];
        const nextTemp = advanceBodyTemperature( previousTemp, ambient, st.mass[s], meanBodyWidth );
        // one update every four steps: stretch the step, never overshoot
        const mix = Math.min( 1, inertiaScale * stepScale );
        M[ m + SS.M_BODY_TEMP ] = previousTemp + ( nextTemp - previousTemp ) * mix;
    }
}

//------------------------------------------------------------------------------
// little helpers on the rows
//------------------------------------------------------------------------------
const _touchBuffer = new Int32Array( 4096 );

// a food bit this swimbot can eat, touching its mouth (-1: none)
function edibleFoodAtMouth( st: SharedState, s: number, mouthX: number, mouthY: number ): number
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_EDIBLE_FOOD ) : 0;
    try
    {
    const meatEater = isPredator( st, s );
    const EAT_RADIUS = SWIMBOT_MOUTH_LENGTH + st.mind[ s * SS.MIND_STRIDE + SS.M_GRAB_RADIUS ];
    const eatR2 = EAT_RADIUS * EAT_RADIUS;
    const n = st.foodGrid.collect( mouthX, mouthY, EAT_RADIUS, _touchBuffer );
    for (let i = 0; i < n; i++)
    {
        const f = _touchBuffer[i];
        if ( st.liveFood[f] !== 1 ) continue;
        if (( st.foodType[f] === 2 ) !== meatEater ) continue;
        const dx = st.foodX[f] - mouthX, dy = st.foodY[f] - mouthY;
        if ( dx * dx + dy * dy >= eatR2 ) continue;
        if ( PLANT_SIZE_ENABLED && !meatEater && ( biteEnergy( st.mass[s], st.foodWood[f], st.foodEnergy[f] ) <= 0 )) continue;
        return f;
    }
    return -1;
    }
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_EDIBLE_FOOD, profT0 ); } }
}

// FILTER_FEEDING_ENABLED: a sprout (a plant not yet grown up) that one of
// the limbs (parts from 2 on; part 1 carries the mouth) brushes, or -1
function sproutAtLimbs( st: SharedState, s: number ): number
{
    const numParts = st.bots[ s * SS.BOT_STRIDE + SS.B_NUM_PARTS ];
    const o = s * SS.PART_STRIDE, w = s * MAX_PARTS;
    const step = st.params[ SS.PARAM_STEP ];
    for (let k = 2; k < numParts; k++)
    {
        const reach = st.partWidth[ w + k ] + FILTER_FEEDING_REACH;
        const x = st.parts[ o + k * SS.PS + SS.M_X ], y = st.parts[ o + k * SS.PS + SS.M_Y ];
        const n = st.foodGrid.collect( x, y, reach, _touchBuffer );
        for (let i = 0; i < n; i++)
        {
            const f = _touchBuffer[i];
            if (( st.liveFood[f] !== 1 ) || ( st.foodType[f] === 2 )) continue;
            if ( step - st.foodBorn[f] >= plantMatureAge( f )) continue;      // grown up: too tough for a sieve
            const dx = st.foodX[f] - x, dy = st.foodY[f] - y;
            if ( dx * dx + dy * dy < reach * reach ) return f;
        }
    }
    return -1;
}

// LIMBS_CATCH_YOUNG_ENABLED: does any of my limb ends touch a part of p?
function limbsTouchBody( st: SharedState, s: number, p: number ): boolean
{
    const n = st.bots[ s * SS.BOT_STRIDE + SS.B_NUM_PARTS ];
    const o = s * SS.PART_STRIDE, w = s * MAX_PARTS;
    for (let k = 2; k < n; k++)
    {
        const x = st.parts[ o + k * SS.PS + SS.P_X ], y = st.parts[ o + k * SS.PS + SS.P_Y ];
        if ( mouthTouchesBody( st, s, p, x, y )) return true;   // (same reach rule, from the limb's end)
    }
    return false;
}

// is the mouth at any part of swimbot p? Each part is a capsule from its
// parent's end to its own end; the mouth touches it when it is nearer to that
// line than the mouth length plus the part's width (anywhere along it, not
// only at the ends and the middle)
function mouthTouchesBody( st: SharedState, s: number, p: number, mouthX: number, mouthY: number ): boolean
{
    const numParts = st.bots[ p * SS.BOT_STRIDE + SS.B_NUM_PARTS ];
    const o = p * SS.PART_STRIDE, w = p * MAX_PARTS;
    // Raptorial front appendages (claws / mandibles) extend the grab reach.
    const mouthReach = SWIMBOT_MOUTH_LENGTH * ( 1 + 0.10 * st.frontAppendages[s] );
    for (let k = 0; k < numParts; k++)
    {
        const i = o + k * SS.PS;
        const reach = mouthReach + st.partWidth[ w + k ];
        const bx = st.parts[ i + SS.P_X ], by = st.parts[ i + SS.P_Y ];
        const parent = st.partParent[ w + k ];
        let ax = bx, ay = by;
        if ( parent === NULL_PART ) { ax = st.bots[ p * SS.BOT_STRIDE + SS.B_POS_X ]; ay = st.bots[ p * SS.BOT_STRIDE + SS.B_POS_Y ]; }
        else if ( parent >= 0 )     { ax = st.parts[ o + parent * SS.PS + SS.P_X ]; ay = st.parts[ o + parent * SS.PS + SS.P_Y ]; }
        // the nearest point of the segment a-b to the mouth
        const sx = bx - ax, sy = by - ay, len2 = sx * sx + sy * sy;
        let t = len2 > 0 ? (( mouthX - ax ) * sx + ( mouthY - ay ) * sy ) / len2 : 0;
        t = t < 0 ? 0 : ( t > 1 ? 1 : t );
        if ( !BITE_ALONG_PARTS_ENABLED ) { t = ( t < 0.75 ) ? 0.5 : 1; }     // (the old rule: the middle or the end)
        const dx = ax + t * sx - mouthX, dy = ay + t * sy - mouthY;
        if ( dx * dx + dy * dy < reach * reach ) return true;
    }
    return false;
}

function isPredator( st: SharedState, s: number ): boolean { return st.predator[s] > PREDATOR_LEVEL_THRESHOLD; }

function normalize( B: Float64Array, k: number ): void
{
    const x = B[k], y = B[k + 1];
    const length = Math.sqrt( x * x + y * y );
    if ( length > 0 ) { B[k] = x / length; B[k + 1] = y / length; }
    else              { B[k] = 1;          B[k + 1] = 0;          }
}

// Rational approximation of the logistic function inside the range the neural
// outputs normally occupy. Outside it, the exact sigmoid keeps the tails sane.
function fastSigmoid( x: number ): number
{
    if ( x < -9 || x > 9 ) return sigmoid( x );
    const x2 = x * x;
    return 0.5 + 0.5 * (( 0.5 * x ) * ( 27 + 0.25 * x2 ) / ( 27 + 2.25 * x2 ));
}

// the direction to the goal = from (fromX, fromY) to (toX, toY), normalized
function aim( B: Float64Array, b: number, toX: number, toY: number, fromX: number, fromY: number ): void
{
    B[ b + SS.B_GOAL_X ] = toX - fromX;
    B[ b + SS.B_GOAL_Y ] = toY - fromY;
    normalize( B, b + SS.B_GOAL_X );
}

//------------------------------------------------------------------------------
// kinesis ("run and tumble"): see Swimbot history; compare how good it is
// here with how good it was, and maybe turn
//------------------------------------------------------------------------------
function kinesis( st: SharedState, s: number ): void
{
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    updateThermalFit( st, s );

    const px = B[ b + SS.B_POS_X ], py = B[ b + SS.B_POS_Y ];
    const fit = M[ m + SS.M_THERMAL_FIT ];

    if ( fit < EMERGENCY_THERMAL_FIT )
    {
        const gx = B[ b + SS.B_GOAL_X ], gy = B[ b + SS.B_GOAL_Y ];
        const length = Math.sqrt( gx * gx + gy * gy );
        let dx = ( length > 0 ) ? gx / length : 1;
        let dy = ( length > 0 ) ? gy / length : 0;
        let bestFit = -1, bestX = dx, bestY = dy;
        for (let k = 0; k < 4; k++)
        {
            const f = thermalFit( feltTemperature( st, s, px + dx * EMERGENCY_PROBE_DISTANCE, py + dy * EMERGENCY_PROBE_DISTANCE ),
                                  M[ m + SS.M_THERMAL_OPT ], M[ m + SS.M_THERMAL_WIDTH ] );
            if ( f > bestFit ) { bestFit = f; bestX = dx; bestY = dy; }
            const t = dx; dx = -dy; dy = t;   // turn 90 degrees
        }
        B[ b + SS.B_GOAL_X ] = bestX;
        B[ b + SS.B_GOAL_Y ] = bestY;
        M[ m + SS.M_COMFORT ] = -1;
        return;
    }

    const cell = plantCell( px, py );
    const food = ( st.plantWarm[ cell ] * st.effWarm[s] + st.plantCold[ cell ] * st.effCold[s] ) / 6;
    const comfort = ( 0.05 + fit * M[ m + SS.M_THERMAL_PEAK ] ) * ( 0.05 + food );
    const previous = M[ m + SS.M_COMFORT ];

    M[ m + SS.M_COMFORT_TREND ] = ( previous < 0 ) ? 0 : ( comfort > previous ? 1 : ( comfort < previous ? -1 : 0 ));

    if (( previous >= 0 ) && ( comfort < previous ) && ( botRandom( st, s ) < KINESIS_TURN_CHANCE ))
    {
        const turn = ( -1 + 2 * botRandom( st, s )) * KINESIS_MAX_TURN * PI_OVER_180;
        const c = Math.cos( turn ), sn = Math.sin( turn );
        const x = B[ b + SS.B_GOAL_X ], y = B[ b + SS.B_GOAL_Y ];
        B[ b + SS.B_GOAL_X ] = x * c - y * sn;
        B[ b + SS.B_GOAL_Y ] = x * sn + y * c;
    }

    M[ m + SS.M_COMFORT ] = comfort;
}

function wanderFocus( st: SharedState, s: number ): void
{
    const B = st.bots, b = s * SS.BOT_STRIDE;
    if (( st.params[ SS.PARAM_ENV_ACTIVE ] === 1 ) && ((( B[ b + SS.B_AGE ] + st.mind[ s * SS.MIND_STRIDE + SS.M_INDEX ] ) % KINESIS_PERIOD ) === 0 ))
    {
        kinesis( st, s );
    }

    let gx = B[ b + SS.B_GOAL_X ], gy = B[ b + SS.B_GOAL_Y ];
    let length = Math.sqrt( gx * gx + gy * gy );
    if ( length === 0 )
    {
        gx = -0.5 + botRandom( st, s );
        gy = -0.5 + botRandom( st, s );
        length = Math.sqrt( gx * gx + gy * gy );
    }
    gx += ( -BRAIN_WANDER_AMOUNT * 0.5 + botRandom( st, s ) * BRAIN_WANDER_AMOUNT );
    gy += ( -BRAIN_WANDER_AMOUNT * 0.5 + botRandom( st, s ) * BRAIN_WANDER_AMOUNT );
    B[ b + SS.B_GOAL_X ] = gx / length;
    B[ b + SS.B_GOAL_Y ] = gy / length;
}

//------------------------------------------------------------------------------
// one thought of the neural brain (was Swimbot.think)
//------------------------------------------------------------------------------
const _newHidden = new Float64Array( NUM_HIDDEN );

export function neuralThink( st: SharedState, s: number ): void
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_NEURAL_THINK ) : 0;
    try
    {
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    const energy    = B[ b + SS.B_ENERGY ];
    const hunger    = M[ m + SS.M_HUNGER ];
    const predator  = M[ m + SS.M_PRED_LEVEL ] > PREDATOR_LEVEL_THRESHOLD;
    const nearPred  = M[ m + SS.M_NEAR_PRED ], calmPred = M[ m + SS.M_CALM_PRED ];
    const threat    = ( nearPred >= 0 ) || ( calmPred >= 0 );
    const xi = s * NUM_INPUTS, x = st.nnInputs;

    x[ xi + IN_BIAS     ] = 1;
    x[ xi + IN_HUNGER   ] = Math.max( -1, Math.min( 1, ( hunger - energy ) / Math.max( 1, hunger )));
    x[ xi + IN_ENERGY   ] = Math.min( 2, energy / 100 );
    x[ xi + IN_AGE      ] = B[ b + SS.B_AGE ] / st.params[ SS.PARAM_MAX_LIFESPAN ];
    x[ xi + IN_FIT      ] = M[ m + SS.M_THERMAL_FIT ];
    x[ xi + IN_TREND    ] = M[ m + SS.M_COMFORT_TREND ];
    x[ xi + IN_FOOD     ] = M[ m + SS.M_SEEN_FOOD ];
    x[ xi + IN_MATE     ] = ( M[ m + SS.M_NUM_SEEN ] > 0 ) ? 1 : 0;
    x[ xi + IN_THREAT   ] = M[ m + SS.M_THREAT_CLOSE ];
    x[ xi + IN_PREDATOR_NEAR ] = M[ m + SS.M_PRED_CLOSE ];
    x[ xi + IN_PREY     ] = M[ m + SS.M_SEEN_PREY ];
    x[ xi + IN_CROWD    ] = Math.min( 1, M[ m + SS.M_NUM_SEEN ] / 10 );
    x[ xi + IN_PREDATOR ] = predator ? 1 : 0;

    // directions, as the swimbot sees them (heading as in the physics)
    const radian   = B[ b + SS.B_ANGLE ] * PI_OVER_180;
    const headingX = Math.sin( radian ), headingY = Math.cos( radian );
    const px = B[ b + SS.B_POS_X ], py = B[ b + SS.B_POS_Y ];
    const toward = ( tx: number, ty: number, sideIndex: number, aheadIndex: number ) =>
    {
        let dx = tx - px, dy = ty - py;
        const length = Math.sqrt( dx * dx + dy * dy );
        if ( length <= 0 ) { x[ xi + sideIndex ] = 0; x[ xi + aheadIndex ] = 0; return; }
        dx /= length; dy /= length;
        x[ xi + aheadIndex ] = dx * headingX + dy * headingY;
        x[ xi + sideIndex  ] = dx * headingY - dy * headingX;
    };
    x[ xi + IN_FOOD_SIDE ] = x[ xi + IN_FOOD_AHEAD ] = x[ xi + IN_NEAR_SIDE ] = x[ xi + IN_NEAR_AHEAD ] = 0;
    x[ xi + IN_THREAT_SIDE ] = x[ xi + IN_THREAT_AHEAD ] = x[ xi + IN_KIN ] = 0;
    if ( M[ m + SS.M_SEEN_FOOD ] === 1 ) { toward( M[ m + SS.M_SEEN_FOOD_X ], M[ m + SS.M_SEEN_FOOD_Y ], IN_FOOD_SIDE, IN_FOOD_AHEAD ); }
    const nearest = M[ m + SS.M_NEAREST_SEEN ];
    if ( nearest >= 0 )
    {
        toward( st.botX[ nearest ], st.botY[ nearest ], IN_NEAR_SIDE, IN_NEAR_AHEAD );
        const difference = ( Math.abs( st.colorR[ nearest ] - st.colorR[s] ) + Math.abs( st.colorG[ nearest ] - st.colorG[s] ) + Math.abs( st.colorB[ nearest ] - st.colorB[s] )) / 3;
        x[ xi + IN_KIN ] = 1 - difference;
    }
    if ( threat )
    {
        const p = (( nearPred >= 0 ) ? nearPred : calmPred ) * SS.BOT_STRIDE;
        toward( B[ p + SS.B_POS_X ], B[ p + SS.B_POS_Y ], IN_THREAT_SIDE, IN_THREAT_AHEAD );
    }
    x[ xi + IN_SEASON ] = ( st.params[ SS.PARAM_ENV_ACTIVE ] === 1 ) ? seasonPhase( st ) : 0;
    // the water around it (CURRENT_AWARENESS_ENABLED): only a feeling - how to use it, the weights decide
    x[ xi + IN_CURRENT_AHEAD ] = x[ xi + IN_CURRENT_SIDE ] = 0;
    if ( CURRENT_AWARENESS_ENABLED && ( st.params[ SS.PARAM_CURRENT ] > 0 ))
    {
        currentAt( px, py );
        const flow = st.params[ SS.PARAM_CURRENT ] / CURRENT_SPEED;
        const dx = currentDriftX() * flow, dy = currentDriftY() * flow;
        x[ xi + IN_CURRENT_AHEAD ] = dx * headingX + dy * headingY;
        x[ xi + IN_CURRENT_SIDE  ] = dx * headingY - dy * headingX;
    }

    const w = st.brainWeights.subarray( s * BRAIN_SIZE, ( s + 1 ) * BRAIN_SIZE );
    const inputs  = st.nnInputs.subarray( xi, xi + NUM_INPUTS );
    const hidden  = st.nnHidden.subarray( s * NUM_HIDDEN, ( s + 1 ) * NUM_HIDDEN );
    const outputs = st.nnOutputs.subarray( s * NUM_OUTPUTS, ( s + 1 ) * NUM_OUTPUTS );
    think( w, inputs, hidden, _newHidden, outputs );

    // These outputs stay unchanged until the next thought, so their transfer
    // functions are needed only here, not on every intervening step.
    st.preyValueWeight [s] = fastSigmoid( outputs[ OUT_PREY_VALUE ] );
    st.preyTravelWeight[s] = fastSigmoid( outputs[ OUT_PREY_TRAVEL ] );
    st.preyBaitBias    [s] = Math.tanh( outputs[ OUT_PREY_BAIT ] );
    st.preyChoiceReady [s] = 1;

    //------------------------------------------------------
    // the strongest possible drive wins (the current goal
    // gets a small bonus so the swimbot doesn't dither)
    //------------------------------------------------------
    const current = M[ m + SS.M_GOAL ];
    let best = OUT_MATE, bestValue = -Infinity;
    for ( const d of DRIVE_OUTPUTS )
    {
        if (( d === OUT_SELF_EAT ) && !canSelfFeed( st, s )) continue;
        if (( d === OUT_FLEE ) && ( !threat || predator )) continue;   // nothing to flee from
        if (( d === OUT_HUNT ) && !predator ) continue;                // only predators hunt
        if (( d === OUT_FOOD ) && predator ) continue;                 // predators don't eat plants
        const value = outputs[d] + ( d === current ? DRIVE_HYSTERESIS : 0 );
        if ( value > bestValue ) { bestValue = value; best = d; }
    }
    M[ m + SS.M_GOAL ] = best;

    //------------------------------------------------------
    // how to move
    //------------------------------------------------------
    const envActive = st.params[ SS.PARAM_ENV_ACTIVE ] === 1;
    B[ b + SS.B_EFFORT ]      = EFFORT_MIN + EFFORT_RANGE * sigmoid( outputs[ OUT_EFFORT ] );
    M[ m + SS.M_STEER ]       = Math.tanh( outputs[ OUT_STEER ] ) * STEER_MAX_DEGREES * PI_OVER_180;
    M[ m + SS.M_SOCIAL_W ]    = Math.tanh( outputs[ OUT_SOCIAL ] );
    const climateWeight       = envActive ? sigmoid( outputs[ OUT_CLIMATE ] ) : 0;
    M[ m + SS.M_CLIMATE_W ]   = climateWeight;

    if ( climateWeight > 0.05 )
    {
        // which way does the temperature suit me better?
        const d = CLIMATE_PROBE_DISTANCE, opt = M[ m + SS.M_THERMAL_OPT ], width = M[ m + SS.M_THERMAL_WIDTH ];
        const gx = thermalFit( feltTemperature( st, s, px + d, py ), opt, width ) - thermalFit( feltTemperature( st, s, px - d, py ), opt, width );
        const gy = thermalFit( feltTemperature( st, s, px, py + d ), opt, width ) - thermalFit( feltTemperature( st, s, px, py - d ), opt, width );
        const length = Math.sqrt( gx * gx + gy * gy );
        M[ m + SS.M_CLIMATE_X ] = ( length > 1e-4 ) ? gx / length : 0;
        M[ m + SS.M_CLIMATE_Y ] = ( length > 1e-4 ) ? gy / length : 0;
    }
    else
    {
        M[ m + SS.M_CLIMATE_X ] = M[ m + SS.M_CLIMATE_Y ] = 0;
    }
    }
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_NEURAL_THINK, profT0 ); } }
}

function canSelfFeed( st: SharedState, s: number ): boolean
{
    const M = st.mind, m = s * SS.MIND_STRIDE;
    return SELF_CANNIBALISM_ENABLED && ( st.params[ SS.PARAM_ENV_ACTIVE ] === 1 ) && ( M[ m + SS.M_PARTS_LOST ] !== 1 )
        && ( M[ m + SS.M_PHENO_PARTS ] > 4 ) && ( st.bots[ s * SS.BOT_STRIDE + SS.B_ENERGY ] < M[ m + SS.M_MAX_ENERGY ] );
}

//------------------------------------------------------------------------------
// the start of a step (was Swimbot.decide + writeTargetChoiceState +
// applyClimateDrain)
//------------------------------------------------------------------------------
export function decideStep( st: SharedState, s: number, counters: number ): void
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_DECIDE_STEP ) : 0;
    try
    {
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    const random = () => botRandom( st, s );

    M[ m + SS.M_TRY_EAT  ] = 0;
    M[ m + SS.M_TRY_HUNT ] = 0;
    B[ b + SS.B_DEATHS   ] = 0;

    const f = M[ m + SS.M_FOOD ], mate = M[ m + SS.M_MATE ];
    const foodAlive = ( f >= 0 ) && ( st.liveFood[f] === 1 );
    const meatAlive = foodAlive && ( st.foodType[f] === 2 );
    const mateAlive = ( mate >= 0 ) && ( st.liveSwimbot[ mate ] === 1 );

    // age
    const age = ++ B[ b + SS.B_AGE ];
    const index = M[ m + SS.M_INDEX ];

    // a dropped part grows back after a while, if I can pay for it (main thread)
    if ( M[ m + SS.M_PARTS_LOST ] === 1 )
    {
        M[ m + SS.M_REGROW ] --;
        if (( M[ m + SS.M_REGROW ] <= 0 ) && ( B[ b + SS.B_ENERGY ] > M[ m + SS.M_HUNGER ] + M[ m + SS.M_AUTOTOMY_LOSS ] ))
        {
            M[ m + SS.M_EVENTS ] |= SS.EVENT_REGROW;
        }
    }

    // a predator's search image fades
    if ( st.imageStrength[s] > 0 ) { st.imageStrength[s] *= SEARCH_IMAGE_FORGETTING; }

    if ( M[ m + SS.M_HUNT_CD ] > 0 ) { M[ m + SS.M_HUNT_CD ] --; }

    if ( !EVENT_DRIVEN_LOOK_ENABLED )
    {
        if ( age % BRAIN_SENSORY_UPDATE_PERIOD == 0 ) { M[ m + SS.M_READY ] = 1; }
    }
    else
    {
        // look when it is due, or at once when something changed
        const stateBefore = M[ m + SS.M_STATE ];
        let due = ( age >= M[ m + SS.M_NEXT_LOOK ] ) || ( M[ m + SS.M_NEXT_LOOK ] > age + 4 * EVENT_CALM_LOOK_PERIOD );   // (the second: a row left from another body)
        if ( !due && ( stateBefore !== M[ m + SS.M_LAST_LOOK_STATE ] )) { due = true; }
        if ( !due && (( stateBefore === BRAIN_STATE_PURSUING_FOOD ) && !foodAlive )) { due = true; }
        if ( !due && (( stateBefore === BRAIN_STATE_PURSUING_MATE ) && !mateAlive )) { due = true; }
        // CURRENT_AWARENESS_ENABLED: the water around it changed (it came into a
        // stream or out of it) - look around anew; a high "feel" notices a small change
        let felt = 0;
        const currentOn = CURRENT_AWARENESS_ENABLED && ( st.params[ SS.PARAM_CURRENT ] > 0 );
        if ( currentOn )
        {
            currentAt( B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ] );
            felt = currentStrength();
            const need = CURRENT_TRIGGER_CHANGE_MAX - ( CURRENT_TRIGGER_CHANGE_MAX - CURRENT_TRIGGER_CHANGE_MIN ) * Math.abs( M[ m + SS.M_CURRENT_W ] );
            if ( !due && ( Math.abs( felt - M[ m + SS.M_LAST_CURRENT ] ) > need )) { due = true; }
        }
        if ( due )
        {
            M[ m + SS.M_LAST_CURRENT ] = felt;
            M[ m + SS.M_READY ] = 1;
            M[ m + SS.M_LAST_LOOK_STATE ] = stateBefore;
            // steady and calm: far target that is still there, no predator seen
            let calm = false;
            if ( st.seenThreat[s] < 0 )
            {
                const mx = B[ b + SS.B_MOUTH_X ], my = B[ b + SS.B_MOUTH_Y ];
                const calmRadiusSq = EVENT_CALM_MIN_DISTANCE * EVENT_CALM_MIN_DISTANCE;
                if (( stateBefore === BRAIN_STATE_PURSUING_FOOD ) && foodAlive )
                {
                    const cx = st.foodX[f] - mx, cy = st.foodY[f] - my;
                    calm = cx * cx + cy * cy > calmRadiusSq;
                }
                else if (( stateBefore === BRAIN_STATE_PURSUING_MATE ) && mateAlive )
                {
                    const cx = st.genitalX[ mate ] - B[ b + SS.B_GENITAL_X ], cy = st.genitalY[ mate ] - B[ b + SS.B_GENITAL_Y ];
                    calm = cx * cx + cy * cy > calmRadiusSq;
                }
            }
            M[ m + SS.M_NEXT_LOOK ] = age + ( calm ? EVENT_CALM_LOOK_PERIOD : BRAIN_SENSORY_UPDATE_PERIOD );
        }
    }

    // neural brain: think now and then
    if (( M[ m + SS.M_NEURAL ] === 1 ) && ((( age + index ) % THINK_PERIOD ) === 0 )) { neuralThink( st, s ); }

    // brain
    M[ m + SS.M_BRAIN_ENERGY ] = B[ b + SS.B_ENERGY ];
    brainUpdate( M, m, random );
    const state = M[ m + SS.M_STATE ];

    if ( M[ m + SS.M_SELF_FEED_CD ] > 0 ) M[ m + SS.M_SELF_FEED_CD ] --;
    if (( state === BRAIN_STATE_SELF_FEED ) && ( M[ m + SS.M_SELF_FEED_CD ] === 0 ))
    {
        M[ m + SS.M_EVENTS ] |= SS.EVENT_SELF_FEED;
        M[ m + SS.M_SELF_FEED_CD ] = THINK_PERIOD;
    }

    if (( state === BRAIN_STATE_PURSUING_PREY ) && meatAlive)
    {
        if ( f !== M[ m + SS.M_LAST_MEAT ] ) st.counters[ counters + SS.K_MEAT_TARGETS_PURSUING ] ++;
        M[ m + SS.M_LAST_MEAT ] = f;
    }
    else if ( state !== BRAIN_STATE_PURSUING_PREY ) { M[ m + SS.M_LAST_MEAT ] = -1; }

    const mouthX = B[ b + SS.B_MOUTH_X ], mouthY = B[ b + SS.B_MOUTH_Y ];
    const prey = M[ m + SS.M_PREY ];
    const preyValid = ( prey >= 0 ) && ( st.liveSwimbot[ prey ] === 1 );

    //-------------------------------------------------
    // close enough to eat, mate or bite?
    //-------------------------------------------------
    if ( state === BRAIN_STATE_PURSUING_FOOD )
    {
        if ( foodAlive )
        {
            const xx = st.foodX[f] - mouthX, yy = st.foodY[f] - mouthY;
            const r = SWIMBOT_MOUTH_LENGTH + M[ m + SS.M_GRAB_RADIUS ];
            if ( xx * xx + yy * yy < r * r ) { M[ m + SS.M_TRY_EAT ] = 1; }
        }
    }
    else if ( state === BRAIN_STATE_PURSUING_MATE )
    {
        if ( mateAlive )
        {
            const xx = st.genitalX[ mate ] - B[ b + SS.B_GENITAL_X ], yy = st.genitalY[ mate ] - B[ b + SS.B_GENITAL_Y ];
            if ( xx * xx + yy * yy < SWIMBOT_GENITAL_LENGTH * SWIMBOT_GENITAL_LENGTH ) { M[ m + SS.M_TRY_MATE ] = 1; }
        }
    }
    else if ( state === BRAIN_STATE_PURSUING_PREY )
    {
        // meat it touches while pursuing prey is eaten first
        const meatX = f >= 0 ? st.foodX[f] - mouthX : 0, meatY = f >= 0 ? st.foodY[f] - mouthY : 0;
        if ( meatAlive && ( Math.sqrt( meatX * meatX + meatY * meatY ) < SWIMBOT_MOUTH_LENGTH + M[ m + SS.M_GRAB_RADIUS ] ))
        {
            M[ m + SS.M_TRY_EAT ] = 1;
        }
        else if ( preyValid && ( M[ m + SS.M_HUNT_CD ] === 0 ))
        {
            if ( BITE_AT_CONTACT_ENABLED )
            {
                // the mouth must be at one of the prey's body parts
                if ( mouthTouchesBody( st, s, prey, mouthX, mouthY )) { M[ m + SS.M_TRY_HUNT ] = 1; }
            }
            else
            {
                const p = prey * SS.BOT_STRIDE;
                const biteDistance = SWIMBOT_MOUTH_LENGTH * ( 1 + 0.10 * st.frontAppendages[s] ) + B[ p + SS.B_SUM_LENGTHS ] * 0.5;
                const xx = B[ p + SS.B_POS_X ] - mouthX, yy = B[ p + SS.B_POS_Y ] - mouthY;
                if ( Math.sqrt( xx * xx + yy * yy ) < biteDistance ) { M[ m + SS.M_TRY_HUNT ] = 1; }
            }
        }
    }
    else if ( state === BRAIN_STATE_LOOKING_FOR_PREY )
    {
        // a hungry predator with no prey in sight eats meat it sees
        if ( meatAlive)
        {
            const xx = st.foodX[f] - mouthX, yy = st.foodY[f] - mouthY;
            if ( Math.sqrt( xx * xx + yy * yy ) < SWIMBOT_MOUTH_LENGTH + M[ m + SS.M_GRAB_RADIUS ] ) { M[ m + SS.M_TRY_EAT ] = 1; }
        }
    }

    //-------------------------------------------------
    // the mouth touches something edible: eat it, whatever the brain is
    // doing (fleeing, looking for a mate...), unless already full
    //-------------------------------------------------
    if ( CONTACT_EATING_ENABLED && ( M[ m + SS.M_TRY_EAT ] !== 1 ) && ( B[ b + SS.B_ENERGY ] < M[ m + SS.M_MAX_ENERGY ] ))
    {
        const touched = edibleFoodAtMouth( st, s, mouthX, mouthY );
        if ( touched >= 0 ) { M[ m + SS.M_FOOD ] = touched; M[ m + SS.M_TRY_EAT ] = 1; }
    }

    //-------------------------------------------------
    // FILTER_FEEDING_ENABLED: a limb brushes a sprout (now and then)
    //-------------------------------------------------
    M[ m + SS.M_FILTER_FOOD ] = -1;
    if ( FILTER_FEEDING_ENABLED && !isPredator( st, s ) && (( st.params[ SS.PARAM_STEP ] + s ) % FILTER_FEEDING_PERIOD === 0 )
    &&   ( B[ b + SS.B_ENERGY ] < M[ m + SS.M_MAX_ENERGY ] ))
    {
        M[ m + SS.M_FILTER_FOOD ] = sproutAtLimbs( st, s );
    }

    //-------------------------------------------------
    // YOUNG_CANNIBALISM_ENABLED: a hungry herbivore bites the young one of
    // its kind (fewer body parts) it is after, when its mouth reaches it
    //-------------------------------------------------
    if ( YOUNG_CANNIBALISM_ENABLED && ( M[ m + SS.M_CANNIBAL ] === 1 ) && ( M[ m + SS.M_TRY_HUNT ] !== 1 ) && ( M[ m + SS.M_TRY_EAT ] !== 1 ))
    {
        const young = M[ m + SS.M_PREY ];
        if (( young >= 0 ) && ( st.liveSwimbot[ young ] === 1 ) && ( M[ m + SS.M_HUNT_CD ] === 0 )
        &&  ( mouthTouchesBody( st, s, young, mouthX, mouthY ) || ( LIMBS_CATCH_YOUNG_ENABLED && limbsTouchBody( st, s, young ))))
        {
            M[ m + SS.M_TRY_HUNT ] = 1;
        }
    }

    //-------------------------------------------------
    // the direction to the goal
    //-------------------------------------------------
    if ( state === BRAIN_STATE_LOOKING_FOR_PREY )
    {
        if ( meatAlive) { aim( B, b, st.foodX[f], st.foodY[f], mouthX, mouthY ); }
        else                              { wanderFocus( st, s ); }
    }
    else if ( state === BRAIN_STATE_PURSUING_PREY )
    {
        if ( preyValid ) { const p = prey * SS.BOT_STRIDE; aim( B, b, B[ p + SS.B_POS_X ], B[ p + SS.B_POS_Y ], mouthX, mouthY ); }
    }
    else if ( state === BRAIN_STATE_FLEEING_PREDATOR )
    {
        const nearPred = M[ m + SS.M_NEAR_PRED ];
        const danger = ( nearPred >= 0 ) ? nearPred : M[ m + SS.M_CALM_PRED ];
        if (( danger >= 0 ) && ( st.liveSwimbot[ danger ] === 1 ))
        {
            // swim directly away from the predator
            const d = danger * SS.BOT_STRIDE;
            aim( B, b, B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ], B[ d + SS.B_POS_X ], B[ d + SS.B_POS_Y ] );
        }
    }
    else if ((( state === BRAIN_STATE_LOOKING_FOR_FOOD ) || ( state === BRAIN_STATE_PURSUING_FOOD )) && ( M[ m + SS.M_CANNIBAL ] === 1 ) && ( M[ m + SS.M_PREY ] >= 0 ) && ( st.liveSwimbot[ M[ m + SS.M_PREY ] ] === 1 ))
    {
        const p = M[ m + SS.M_PREY ] * SS.BOT_STRIDE;
        aim( B, b, B[ p + SS.B_POS_X ], B[ p + SS.B_POS_Y ], mouthX, mouthY );
    }
    else if (( state === BRAIN_STATE_LOOKING_FOR_FOOD ) || ( state === BRAIN_STATE_LOOKING_FOR_MATE ))
    {
        wanderFocus( st, s );
    }
    else if ( state == BRAIN_STATE_PURSUING_MATE )
    {
        if ( mate >= 0 ) { aim( B, b, st.genitalX[ mate ], st.genitalY[ mate ], B[ b + SS.B_GENITAL_X ], B[ b + SS.B_GENITAL_Y ] ); }
    }
    else if ( state === BRAIN_STATE_SELF_FEED )
    {
        B[ b + SS.B_GOAL_X ] = B[ b + SS.B_GOAL_Y ] = 0;
    }
    else if ( state === BRAIN_STATE_PURSUING_FOOD )
    {
        if ( f >= 0 ) { aim( B, b, st.foodX[f], st.foodY[f], mouthX, mouthY ); }
    }

    //-------------------------------------------------
    // CURRENT_AWARENESS_ENABLED: in moving water the brain's own turn (the
    // steering output) bends a chase too - as much as the water is felt.
    // Whether it turns into the drift, with it, or not at all: the weights of
    // the current senses, i.e. evolution, decide (they are born 0)
    //-------------------------------------------------
    if ( CURRENT_AWARENESS_ENABLED && ( M[ m + SS.M_NEURAL ] === 1 ) && ( st.params[ SS.PARAM_CURRENT ] > 0 ) && ( M[ m + SS.M_STEER ] !== 0 )
    &&   (( state === BRAIN_STATE_PURSUING_FOOD ) || ( state === BRAIN_STATE_PURSUING_PREY ) || ( state === BRAIN_STATE_PURSUING_MATE )))
    {
        currentAt( B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ] );
        const turn = M[ m + SS.M_STEER ] * 0.1 * currentStrength();
        if ( turn !== 0 )
        {
            const c = Math.cos( turn ), sn = Math.sin( turn );
            const gx = B[ b + SS.B_GOAL_X ], gy = B[ b + SS.B_GOAL_Y ];
            B[ b + SS.B_GOAL_X ] = gx * c - gy * sn;
            B[ b + SS.B_GOAL_Y ] = gx * sn + gy * c;
        }
    }

    //-------------------------------------------------
    // neural brain: while searching, also follow the better temperature and
    // keep close to (or away from) the others, as the brain decides
    //-------------------------------------------------
    if ( M[ m + SS.M_NEURAL ] === 1 )
    {
        if (( state === BRAIN_STATE_LOOKING_FOR_FOOD ) || ( state === BRAIN_STATE_LOOKING_FOR_MATE ) || ( state === BRAIN_STATE_LOOKING_FOR_PREY ))
        {
            B[ b + SS.B_GOAL_X ] += CLIMATE_STEERING * M[ m + SS.M_CLIMATE_W ] * M[ m + SS.M_CLIMATE_X ] + SOCIAL_STEERING * M[ m + SS.M_SOCIAL_W ] * M[ m + SS.M_SOCIAL_X ];
            B[ b + SS.B_GOAL_Y ] += CLIMATE_STEERING * M[ m + SS.M_CLIMATE_W ] * M[ m + SS.M_CLIMATE_Y ] + SOCIAL_STEERING * M[ m + SS.M_SOCIAL_W ] * M[ m + SS.M_SOCIAL_Y ];
            normalize( B, b + SS.B_GOAL_X );

            // the brain may also turn the swimbot a little, left or right
            const steer = M[ m + SS.M_STEER ];
            if ( steer !== 0 )
            {
                const c = Math.cos( steer * 0.1 ), sn = Math.sin( steer * 0.1 );   // (a tenth per step: a smooth turn)
                const gx = B[ b + SS.B_GOAL_X ], gy = B[ b + SS.B_GOAL_Y ];
                B[ b + SS.B_GOAL_X ] = gx * c - gy * sn;
                B[ b + SS.B_GOAL_Y ] = gx * sn + gy * c;
            }
        }
    }

    //-------------------------------------------------
    // continually push the focus direction towards the goal
    //-------------------------------------------------
    const previousX = B[ b + SS.B_FOCUS_X ], previousY = B[ b + SS.B_FOCUS_Y ];
    const goalX = B[ b + SS.B_GOAL_X ], goalY = B[ b + SS.B_GOAL_Y ];
    let fx = previousX + goalX * BRAIN_FOCUS_TARGET_SHIFT_STRENGTH;
    let fy = previousY + goalY * BRAIN_FOCUS_TARGET_SHIFT_STRENGTH;
    if ( previousX * goalX + previousY * goalY < 0 )
    {
        // a near-reversal: turn by a small fixed step along the shortest arc
        // instead of letting the additive shift swing the heading across the circle
        const turn = Math.min( 0.06, BRAIN_FOCUS_TARGET_SHIFT_STRENGTH );
        const sign = ( previousX * goalY - previousY * goalX ) >= 0 ? 1 : -1;
        const sn = sign * turn, cs = 1 - 0.5 * turn * turn;
        fx = previousX * cs - previousY * sn;
        fy = previousY * cs + previousX * sn;
    }
    else
    {
        const ddx = fx - previousX, ddy = fy - previousY;
        if ( ddx * ddx + ddy * ddy > BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD * BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD )
        {
            fx = previousX + goalX * BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD;
            fy = previousY + goalY * BRAIN_FOCUS_TARGET_SHIFT_THRESHOLD;
        }
    }
    // A goal exactly behind the current focus can cancel it to zero; the
    // normalizer would then snap to a fixed heading and the limbs twitch.
    // Step around the zero point along the old focus's perpendicular instead.
    if ( fx * fx + fy * fy < 1e-4 )
    {
        fx += -previousY * 0.08;
        fy +=  previousX * 0.08;
    }
    B[ b + SS.B_FOCUS_X ] = fx;
    B[ b + SS.B_FOCUS_Y ] = fy;
    normalize( B, b + SS.B_FOCUS_X );

    // A new or loaded slot needs the old initial derivation once; afterwards
    // neuralThink refreshes these values only when its outputs actually change.
    if ( st.preyChoiceReady[s] === 0 )
    {
        const o = s * NUM_OUTPUTS, out = st.nnOutputs;
        st.preyValueWeight [s] = fastSigmoid( out[ o + OUT_PREY_VALUE ] );
        st.preyTravelWeight[s] = fastSigmoid( out[ o + OUT_PREY_TRAVEL ] );
        st.preyBaitBias    [s] = Math.tanh( out[ o + OUT_PREY_BAIT ] );
        st.preyChoiceReady [s] = 1;
    }

    //-------------------------------------------------
    // the climate costs energy
    //-------------------------------------------------
    if ( st.params[ SS.PARAM_ENV_ACTIVE ] === 1 )
    {
        if ((( age + index ) & 3 ) === 0 ) { updateBodyTemperature( st, s, 4 ); }
        if ((( age + index ) % THERMAL_FIT_UPDATE_PERIOD ) === 0 ) { updateThermalFit( st, s ); }
        const energyBeforeDrain = B[ b + SS.B_ENERGY ];
        B[ b + SS.B_ENERGY ] = Math.max( 0, energyBeforeDrain - THERMAL_MISMATCH_DRAIN * ( 1 - M[ m + SS.M_THERMAL_FIT ] ));
        transferToAtmosphere( energyBeforeDrain - B[ b + SS.B_ENERGY ] );
    }
    }
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_DECIDE_STEP, profT0 ); } }
}

//------------------------------------------------------------------------------
// after the physics: does it look around this step? (for the perception)
//------------------------------------------------------------------------------
export function prepareLook( st: SharedState, s: number ): void
{
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    if ( M[ m + SS.M_READY ] === 1 )
    {
        // scan radius: a hunting predator looks farther and farther
        const state = M[ m + SS.M_STATE ];
        const reach = isPredator( st, s ) ? PREDATOR_VISION_SCALE : 1;      // a predator sees its prey this many times farther
        const hunting = isPredator( st, s ) && (( state === BRAIN_STATE_LOOKING_FOR_PREY ) || ( state === BRAIN_STATE_PURSUING_PREY ));
        if ( M[ m + SS.M_SCAN_CD ] > 0 )
        {
            M[ m + SS.M_SCAN_CD ] -= BRAIN_SENSORY_UPDATE_PERIOD;
        }
        else if ( hunting && ( state === BRAIN_STATE_LOOKING_FOR_PREY ))
        {
            M[ m + SS.M_SCAN_RADIUS ] = Math.min( M[ m + SS.M_SCAN_RADIUS ] + PREY_SCAN_RADIUS_GROWTH, M[ m + SS.M_VIEW_RADIUS ] * reach * PREY_SCAN_RADIUS_MAX_SCALE );
        }
        else if ( !hunting )
        {
            M[ m + SS.M_SCAN_RADIUS ] = Math.max( M[ m + SS.M_SCAN_RADIUS ] - PREY_SCAN_RADIUS_GROWTH, M[ m + SS.M_VIEW_RADIUS ] * reach );
        }
        st.sensing[s] = 1;
    }
    st.mouthX    [s] = B[ b + SS.B_MOUTH_X ];
    st.mouthY    [s] = B[ b + SS.B_MOUTH_Y ];
    st.energy    [s] = B[ b + SS.B_ENERGY  ];
    st.scanRadius[s] = M[ m + SS.M_SCAN_RADIUS ];
    st.brainState[s] = M[ m + SS.M_STATE ];
    st.age       [s] = B[ b + SS.B_AGE ];
}

//------------------------------------------------------------------------------
// after looking around: what it saw becomes its targets
// (was GenePool.applyPerception and Swimbot.setEnvironmentalStimuli)
//------------------------------------------------------------------------------
export function takeInLook( st: SharedState, s: number, counters: number ): void
{
    const M = st.mind, m = s * SS.MIND_STRIDE, B = st.bots, b = s * SS.BOT_STRIDE;
    const neural = M[ m + SS.M_NEURAL ] === 1;
    const count  = st.seenCount[s];
    // (a bite decided at the start of the step stays on that food bit)
    const eatingNow = ( M[ m + SS.M_TRY_EAT ] === 1 ) ? M[ m + SS.M_FOOD ] : -1;
    const base   = s * SS.MAX_SEEN;

    if ( neural )
    {
        const sx = st.socialX[s], sy = st.socialY[s];
        const length = Math.sqrt( sx * sx + sy * sy );
        M[ m + SS.M_SOCIAL_X ] = ( length > 0 ) ? sx / length : 0;
        M[ m + SS.M_SOCIAL_Y ] = ( length > 0 ) ? sy / length : 0;
    }
    if ( PREDATOR_TARGET_SELECTION_ENABLED )
    {
        const x = st.nnInputs, xi = s * NUM_INPUTS;
        x[ xi + IN_PREY_DISTANCE ] = st.targetPreyDistance[s] || 0;
        x[ xi + IN_PREY_REWARD   ] = st.targetPreyReward[s]   || 0;
        x[ xi + IN_PREY_SUCCESS  ] = st.targetPreySuccess[s]  || 0;
        x[ xi + IN_PREY_CHASE    ] = st.targetPreyChase[s]    || 0;
        x[ xi + IN_BAIT_PRESENT  ] = ( st.targetBaitPresent[s] === 1 ) ? 1 : 0;
        x[ xi + IN_BAIT_DISTANCE ] = st.targetBaitDistance[s] || 0;
        x[ xi + IN_BAIT_REWARD   ] = st.targetBaitReward[s]   || 0;
    }

    // (something may have died or been eaten since the look)
    const f = st.seenFood[s], p = st.seenPrey[s], t = st.seenThreat[s], a = st.seenPredator[s];
    const foodOkay   = ( f >= 0 ) && ( st.liveFood[f] === 1 );
    const preyOkay   = ( p >= 0 ) && ( st.liveSwimbot[p] === 1 );
    const threatOkay = ( t >= 0 ) && ( st.liveSwimbot[t] === 1 );
    const anyPredator = (( a >= 0 ) && ( st.liveSwimbot[a] === 1 )) ? a : -1;
    const foodIsMeat = foodOkay && ( st.foodType[f] === 2 );
    const K = st.counters, k = counters;

    if ( PREDATOR_TARGET_SELECTION_ENABLED && ( preyOkay || foodIsMeat ))
    {
        K[ k + SS.K_PREY_CHOICES ] ++;
        if ( foodIsMeat && !preyOkay )
        {
            K[ k + SS.K_PREY_MEAT_CHOICES  ] ++;
            K[ k + SS.K_PREY_MEAT_DISTANCE ] += st.targetBaitDistance[s];
            K[ k + SS.K_PREY_MEAT_REWARD   ] += st.targetBaitReward[s];
            K[ k + SS.K_PREY_DISTANCE      ] += st.targetBaitDistance[s];
            K[ k + SS.K_PREY_REWARD        ] += st.targetBaitReward[s];
        }
        else
        {
            K[ k + SS.K_PREY_LIVE_CHOICES  ] ++;
            K[ k + SS.K_PREY_LIVE_DISTANCE ] += st.targetPreyDistance[s];
            K[ k + SS.K_PREY_LIVE_REWARD   ] += st.targetPreyReward[s] * st.targetPreySuccess[s];
            K[ k + SS.K_PREY_DISTANCE      ] += st.targetPreyDistance[s];
            K[ k + SS.K_PREY_REWARD        ] += st.targetPreyReward[s] * st.targetPreySuccess[s];
        }
    }

    if ( preyOkay ) { M[ m + SS.M_SCAN_CD ] = PREY_SCAN_COOLDOWN; }

    //------------------------------------------------------------
    // remember what I see, for the neural brain
    //------------------------------------------------------------
    M[ m + SS.M_SEEN_FOOD ] = ( foodOkay && !foodIsMeat ) ? 1 : 0;
    M[ m + SS.M_SEEN_PREY ] = ( preyOkay || foodIsMeat ) ? 1 : 0;
    M[ m + SS.M_NUM_SEEN  ] = count;
    if ( foodOkay && !foodIsMeat ) { M[ m + SS.M_SEEN_FOOD_X ] = st.foodX[f]; M[ m + SS.M_SEEN_FOOD_Y ] = st.foodY[f]; }
    M[ m + SS.M_NEAREST_SEEN ] = ( count > 0 ) ? st.seen[ base ] : -1;

    //------------------------------------------------------------
    // danger: a hunting predator close enough makes me flee
    //------------------------------------------------------------
    const px = B[ b + SS.B_POS_X ], py = B[ b + SS.B_POS_Y ];
    let nearPred = -1;
    M[ m + SS.M_THREAT_CLOSE ] = 0;
    M[ m + SS.M_PRED_CLOSE ]   = 0;
    if ( threatOkay )
    {
        const d = t * SS.BOT_STRIDE, dx = B[ d + SS.B_POS_X ] - px, dy = B[ d + SS.B_POS_Y ] - py;
        const distance = Math.sqrt( dx * dx + dy * dy );
        M[ m + SS.M_THREAT_CLOSE ] = Math.max( 0, 1 - distance / SWIMBOT_VIEW_RADIUS );
        if ( distance < PREDATOR_FLEE_RADIUS ) { nearPred = t; }
    }
    M[ m + SS.M_NEAR_PRED ] = nearPred;
    M[ m + SS.M_THREAT_NEAR ] = ( nearPred >= 0 ) ? 1 : 0;

    // autotomy as a decoy: a hunter came too close - drop a part (main thread)
    const autotomyThreat = M[ m + SS.M_AUTOTOMY_THREAT ];
    if ( threatOkay && ( M[ m + SS.M_PARTS_LOST ] !== 1 ) && ( autotomyThreat > 0.05 )
    &&   ( M[ m + SS.M_THREAT_CLOSE ] >= 1 - AUTOTOMY_DECOY_SPAN * autotomyThreat ))
    {
        M[ m + SS.M_EVENTS ] |= SS.EVENT_DECOY;
    }

    if ( anyPredator >= 0 )
    {
        const d = anyPredator * SS.BOT_STRIDE, dx = B[ d + SS.B_POS_X ] - px, dy = B[ d + SS.B_POS_Y ] - py;
        M[ m + SS.M_PRED_CLOSE ] = Math.max( 0, 1 - Math.sqrt( dx * dx + dy * dy ) / SWIMBOT_VIEW_RADIUS );
        M[ m + SS.M_CALM_PRED ] = ( neural && ( nearPred < 0 )) ? anyPredator : -1;
    }
    else { M[ m + SS.M_CALM_PRED ] = -1; }

    //------------------------------------------------------------
    // if hunting, choose the prey that was found
    //------------------------------------------------------------
    const state = M[ m + SS.M_STATE ];
    const huntingState = ( state == BRAIN_STATE_LOOKING_FOR_PREY ) || ( state == BRAIN_STATE_PURSUING_PREY );
    M[ m + SS.M_PREY ] = -1;
    if ( huntingState )
    {
        M[ m + SS.M_FOUND_PREY ] = preyOkay ? 1 : 0;
        // a chosen meat target replaces the live-prey chase
        if ( PREDATOR_TARGET_SELECTION_ENABLED && !preyOkay && foodIsMeat && ( state === BRAIN_STATE_PURSUING_PREY ))
        {
            M[ m + SS.M_STATE ] = BRAIN_STATE_LOOKING_FOR_PREY;
        }
        if ( preyOkay ) { M[ m + SS.M_PREY ] = p; }
    }

    //------------------------------------------------------------
    // keep a meat target available while a predator hunts
    //------------------------------------------------------------
    const stateNow = M[ m + SS.M_STATE ];
    M[ m + SS.M_FOOD ] = -1;
    if ((( stateNow == BRAIN_STATE_LOOKING_FOR_PREY ) || ( stateNow == BRAIN_STATE_PURSUING_PREY )) && foodIsMeat )
    {
        M[ m + SS.M_FOOD ] = f;
    }
    if (( stateNow === BRAIN_STATE_PURSUING_PREY ) && ( M[ m + SS.M_FOOD ] >= 0 ))
    {
        if ( M[ m + SS.M_FOOD ] !== M[ m + SS.M_LAST_MEAT ] ) K[ k + SS.K_MEAT_TARGETS_PURSUING ] ++;
        M[ m + SS.M_LAST_MEAT ] = M[ m + SS.M_FOOD ];
    }
    else { M[ m + SS.M_LAST_MEAT ] = -1; }

    if (( stateNow == BRAIN_STATE_LOOKING_FOR_FOOD ) || ( stateNow == BRAIN_STATE_PURSUING_FOOD ))
    {
        M[ m + SS.M_FOUND_FOOD ] = foodOkay ? 1 : 0;
        if ( foodOkay ) { M[ m + SS.M_FOOD ] = f; }
    }

    // nothing to eat anymore - cancel any pending bite
    if ( M[ m + SS.M_FOOD ] < 0 ) { M[ m + SS.M_TRY_EAT ] = 0; }

    //------------------------------------------------------------
    // YOUNG_CANNIBALISM_ENABLED: a hungry herbivore that sees no plant may go
    // for a young one of its kind with fewer body parts (the nearest)
    //------------------------------------------------------------
    M[ m + SS.M_CANNIBAL ] = 0;
    // (18.10: a hungry body goes for the young one even when it sees a plant,
    //  if the young one is nearer than the plant)
    if ( YOUNG_CANNIBALISM_ENABLED && !isPredator( st, s )
    &&   ( M[ m + SS.M_CANNIBAL_GENE ] > CANNIBAL_GENE_THRESHOLD )             // (an inherited ability, not everyone's)
    &&   !( ONLY_GROWN_EAT_YOUNG_ENABLED && ( B[ b + SS.B_GROWTH ] < 1 ))
    &&   ( B[ b + SS.B_ENERGY ] < M[ m + SS.M_HUNGER ] ))
    {
        const plantSeen = foodOkay && !foodIsMeat;
        const mouthAtX = B[ b + SS.B_MOUTH_X ], mouthAtY = B[ b + SS.B_MOUTH_Y ];
        const plantDistance = plantSeen ? Math.hypot( st.foodX[f] - mouthAtX, st.foodY[f] - mouthAtY ) : Infinity;
        const desperate = DESPERATE_CANNIBALISM_ENABLED && ( B[ b + SS.B_ENERGY ] < M[ m + SS.M_MAX_ENERGY ] * DESPERATE_ENERGY_SHARE );
        for (let i = 0; i < count; i++)
        {
            const o = st.seen[ base + i ];
            if (( st.liveSwimbot[o] !== 1 ) || isPredator( st, o ) || ( st.eternal[o] === 1 )) continue;
            // what fits in the mouth: its mass now (a young one grows from an egg) against mine
            const young = st.age[o] < st.mind[ o * SS.MIND_STRIDE + SS.M_MATURE_AGE ];
            const theirMassNow = st.mass[o] * Math.min( 1, st.bots[ o * SS.BOT_STRIDE + SS.B_GROWTH ] );
            // ONLY_GROWN_EAT_YOUNG_ENABLED: the eater is measured by its own present mass
            const myMassNow   = st.mass[s] * ( ONLY_GROWN_EAT_YOUNG_ENABLED ? Math.min( 1, B[ b + SS.B_GROWTH ] ) : 1 );
            const youngOk     = young && ( theirMassNow < myMassNow * CANNIBAL_PREY_MASS_SHARE );
            const desperateOk = desperate && ( theirMassNow < myMassNow * DESPERATE_PREY_MASS_SHARE );
            if ( !youngOk && !desperateOk ) continue;
            if ( Math.hypot( st.botX[o] - mouthAtX, st.botY[o] - mouthAtY ) > plantDistance ) continue;   // the plant is nearer
            if ( KIN_NOT_EATEN_ENABLED && areKin( st, s, o )) continue;
            M[ m + SS.M_PREY ] = o;
            M[ m + SS.M_CANNIBAL ] = 1;
            break;
        }
    }

    //------------------------------------------------------------
    // a mate
    //------------------------------------------------------------
    if ( stateNow === BRAIN_STATE_LOOKING_FOR_MATE )
    {
        const chosen = st.seenMate[s];
        if ( chosen === -2 )
        {
            // other criteria than color: the main thread chooses (EVENT_CHOOSE_MATE)
            M[ m + SS.M_EVENTS ] |= SS.EVENT_CHOOSE_MATE;
        }
        else if (( chosen >= 0 ) && ( st.liveSwimbot[ chosen ] === 1 ))
        {
            M[ m + SS.M_MATE ] = chosen;
            M[ m + SS.M_FOUND_MATE ] = 1;
        }
        else
        {
            M[ m + SS.M_FOUND_MATE ] = 0;
        }
    }
    else if ( stateNow == BRAIN_STATE_PURSUING_MATE )
    {
        // can I still see my mate? (a mate that changed its diet is given up)
        const mate = M[ m + SS.M_MATE ];
        let stillSeen = false;
        for (let i = 0; i < count; i++)
        {
            const o = st.seen[ base + i ];
            if (( o === mate ) && ( isPredator( st, o ) === isPredator( st, s ))) { stillSeen = true; }
        }
        if ( !stillSeen && ( mate >= 0 ) && ( st.liveSwimbot[ mate ] === 1 )
        &&  ( isPredator( st, mate ) === isPredator( st, s )))
        {
            // a partner at the edge of the radius may leave the strict view
            // for one tick; keep it for a little longer instead of dropping it
            const mp = mate * SS.BOT_STRIDE;
            const dx = B[ mp + SS.B_POS_X ] - px, dy = B[ mp + SS.B_POS_Y ] - py;
            const reach = M[ m + SS.M_VIEW_RADIUS ] * 1.15;
            stillSeen = ( dx * dx + dy * dy <= reach * reach );
        }
        if ( !stillSeen )
        {
            M[ m + SS.M_FOUND_MATE ] = 0;
            M[ m + SS.M_MATE ] = -1;
        }
    }

    if (( eatingNow >= 0 ) && ( st.liveFood[ eatingNow ] === 1 ))
    {
        M[ m + SS.M_FOOD ] = eatingNow;
        M[ m + SS.M_TRY_EAT ] = 1;
    }

    M[ m + SS.M_READY ] = 0;
}

