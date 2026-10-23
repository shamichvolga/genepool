//------------------------------------------------------------------------------
// The ecology gene block (genes 120..155).
//
// Genes 0..111 build the body. The ecological traits live in their own block
// so that they no longer share genes with the body shape (the predator gene
// used to be gene 51 = a body gene!). Each trait is the AVERAGE of a few genes:
// a child of two different parents then gets an in-between value, which is
// what makes hybrids between adapted populations worse (see docs/БИОЛОГ_ЭТАП5.md).
//
// Mutations in this block are small and never "wrap around" (255 -> 0),
// unlike the body genes.
//------------------------------------------------------------------------------
import { gpRandom } from "./Globals";

export const GENES_THERMAL_OPTIMUM = [ 120, 121, 122, 123 ];   // preferred temperature θ, 0..1
export const GENES_THERMAL_WIDTH   = [ 124, 125 ];             // tolerance w
export const GENES_DIGESTION       = [ 126, 127, 128 ];        // 0 = digests cold plants (B) best, 1 = warm plants (A)
export const GENES_PREDATOR        = [ 129, 130 ];             // predator level 0..1 (was gene 51)
export const GENES_HUNGER          = [ 131 ];                  // hunger (was gene 50; not used yet)
export const GENES_BRIGHTNESS      = [ 132, 133, 134 ];        // body brightness b: camouflage + mating signal
export const GENES_CHOOSINESS      = [ 135, 136 ];             // how picky about a mate's brightness
// autotomy: dropping a part of the body (like a lizard's tail)
export const GENES_AUTOTOMY_BITE   = [ 137 ];                  // chance to drop a part when bitten
export const GENES_AUTOTOMY_THREAT = [ 138 ];                  // drop one as a decoy when a hunter comes this close (0 = never)
export const GENES_AUTOTOMY_AMOUNT = [ 139 ];                  // how much of the body to drop
export const GENES_AUTOTOMY_WHICH  = [ 140 ];                  // which limb (tail / side branch...)
export const GENES_PERSISTENCE     = [ 141 ];                  // how firmly the chosen food is kept
export const GENES_INVESTMENT      = [ 142 ];                  // share of energy given to a child (INHERITED_INVESTMENT_ENABLED)
export const GENES_SIZE_PICKINESS  = [ 143 ];                  // how much a mate's size counts (SIZE_ASSORTATIVE_MATING_ENABLED)

// C11: independent inherited choice of tissue for self-consumption. These
// otherwise-unused loci are active only in that experiment.
export const GENES_SELF_FEED_WHICH   = [ 160 ];
export const GENES_SELF_FEED_AMOUNT  = [ 161 ];
export const GENES_DEFERENCE         = [ 162 ];   // how much a plant others are nearer to is avoided (CROWD_AWARE_FOOD_CHOICE_ENABLED)
export const GENES_RUDDER            = [ 163 ];   // how fast the whole body may turn towards its goal (RUDDER_ENABLED)
export const GENES_WEAK_PREY          = [ 164 ];   // how much a predator prefers old and starving prey (WEAK_PREY_ENABLED)
export const GENES_IMMUNE            = [ 165, 166, 167, 168 ];
export const GENES_CURRENT          = [ 170 ];   // the feel for the current (CURRENT_AWARENESS_ENABLED)
export const GENES_CANNIBAL          = [ 169 ];   // eating the young of one's kind (an ability)   // the immune profile (DISEASE_ENABLED)
export function isDeferenceGene( g ) { return ( g === GENES_DEFERENCE[0] ) || ( g === GENES_RUDDER[0] ) || ( g === GENES_WEAK_PREY[0] ) || (( g >= 165 ) && ( g <= 170 )); }   // (small-step genes outside the ecology block)

export function isSelfFeedingGene( g ): boolean
{
    return ( g === GENES_SELF_FEED_WHICH[0] ) || ( g === GENES_SELF_FEED_AMOUNT[0] );
}

export function preyTargetScore( reward: number, pursuitCost: number, rewardWeight: number,
                                 travelWeight: number, baitBias = 0, isBait = false ): number
{
    return reward * rewardWeight - pursuitCost * travelWeight + ( isBait ? baitBias : -baitBias );
}

