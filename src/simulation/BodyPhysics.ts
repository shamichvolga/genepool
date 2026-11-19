import { BODY_HYDRODYNAMICS_ENABLED, QUADRATIC_WATER_ENABLED } from "./Parameters";

const REFERENCE_BODY_MASS = 450;
const REFERENCE_BODY_WIDTH = 3.5;
const WATER_DRAG_COEFFICIENT = 0.004;
const WATER_DRAG_ENERGY_SCALE = 0.0001;
const MAX_WATER_DRAG_FRACTION = 0.30;

export interface BodyMotionFactors
{
    enabled: boolean;
    acceleration: number;
    drag: number;
    strokeCost: number;
}

const _motionScratch: BodyMotionFactors = { enabled: false, acceleration: 1, drag: 1, strokeCost: 1 };
let _cachedMass = -1, _cachedWidth = -1;
const _cachedMotion: BodyMotionFactors = { enabled: false, acceleration: 1, drag: 1, strokeCost: 1 };

function clamp( value: number, min: number, max: number ): number
{
    return value < min ? min : ( value > max ? max : value );
}

export function bodyMotionFactors( mass: number, meanWidth: number, out: BodyMotionFactors = _motionScratch ): BodyMotionFactors
{
    if ( !BODY_HYDRODYNAMICS_ENABLED || !( mass > 0 ) || !( meanWidth > 0 ))
    {
        out.enabled = false; out.acceleration = 1; out.drag = 1; out.strokeCost = 1;
        return out;
    }
    if ( mass === _cachedMass && meanWidth === _cachedWidth )
    {
        out.enabled = _cachedMotion.enabled;
        out.acceleration = _cachedMotion.acceleration;
        out.drag = _cachedMotion.drag;
        out.strokeCost = _cachedMotion.strokeCost;
        return out;
    }

    const relativeMass = clamp( mass / REFERENCE_BODY_MASS, 0.25, 4 );
    const sqrtMass = Math.sqrt( relativeMass );
    const relativeBreadth = clamp( ( meanWidth / REFERENCE_BODY_WIDTH ) / sqrtMass, 0.5, 2 );
    const sqrtBreadth = Math.sqrt( relativeBreadth );

    _cachedMass = mass;
    _cachedWidth = meanWidth;
    _cachedMotion.enabled = true;
    _cachedMotion.acceleration = clamp( Math.pow( relativeMass, -1 / 6 ) * sqrtBreadth, 0.4, 2.2 );
    _cachedMotion.drag = clamp( relativeBreadth * relativeBreadth, 0.2, 4 );
    _cachedMotion.strokeCost = clamp( Math.pow( relativeMass, 0.15 ) * sqrtBreadth, 0.4, 2.2 );

    out.enabled = true;
    out.acceleration = _cachedMotion.acceleration;
    out.drag = _cachedMotion.drag;
    out.strokeCost = _cachedMotion.strokeCost;
    return out;
}

export interface WaterDragResult
{
    velocityX: number;
    velocityY: number;
    energyCost: number;
}

// Quadratic drag damps fast movement more than slow movement. Its energy cost
// is estimated from the kinetic energy lost during this step, then converted
// to the simulation's energy units.
export function applyWaterDrag( velocityX: number, velocityY: number, mass: number, sumLengths: number, dragScale: number ): WaterDragResult
{
    if ( !BODY_HYDRODYNAMICS_ENABLED || !( mass > 0 ) || !( dragScale > 0 ))
    {
        return { velocityX, velocityY, energyCost: 0 };
    }
    if ( !QUADRATIC_WATER_ENABLED )
    {
        const speed = Math.sqrt( velocityX * velocityX + velocityY * velocityY );
        if ( !( speed > 0 )) return { velocityX, velocityY, energyCost: 0 };
        const fraction = Math.min( MAX_WATER_DRAG_FRACTION, WATER_DRAG_COEFFICIENT * dragScale * speed );
        const retained = 1 - fraction;
        const kineticEnergyLost = 0.5 * mass * speed * speed * ( 1 - retained * retained );
        return {
            velocityX: velocityX * retained,
            velocityY: velocityY * retained,
            energyCost: kineticEnergyLost * WATER_DRAG_ENERGY_SCALE,
        };
    }

    const speed = Math.sqrt( velocityX * velocityX + velocityY * velocityY );
    if ( !( speed > 0 )) return { velocityX, velocityY, energyCost: 0 };

    const lengthDrag = Math.min( 0.08, 0.00018 * sumLengths );
    const fraction = Math.min( MAX_WATER_DRAG_FRACTION, WATER_DRAG_COEFFICIENT * dragScale * speed + lengthDrag );
    const retained = 1 - fraction;
    const kineticEnergyLost = 0.5 * mass * speed * speed * ( 1 - retained * retained );
    const addedMassCost = 0.00004 * sumLengths * sumLengths * speed * speed * WATER_DRAG_ENERGY_SCALE;
    const longitudinalFriction = 0.00025 * sumLengths * speed * WATER_DRAG_ENERGY_SCALE;
    return {
        velocityX: velocityX * retained,
        velocityY: velocityY * retained,
        energyCost: kineticEnergyLost * WATER_DRAG_ENERGY_SCALE + addedMassCost + longitudinalFriction,
    };
}
