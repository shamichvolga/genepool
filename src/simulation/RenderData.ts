//------------------------------------------------------------------------------
// What the graphics card needs to draw a body, written by the physics threads
// right after the body moved (in parallel, see ParallelWork TASK_PHYSICS):
// one record per body part, RENDER_FLOATS numbers each -
//   parent end x y, own end x y, radius at the start, radius at the end,
//   red green blue alpha
// so drawing a frame is only copying these blocks (no work per part on the
// simulation thread). The colours follow SwimbotRenderer.calculatePartColor:
// a newborn starts white, a starving or old body turns grey.
//------------------------------------------------------------------------------
import { OLD_AGE_DURATION, YOUNG_AGE_DURATION } from "./Parameters";
import { SharedState, BOT_STRIDE, PART_STRIDE, PS, P_X, P_Y, PARAM_MAX_LIFESPAN,
         B_AGE, B_ENERGY, B_ETERNAL, B_GROWTH, B_NUM_PARTS, B_POS_X, B_POS_Y } from "./SharedState";
import { MAX_PARTS, NULL_PART, STARVING } from "./SwimbotTypes";
import { MIND_STRIDE, M_DISEASE } from "./MindLayout";

export const RENDER_FLOATS = 10;   // (as CapsuleRenderer's FLOATS_PER_CAPSULE)

const DEAD_RED = 0.2, DEAD_GREEN = 0.25, DEAD_BLUE = 0.3, EGG_SIZE = 5.0;

export function writeRenderData( s: number, st: SharedState ): void
{
    const B = st.bots, b = s * BOT_STRIDE;
    const pd = st.parts, o = s * PART_STRIDE, k = s * MAX_PARTS;
    const out = st.renderParts;
    const numParts = B[ b + B_NUM_PARTS ];

    // how much newborn white / dying grey is mixed in
    let white = 0, dead = 0;
    if ( B[ b + B_ETERNAL ] === 0 )
    {
        const age = B[ b + B_AGE ], energy = B[ b + B_ENERGY ];
        const oldAgeThreshold = st.params[ PARAM_MAX_LIFESPAN ] - OLD_AGE_DURATION;
        if ( age < oldAgeThreshold )
        {
            if      ( age    < YOUNG_AGE_DURATION ) { white = 1 - B[ b + B_GROWTH ]; }
            else if ( energy < STARVING           ) { dead  = 1 - Math.max( 0, energy ) / STARVING; }
        }
        else { dead = Math.max( 0, Math.min( 1, ( age - oldAgeThreshold ) / OLD_AGE_DURATION )); }
    }
    const keep = 1 - white - dead;
    const greyR = white + dead * DEAD_RED, greyG = white + dead * DEAD_GREEN, greyB = white + dead * DEAD_BLUE;
    const growth = Math.min( 1, B[ b + B_GROWTH ] ), egg = EGG_SIZE * ( 1 - growth );

    const sick = st.mind[ s * MIND_STRIDE + M_DISEASE ] > 0;
    let i = k * RENDER_FLOATS;
    for (let p = 1; p < numParts; p++)
    {
        const parent = st.partParent[ k + p ];
        if ( parent === NULL_PART ) { out[ i ] = B[ b + B_POS_X ]; out[ i + 1 ] = B[ b + B_POS_Y ]; }
        else { out[ i ] = pd[ o + parent * PS + P_X ]; out[ i + 1 ] = pd[ o + parent * PS + P_Y ]; }
        out[ i + 2 ] = pd[ o + p * PS + P_X ];
        out[ i + 3 ] = pd[ o + p * PS + P_Y ];
        out[ i + 4 ] = st.partStartWidth[ k + p ] * growth + egg;
        out[ i + 5 ] = st.partWidth[ k + p ]      * growth + egg;
        out[ i + 6 ] = greyR + st.partRGB[ ( k + p ) * 3     ] * keep;
        out[ i + 7 ] = greyG + st.partRGB[ ( k + p ) * 3 + 1 ] * keep;
        out[ i + 8 ] = greyB + st.partRGB[ ( k + p ) * 3 + 2 ] * keep;
        out[ i + 9 ] = 1;
        // sick (DISEASE_ENABLED): every other part pale - spots
        if ( sick && ( p % 2 === 1 ))
        {
            out[ i + 6 ] = 0.5 * out[ i + 6 ] + 0.45;
            out[ i + 7 ] = 0.5 * out[ i + 7 ] + 0.44;
            out[ i + 8 ] = 0.5 * out[ i + 8 ] + 0.275;
        }
        i += RENDER_FLOATS;
    }
}
