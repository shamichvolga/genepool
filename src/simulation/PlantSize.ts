//------------------------------------------------------------------------------
// PLANT_SIZE_ENABLED: soft sprouts share one continuous growth model with trees.
// Wood follows the historical biomass maximum, never age alone. The current
// crown can regrow after a bite, but the trunk does not become soft again.
//------------------------------------------------------------------------------
import { PLANT_LIFESPAN, BITE_ENERGY, BITE_FORCE_AT_REFERENCE, BITE_MARGIN, BITE_REFERENCE_MASS, PLANT_MAX_TOUGHNESS,
         PLANT_SPROUT_ENERGY, PLANT_TREE_ENERGY, SOIL_NUTRIENT_PER_ENERGY } from "./Parameters";

export function plantSize( wood: number ): number { return Math.min( 1, Math.max( 0, wood / PLANT_TREE_ENERGY )); }

export function plantToughness( wood: number ): number { return PLANT_MAX_TOUGHNESS * plantSize( wood ); }

export function plantFullEnergy( soilNutrient: number ): number
{
    return Math.min( PLANT_TREE_ENERGY, PLANT_SPROUT_ENERGY + Math.max( 0, soilNutrient ) / SOIL_NUTRIENT_PER_ENERGY );
}

export function plantCrown( energy: number ): number
{
    return Math.min( 1, Math.max( 0, ( energy - PLANT_SPROUT_ENERGY ) / ( PLANT_TREE_ENERGY - PLANT_SPROUT_ENERGY )));
}

export function plantLifespan( f: number, born: number ): number
{
    const h = ( Math.imul( f + 1, 0x9E3779B1 ) ^ Math.imul( Math.floor( born ) | 0, 0x85EBCA6B )) >>> 0;
    return PLANT_LIFESPAN * ( 0.5 + ( h % 10007 ) / 10007 );
}

export function biteForce( mass: number ): number { return BITE_FORCE_AT_REFERENCE * Math.pow( Math.max( 1, mass ) / BITE_REFERENCE_MASS, 2 / 3 ); }

export function biteEfficiency( mass: number, wood: number ): number
{
    const force = biteForce( mass ), tough = plantToughness( wood );
    return force <= tough ? 0 : Math.min( 1, ( force - tough ) / BITE_MARGIN );
}

export function biteEnergy( mass: number, wood: number, energy: number ): number
{
    const efficiency = biteEfficiency( mass, wood );
    return efficiency <= 0 ? 0 : Math.min( energy, BITE_ENERGY * biteForce( mass ) * efficiency );
}
