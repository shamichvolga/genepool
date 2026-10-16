//------------------------------------------------------------------------------
// Physics kernel (stage 7): the body motion of one swimbot, working only on
// the flat arrays of SharedState, so it can run in any thread.
//
// This is the old Swimbot.updateBodyParts + updatePhysics, moved here with the
// same arithmetic in the same order (results are bit-identical; checked with
// tools/bench.cjs fingerprints).
//
//   physicsPartA: body parts move, fluid forces, swimming cost, efficiency,
//                 the constant energy drain
//   physicsPartB: starvation check, walls
// (between them the main thread may apply the climate drain)
//------------------------------------------------------------------------------
import { ONE, ONE_HALF, PI_OVER_180, ZERO } from "./MathConstants";
import { OLD_AGE_DURATION, RUDDER_COST_PER_DEGREE, RUDDER_ENABLED, STEER_BY_SWIM_DIRECTION_ENABLED, SWIM_DIRECTION_SMOOTHING, SWIMBOT_SELECT_RADIUS_SCALAR, YOUNG_AGE_DURATION } from "./Parameters";
import { applyWaterDrag, bodyMotionFactors } from "./BodyPhysics";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { CONTINUAL_ENERGY_DRAIN, ENERGY_EFFICIENCY_MEASUREMENT_PERIOD, ENERGY_USED_UP_SWIMMING, GENITAL_INDEX, MAX_PARTS, MOUTH_INDEX, ROOT_PART, STARVING, STARVING_TIMER_DELTA, TIMER_DELTA_INCREASE_RATE, WALL_BOUNCE } from "./SwimbotTypes";
import {
    B_RUDDER, B_SWIM_X, B_SWIM_Y, A_X, A_Y, B_A, B_AGE, B_ANGLE, B_BASAL, B_BODY_MASS, B_COM_X, B_COM_Y, B_DEATHS, B_EFFICIENCY, B_EFFORT,
    B_ENERGY, B_ETERNAL, B_FOCUS_X, B_FOCUS_Y, B_FREQUENCY, B_GENITAL_X, B_GENITAL_Y, B_GOAL_X, B_GOAL_Y, B_GROWTH,
    B_LAST_ENERGY, B_LAST_X, B_LAST_Y, B_MOUTH_X, B_MOUTH_Y, B_NUM_PARTS, B_POS_X, B_POS_Y, B_SELECT_RADIUS,
    B_SPIN, B_SUM_LENGTHS, B_TIMER, B_TIMER_DELTA, B_VEL_X, B_VEL_Y, BOT_STRIDE, C_A, M_X, M_Y, N_X, N_Y, P_X,
    P_Y, PARAM_MAX_LIFESPAN, PART_STRIDE, PS, Q_X, Q_Y, SharedState, V_X, V_Y,
    PARAM_OB_END_RADIUS, PARAM_OB_LENGTH, PARAM_OB_MID_X, PARAM_OB_MID_Y, PARAM_OB_PERP_X, PARAM_OB_PERP_Y,
    PARAM_OBSTACLE_X1, PARAM_OBSTACLE_Y1
} from "./SharedState";

