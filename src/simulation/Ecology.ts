//------------------------------------------------------------------------------
// How the environment acts on a swimbot (stage 5). Numbers: docs/БИОЛОГ_ЭТАП5.md
//
//  thermal fit       g = exp( -(T - θ)² / (2w²) )        how well the place suits me
//  thermal peak      (W_MIN / w)^a                       broad tolerance = lower peak
//  food energy       50 · 2.5 · eff(d, type) · (0.3 + 0.7 · g · peak)
//  extra drain       0.006 · (1 - g)   per step          living in the wrong climate costs
//  digestion         eff_warm = 0.15 + 0.85 · d^1.5,  eff_cold = 0.15 + 0.85 · (1-d)^1.5
//
// No genotype is best everywhere: a specialist does very well at home and badly
// elsewhere, a generalist does so-so everywhere.
//------------------------------------------------------------------------------
import { THERMAL_WIDTH_MIN } from "./EcologyGenes";
import { PLANT_TYPE_WARM } from "./Environment";

export const THERMAL_TRADE_OFF          = 0.5;     // "a": 0 = no cost of being a generalist
export const THERMAL_MISMATCH_DRAIN     = 0.006;   // extra energy per step at a totally wrong temperature
export const FOOD_BASE_FRACTION         = 0.3;     // part of the food energy you always get
// Swimbots find food at the same rate as in the classic pool, but get only a
// part of its energy here (they mostly eat "their" plant type). This bonus was
// tuned by runs (tools/eco.cjs, 3 seeds): at 1.6 the population starved down
// to ~600, at 2.2 it held 1200-2000, at 2.8 about 2600. An adapted specialist
// at home now gets ~2x the classic energy, a misplaced generalist ~0.5x.
//
// One food for everybody (TWO_PLANT_TYPES = false): digestion no longer
// matters (runs, 2 seeds x 30 000 steps: 1.75 and 2.0 slowly starved the
// population to ~1000-1500, 2.4 holds ~2000, 2.8 ~3000).
export const TWO_PLANT_TYPES            = false;
export const ENVIRONMENT_FOOD_BONUS     = TWO_PLANT_TYPES ? 2.5 : 2.4;
export const DIGESTION_MINIMUM          = 0.15;
export const DIGESTION_CURVE            = 1.5;     // > 1: in-between digestion is bad at both foods
export const IGNORE_FOOD_EFFICIENCY     = 0.3;     // food worse than this is ignored unless starving

// Body size and diet: big bodies handle the (tough) cold plants better, small
// bodies the warm ones. This ties the body form to the biome, so that one
// "best body" can't spread everywhere. size = ln(mass) relative to a typical
// swimbot (ln 370 ≈ 5.9), in units of 1.5, limited to -1..1.
export const SIZE_DIET_EFFECT           = 0.35;
const TYPICAL_LOG_MASS                  = 5.9;
const LOG_MASS_SCALE                    = 1.5;

export function bodySize( mass: number ): number
{
    const s = ( Math.log( Math.max( 1, mass )) - TYPICAL_LOG_MASS ) / LOG_MASS_SCALE;
    return s < -1 ? -1 : ( s > 1 ? 1 : s );
}

// how well a body of this size handles a plant type (meat: always 1)
export function sizeDietFactor( size: number, type: number ): number
{
    if (( type === 2 ) || !TWO_PLANT_TYPES ) return 1;
    return ( type === PLANT_TYPE_WARM ) ? 1 - SIZE_DIET_EFFECT * size : 1 + SIZE_DIET_EFFECT * size;
}

// body brightness b (step 2)
export const THERMOMELANISM             = 0.06;    // dark bodies feel warmer: T_eff = T + 0.06 · (1 - 2b)
export const PREY_DETECTION_MINIMUM     = 0.35;    // predator sees prey at R · (0.35 + 0.65 · |b - background|)
export const MATE_TOLERANCE_MINIMUM     = 0.03;    // mate acceptance width σ = 0.03 + 0.4 · (1 - choosiness)²
export const MATE_TOLERANCE_RANGE       = 0.4;

export const THERMAL_FIT_UPDATE_PERIOD  = 10;      // steps between temperature checks
export const KINESIS_PERIOD             = 50;      // steps between "is it better here?" checks
export const KINESIS_TURN_CHANCE        = 0.6;
export const KINESIS_MAX_TURN           = 120;     // degrees
export const EMERGENCY_THERMAL_FIT      = 0.2;     // below this: look around and head for the best way
export const EMERGENCY_PROBE_DISTANCE   = 300;

export function thermalFit( temperature: number, optimum: number, width: number ): number
{
    const d = temperature - optimum;
    return Math.exp( -( d * d ) / ( 2 * width * width ));
}

export function thermalPeak( width: number ): number
{
    return Math.pow( THERMAL_WIDTH_MIN / width, THERMAL_TRADE_OFF );
}

// energy multiplier of food at a place: fit = thermalFit, peak = thermalPeak
export function climateFoodFactor( fit: number, peak: number ): number
{
    return ENVIRONMENT_FOOD_BONUS * ( FOOD_BASE_FRACTION + ( 1 - FOOD_BASE_FRACTION ) * fit * peak );
}

// how far away a predator notices prey (as a share of its search radius)
export function preyVisibility( brightness: number, background: number ): number
{
    return PREY_DETECTION_MINIMUM + ( 1 - PREY_DETECTION_MINIMUM ) * Math.abs( brightness - background );
}

// chance that a swimbot with this choosiness accepts a mate whose brightness differs by db
export function mateAcceptance( db: number, choosiness: number ): number
{
    const width = MATE_TOLERANCE_MINIMUM + MATE_TOLERANCE_RANGE * ( 1 - choosiness ) * ( 1 - choosiness );
    return Math.exp( -( db * db ) / ( 2 * width * width ));
}

// a fixed "random" number 0..1 for a pair of swimbots (so asking again doesn't help)
export function pairRandom( a: number, b: number ): number
{
    let h = ( Math.imul( a + 1, 73856093 ) ^ Math.imul( b + 1, 19349663 )) >>> 0;
    h = Math.imul( h ^ ( h >>> 16 ), 0x45d9f3b ) >>> 0;
    h = ( h ^ ( h >>> 16 )) >>> 0;
    return h / 4294967296;
}

// how well digestion d (0..1) handles a plant type; meat (type 2) is always 1
export function digestionEfficiency( digestion: number, type: number ): number
{
    if (( type === 2 ) || !TWO_PLANT_TYPES ) return 1;
    const x = ( type === PLANT_TYPE_WARM ) ? digestion : 1 - digestion;
    return DIGESTION_MINIMUM + ( 1 - DIGESTION_MINIMUM ) * Math.pow( x, DIGESTION_CURVE );
}
