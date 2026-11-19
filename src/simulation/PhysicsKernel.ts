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
import { currentAt, currentDriftX, currentDriftY } from "./Currents";
import { ONE, ONE_HALF, PI_OVER_180, ZERO } from "./MathConstants";
import { GROWTH_COSTS_ENERGY_ENABLED, GROWTH_ENERGY_PER_MASS, NEWBORN_SIZE_SCALE, OLD_AGE_DURATION, RUDDER_COST_PER_DEGREE, RUDDER_ENABLED, STEER_BY_SWIM_DIRECTION_ENABLED, SWIM_DIRECTION_SMOOTHING, SWIMBOT_SELECT_RADIUS_SCALAR, YOUNG_AGE_DURATION } from "./Parameters";
import { applyWaterDrag, bodyMotionFactors } from "./BodyPhysics";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { CONTINUAL_ENERGY_DRAIN, ENERGY_EFFICIENCY_MEASUREMENT_PERIOD, ENERGY_USED_UP_SWIMMING, GENITAL_INDEX, MAX_PARTS, MOUTH_INDEX, ROOT_PART, STARVING, STARVING_TIMER_DELTA, TIMER_DELTA_INCREASE_RATE, WALL_BOUNCE } from "./SwimbotTypes";
import { BODY_COLLISIONS_ENABLED, BODY_COLLISION_PUSH, BODY_COLLISION_MAX_IMPULSE, TREE_OBSTACLES_ENABLED, TREE_OBSTACLE_RADIUS_BASE, TREE_OBSTACLE_RADIUS_SCALE, CAVITY_JET_ENABLED, CAVITY_JET_C, CAVITY_JET_MAX, CAVITY_SUCTION_RADIUS_SCALE, WAKE_GRID_ENABLED, WAKE_GRID_SIZE, WAKE_DAMPING, WAKE_DIFFUSION, WAKE_MAX_SPEED, WAKE_IMPULSE_SHARE, QUADRATIC_WATER_ENABLED, JOINT_MIN_ANGLE, JOINT_MAX_ANGLE, PLANT_TREE_ENERGY, WOOD_PER_FRUIT_TIER } from "./Parameters";

const _WAKE_N = WAKE_GRID_SIZE;
const _kernelGridBuf = new Int32Array( 512 );

// Polynomial sine and cosine with the argument reduced to [-pi, pi].
// The reduced range is small enough for a short Remez-style polynomial,
// without a Math.sin / Math.cos call for every body segment.
const INV_PI2 = 1 / ( 2 * Math.PI );
const PI = Math.PI;
const PI2 = 2 * Math.PI;

function fastSin( x: number ): number
{
    x -= Math.round( x * INV_PI2 ) * PI2;
    const x2 = x * x;
    return x * ( 0.99999995 - x2 * ( 0.16666657 - x2 * ( 0.00833301 - x2 * 0.00019807 )));
}

function fastCos( x: number ): number
{
    x -= Math.round( x * INV_PI2 ) * PI2;
    const x2 = x * x;
    return 0.99999995 - x2 * ( 0.49999905 - x2 * ( 0.04166358 - x2 * 0.00138537 ));
}