//------------------------------------------------------------------------------
// part A
//------------------------------------------------------------------------------
export function physicsPartA( s: number, st: SharedState ): void
{
    const B   = st.bots;
    const b   = s * BOT_STRIDE;
    const pd  = st.parts;
    const o   = s * PART_STRIDE;         // this swimbot's part data starts here
    const k   = s * MAX_PARTS;           // ... and its static part data
    const length    = st.partLength;
    const mass      = st.partMass;
    const angle     = st.partAngle;
    const amp       = st.partAmp;
    const phase     = st.partPhase;
    const turnAmp   = st.partTurnAmp;
    const turnPhase = st.partTurnPhase;
    const moment    = st.partMoment;
    const parentOf  = st.partParent;

    const maximumLifeSpan = st.params[ PARAM_MAX_LIFESPAN ];
    const oldAgeThreshold = maximumLifeSpan - OLD_AGE_DURATION;

    const age       = B[ b + B_AGE ];
    const eternal   = B[ b + B_ETERNAL ] !== 0;
    const numParts  = B[ b + B_NUM_PARTS ];
    const frequency = B[ b + B_FREQUENCY ];
    const sumLengths= B[ b + B_SUM_LENGTHS ];
    const bodyMass  = B[ b + B_BODY_MASS ];
    const motion    = bodyMotionFactors( bodyMass, sumLengths > ZERO ? bodyMass / sumLengths : ZERO );
    let energy      = B[ b + B_ENERGY ];
    let growth      = B[ b + B_GROWTH ];
    let timerDelta  = B[ b + B_TIMER_DELTA ];
    let posX        = B[ b + B_POS_X ];
    let posY        = B[ b + B_POS_Y ];
    let angleNow    = B[ b + B_ANGLE ];

    //==================================================================
    // update body parts
    //==================================================================
    if (( age < oldAgeThreshold ) || eternal )
    {
        growth = ( age < YOUNG_AGE_DURATION ) ? age / YOUNG_AGE_DURATION : ONE;

        // slowing down because starving, but not to a full stop
        if ( energy < STARVING )
        {
            timerDelta = energy / STARVING;
            if ( timerDelta < STARVING_TIMER_DELTA ) { timerDelta = STARVING_TIMER_DELTA; }
        }
        else
        {
            timerDelta += TIMER_DELTA_INCREASE_RATE;
            if ( timerDelta > ONE ) { timerDelta = ONE; }
        }
    }
    else
    {
        if ( age > maximumLifeSpan )
        {
            B[ b + B_DEATHS ] += 1;        // dying of old age
        }
        else
        {
            timerDelta = ONE - ( age - oldAgeThreshold ) / OLD_AGE_DURATION;   // slowing down because dying
        }
    }

    const timer = B[ b + B_TIMER ] + timerDelta * B[ b + B_EFFORT ];

    // modulators: the dot between the heading's perpendicular and the focus direction
    const radian0 = angleNow * PI_OVER_180;
    let headingX = Math.sin( radian0 );
    let headingY = Math.cos( radian0 );
    if ( STEER_BY_SWIM_DIRECTION_ENABLED )
    {
        // "forward" = where I actually swim (smoothed velocity), if I swim at all
        const sx = B[ b + B_SWIM_X ], sy = B[ b + B_SWIM_Y ], sl = Math.sqrt( sx * sx + sy * sy );
        if ( sl > 0.02 ) { headingX = sx / sl; headingY = sy / sl; }
    }
    const perpX =  headingY;
    const perpY = -headingX;
    const directionDot = B[ b + B_FOCUS_X ] * perpX + B[ b + B_FOCUS_Y ] * perpY;

    // root position and angle
    let momentAdjustment = ZERO;
    for (let p = 2; p < numParts; p++) { momentAdjustment += pd[ o + p * PS + B_A ] * moment[ k + p ]; }

    pd[ o + ROOT_PART * PS + P_X ] = posX;
    pd[ o + ROOT_PART * PS + P_Y ] = posY;
    pd[ o + ROOT_PART * PS + C_A ] = angleNow - momentAdjustment;

    // parts: angle and position
    for (let p = 1; p < numParts; p++)
    {
        const i = o + p * PS;
        const j = o + parentOf[ k + p ] * PS;     // (every part from 1 on has a real parent)

        pd[ i + P_X ] = pd[ j + P_X ];
        pd[ i + P_Y ] = pd[ j + P_Y ];

        pd[ i + C_A ] = pd[ j + C_A ] + angle[ k + p ];

        if ( p > 1 ) // part 1 has nothing to bend off of
        {
            const ampModulator   = turnAmp  [ k + p ] * directionDot;
            const phaseModulator = turnPhase[ k + p ] * directionDot;
            const radian = timer * frequency + ( phase[ k + p ] + phaseModulator );
            pd[ i + B_A ] = ( amp[ k + p ] + ampModulator ) * Math.sin( radian );
            pd[ i + C_A ] += pd[ i + B_A ];
        }

        const radian = pd[ i + C_A ] * PI_OVER_180;
        let partLength = length[ k + p ];
        if ( age < YOUNG_AGE_DURATION ) { partLength *= growth; }

        const x = partLength * Math.sin( radian );
        const y = partLength * Math.cos( radian );
        pd[ i + Q_X ] = pd[ i + M_X ];
        pd[ i + Q_Y ] = pd[ i + M_Y ];
        pd[ i + M_X ] = pd[ i + P_X ];
        pd[ i + M_Y ] = pd[ i + P_Y ];
        pd[ i + P_X ] += x;
        pd[ i + P_Y ] += y;
        pd[ i + M_X ] += x * ONE_HALF;
        pd[ i + M_Y ] += y * ONE_HALF;

        pd[ i + A_X ] = pd[ i + P_X ] - pd[ j + P_X ];
        pd[ i + A_Y ] = pd[ i + P_Y ] - pd[ j + P_Y ];
        pd[ i + N_X ] =  pd[ i + A_Y ] / partLength;
        pd[ i + N_Y ] = -pd[ i + A_X ] / partLength;

        pd[ i + V_X ] = pd[ i + M_X ] - pd[ i + Q_X ];
        pd[ i + V_Y ] = pd[ i + M_Y ] - pd[ i + Q_Y ];
    }

    // center of mass, shift the body so it stays in place, center of mass again
    let comX = ZERO, comY = ZERO;
    for (let p = 1; p < numParts; p++)
    {
        comX += pd[ o + p * PS + M_X ] * mass[ k + p ];
        comY += pd[ o + p * PS + M_Y ] * mass[ k + p ];
    }
    let scale = ONE / bodyMass;
    comX *= scale;
    comY *= scale;

    const offsetX = posX - comX;
    const offsetY = posY - comY;
    for (let p = 0; p < numParts; p++)
    {
        const i = o + p * PS;
        pd[ i + P_X ] += offsetX;
        pd[ i + P_Y ] += offsetY;
        pd[ i + M_X ] += offsetX;
        pd[ i + M_Y ] += offsetY;
    }
    B[ b + B_MOUTH_X   ] = pd[ o + MOUTH_INDEX   * PS + P_X ];
    B[ b + B_MOUTH_Y   ] = pd[ o + MOUTH_INDEX   * PS + P_Y ];
    B[ b + B_GENITAL_X ] = pd[ o + GENITAL_INDEX * PS + P_X ];
    B[ b + B_GENITAL_Y ] = pd[ o + GENITAL_INDEX * PS + P_Y ];

    comX = ZERO; comY = ZERO;
    for (let p = 1; p < numParts; p++)
    {
        comX += pd[ o + p * PS + M_X ] * mass[ k + p ];
        comY += pd[ o + p * PS + M_Y ] * mass[ k + p ];
    }
    comX *= scale;
    comY *= scale;
    B[ b + B_COM_X ] = comX;
    B[ b + B_COM_Y ] = comY;

    // select radius (now and then)
    if ( age % 20 === 0 )
    {
        let selectRadius = B[ b + B_SELECT_RADIUS ];
        for (let p = 1; p < numParts; p++)
        {
            for (let q = 1; q < numParts; q++)
            {
                if ( q != p )
                {
                    const xx = pd[ o + p * PS + P_X ] - pd[ o + q * PS + P_X ];
                    const yy = pd[ o + p * PS + P_Y ] - pd[ o + q * PS + P_Y ];
                    let distance = Math.sqrt( xx * xx + yy * yy );
                    distance = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( distance );
                    if ( distance > selectRadius ) { selectRadius = distance; }
                }
            }
        }
        B[ b + B_SELECT_RADIUS ] = selectRadius;
    }

    //==================================================================
    // fluid forces: the moving parts push the body forward and turn it
    //==================================================================
    let accelerationX = ZERO, accelerationY = ZERO, torque = ZERO;

    for (let p = 1; p < numParts; p++)
    {
        const i = o + p * PS;
        const fractionOfWhole = length[ k + p ] / sumLengths;

        pd[ i + V_X ] = pd[ i + M_X ] - pd[ i + Q_X ];
        pd[ i + V_Y ] = pd[ i + M_Y ] - pd[ i + Q_Y ];

        const strokeAmplitude = ( pd[ i + V_X ] * pd[ i + N_X ] + pd[ i + V_Y ] * pd[ i + N_Y ] ) * fractionOfWhole;
        const strokeForceX = pd[ i + N_X ] * strokeAmplitude;
        const strokeForceY = pd[ i + N_Y ] * strokeAmplitude;

        if ( motion.enabled )
            energy -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING * motion.strokeCost;
        else
            energy -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING;
        if ( energy < ZERO ) { energy = ZERO; }

        const partVectorFromCenterX = pd[ i + M_X ] - posX;
        const partVectorFromCenterY = pd[ i + M_Y ] - posY;
        const xx = partVectorFromCenterX * partVectorFromCenterX;
        const yy = partVectorFromCenterY * partVectorFromCenterY;
        const distance = Math.sqrt( xx * xx + yy * yy );

        if ( distance > ZERO )
        {
            if ( motion.enabled )
            {
                accelerationX += -strokeForceX * motion.acceleration;
                accelerationY += -strokeForceY * motion.acceleration;
            }
            else
            {
                accelerationX += -strokeForceX;
                accelerationY += -strokeForceY;
            }

            const partPerpendicularX =  partVectorFromCenterY;
            const partPerpendicularY = -partVectorFromCenterX;
            const perpDot = ( strokeForceX * partPerpendicularX + strokeForceY * partPerpendicularY ) / sumLengths;
            torque -= perpDot;
        }
    }

    let velX = B[ b + B_VEL_X ] + accelerationX;
    let velY = B[ b + B_VEL_Y ] + accelerationY;
    if ( motion.enabled )
    {
        const drag = applyWaterDrag( velX, velY, bodyMass, motion.drag );
        velX = drag.velocityX;
        velY = drag.velocityY;
        energy -= drag.energyCost;
        if ( energy < ZERO ) { energy = ZERO; }
    }
    // the remembered swimming direction follows the velocity slowly
    B[ b + B_SWIM_X ] += ( velX - B[ b + B_SWIM_X ] ) * SWIM_DIRECTION_SMOOTHING;
    B[ b + B_SWIM_Y ] += ( velY - B[ b + B_SWIM_Y ] ) * SWIM_DIRECTION_SMOOTHING;

    let spin = B[ b + B_SPIN ] + torque;

    // RUDDER_ENABLED: the whole body turns towards the focus, as fast as the
    // gene allows, for energy (if the focus is right behind, it turns anyway)
    if ( RUDDER_ENABLED && ( B[ b + B_RUDDER ] > ZERO ))
    {
        const fx = B[ b + B_FOCUS_X ], fy = B[ b + B_FOCUS_Y ];
        const side  = fx * perpX + fy * perpY;               // focus . perpendicular of "forward"
        const ahead = fx * headingX + fy * headingY;
        const want  = ( ahead < ZERO ) ? ( side >= ZERO ? ONE : -ONE ) : side;
        const turn  = B[ b + B_RUDDER ] * Math.max( -ONE, Math.min( ONE, want ));
        spin += turn;
        energy -= Math.abs( turn ) * RUDDER_COST_PER_DEGREE;
        if ( energy < ZERO ) { energy = ZERO; }
    }
    posX += velX;
    posY += velY;
    angleNow += spin;

    //==================================================================
    // energy efficiency (now and then), constant drain
    //==================================================================
    if ( age % ENERGY_EFFICIENCY_MEASUREMENT_PERIOD === 0 )
    {
        const dx = posX - B[ b + B_LAST_X ];
        const dy = posY - B[ b + B_LAST_Y ];
        const distanceTraveled = Math.sqrt( dx * dx + dy * dy );
        const averageSpeed = distanceTraveled / ENERGY_EFFICIENCY_MEASUREMENT_PERIOD;
        let energyLost = B[ b + B_LAST_ENERGY ] - energy;
        if ( energyLost < ZERO ) { energyLost = ZERO; }
        B[ b + B_EFFICIENCY  ] = averageSpeed / ( ONE + energyLost );
        B[ b + B_LAST_X      ] = posX;
        B[ b + B_LAST_Y      ] = posY;
        B[ b + B_LAST_ENERGY ] = energy;
    }

    energy -= CONTINUAL_ENERGY_DRAIN + B[ b + B_BASAL ];

    B[ b + B_GROWTH      ] = growth;
    B[ b + B_TIMER_DELTA ] = timerDelta;
    B[ b + B_TIMER       ] = timer;
    B[ b + B_ENERGY      ] = energy;
    B[ b + B_VEL_X       ] = velX;
    B[ b + B_VEL_Y       ] = velY;
    B[ b + B_SPIN        ] = spin;
    B[ b + B_POS_X       ] = posX;
    B[ b + B_POS_Y       ] = posY;
    B[ b + B_ANGLE       ] = angleNow;
}

