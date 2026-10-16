import { BODY_HYDRODYNAMICS_ENABLED } from "./Parameters";

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

function clamp( value: number, min: number, max: number ): number
{
    return Math.max( min, Math.min( max, value ));
}

// Mass is the current segment-area proxy (sum of length * width). Width is its
// length-weighted mean. The aspect factor distinguishes broad shapes from
// slimmer bodies without assigning a preferred climate or behaviour.
export function bodyMotionFactors( mass: number, meanWidth: number ): BodyMotionFactors
{
    if ( !BODY_HYDRODYNAMICS_ENABLED || !( mass > 0 ) || !( meanWidth > 0 ))
    {
        return { enabled: false, acceleration: 1, drag: 1, strokeCost: 1 };
    }

    const relativeMass = clamp( mass / REFERENCE_BODY_MASS, 0.25, 4 );
    const relativeBreadth = clamp(
        ( meanWidth / REFERENCE_BODY_WIDTH ) / Math.sqrt( relativeMass ),
        0.5,
        2
    );
    const massScale = Math.pow( relativeMass, -1 / 3 );
    return {
        enabled: true,
        acceleration: clamp( massScale * Math.sqrt( relativeBreadth ), 0.4, 2.2 ),
        // (drag: by the breadth only - a narrow big body cruises cheaply, a
        //  broad one is a slow "tank"; it was also x mass^-1/3, which left big
        //  bodies only the costs)
        drag: clamp( relativeBreadth * relativeBreadth, 0.2, 4 ),
        strokeCost: clamp( Math.pow( relativeMass, 1 / 3 ) * Math.sqrt( relativeBreadth ), 0.4, 2.2 ),
    };
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
export function applyWaterDrag( velocityX: number, velocityY: number, mass: number, dragScale: number ): WaterDragResult
{
    if ( !BODY_HYDRODYNAMICS_ENABLED || !( mass > 0 ) || !( dragScale > 0 ))
    {
        return { velocityX, velocityY, energyCost: 0 };
    }

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
