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
    PARAM_WALL_COUNT, PARAM_WALL_BASE
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

        // Асимметричный суставной упор ("колени" / Joint ROM)
        if ( p > 1 )
        {
            const jMin = st.partJointMin[ k + p ] || JOINT_MIN_ANGLE;
            const jMax = st.partJointMax[ k + p ] || JOINT_MAX_ANGLE;
            const relativeAngle = pd[ i + C_A ] - pd[ j + C_A ];
            if ( relativeAngle < jMin ) { pd[ i + C_A ] = pd[ j + C_A ] + jMin; }
            if ( relativeAngle > jMax ) { pd[ i + C_A ] = pd[ j + C_A ] + jMax; }
        }

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
        if ( growth < ONE ) { partLength *= NEWBORN_SIZE_SCALE + ( ONE - NEWBORN_SIZE_SCALE ) * growth; }

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
                        const impulse = Math.min( CAVITY_JET_MAX, CAVITY_JET_C * ( dS * dS ) / gap ) * ( motion.enabled ? motion.acceleration : 1 );
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
    // Tree obstacles and body collisions: every other step (each body skips
    // half the steps, so the grid is walked half as often)
    if ((( st.params[ PARAM_STEP ] + s ) & 1 ) === 0 )
    {
        // Tree obstacles: O(N) поиск стволов через foodGrid
        if ( TREE_OBSTACLES_ENABLED )
        {
            const searchR = sumLengths * 0.5 + TREE_OBSTACLE_RADIUS_BASE + TREE_OBSTACLE_RADIUS_SCALE + 8;
            const fn = st.foodGrid.collect( posX, posY, searchR, _kernelGridBuf );
            for ( let fi = 0; fi < fn; fi++ )
            {
                const tf = _kernelGridBuf[fi];
                if ( st.liveFood[tf] !== 1 || st.foodType[tf] === 2 || st.foodWood[tf] < WOOD_PER_FRUIT_TIER ) continue;
                const tx = st.foodX[tf], ty = st.foodY[tf];
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
                        const push = Math.min( BODY_COLLISION_MAX_IMPULSE, overlap * BODY_COLLISION_PUSH * 1.8 );
                        velX += ( dx / dist ) * push;
                        velY += ( dy / dist ) * push;
                        energy -= push * 0.005;
                        if ( energy < ZERO ) { energy = ZERO; }
                    }
                }
            }
        }

        // Body collisions: O(N) потокобезопасное отталкивание через swimbotGrid (пишем только в себя)
        if ( BODY_COLLISIONS_ENABLED )
        {
            const ra = Math.max( 3, Math.sqrt( Math.max( 1, bodyMass ) ) * 0.14 );
            const nn = st.swimbotGrid.collect( posX, posY, ra + 26, _kernelGridBuf );
            const ma = Math.max( 1, bodyMass );
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
                    const push = Math.min( BODY_COLLISION_MAX_IMPULSE, overlap * BODY_COLLISION_PUSH * 1.8 * ( mb / ( ma + mb ) ) * 2.0 );
                    velX += ( dx / dist ) * push;
                    velY += ( dy / dist ) * push;
                    energy -= push * 0.004;
                    if ( energy < ZERO ) { energy = ZERO; }
                }
            }
        }
    }

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
        velX += ( wx - velX ) * 0.06;
        velY += ( wy - velY ) * 0.06;
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