//------------------------------------------------------------------------------
// part B: starvation, walls
//------------------------------------------------------------------------------
export function physicsPartB( s: number, st: SharedState ): void
{
    const B  = st.bots;
    const b  = s * BOT_STRIDE;
    const pd = st.parts;
    const o  = s * PART_STRIDE;
    const k  = s * MAX_PARTS;

    // when energy hits zero, that means death (eternal swimbots don't starve)
    if ( B[ b + B_ENERGY ] <= ZERO )
    {
        B[ b + B_ENERGY ] = ZERO;
        if ( B[ b + B_ETERNAL ] === 0 ) { B[ b + B_DEATHS ] += 1; }
    }

    const numParts   = B[ b + B_NUM_PARTS ];
    const sumLengths = B[ b + B_SUM_LENGTHS ];
    let posX  = B[ b + B_POS_X  ], posY  = B[ b + B_POS_Y  ];
    let velX  = B[ b + B_VEL_X  ], velY  = B[ b + B_VEL_Y  ];
    let goalX = B[ b + B_GOAL_X ], goalY = B[ b + B_GOAL_Y ];

    const normalizeGoal = () =>
    {
        const m = Math.sqrt( goalX * goalX + goalY * goalY );
        if ( m > 0 ) { goalX /= m; goalY /= m; } else { goalX = 1.0; goalY = 0.0; }
    };

    if ( posX < POOL_LEFT + sumLengths * ONE_HALF )
    {
        for (let p = 1; p < numParts; p++)
        {
            const limit = POOL_LEFT + ( st.partLength[ k + p ] + st.partWidth[ k + p ] );
            if ( pd[ o + p * PS + P_X ] < limit )
            {
                const penetration = limit - pd[ o + p * PS + P_X ];
                posX  += penetration * WALL_BOUNCE;
                velX  += penetration * WALL_BOUNCE;
                goalX += penetration * WALL_BOUNCE;
                normalizeGoal();
            }
        }
    }
    else if ( posX > POOL_RIGHT - sumLengths * ONE_HALF )
    {
        for (let p = 1; p < numParts; p++)
        {
            const limit = POOL_RIGHT - ( st.partLength[ k + p ] + st.partWidth[ k + p ] );
            if ( pd[ o + p * PS + P_X ] > limit )
            {
                const penetration = limit - pd[ o + p * PS + P_X ];
                posX  += penetration * WALL_BOUNCE;
                velX  += penetration * WALL_BOUNCE;
                goalX += penetration * WALL_BOUNCE;
                normalizeGoal();
            }
        }
    }

    if ( posY < POOL_TOP + sumLengths * ONE_HALF )
    {
        for (let p = 1; p < numParts; p++)
        {
            const limit = POOL_TOP + ( st.partLength[ k + p ] + st.partWidth[ k + p ] );
            if ( pd[ o + p * PS + P_Y ] < limit )
            {
                const penetration = limit - pd[ o + p * PS + P_Y ];
                posY  += penetration * WALL_BOUNCE;
                velY  += penetration * WALL_BOUNCE;
                goalY += penetration * WALL_BOUNCE;
                normalizeGoal();
            }
        }
    }
    else if ( posY > POOL_BOTTOM - sumLengths * ONE_HALF )
    {
        for (let p = 1; p < numParts; p++)
        {
            const limit = POOL_BOTTOM - ( st.partLength[ k + p ] + st.partWidth[ k + p ] );
            if ( pd[ o + p * PS + P_Y ] > limit )
            {
                const penetration = limit - pd[ o + p * PS + P_Y ];
                posY  += penetration * WALL_BOUNCE;
                velY  += penetration * WALL_BOUNCE;
                goalY += penetration * WALL_BOUNCE;
                normalizeGoal();
            }
        }
    }

    B[ b + B_POS_X  ] = posX;  B[ b + B_POS_Y  ] = posY;
    B[ b + B_VEL_X  ] = velX;  B[ b + B_VEL_Y  ] = velY;
    B[ b + B_GOAL_X ] = goalX; B[ b + B_GOAL_Y ] = goalY;
}

