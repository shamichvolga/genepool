//------------------------------------------------------------------------------
// Size of the world. WORLD_SCALE multiplies the width and the height of the
// original 8000 x 8000 pool; the number of swimbots and the food supply grow
// with the area (WORLD_AREA_FACTOR), so the density stays the same.
//
// The size is chosen in the "pool" panel (small / normal / large / huge):
// the page reloads with ?world=1..4 in its address, because every size of
// the simulation is computed once, when the modules load. Worker threads get
// the same number through their name (see ParallelRunner).
// (This module imports nothing, so anything can use it.)
//------------------------------------------------------------------------------
export const DEFAULT_WORLD_SCALE = 2;

function readWorldScale(): number
{
    try
    {
        let text = "";
        if (( typeof location !== "undefined" ) && location.search ) { text += location.search; }
        if (( typeof self !== "undefined" ) && ( self as any ).name ) { text += " " + ( self as any ).name; }
        const match = /world=([1-4])/.exec( text );
        if ( match ) { return parseInt( match[1], 10 ); }
    }
    catch ( e ) { /* no address: the default */ }
    return DEFAULT_WORLD_SCALE;
}

export const WORLD_SCALE        = readWorldScale();
export const WORLD_AREA_FACTOR  = WORLD_SCALE * WORLD_SCALE;
