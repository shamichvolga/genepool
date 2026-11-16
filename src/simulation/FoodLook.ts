//------------------------------------------------------------------------------
// How food bits look on the pool, in one place. The screen draws plants three
// ways - as capsules on the graphics card (GenePool.writeFoodDots), on the 2D
// canvas up close (FoodBit.render) and in the FoodBit.writeCapsule fallback -
// and all of them use the shapes below, so a plant looks the same everywhere.
//
// Every plant grows through three stages (PLANT_SIZE_ENABLED: its size; else
// its age, PLANT_STAGES_SHOWN), and the stage shows as a form:
//
//   sprout  size < 0.20  a seedling: a short stalk and two round cotyledons
//   sapling size < 0.70  three leaves in a rosette, on a short stem
//   mature  size >= 0.70 a crown: an eight-ray starburst after Claude's avatar,
//                        four long rays and four short ones, with a dark core
//
// The starburst is drawn with tapered capsules (thick where it leaves the
// centre, thin at the tip), so a grown plant never reads as a fat dot - it is
// a flat, open crown around a small core. Far away the crown stays a few
// pixels wide: still a star, not a point.
//
// A piece of meat smaller than a whole one is a wedge of a dot (the original
// draws a part of a circle); a fruit is yellow with a small green leaf.
//------------------------------------------------------------------------------
import { PI2 } from "./MathConstants";
import { MEAT_PIECE_ENERGY } from "./Parameters";

// size thresholds of the three plant stages (and of the 2D drawing in FoodBit)
export const PLANT_SPROUT_MAX = 0.20;
export const PLANT_SAPLING_MAX = 0.70;

// screen widths in pixels. A mature crown is about 9 pixels across, whatever
// the zoom, and grows with the plant only a little, so it stays a star when
// the whole pool is in view and is still a star when zoomed in.
const SPROUT_PIXELS   = 2.6;
const SAPLING_PIXELS  = 5.0;
const CROWN_PIXELS    = 9.0;

// the starburst: eight rays, long ones (0, 2, 4, 6) at 45 degree steps from "up"
const CROWN_RAYS = 8;

//------------------------------------------------------------------------------
// one capsule as the screen wants it (the same numbers CapsuleRenderer.add takes)
//------------------------------------------------------------------------------
export type FoodCapsule = { ax: number, ay: number, bx: number, by: number,
                            ra: number, rb: number, red: number, green: number, blue: number, alpha: number };

export type FoodShape =
{
    red: number, green: number, blue: number, alpha: number,
    capsules: FoodCapsule[],
};

// the green of a plant: a brighter young one and a darker grown one (the same
// colours the 2D drawing in FoodBit uses)
const SPROUT_RGB  = [ 0.50, 0.91, 0.25 ];   // rgb( 128, 232, 64 )
const SAPLING_RGB = [ 0.28, 0.77, 0.22 ];   // rgb( 71, 196, 56 )
const CROWN_RGB   = [ 0.22, 0.70, 0.19 ];   // rgb( 56, 179, 48 )
const FRUIT_RGB   = [ 0.98, 0.61, 0.12 ];   // (the yellow "255, 211, 63" of the 2D drawing)
const MEAT_RGB    = [ 0.9, 0.1, 0.1 ];

const shade = ( rgb: number[], k: number ) => [ Math.min( 1, rgb[0] * k ), Math.min( 1, rgb[1] * k ), Math.min( 1, rgb[2] * k ) ];

//------------------------------------------------------------------------------
// which of the three forms a plant shows
//------------------------------------------------------------------------------
export function plantStageOf( size: number ): number
{
    return size < PLANT_SPROUT_MAX ? 0 : size < PLANT_SAPLING_MAX ? 1 : 2;
}

// the size of a plant in "dot radii": what FoodBit has always used to draw it
// (a sprout is a small dot, a tree a big one)
export function plantDotScale( size: number ): number { return 0.6 + 1.8 * size; }

// the radius of the central core, in "dot radii"
export function plantCoreScale( stage: number ): number
{
    return stage === 0 ? 0.40 : stage === 1 ? 0.46 : 0.34;
}

// the size of the starburst around its centre, in pixels (the long rays reach it)
export function crownPixels( size: number ): number { return CROWN_PIXELS * ( 0.94 + 0.16 * size ); }

// what a piece of meat is: 1 whole, or a half or a third of one
export function meatPortion( energy: number ): number
{
    const share = energy / MEAT_PIECE_ENERGY;
    return ( share >= 0.8 ) ? 1 : ( share >= 0.42 ) ? 0.5 : 1 / 3;
}

