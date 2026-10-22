//------------------------------------------------------------------------------
// A drawn map (the map editor, src/ui/mapEditor.ts): zones are polygons in pool
// coordinates, given as a flat list x0, y0, x1, y1, ... Here: is a point
// inside, how big is a zone, a random point in it.
//
// The map itself (what GenePool.startSimulationWithMap takes):
//   base     "vanilla" (the generated temperature map) or "blank" (flat, no food)
//   environment  the generated map it was drawn on (Environment.getState)
//   zones    [{ kind: "plants" | "meat" | "warm" | "cold" | "mild" | "outline", points }]
//   seeds    flat list x, y, code: code > 0 = this many parts; -1, -2, -3 = a
//            pile of the vanilla start (small, medium, big bodies); 0 = any
//   diets    one number per seed: 0 = as usual (about a tenth are born
//            predators), 1 = herbivore, 2 = predator (missing = 0)
//   barrier  { x1, y1, x2, y2 } or null: the wall (the obstacle)
//   partsMin, partsMax  the number of parts the random founders may have
//------------------------------------------------------------------------------
export type MapZone = { kind: string, points: number[] };

export const ZONE_TEMPERATURE: { [ kind: string ]: number } = { warm: 0.85, cold: 0.15, mild: 0.5 };

// the vanilla piles: parts of each (the root counted), as GenePool.startSimulation sorts them
export const PILE_PARTS = [ [ 3, 8 ], [ 9, 12 ], [ 13, 16 ] ];

export function zoneBounds( points: number[] ): { left: number, top: number, right: number, bottom: number }
{
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < points.length; i += 2)
    {
        left = Math.min( left, points[i] ); right = Math.max( right, points[i] );
        top = Math.min( top, points[ i + 1 ] ); bottom = Math.max( bottom, points[ i + 1 ] );
    }
    return { left, top, right, bottom };
}

// even-odd rule
export function pointInZone( x: number, y: number, points: number[] ): boolean
{
    let inside = false;
    const n = points.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i ++)
    {
        const xi = points[ i * 2 ], yi = points[ i * 2 + 1 ], xj = points[ j * 2 ], yj = points[ j * 2 + 1 ];
        if ((( yi > y ) !== ( yj > y )) && ( x < ( xj - xi ) * ( y - yi ) / ( yj - yi ) + xi )) { inside = !inside; }
    }
    return inside;
}

export function zoneArea( points: number[] ): number
{
    let sum = 0;
    const n = points.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i ++) { sum += points[ j * 2 ] * points[ i * 2 + 1 ] - points[ i * 2 ] * points[ j * 2 + 1 ]; }
    return Math.abs( sum ) / 2;
}

// a zone with its box, for quick tests
export type PreparedZone = { points: number[], left: number, top: number, right: number, bottom: number, area: number };

export function prepareZones( zones: MapZone[], kind: string ): PreparedZone[]
{
    return zones.filter( z => z.kind === kind && z.points.length >= 6 ).map( z => ({ points: z.points, ...zoneBounds( z.points ), area: zoneArea( z.points ) }));
}

export function insideAny( zones: PreparedZone[], x: number, y: number ): boolean
{
    for ( const z of zones )
    {
        if ( x < z.left || x > z.right || y < z.top || y > z.bottom ) continue;
        if ( pointInZone( x, y, z.points )) return true;
    }
    return false;
}

// a random point inside a zone (random numbers from `random`); false if none was found
export function randomPointInZone( z: PreparedZone, random: () => number, out: { x: number, y: number } ): boolean
{
    for (let attempt = 0; attempt < 60; attempt++)
    {
        const x = z.left + random() * ( z.right - z.left ), y = z.top + random() * ( z.bottom - z.top );
        if ( pointInZone( x, y, z.points )) { out.x = x; out.y = y; return true; }
    }
    return false;
}