export const ECOLOGY_GENES_FIRST   = 120;
export const ECOLOGY_GENES_LAST    = 143;
export const MARKER_GENES_FIRST    = 144;                      // neutral markers: change slowly, affect nothing,
export const MARKER_GENES_LAST     = 159;                      // used to measure how related populations are

export const THERMAL_WIDTH_MIN     = 0.04;
export const THERMAL_WIDTH_MAX     = 0.40;

const ECOLOGY_MUTATION_RATE = 0.02;     // per gene per birth
const ECOLOGY_MUTATION_STEP = 9;        // typical size (out of 255)
const MARKER_MUTATION_RATE  = 0.0015;

export function isEcologyGene( g ) { return ( g >= ECOLOGY_GENES_FIRST ) && ( g <= ECOLOGY_GENES_LAST ); }
export function isMarkerGene ( g ) { return ( g >= MARKER_GENES_FIRST  ) && ( g <= MARKER_GENES_LAST  ); }

//------------------------------------------------------------
// a trait = the average of its genes, scaled to 0..1
//------------------------------------------------------------
export function geneAverage( genotype, genes: number[] ): number
{
    let sum = 0;
    for ( const g of genes ) { sum += genotype.getGeneValue(g); }
    return sum / ( genes.length * 255 );
}

// write a 0..1 value into all genes of a trait (optionally with a little noise per gene)
export function setTrait( genotype, genes: number[], value: number, noise = 0 )
{
    for ( const g of genes )
    {
        let v = value * 255 + ( noise > 0 ? gaussian() * noise * 255 : 0 );
        genotype.setGeneValue( g, clampGene( v ) );
    }
}

export function thermalWidthOf( genotype ): number
{
    return THERMAL_WIDTH_MIN + geneAverage( genotype, GENES_THERMAL_WIDTH ) * ( THERMAL_WIDTH_MAX - THERMAL_WIDTH_MIN );
}

export function thermalWidthToGene( w: number ): number
{
    return ( w - THERMAL_WIDTH_MIN ) / ( THERMAL_WIDTH_MAX - THERMAL_WIDTH_MIN );
}

//------------------------------------------------------------
// Saved pools from before stage 5 kept the predator level in gene 51 and the
// hunger in gene 50. Move them into this block; the ecology traits get
// neutral values (likes 0.5, broad tolerance, digests both plants).
//------------------------------------------------------------
export const GENE_LAYOUT_VERSION = 2;

export function convertOldGenes( genes: number[] ): void
{
    const predator = genes[51], hunger = genes[50];
    for ( const g of GENES_PREDATOR        ) { genes[g] = predator; }
    for ( const g of GENES_HUNGER          ) { genes[g] = hunger;   }
    for ( const g of GENES_THERMAL_OPTIMUM ) { genes[g] = 128;      }
    for ( const g of GENES_THERMAL_WIDTH   ) { genes[g] = 255;      }
    for ( const g of GENES_DIGESTION       ) { genes[g] = 128;      }
    for ( const g of GENES_BRIGHTNESS      ) { genes[g] = 128;      }
    for ( const g of GENES_CHOOSINESS      ) { genes[g] = 0;        }
}

//------------------------------------------------------------
// mutation of one gene of this block (returns the new value)
//------------------------------------------------------------
export function mutateEcologyGene( value: number ): number
{
    return clampGene( value + gaussian() * ECOLOGY_MUTATION_STEP );
}

export function mutateMarkerGene( value: number ): number
{
    return clampGene( value + ( gpRandom() < 0.5 ? -1 : 1 ) * ( gpRandom() < 0.5 ? 1 : 2 ) );
}

export function ecologyMutationRate( g ): number
{
    return isMarkerGene( g ) ? MARKER_MUTATION_RATE : ECOLOGY_MUTATION_RATE;
}

// whole number 0..255, reflected at the ends (no wrap-around)
function clampGene( v: number ): number
{
    if ( v < 0   ) { v = -v; }
    if ( v > 255 ) { v = 510 - v; }
    return Math.max( 0, Math.min( 255, Math.round( v )));
}

// standard normal random number
export function gaussian(): number
{
    let u = 0, v = 0;
    while ( u === 0 ) { u = gpRandom(); }
    while ( v === 0 ) { v = gpRandom(); }
    return Math.sqrt( -2.0 * Math.log( u )) * Math.cos( 2.0 * Math.PI * v );
}
