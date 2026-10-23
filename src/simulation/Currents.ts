//------------------------------------------------------------------------------
// Currents: a few big ring-shaped streams (gyres), like the ocean's Gulf
// Stream - rare on the map but wide and strong. Inside a ring band the water
// flows along the ring; away from the rings it is still. A flow that only
// goes round its centre neither piles things up nor thins them out.
//
// currentAt( x, y ) sets currentX, currentY: the drift per step at full
// strength 1 (multiply by the current speed).
//------------------------------------------------------------------------------
import { POOL_LEFT, POOL_TOP, POOL_WIDTH, POOL_HEIGHT } from "./Pool";

// centre, radius and width of each ring (fractions of the pool), direction (+1 clockwise on screen)
const RINGS = [
    { cx: 0.30, cy: 0.32, radius: 0.22, width: 0.045, turn:  1 },
    { cx: 0.70, cy: 0.66, radius: 0.20, width: 0.040, turn: -1 },
    { cx: 0.22, cy: 0.80, radius: 0.11, width: 0.030, turn:  1 },
];
const RING_X = RINGS.map( r => POOL_LEFT + r.cx * POOL_WIDTH );
const RING_Y = RINGS.map( r => POOL_TOP  + r.cy * POOL_HEIGHT );
const RING_R = RINGS.map( r => r.radius * POOL_WIDTH );
const RING_W = RINGS.map( r => r.width  * POOL_WIDTH );

export let currentX = 0;
export let currentY = 0;
let strength = 0;

export function currentAt( x: number, y: number ): void
{
    currentX = 0; currentY = 0; strength = 0;
    for (let i = 0; i < RINGS.length; i++)
    {
        const dx = x - RING_X[i], dy = y - RING_Y[i];
        const r = Math.sqrt( dx * dx + dy * dy );
        const off = ( r - RING_R[i] ) / RING_W[i];
        if (( off > 3 ) || ( off < -3 ) || ( r < 1 )) continue;
        const g = Math.exp( -off * off );
        const t = RINGS[i].turn * g / r;             // along the ring
        currentX += -dy * t;
        currentY +=  dx * t;
        strength = Math.max( strength, g );
    }
}

// CURRENT_AWARENESS_ENABLED: how much farther (> 1) or nearer (< 1) a target
// feels when the water flows. (driftX, driftY): the drift here; (wayX, wayY):
// the way to the target; speed: my own swimming speed. The time of the way
// at my speed with the drift added, as a share of the time in still water;
// awareness 0 = the drift is not noticed (1), 1 = all of it.
export function currentTravelFactor( driftX: number, driftY: number, wayX: number, wayY: number, speed: number, awareness: number ): number
{
    const d = Math.sqrt( wayX * wayX + wayY * wayY );
    if (( awareness <= 0 ) || ( d <= 0 )) return 1;
    const along = ( driftX * wayX + driftY * wayY ) / d;           // (negative: against the stream)
    const effective = Math.max( 0.2 * speed, speed + along );     // (against a strong stream: slowly, never back)
    return 1 + awareness * ( speed / effective - 1 );
}

// (functions: the numbers above are live only inside this module)
export function currentDriftX(): number { return currentX; }
export function currentDriftY(): number { return currentY; }
export function currentStrength(): number { return strength; }

// a random point inside one of the streams (for the drifting marks)
export function randomPointInCurrent( random: () => number, out: { x: number, y: number } ): void
{
    let total = 0;
    for (let i = 0; i < RINGS.length; i++) { total += RING_R[i] * RING_W[i]; }
    let pick = random() * total, i = 0;
    for ( ; i < RINGS.length - 1; i++) { pick -= RING_R[i] * RING_W[i]; if ( pick <= 0 ) break; }
    const angle = random() * Math.PI * 2;
    const r = RING_R[i] + RING_W[i] * ( random() + random() + random() - 1.5 ) * 0.9;
    out.x = RING_X[i] + r * Math.cos( angle );
    out.y = RING_Y[i] + r * Math.sin( angle );
}
