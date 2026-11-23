// The soil grid scales with the world so that one soil cell is always
// 62.5 x 62.5 world units (8000/128 = 16000/256 = 32000/512 = 62.5).
// Kept apart from SharedState so Pool can size its texture without importing it.
import { WORLD_SCALE } from "./World";
export const SOIL_GRID_N = WORLD_SCALE <= 1 ? 128 :
                           WORLD_SCALE <= 2 ? 256 :
                           WORLD_SCALE <= 4 ? 192 :
                           128 * WORLD_SCALE;  // Use capped values for memory optimization
