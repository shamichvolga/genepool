//------------------------------------------------------------------------------
// Where things are in the shared "mind" rows (see SharedState.mind and
// DecisionKernel.ts). Kept in a module that imports nothing, so Brain,
// Swimbot, the kernels and the workers can all use it.
//------------------------------------------------------------------------------
// the mind: what a swimbot's brain keeps from step to step
// (one row of MIND_STRIDE numbers per swimbot, in `mind`).
// The decision kernel (DecisionKernel.ts) reads and writes it
// in any thread; Swimbot and Brain read the same numbers.
//------------------------------------------------------------
export const M_STATE         = 0;    // brain state (BRAIN_STATE_...)
export const M_GOAL          = 1;    // neural brain: chosen drive, -1 = classic brain
export const M_HUNGER        = 2;    // hunger threshold
export const M_FOUND_FOOD    = 3;
export const M_FOUND_MATE    = 4;
export const M_FOUND_PREY    = 5;
export const M_THREAT_NEAR   = 6;    // a hunting predator close enough to flee from
export const M_PRED_LEVEL    = 7;    // the brain's copy of the predator level
export const M_BRAIN_ENERGY  = 8;    // the brain's copy of the energy
export const M_ATTRACTION    = 9;    // mate choice criterion
export const M_NEURAL        = 10;   // 1 = neural brain
export const M_HUNT_CD       = 11;   // steps until the next bite
export const M_SELF_FEED_CD  = 12;
export const M_SCAN_CD       = 13;
export const M_SCAN_RADIUS   = 14;
export const M_READY         = 15;   // 1 = will look around this step
export const M_TRY_EAT       = 16;
export const M_TRY_HUNT      = 17;
export const M_TRY_MATE      = 18;
export const M_FOOD          = 19;   // chosen food bit (-1 = none)
export const M_MATE          = 20;   // chosen mate (-1 = none)
export const M_PREY          = 21;   // chosen prey (-1 = none)
export const M_NEAR_PRED     = 22;   // hunting predator close enough to flee from (-1 = none)
export const M_CALM_PRED     = 23;   // a predator to keep away from (neural brain)
export const M_LAST_MEAT     = 24;
export const M_SEEN_FOOD     = 25;
export const M_SEEN_FOOD_X   = 26;
export const M_SEEN_FOOD_Y   = 27;
export const M_SEEN_PREY     = 28;
export const M_NUM_SEEN      = 29;
export const M_NEAREST_SEEN  = 30;
export const M_THREAT_CLOSE  = 31;
export const M_PRED_CLOSE    = 32;
export const M_SOCIAL_X      = 33;
export const M_SOCIAL_Y      = 34;
export const M_COMFORT       = 35;
export const M_COMFORT_TREND = 36;
export const M_THERMAL_FIT   = 37;
export const M_BODY_TEMP     = 38;
export const M_BODY_TEMP_SET = 39;   // 1 = the body temperature has started
export const M_STEER         = 40;
export const M_SOCIAL_W      = 41;
export const M_CLIMATE_W     = 42;
export const M_CLIMATE_X     = 43;
export const M_CLIMATE_Y     = 44;
export const M_PARTS_LOST    = 45;
export const M_REGROW        = 46;   // steps until a dropped part grows back
export const M_EVENTS        = 47;   // things only the main thread can do (EVENT_...)
export const M_THERMAL_OPT   = 48;   // (these follow the phenotype)
export const M_THERMAL_WIDTH = 49;
export const M_THERMAL_PEAK  = 50;
export const M_AUTOTOMY_THREAT = 51;
export const M_AUTOTOMY_LOSS = 52;
export const M_PHENO_PARTS   = 53;
export const M_INDEX         = 54;
export const M_PERSIST       = 55;   // gene: how firmly the chosen food is kept (0..1)
export const M_MATURE_AGE    = 56;   // age from which it may mate
export const M_INVEST        = 57;   // gene: share of energy given to a child
export const M_SIZE_PICKY    = 58;   // gene: how much a mate's size counts (0..1)
export const M_MAX_ENERGY    = 59;   // its maximum energy (depends on mass when MASS_SCALED_STOMACH_ENABLED)
export const M_DEFERENCE     = 60;   // gene: how much a plant others are nearer to is avoided (0..1)
export const M_CANNIBAL      = 61;   // 1 = it is after a young one of its kind (YOUNG_CANNIBALISM_ENABLED)
export const MIND_STRIDE     = 64;

// what the decision kernel asks the main thread to do (bits in M_EVENTS)
export const EVENT_REGROW    = 1;    // grow the dropped parts back
export const EVENT_SELF_FEED = 2;    // eat a part of my own body
export const EVENT_DECOY     = 4;    // a hunter is close: drop a part
export const EVENT_CHOOSE_MATE = 8;  // choose a mate the old way (other criteria than color)

// counters the kernels add to (one row per thread, summed by the main thread)
export const K_MEAT_TARGETS_PURSUING = 0;
export const K_PREY_CHOICES          = 1;
export const K_PREY_MEAT_CHOICES     = 2;
export const K_PREY_MEAT_DISTANCE    = 3;
export const K_PREY_MEAT_REWARD      = 4;
export const K_PREY_LIVE_CHOICES     = 5;
export const K_PREY_LIVE_DISTANCE    = 6;
export const K_PREY_LIVE_REWARD      = 7;
export const K_PREY_DISTANCE         = 8;
export const K_PREY_REWARD           = 9;
export const NUM_COUNTERS            = 12;
export const MAX_THREADS             = 64;

