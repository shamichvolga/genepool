// The soil grid is a pure constant, kept apart from SharedState so that Pool
// can size its texture without importing SharedState (that import was one of
// the edges of the startup cycle Environment -> Pool -> SharedState -> ...).
export const SOIL_GRID_N = 256;