//------------------------------------------------------------------------------
// the picture of a plant. dotRadius is the radius of an ordinary food dot at
// this zoom (FoodBit.getDotRadius); pixel is how much of the pool is one
// screen pixel. The centre is the plant's position.
//------------------------------------------------------------------------------
export function plantShape( x: number, y: number, dotRadius: number, pixel: number, size: number, alpha: number ): FoodShape
{
    const stage = plantStageOf( size );
    const capsules: FoodCapsule[] = [];
    const core = Math.max( dotRadius * plantCoreScale( stage ), pixel * ( stage === 0 ? 0.80 : 1.05 ));
    const rgb = stage === 0 ? SPROUT_RGB : stage === 1 ? SAPLING_RGB : CROWN_RGB;
    const add = ( ax: number, ay: number, bx: number, by: number, ra: number, rb: number, r: number, g: number, b: number ) =>
    {
        capsules.push({ ax, ay, bx, by, ra, rb, red: r, green: g, blue: b, alpha });
    };

    if ( stage === 0 )
    {
        // a seedling: a short stalk and two round cotyledons
        add( x, y + pixel * 0.20, x, y - pixel * 0.95, pixel * 0.22, pixel * 0.20, SPROUT_RGB[0], SPROUT_RGB[1], SPROUT_RGB[2] );
        for ( let leaf = 0; leaf < 2; leaf++ )
        {
            const side = leaf === 0 ? -1 : 1;
            add( x, y - pixel * 0.55, x + side * pixel * 1.00, y - pixel * 0.95,
                 pixel * 0.44, pixel * 0.34, SPROUT_RGB[0], SPROUT_RGB[1], SPROUT_RGB[2] );
        }
    }
    else if ( stage === 1 )
    {
        // a sapling: a short stem and three leaves in a rosette
        add( x, y + pixel * 0.55, x, y - pixel * 0.55, pixel * 0.24, pixel * 0.20, SAPLING_RGB[0], SAPLING_RGB[1], SAPLING_RGB[2] );
        const reach = pixel * 2.05;
        for ( let leaf = 0; leaf < 3; leaf++ )
        {
            const a = -Math.PI / 2 + leaf * PI2 / 3;
            add( x + Math.cos( a ) * reach * 0.30, y + Math.sin( a ) * reach * 0.30,
                 x + Math.cos( a ) * reach,        y + Math.sin( a ) * reach,
                 pixel * 0.55, pixel * 0.40, SAPLING_RGB[0], SAPLING_RGB[1], SAPLING_RGB[2] );
        }
    }
    else
    {
        // a mature plant: the eight-ray starburst. Long rays are thick where
        // they leave the centre and thin at the tip; short ones in between.
        const crown = crownPixels( size );
        for ( let ray = 0; ray < CROWN_RAYS; ray++ )
        {
            const a = -Math.PI / 2 + ray * PI2 / CROWN_RAYS;
            const long = ( ray % 2 ) === 0;
            const inner = crown * ( long ? 0.26 : 0.30 );
            const outer = crown * ( long ? 1.00 : 0.76 );
            const rgbRay = shade( CROWN_RGB, long ? 1.28 : 0.82 );
            add( x + Math.cos( a ) * inner, y + Math.sin( a ) * inner,
                 x + Math.cos( a ) * outer, y + Math.sin( a ) * outer,
                 pixel * ( long ? 0.52 : 0.44 ), pixel * 0.08, rgbRay[0], rgbRay[1], rgbRay[2] );
        }
    }
    // the core goes last: it sits on top of the stems and rays, so it reads as
    // the middle of the plant rather than as a dot with things stuck to it
    add( x, y, x, y, core, core, rgb[0], rgb[1], rgb[2] );
    return { red: rgb[0], green: rgb[1], blue: rgb[2], alpha, capsules };
}

//------------------------------------------------------------------------------
// a fruit: a yellow berry with a small green leaf (never the red of meat)
//------------------------------------------------------------------------------
export function fruitShape( x: number, y: number, dotRadius: number, pixel: number, alpha: number ): FoodShape
{
    const r = Math.max( dotRadius * 0.62, pixel * 0.95 );
    return { red: FRUIT_RGB[0], green: FRUIT_RGB[1], blue: FRUIT_RGB[2], alpha, capsules: [
        { ax: x, ay: y, bx: x, by: y, ra: r, rb: r, red: FRUIT_RGB[0], green: FRUIT_RGB[1], blue: FRUIT_RGB[2], alpha },
        { ax: x - pixel * 0.05, ay: y - pixel * 0.55, bx: x + pixel * 0.80, by: y - pixel * 1.05,
          ra: pixel * 0.27, rb: pixel * 0.20, red: 0.22, green: 0.62, blue: 0.16, alpha },
    ]};
}

//------------------------------------------------------------------------------
// a piece of meat: a whole dot, or a wedge of one (a fan of short thick rays)
//------------------------------------------------------------------------------
export function meatShape( x: number, y: number, dotRadius: number, energy: number, alpha: number ): FoodShape
{
    const portion = meatPortion( energy );
    const capsules: FoodCapsule[] = [];
    if ( portion >= 1 )
    {
        capsules.push({ ax: x, ay: y, bx: x, by: y, ra: dotRadius, rb: dotRadius, red: MEAT_RGB[0], green: MEAT_RGB[1], blue: MEAT_RGB[2], alpha });
    }
    else
    {
        const rays = ( portion === 0.5 ) ? 5 : 4, span = portion * PI2, w = dotRadius * ( portion === 0.5 ? 0.62 : 0.5 );
        for ( let k = 0; k < rays; k++ )
        {
            const a = -span / 2 + k * span / ( rays - 1 );
            capsules.push({ ax: x, ay: y, bx: x + Math.cos( a ) * dotRadius * 0.75, by: y + Math.sin( a ) * dotRadius * 0.75,
                            ra: w, rb: w, red: MEAT_RGB[0], green: MEAT_RGB[1], blue: MEAT_RGB[2], alpha });
        }
    }
    return { red: MEAT_RGB[0], green: MEAT_RGB[1], blue: MEAT_RGB[2], alpha, capsules };
}