export function stepWakeGrid( st: SharedState ): void
{
    const wx = st.wakeX, wy = st.wakeY, nx = st.wakeNextX, ny = st.wakeNextY;
    for ( let y = 0; y < _WAKE_N; y++ )
    {
        const row = y * _WAKE_N;
        const upRow = ( y > 0 ) ? row - _WAKE_N : row;
        const downRow = ( y < _WAKE_N - 1 ) ? row + _WAKE_N : row;
        for ( let x = 0; x < _WAKE_N; x++ )
        {
            const idx = row + x;
            const left = ( x > 0 ) ? idx - 1 : idx;
            const right = ( x < _WAKE_N - 1 ) ? idx + 1 : idx;
            nx[idx] = wx[idx] * WAKE_DAMPING + ( wx[left] + wx[right] + wx[upRow + x] + wx[downRow + x] ) * WAKE_DIFFUSION;
            ny[idx] = wy[idx] * WAKE_DAMPING + ( wy[left] + wy[right] + wy[upRow + x] + wy[downRow + x] ) * WAKE_DIFFUSION;
        }
    }
    wx.set( nx );
    wy.set( ny );
}
import {
    PARAM_CURRENT, B_RUDDER, B_SWIM_X, B_SWIM_Y, A_X, A_Y, B_A, B_AGE, B_ANGLE, B_BASAL, B_BODY_MASS, B_COM_X, B_COM_Y, B_DEATHS, B_EFFICIENCY, B_EFFORT,
    B_ENERGY, B_ETERNAL, B_FOCUS_X, B_FOCUS_Y, B_FREQUENCY, B_GENITAL_X, B_GENITAL_Y, B_GOAL_X, B_GOAL_Y, B_GROWTH,
    B_LAST_ENERGY, B_LAST_X, B_LAST_Y, B_MOUTH_X, B_MOUTH_Y, B_NUM_PARTS, B_POS_X, B_POS_Y, B_SELECT_RADIUS,
    B_SPIN, B_SUM_LENGTHS, B_TIMER, B_TIMER_DELTA, B_VEL_X, B_VEL_Y, BOT_STRIDE, C_A, M_X, M_Y, N_X, N_Y, P_X,
    P_Y, PARAM_MAX_LIFESPAN, PARAM_STEP, PART_STRIDE, PS, Q_X, Q_Y, SharedState, V_X, V_Y,
    PARAM_WALL_COUNT, PARAM_WALL_BASE, PARAM_MATURE_TREE_COUNT
} from "./SharedState";
import { PROFILER_ENABLED, profEnter, profExit, PROF_PHYSICS_A, PROF_PHYS_KINEMATICS, PROF_PHYS_FLUID, PROF_PHYS_CAVITY_JET, PROF_PHYS_TREES, PROF_PHYS_COLLISIONS } from "./Profiler";

//------------------------------------------------------------------------------
// part A
//------------------------------------------------------------------------------

