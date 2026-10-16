//------------------------------------------------------------------------------
// Plant genes (PLANT_EVOLUTION_ENABLED): still one plant species, but each
// plant carries two inherited numbers, and only grown-up plants make seeds.
//
//   growth (0 slow .. 1 fast): a fast plant grows up and starts seeding early,
//     but it also ages and rots early, and its old age is less rich;
//     a slow plant must survive long uneaten, then seeds for a long time and
//     becomes a rich old plant. Heavy grazing favours fast, light - slow.
//   spread (0 near .. 1 far): how far its seeds fall. Near seeds make
//     patches (easy to find, easy to graze bare), far seeds scatter.
//
// Nothing here says which is better: that is decided by who eats what where.
// The numbers live in the shared state (plantGrowth, plantSpread by food
// slot); bindPlantGenes( st ) is called once when the pool is made.
//------------------------------------------------------------------------------
import { gpRandom } from "./Globals";
import { PLANT_EVOLUTION_ENABLED, PLANT_GENE_MUTATION, PLANT_MATURE_AGE_FAST, PLANT_MATURE_AGE_SLOW,
         PLANT_OLD_AGE, PLANT_OLD_AGE_FACTOR, PLANT_ROT_AGE, PLANT_ROT_AGE_FACTOR, PLANT_SEED_DISTANCE_FAR,
         PLANT_SEED_DISTANCE_NEAR, PLANT_SPROUT_AGE, PLANT_STAGE_ENERGY } from "./Parameters";

let plantGrowth = new Float32Array( 0 );
let plantSpread = new Float32Array( 0 );
export function bindPlantGenes( st: { plantGrowth: Float32Array, plantSpread: Float32Array } ): void
{
    plantGrowth = st.plantGrowth;
    plantSpread = st.plantSpread;
}
export function plantGrowthOf( f: number ): number { return plantGrowth[f]; }
export function plantSpreadOf( f: number ): number { return plantSpread[f]; }

// a new plant without a parent: random genes
export function randomizePlantGenes( f: number ): void
{
    plantGrowth[f] = gpRandom();
    plantSpread[f] = gpRandom();
}

// a seed: the parent's genes, slightly changed
export function inheritPlantGenes( child: number, parent: number ): void
{
    const mutate = ( v: number ) => Math.min( 1, Math.max( 0, v + ( gpRandom() + gpRandom() - 1 ) * PLANT_GENE_MUTATION * 2 ));
    plantGrowth[ child ] = mutate( plantGrowth[ parent ] );
    plantSpread[ child ] = mutate( plantSpread[ parent ] );
}

// the age at which it is grown up (and may seed), old, rotten
export function plantMatureAge( f: number ): number
{
    return PLANT_EVOLUTION_ENABLED ? PLANT_MATURE_AGE_SLOW + ( PLANT_MATURE_AGE_FAST - PLANT_MATURE_AGE_SLOW ) * plantGrowth[f] : PLANT_SPROUT_AGE;
}
export function plantOldAge( f: number ): number { return PLANT_EVOLUTION_ENABLED ? plantMatureAge( f ) * PLANT_OLD_AGE_FACTOR : PLANT_OLD_AGE; }
export function plantRotAge( f: number ): number { return PLANT_EVOLUTION_ENABLED ? plantMatureAge( f ) * PLANT_ROT_AGE_FACTOR : PLANT_ROT_AGE; }

// 0 sprout, 1 grown up, 2 old
export function plantStage( f: number, age: number ): number
{
    return ( age < plantMatureAge( f )) ? 0 : ( age > plantOldAge( f )) ? 2 : 1;
}

// energy of an old plant (relative): a slow plant becomes richer
export function plantOldEnergy( f: number ): number
{
    return PLANT_EVOLUTION_ENABLED ? 1 + ( PLANT_STAGE_ENERGY[2] - 1 ) * ( 1 - plantGrowth[f] ) : PLANT_STAGE_ENERGY[2];
}

// how far its seeds fall
export function plantSeedDistance( f: number ): number
{
    const s = plantSpread[f];
    return PLANT_SEED_DISTANCE_NEAR + ( PLANT_SEED_DISTANCE_FAR - PLANT_SEED_DISTANCE_NEAR ) * s * s;
}

// how far a sprout has grown (0 just sprouted .. 1 grown up)
export function plantSproutGrowth( f: number, age: number ): number
{
    return Math.max( 0, Math.min( 1, age / plantMatureAge( f )));
}
