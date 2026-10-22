//------------------------------------------------------------------------------
// PLANT_SIZE_ENABLED: a plant grows while nobody eats it, and gets tougher;
// who can eat it is decided by the bite (docs/концепт_размер_пищи.md):
//   size       0 (a sprout) .. 1 (a full-grown tree), by age
//   energy     what it holds now: grows towards its size's worth, bitten off
//              by the eaters, grows back (the plant lives on)
//   toughness  grows with size: a rabbit nibbles the oak seedling, not the oak
//   bite force grows with the body (the mouth: mass^(2/3))
// Only Parameters here: the threads use it too.
//------------------------------------------------------------------------------
import { BITE_ENERGY, BITE_FORCE_AT_REFERENCE, BITE_MARGIN, BITE_REFERENCE_MASS, PLANT_GROW_TIME, PLANT_MAX_TOUGHNESS,
         PLANT_SPROUT_ENERGY, PLANT_TREE_ENERGY } from "./Parameters";

export function plantSize( age: number ): number { return ( age <= 0 ) ? 0 : 1 - Math.exp( -age / PLANT_GROW_TIME ); }

export function plantToughness( age: number ): number { return PLANT_MAX_TOUGHNESS * plantSize( age ); }

// what a plant of this age holds when nobody has bitten it
export function plantFullEnergy( age: number ): number { return PLANT_SPROUT_ENERGY + ( PLANT_TREE_ENERGY - PLANT_SPROUT_ENERGY ) * plantSize( age ); }

export function biteForce( mass: number ): number { return BITE_FORCE_AT_REFERENCE * Math.pow( Math.max( 1, mass ) / BITE_REFERENCE_MASS, 2 / 3 ); }

// how much one bite takes from a plant (0: too tough for this mouth). A bite
// is full when the force is clearly above the toughness, smaller near the limit.
export function biteEnergy( mass: number, age: number, energy: number ): number
{
    const force = biteForce( mass ), tough = plantToughness( age );
    if ( force <= tough ) return 0;
    return Math.min( energy, BITE_ENERGY * force * Math.min( 1, ( force - tough ) / BITE_MARGIN ));
}