export function physicsPartA( s: number, st: SharedState ): void
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_PHYSICS_A ) : 0;
    try
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
    const profKinT0 = PROFILER_ENABLED ? profEnter( PROF_PHYS_KINEMATICS ) : 0;
    if (( age < oldAgeThreshold ) || eternal )
    {
        if ( !GROWTH_COSTS_ENERGY_ENABLED )
        {
            growth = ( age < YOUNG_AGE_DURATION ) ? age / YOUNG_AGE_DURATION : ONE;
        }
        else if ( growth < ONE )
        {
            // GROWTH_COSTS_ENERGY_ENABLED: a step of growing is paid for with
            // the energy its new mass holds; no energy, no growing
            const step = Math.min( ONE / YOUNG_AGE_DURATION, ONE - growth );
            const cost = step * bodyMass * GROWTH_ENERGY_PER_MASS;
            if ( energy > cost ) { growth += step; energy -= cost; }
        }

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

    const glide = st.botGlide[s];
    const effort = B[ b + B_EFFORT ];
    const glideScale = ( glide > 0 && effort < 0.85 ) ? ( 1 - 0.35 * glide ) : 1;
    const timer = B[ b + B_TIMER ] + timerDelta * effort * glideScale;

    // modulators: the dot between the heading's perpendicular and the focus direction
    const radian0 = angleNow * PI_OVER_180;
    let headingX = fastSin( radian0 );
    let headingY = fastCos( radian0 );
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
            const phaseModulator = turnPhase[ k + p ] * directionDot * 0.5;
            const radian = timer * frequency + ( phase[ k + p ] + phaseModulator );
            const baseRel = pd[ i + C_A ] - pd[ j + C_A ];
            let bend = ( amp[ k + p ] + ampModulator ) * fastSin( radian );

            // C1 joint stop: a smooth asymptotic limit instead of a hard
            // clamp, so the bend never freezes at the peak of the stroke
            const totalRel = baseRel + bend;
            const jMin = st.partJointMin[ k + p ] || JOINT_MIN_ANGLE;
            const jMax = st.partJointMax[ k + p ] || JOINT_MAX_ANGLE;
            if ( totalRel > jMax )
            {
                const over = totalRel - jMax;
                bend = ( jMax - baseRel ) + ( 15 * over ) / ( 15 + over );
            }
            else if ( totalRel < jMin )
            {
                const under = jMin - totalRel;
                bend = ( jMin - baseRel ) - ( 15 * under ) / ( 15 + under );
            }
            pd[ i + B_A ] = bend;
            pd[ i + C_A ] += bend;

            // flexural rigidity: a wide plate resists a sharp bend, so a
            // stiff armoured body and a narrow flexible tail each pay their way
            const bendRad = bend * PI_OVER_180;
            const widthNorm = st.partWidth[ k + p ] / 3.5;
            energy -= 0.00018 * bendRad * bendRad * widthNorm * widthNorm * effort;
            if ( energy < ZERO ) { energy = ZERO; }
        }

        // one argument reduction, one shared r2 for both sine and cosine
        let r = pd[ i + C_A ] * PI_OVER_180;
        r -= Math.round( r * INV_PI2 ) * PI2;
        const r2 = r * r;
        const sinR = r * ( 0.99999995 - r2 * ( 0.16666657 - r2 * ( 0.00833301 - r2 * 0.00019807 )));
        const cosR = 0.99999995 - r2 * ( 0.49999905 - r2 * ( 0.04166358 - r2 * 0.00138537 ));
        let partLength = length[ k + p ];
        if ( growth < ONE ) { partLength *= NEWBORN_SIZE_SCALE + ( ONE - NEWBORN_SIZE_SCALE ) * growth; }

        const x = partLength * sinR;
        const y = partLength * cosR;
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
        let maxDistSq = 0;
        for (let p = 1; p < numParts; p++)
        {
            const px = pd[ o + p * PS + P_X ], py = pd[ o + p * PS + P_Y ];
            for (let q = p + 1; q < numParts; q++)
            {
                const xx = px - pd[ o + q * PS + P_X ];
                const yy = py - pd[ o + q * PS + P_Y ];
                const d2 = xx * xx + yy * yy;
                if ( d2 > maxDistSq ) { maxDistSq = d2; }
            }
        }
        if ( maxDistSq > 0 )
        {
            const sr = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( Math.sqrt( maxDistSq ));
            if ( sr > B[ b + B_SELECT_RADIUS ] ) { B[ b + B_SELECT_RADIUS ] = sr; }
        }
    }

    //==================================================================
    // fluid forces: the moving parts push the body forward and turn it
    //==================================================================
    if ( PROFILER_ENABLED ) { profExit( PROF_PHYS_KINEMATICS, profKinT0 ); }
    const profFluidT0 = PROFILER_ENABLED ? profEnter( PROF_PHYS_FLUID ) : 0;
    let accelerationX = ZERO, accelerationY = ZERO, torque = ZERO;

    // Keep the thrust normalized by the whole body length: a higher power
    // inflated both force and energy use several times over and killed the
    // bots at startup. Only a gentle, bounded width bonus remains.
    const normLength = Math.max( ONE, sumLengths );
    for (let p = 1; p < numParts; p++)
    {
        const i = o + p * PS;
        const widthFactor = Math.sqrt( Math.max( 0.45, Math.min( 1.8, st.partWidth[ k + p ] / 3.5 )));
        const fractionOfWhole = ( length[ k + p ] * widthFactor ) / normLength;

        // a broader parent body shelters the segment behind it (teardrop
        // shapes spend less energy than uniform worms)
        const parent = parentOf[ k + p ];
        const shield = parent > 0
            ? Math.max( 0.55, Math.min( 1.0, st.partWidth[ k + p ] / Math.max( 0.5, st.partWidth[ k + parent ] )))
            : 1.0;
        // branches on the outside of a turn push harder (differential rudder)
        const branchBias = angle[ k + p ] !== ZERO
            ? Math.max( 0.82, Math.min( 1.18, ONE + ( angle[ k + p ] / 90 ) * directionDot * 0.22 ))
            : ONE;

        // (the body was just shifted onto its center of mass, so the part
        //  velocities are computed here, after the shift)
        pd[ i + V_X ] = pd[ i + M_X ] - pd[ i + Q_X ];
        pd[ i + V_Y ] = pd[ i + M_Y ] - pd[ i + Q_Y ];

        const strokeAmplitude = ( pd[ i + V_X ] * pd[ i + N_X ] + pd[ i + V_Y ] * pd[ i + N_Y ] ) * fractionOfWhole * branchBias;
        const strokeForceX = pd[ i + N_X ] * strokeAmplitude;
        const strokeForceY = pd[ i + N_Y ] * strokeAmplitude;

        if ( motion.enabled )
            energy -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING * motion.strokeCost * shield;
        else
            energy -= Math.abs( strokeAmplitude ) * ENERGY_USED_UP_SWIMMING * shield;
        if ( energy < ZERO ) { energy = ZERO; }

        const partVectorFromCenterX = pd[ i + M_X ] - posX;
        const partVectorFromCenterY = pd[ i + M_Y ] - posY;
        const xx = partVectorFromCenterX * partVectorFromCenterX;
        const yy = partVectorFromCenterY * partVectorFromCenterY;

        if ( xx + yy > ZERO )
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

    // Cavity Jet & Suction: геометрическое схлопывание и раскрытие парных веток без "абилок"
    if ( PROFILER_ENABLED ) { profExit( PROF_PHYS_FLUID, profFluidT0 ); }
    const profCavityT0 = PROFILER_ENABLED ? profEnter( PROF_PHYS_CAVITY_JET ) : 0;
    if ( CAVITY_JET_ENABLED && numParts >= 4 )
    {
        const p1 = st.cavityP1[s], p2 = st.cavityP2[s], sharedParent = st.cavityParent[s];
        if ( p1 > 0 && p2 > 0 )
        {
            const jx = pd[ o + sharedParent * PS + P_X ], jy = pd[ o + sharedParent * PS + P_Y ];
            const v1x = pd[ o + p1 * PS + P_X ] - jx, v1y = pd[ o + p1 * PS + P_Y ] - jy;
            const v2x = pd[ o + p2 * PS + P_X ] - jx, v2y = pd[ o + p2 * PS + P_Y ] - jy;
            const area = 0.5 * Math.abs( v1x * v2y - v1y * v2x );
            if ( st.cavityValid[s] === 1 )
            {
                const dS = area - st.prevCavityArea[s];
                if ( dS < -0.5 )
                {
                    const gap = Math.max( 4.0, Math.sqrt( ( v1x - v2x ) * ( v1x - v2x ) + ( v1y - v2y ) * ( v1y - v2y ) ));
                    const l1 = Math.max( 1, Math.sqrt( v1x * v1x + v1y * v1y ));
                    const l2 = Math.max( 1, Math.sqrt( v2x * v2x + v2y * v2y ));
                    let bx = v1x / l1 + v2x / l2, by = v1y / l1 + v2y / l2;
                    const bl = Math.sqrt( bx * bx + by * by );
                    if ( bl > 1e-4 )
                    {
                        bx /= bl; by /= bl;
                        const impulse = Math.min( 0.45, 0.5 * CAVITY_JET_C * ( dS * dS ) / gap ) * ( motion.enabled ? motion.acceleration : 1 );
                        accelerationX -= bx * impulse;
                        accelerationY -= by * impulse;
                        energy = Math.max( ZERO, energy - impulse * 0.008 );
                    }
                }
                else if ( dS > 0.5 )
                {
                    const branchLen = 0.5 * ( length[ k + p1 ] + length[ k + p2 ] );
                    const sucR = branchLen * CAVITY_SUCTION_RADIUS_SCALE;
                    const mx = B[ b + B_MOUTH_X ], my = B[ b + B_MOUTH_Y ];
                    const fn = st.foodGrid.collect( mx, my, sucR, _kernelGridBuf );
                    const sucR2 = sucR * sucR;
                    for ( let fi = 0; fi < fn; fi++ )
                    {
                        const f = _kernelGridBuf[fi];
                        if ( st.liveFood[f] !== 1 || st.foodWood[f] >= WOOD_PER_FRUIT_TIER ) continue;
                        const dx = mx - st.foodX[f], dy = my - st.foodY[f];
                        const d2 = dx * dx + dy * dy;
                        if ( d2 > 4 && d2 < sucR2 )
                        {
                            const pull = Math.min( 0.6, 0.04 * dS / Math.sqrt( d2 ) );
                            st.foodX[f] += dx * pull;
                            st.foodY[f] += dy * pull;
                        }
                    }
                }
            }
            st.prevCavityArea[s] = area;
            st.cavityValid[s] = 1;
        }
    }

    // Wake grid: the whole body leaves one impulse in the cell it stands in
    if ( PROFILER_ENABLED ) { profExit( PROF_PHYS_CAVITY_JET, profCavityT0 ); }
    if ( WAKE_GRID_ENABLED && ( accelerationX !== ZERO || accelerationY !== ZERO ))
    {
        const wcx = Math.max( 0, Math.min( _WAKE_N - 1, Math.floor( ( posX - POOL_LEFT ) / ( POOL_RIGHT - POOL_LEFT ) * _WAKE_N ) ) );
        const wcy = Math.max( 0, Math.min( _WAKE_N - 1, Math.floor( ( posY - POOL_TOP ) / ( POOL_BOTTOM - POOL_TOP ) * _WAKE_N ) ) );
        const widx = wcy * _WAKE_N + wcx;
        st.wakeX[widx] -= accelerationX * WAKE_IMPULSE_SHARE;
        st.wakeY[widx] -= accelerationY * WAKE_IMPULSE_SHARE;
    }

    let velX = B[ b + B_VEL_X ] + accelerationX;
    let velY = B[ b + B_VEL_Y ] + accelerationY;
    if ( motion.enabled )
    {
        const effectiveDrag = motion.drag * ( ( glide > 0 && effort < 0.85 ) ? ( 1 - 0.35 * glide ) : 1 );
        const drag = applyWaterDrag( velX, velY, bodyMass, sumLengths, effectiveDrag );
        velX = drag.velocityX;
        velY = drag.velocityY;
        energy -= drag.energyCost;
        if ( energy < ZERO ) { energy = ZERO; }
    }
    // Tree obstacles and body collisions: a soft push on every step
    // Tree obstacles: the compact list of adult trees (no grid walk)
    const profTreesT0 = PROFILER_ENABLED ? profEnter( PROF_PHYS_TREES ) : 0;
    if ( TREE_OBSTACLES_ENABLED )
    {
        const treeCount = st.params[ PARAM_MATURE_TREE_COUNT ];
        const trees = st.matureTrees;
        const treeReach = sumLengths * 0.5 + TREE_OBSTACLE_RADIUS_BASE + TREE_OBSTACLE_RADIUS_SCALE + 8;
        const treeReachSquared = treeReach * treeReach;
        for ( let ti = 0; ti < treeCount; ti++ )
        {
            const tf = trees[ti];
            if ( st.liveFood[tf] !== 1 || st.foodType[tf] === 2 || st.foodWood[tf] < WOOD_PER_FRUIT_TIER ) continue;
            const tx = st.foodX[tf], ty = st.foodY[tf];
            const bdx0 = posX - tx, bdy0 = posY - ty;
            if ( bdx0 * bdx0 + bdy0 * bdy0 > treeReachSquared ) continue;
            const tr = TREE_OBSTACLE_RADIUS_BASE + TREE_OBSTACLE_RADIUS_SCALE * Math.min( 1, st.foodWood[tf] / PLANT_TREE_ENERGY );
            const maxBodyR = sumLengths * 0.6 + tr + 8;
            const bdx = posX - tx, bdy = posY - ty;
            if ( bdx * bdx + bdy * bdy > maxBodyR * maxBodyR ) continue;
            for ( let p = 0; p < numParts; p += 2 )
            {
                const i = o + p * PS;
                const dx = pd[ i + M_X ] - tx, dy = pd[ i + M_Y ] - ty;
                const rSum = tr + st.partWidth[ k + p ] * 0.5;
                const d2 = dx * dx + dy * dy;
                if ( d2 > 1e-6 && d2 < rSum * rSum )
                {
                    const dist = Math.sqrt( d2 );
                    const overlap = rSum - dist;
                    const sep = Math.min( 1.2, overlap * 0.25 );
                    const sx = ( dx / dist ) * sep, sy = ( dy / dist ) * sep;
                    posX += sx; posY += sy;
                    velX += sx * 0.15; velY += sy * 0.15;
                    energy -= sep * 0.005;
                    if ( energy < ZERO ) { energy = ZERO; }
                }
            }
        }
    }
    if ( PROFILER_ENABLED ) { profExit( PROF_PHYS_TREES, profTreesT0 ); }

    // Body collisions: O(N) потокобезопасное отталкивание через swimbotGrid (пишем только в себя)
    const profCollT0 = PROFILER_ENABLED ? profEnter( PROF_PHYS_COLLISIONS ) : 0;
    if ( BODY_COLLISIONS_ENABLED )
    {
        const ma = Math.max( 1, bodyMass );
        const ra = Math.max( 3, Math.sqrt( ma ) * 0.14 );
        const nn = st.swimbotGrid.collect( posX, posY, ra + 26, _kernelGridBuf );
        for ( let ni = 0; ni < nn; ni++ )
        {
            const o2 = _kernelGridBuf[ni];
            if ( o2 === s || st.liveSwimbot[o2] !== 1 ) continue;
            const dx = posX - st.botX[o2];
            const dy = posY - st.botY[o2];
            const rb = Math.max( 3, Math.sqrt( Math.max( 1, st.mass[o2] ) ) * 0.14 );
            const rSum = ra + rb;
            const d2 = dx * dx + dy * dy;
            if ( d2 > 1e-6 && d2 < rSum * rSum )
            {
                const dist = Math.sqrt( d2 );
                const overlap = rSum - dist;
                const mb = Math.max( 1, st.mass[o2] );
                const share = mb / ( ma + mb );
                const sep = Math.min( 1.0, overlap * 0.35 * share );
                const sx = ( dx / dist ) * sep, sy = ( dy / dist ) * sep;
                posX += sx; posY += sy;
                velX += sx * 0.12; velY += sy * 0.12;
                energy -= sep * 0.004;
                if ( energy < ZERO ) { energy = ZERO; }
            }
        }
    }
    if ( PROFILER_ENABLED ) { profExit( PROF_PHYS_COLLISIONS, profCollT0 ); }

    // Wake grid: мягкое увлечение потоком воды (без саморазгона)
    if ( WAKE_GRID_ENABLED )
    {
        const ix = Math.max( 0, Math.min( _WAKE_N - 1, Math.floor( ( posX - POOL_LEFT ) / ( POOL_RIGHT - POOL_LEFT ) * _WAKE_N ) ) );
        const iy = Math.max( 0, Math.min( _WAKE_N - 1, Math.floor( ( posY - POOL_TOP ) / ( POOL_BOTTOM - POOL_TOP ) * _WAKE_N ) ) );
        const widx = iy * _WAKE_N + ix;
        let wx = st.wakeX[widx];
        let wy = st.wakeY[widx];
        const wm2 = wx * wx + wy * wy;
        if ( wm2 > WAKE_MAX_SPEED * WAKE_MAX_SPEED )
        {
            const sc = WAKE_MAX_SPEED / Math.sqrt( wm2 );
            wx *= sc; wy *= sc;
        }
        velX += ( wx - velX ) * 0.025;
        velY += ( wy - velY ) * 0.025;
    }

    // the remembered swimming direction follows the velocity slowly
    if ( STEER_BY_SWIM_DIRECTION_ENABLED )
    {
        B[ b + B_SWIM_X ] += ( velX - B[ b + B_SWIM_X ] ) * SWIM_DIRECTION_SMOOTHING;
        B[ b + B_SWIM_Y ] += ( velY - B[ b + B_SWIM_Y ] ) * SWIM_DIRECTION_SMOOTHING;
    }

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

    // Viscous water resistance for rotation: linear velocity is damped by
    // drag, spin was not, so it accumulated and jerked the head left/right.
    spin *= 0.82;

    posX += velX;
    posY += velY;
    angleNow += spin;

    // CURRENTS_ENABLED: the water carries the body (a heavy one less, when
    // body hydrodynamics is on)
    const current = st.params[ PARAM_CURRENT ];
    if ( current > ZERO )
    {
        const push = motion.enabled ? Math.max( 0.6, Math.min( 1.4, Math.pow( 410 / Math.max( 1, bodyMass ), 1 / 6 ))) : ONE;
        currentAt( posX, posY );
        const driftX = push * current * currentDriftX(), driftY = push * current * currentDriftY();
        posX += driftX;
        posY += driftY;
        // the parts move with the water, not through it: shift where they
        // were too, or the next step would take the drift for a stroke and
        // the drag would cancel it
        for (let p = 0; p < numParts; p++)
        {
            const i = o + p * PS;
            pd[ i + P_X ] += driftX; pd[ i + P_Y ] += driftY;
            pd[ i + M_X ] += driftX; pd[ i + M_Y ] += driftY;
        }
    }

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

    // a still, gliding ambusher lives more cheaply than an active swimmer
    let basal = B[ b + B_BASAL ];
    if (( glide > 0.2 ) && ( effort < 0.75 )) { basal *= ( ONE - 0.5 * glide ); }
    energy -= CONTINUAL_ENERGY_DRAIN + basal;

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
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_PHYSICS_A, profT0 ); } }
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
// bumping into the walls pushes the swimbot away (as Obstacle.getCollision,
// with the push of GenePool: force x 1.2 added to the velocity)
//------------------------------------------------------------------------------
export function obstacleCollision( s: number, st: SharedState ): void
{
    const B = st.bots, b = s * BOT_STRIDE, P = st.params;
    const count = P[ PARAM_WALL_COUNT ];
    if ( count <= 0 ) { return; }

    const END_RADIUS = 20;   // (keep in step with the END_RADIUS of Obstacle)
    let radius = B[ b + B_SUM_LENGTHS ] * ONE_HALF;
    if ( radius < END_RADIUS ) { radius = END_RADIUS; }

    const px = B[ b + B_POS_X ], py = B[ b + B_POS_Y ];

    for ( let w = 0; w < count; w++ )
    {
        const p = PARAM_WALL_BASE + w * 4;
        const x1 = P[ p ], y1 = P[ p + 1 ], x2 = P[ p + 2 ], y2 = P[ p + 3 ];
        const axisX = x2 - x1, axisY = y2 - y1;
        const length = Math.sqrt( axisX * axisX + axisY * axisY );
        if ( length <= ZERO ) continue;

        const perpX = axisY / length, perpY = -axisX / length;
        const midX = ( x1 + x2 ) * ONE_HALF, midY = ( y1 + y2 ) * ONE_HALF;

        const xx = px - midX, yy = py - midY;
        const distanceSquared = xx * xx + yy * yy;
        const ll = length * ONE_HALF + END_RADIUS + radius;
        if ( distanceSquared >= ll * ll ) continue;

        const testX = px - x1, testY = py - y1;
        const dot = testX * perpX + testY * perpY;
        if ( Math.abs( dot ) >= radius ) continue;

        let penetration = ( ONE - ( dot / radius ) );
        if ( dot < ZERO ) { penetration *= -ONE; }
        B[ b + B_VEL_X ] += ( perpX * penetration ) * 1.2;
        B[ b + B_VEL_Y ] += ( perpY * penetration ) * 1.2;
    }
}
