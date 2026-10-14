//------------------------------------------------------------------------------
// "Petri" pool: like the MEGA-plate experiment (bacteria and antibiotics,
// Harvard 2016). The world is cut into a few big zones in a row, each one
// warmer than the one before. Life starts only in the middle (mildest) zone;
// the others are empty and full of food. To move on, a lineage must first
// adapt to the next temperature - so the world is conquered in waves.
//
// The settings come from the pool panel: number of zones, their shape
// (stripes, rings, star, spiral) and how soft the borders are.
// (No imports: the map and the little preview picture both use it.)
//------------------------------------------------------------------------------
export const PETRI_LAYOUTS = [ "stripes", "rings", "star", "spiral" ];

export const petriSettings =
{
    zones    : 7,      // 2..12
    layout   : 0,      // index in PETRI_LAYOUTS
    softness : 0.1,    // 0 = sharp borders .. 1 = the border is as wide as a zone
};

export const PETRI_COLDEST = 0.1;    // temperature of the first zone
export const PETRI_HOTTEST = 0.9;    // ... and of the last

// where a point is along the zones: 0..1 (x, y: 0..1 inside the world)
export function petriPosition( x: number, y: number, layout: number ): number
{
    const dx = x - 0.5, dy = y - 0.5;
    const radius = Math.min( 1, Math.sqrt( dx * dx + dy * dy ) / 0.5 );
    const angle  = ( Math.atan2( dy, dx ) / ( 2 * Math.PI ) + 1 ) % 1;
    if ( layout === 1 ) return radius;                       // rings: from the middle out
    if ( layout === 2 ) return angle;                        // star: around the middle
    if ( layout === 3 ) return ( angle + radius * 0.75 ) % 1; // spiral: twisted star
    return x;                                                // stripes: left to right
}

// the zone "level": 0 .. zones-1, with soft steps between zones
export function petriLevel( position: number, zones: number, softness: number ): number
{
    const v = position * zones;
    if ( softness <= 0.001 ) return Math.min( zones - 1, Math.floor( v ));
    let level = 0;
    for ( let border = 1; border < zones; border++ )
    {
        level += Math.min( 1, Math.max( 0, ( v - border ) / softness + 0.5 ));
    }
    return level;
}

export function petriTemperature( level: number, zones: number ): number
{
    return PETRI_COLDEST + ( PETRI_HOTTEST - PETRI_COLDEST ) * ( zones > 1 ? level / ( zones - 1 ) : 0.5 );
}

// the zone where life starts: the middle one (the mildest temperature)
export function petriStartZone( zones: number ): number { return Math.floor(( zones - 1 ) / 2 ); }

// draw the zones into a small canvas (the clickable picture in the panel)
export function drawPetriPreview( canvas: HTMLCanvasElement, zones: number, layout: number, softness: number ): void
{
    const context = canvas.getContext( "2d" );
    const w = canvas.width, h = canvas.height;
    const image = context.createImageData( w, h );
    const start = petriStartZone( zones );
    for ( let j = 0; j < h; j++ )
    {
        for ( let i = 0; i < w; i++ )
        {
            const level = petriLevel( petriPosition( ( i + 0.5 ) / w, ( j + 0.5 ) / h, layout ), zones, softness );
            const t = petriTemperature( level, zones );
            const k = ( j * w + i ) * 4;
            const isStart = Math.round( level ) === start;
            image.data[k    ] = 40 + t * 180;
            image.data[k + 1] = isStart ? 170 : 70 + t * 40;
            image.data[k + 2] = 200 - t * 160;
            image.data[k + 3] = 255;
        }
    }
    context.putImageData( image, 0, 0 );
}
