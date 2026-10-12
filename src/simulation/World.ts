//------------------------------------------------------------------------------
// Size of the world. WORLD_SCALE multiplies the width and the height of the
// original 8000 x 8000 pool; the number of swimbots and the food supply grow
// with the area (WORLD_AREA_FACTOR), so the density stays the same.
// (This module imports nothing, so anything can use it.)
//------------------------------------------------------------------------------
export const WORLD_SCALE        = 2;
export const WORLD_AREA_FACTOR  = WORLD_SCALE * WORLD_SCALE;
