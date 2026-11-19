// PlantVisuals.ts — единый расчёт геометрии и цвета кроны растения.

import { PLANT_SPROUT_ENERGY } from "./Parameters";

export interface CrownColor
{
    red: number;
    green: number;
    blue: number;
}

export interface CrownRay
{
    angle: number;
    lengthFactor: number;
    color: CrownColor;
    visible: boolean;
}

function clamp( value: number, min: number, max: number ): number
{
    return Math.max( min, Math.min( max, value ));
}

function lerp( a: number, b: number, t: number ): number
{
    return a + ( b - a ) * t;
}

function lerpColor( a: CrownColor, b: CrownColor, t: number, out: CrownColor ): CrownColor
{
    out.red = lerp( a.red, b.red, t );
    out.green = lerp( a.green, b.green, t );
    out.blue = lerp( a.blue, b.blue, t );
    return out;
}

function lighten( color: CrownColor, amount: number, out: CrownColor ): CrownColor
{
    out.red = color.red + ( 1 - color.red ) * amount;
    out.green = color.green + ( 1 - color.green ) * amount;
    out.blue = color.blue + ( 1 - color.blue ) * amount;
    return out;
}

const GREEN_MAIN: CrownColor = { red: 56 / 255, green: 179 / 255, blue: 48 / 255 };
const GREEN_LIGHT: CrownColor = { red: 102 / 255, green: 217 / 255, blue: 61 / 255 };
const AMBER: CrownColor = { red: 212 / 255, green: 163 / 255, blue: 56 / 255 };
const TERRACOTTA: CrownColor = { red: 217 / 255, green: 119 / 255, blue: 87 / 255 };
const COPPER: CrownColor = { red: 140 / 255, green: 59 / 255, blue: 43 / 255 };

const SCRATCH_MAIN: CrownColor = { red: 0, green: 0, blue: 0 };
const SCRATCH_LIGHT: CrownColor = { red: 0, green: 0, blue: 0 };
const SCRATCH_TRUNK: CrownColor = { red: 0, green: 0, blue: 0 };
const SCRATCH_COLORS = { main: SCRATCH_MAIN, light: SCRATCH_LIGHT, trunk: SCRATCH_TRUNK, tau: 0 };
const SCRATCH_RAYS: CrownRay[] = [];
for ( let i = 0; i < 12; i++ )
{
    SCRATCH_RAYS.push( { angle: 0, lengthFactor: 0, color: i % 2 === 0 ? SCRATCH_MAIN : SCRATCH_LIGHT, visible: false } );
}
const SCRATCH_RESULT = { rays: SCRATCH_RAYS, completeness: 0, silhouette: false, colors: SCRATCH_COLORS };

export function plantCrownBaseAngle( f: number ): number
{
    return ( f * 0.61803398875 ) % ( Math.PI / 6 );
}

export function plantBiteAngle( f: number ): number
{
    return ( f * 2.39996322973 ) % ( Math.PI * 2 );
}

export function plantCrownCompleteness( energy: number, wood: number ): number
{
    const denominator = Math.max( PLANT_SPROUT_ENERGY, wood );
    return clamp( energy / Math.max( 1e-9, denominator ), 0, 1 );
}

export function plantCrownColors( wood: number, energy: number, age: number, lifespan: number ): { main: CrownColor; light: CrownColor; trunk: CrownColor; tau: number }
{
    const tau = clamp( lifespan > 0 ? age / lifespan : 0, 0, 1 );
    if ( tau <= 0.60 )
    {
        SCRATCH_MAIN.red = GREEN_MAIN.red;
        SCRATCH_MAIN.green = GREEN_MAIN.green;
        SCRATCH_MAIN.blue = GREEN_MAIN.blue;
    }
    else if ( tau <= 0.72 )
    {
        lerpColor( GREEN_MAIN, AMBER, ( tau - 0.60 ) / 0.12, SCRATCH_MAIN );
    }
    else if ( tau <= 0.86 )
    {
        lerpColor( AMBER, TERRACOTTA, ( tau - 0.72 ) / 0.14, SCRATCH_MAIN );
    }
    else
    {
        lerpColor( TERRACOTTA, COPPER, ( tau - 0.86 ) / 0.14, SCRATCH_MAIN );
    }
    if ( tau <= 0.60 )
    {
        SCRATCH_LIGHT.red = GREEN_LIGHT.red;
        SCRATCH_LIGHT.green = GREEN_LIGHT.green;
        SCRATCH_LIGHT.blue = GREEN_LIGHT.blue;
    }
    else
    {
        lighten( SCRATCH_MAIN, 0.12, SCRATCH_LIGHT );
    }
    const ageNorm = Math.min( 1, wood / 150 );
    SCRATCH_TRUNK.red = 0.45 - 0.10 * ageNorm;
    SCRATCH_TRUNK.green = 0.30 - 0.05 * ageNorm;
    SCRATCH_TRUNK.blue = 0.14;
    SCRATCH_COLORS.tau = tau;
    return SCRATCH_COLORS;
}

export function plantCrownRays( wood: number, energy: number, age: number, lifespan: number, f: number, crownRadius: number ): { rays: CrownRay[]; completeness: number; silhouette: boolean; colors: { main: CrownColor; light: CrownColor; trunk: CrownColor; tau: number } }
{
    const colors = plantCrownColors( wood, energy, age, lifespan );
    const completeness = plantCrownCompleteness( energy, wood );
    const silhouette = completeness < 0.95;
    const baseAngle = plantCrownBaseAngle( f );
    const biteAngle = plantBiteAngle( f );
    const delta = Math.PI * 2 * ( 1 - completeness );
    const halfDelta = delta / 2;
    const scale = 0.5 + 0.5 * completeness;
    for ( let i = 0; i < 12; i++ )
    {
        const angle = baseAngle + i * Math.PI / 6;
        let removed = false;
        if ( silhouette )
        {
            let diff = Math.abs( ( ( angle - biteAngle + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI );
            removed = diff <= halfDelta;
        }
        SCRATCH_RAYS[i].angle = angle;
        SCRATCH_RAYS[i].lengthFactor = ( i % 2 === 0 ? 1.0 : 0.78 ) * ( removed ? 1.0 : scale );
        SCRATCH_RAYS[i].color = i % 2 === 0 ? SCRATCH_MAIN : SCRATCH_LIGHT;
        SCRATCH_RAYS[i].visible = !removed;
    }
    SCRATCH_RESULT.completeness = completeness;
    SCRATCH_RESULT.silhouette = silhouette;
    return SCRATCH_RESULT;
}