//------------------------------------------------------------------------------
// the whole physics of one swimbot for one step (phased step: the climate
// drain was already applied before)
//------------------------------------------------------------------------------
export function physicsStep( s: number, st: SharedState ): void
{
    physicsPartA( s, st );
    physicsPartB( s, st );
    obstacleCollision( s, st );
}

//------------------------------------------------------------------------------
// bumping into the obstacle pushes the swimbot away (as Obstacle.getCollision,
// with the push of GenePool: force x 1.2 added to the velocity)
//------------------------------------------------------------------------------
export function obstacleCollision( s: number, st: SharedState ): void
{
    const B = st.bots, b = s * BOT_STRIDE, P = st.params;
    const endRadius = P[ PARAM_OB_END_RADIUS ];
    if ( endRadius <= ZERO ) return;
    let radius = B[ b + B_SUM_LENGTHS ] * ONE_HALF;
    if ( radius < endRadius ) { radius = endRadius; }

    const xx = B[ b + B_POS_X ] - P[ PARAM_OB_MID_X ];
    const yy = B[ b + B_POS_Y ] - P[ PARAM_OB_MID_Y ];
    const distanceSquared = xx * xx + yy * yy;
    const ll = P[ PARAM_OB_LENGTH ] * ONE_HALF + endRadius + radius;

    if ( distanceSquared < ll * ll )
    {
        const perpX = P[ PARAM_OB_PERP_X ], perpY = P[ PARAM_OB_PERP_Y ];
        const testX = B[ b + B_POS_X ] - P[ PARAM_OBSTACLE_X1 ];
        const testY = B[ b + B_POS_Y ] - P[ PARAM_OBSTACLE_Y1 ];
        const dot = testX * perpX + testY * perpY;

        if ( Math.abs( dot ) < radius )
        {
            let penetration = ( ONE - ( dot / radius ) );
            if ( dot < ZERO ) { penetration *= -ONE; }
            B[ b + B_VEL_X ] += ( perpX * penetration ) * 1.2;
            B[ b + B_VEL_Y ] += ( perpY * penetration ) * 1.2;
        }
    }
}
