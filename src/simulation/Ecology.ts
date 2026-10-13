//------------------------------------------------------------------------------
// How the environment acts on a swimbot (stage 5). Numbers: docs/БИОЛОГ_ЭТАП5.md
//
//  thermal fit       g = exp( -(T - θ)² / (2w²) )        how well the place suits me
//  thermal peak      (W_MIN / w)^a                       broad tolerance = lower peak
//  food energy       50 · 1.6 · eff(d, type) · (0.3 + 0.7 · g · peak)
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
// part of its energy here; this bonus makes an adapted specialist at home get
// more than in the classic pool (~1.4x), a typical founder about the same, and
// a misplaced generalist much less (~0.4x).
export const ENVIRONMENT_FOOD_BONUS     = 1.6;
export const DIGESTION_MINIMUM          = 0.15;
export const DIGESTION_CURVE            = 1.5;     // > 1: in-between digestion is bad at both foods
export const IGNORE_FOOD_EFFICIENCY     = 0.3;     // food worse than this is ignored unless starving

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
    if ( type === 2 ) return 1;
    const x = ( type === PLANT_TYPE_WARM ) ? digestion : 1 - digestion;
    return DIGESTION_MINIMUM + ( 1 - DIGESTION_MINIMUM ) * Math.pow( x, DIGESTION_CURVE );
}
