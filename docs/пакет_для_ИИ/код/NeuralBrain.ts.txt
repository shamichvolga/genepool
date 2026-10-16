//------------------------------------------------------------------------------
// Neural brain (stage 6).
//
// A small fixed network decides WHAT a swimbot wants (eat, mate, flee, hunt)
// and HOW it moves (follow the climate, keep close to or away from others,
// how hard to swim). Its weights are the "brain chromosome": inherited from
// both parents (whole neurons at a time), with small random mutations.
//
// Every swimbot is born with the INNATE weights plus its family's mutations.
// The innate weights reproduce the classic Gene Pool behavior (hungry -> eat,
// fed -> mate, threat -> flee), so the first generations survive; evolution
// then changes the behavior from there.
//
//   inputs  ──────────────────────────────►  outputs   (direct connections)
//      └──►  hidden (remembers its last state) ──┘
//------------------------------------------------------------------------------
import { gaussian } from "./EcologyGenes";
import { gpRandom } from "./Globals";

//------------------------------------------------------------
// inputs
//------------------------------------------------------------
export const IN_BIAS        = 0;    // always 1
export const IN_HUNGER      = 1;    // (hunger threshold - energy) / threshold, -1..1
export const IN_ENERGY      = 2;    // energy / 100, 0..2
export const IN_AGE         = 3;    // age / maximum age
export const IN_FIT         = 4;    // how well the temperature suits me, 0..1
export const IN_TREND       = 5;    // getting better (+1) or worse (-1) here
export const IN_FOOD        = 6;    // food in sight
export const IN_MATE        = 7;    // possible mate in sight
export const IN_THREAT      = 8;    // a hunting predator in sight: 0 far .. 1 very close
export const IN_PREY        = 9;    // prey or meat in sight
export const IN_CROWD       = 10;   // how many others around (0..1)
export const IN_PREDATOR    = 11;   // I am a predator
// where things are, seen from the swimbot (side: -1 left .. +1 right, ahead: -1 behind .. +1 ahead)
export const IN_FOOD_SIDE   = 12;   // the food bit it is after
export const IN_FOOD_AHEAD  = 13;
export const IN_NEAR_SIDE   = 14;   // the nearest swimbot in sight
export const IN_NEAR_AHEAD  = 15;
export const IN_THREAT_SIDE = 16;   // the hunting predator in sight
export const IN_THREAT_AHEAD= 17;
export const IN_KIN         = 18;   // how alike (color) the nearest swimbot is, 0..1
export const IN_SEASON      = 19;   // -1 winter .. +1 summer
export const IN_PREDATOR_NEAR = 20; // any predator (also a calm one): 0 far .. 1 very close
export const IN_PREY_DISTANCE = 21; // distance to the best visible live prey, / scan radius
export const IN_PREY_REWARD   = 22; // expected energy from the live prey, 0..1
export const IN_PREY_SUCCESS  = 23; // estimated chance of a successful attack, 0..1
export const IN_PREY_CHASE    = 24; // estimated travel/time cost to reach live prey, 0..1
export const IN_BAIT_PRESENT  = 25; // edible meat is visible
export const IN_BAIT_DISTANCE = 26; // distance to the best visible meat, / view radius
export const IN_BAIT_REWARD   = 27; // energy available from the meat, 0..1
export const NUM_INPUTS       = 28;

//------------------------------------------------------------
// outputs
//------------------------------------------------------------
export const OUT_FOOD       = 0;    // the four drives: the strongest one wins
export const OUT_MATE       = 1;
export const OUT_FLEE       = 2;
export const OUT_HUNT       = 3;
export const OUT_CLIMATE    = 4;    // how strongly to follow the better temperature
export const OUT_SOCIAL     = 5;    // + swim towards the others, - keep away
export const OUT_EFFORT     = 6;    // how hard to swim (faster, but costs energy)
export const OUT_STEER      = 7;    // while searching: turn left (-) or right (+)
export const OUT_SELF_EAT   = 8;    // choose to metabolize a removable body branch
export const OUT_PREY_VALUE = 9;    // how much expected energy matters when choosing a target
export const OUT_PREY_TRAVEL= 10;   // how much pursuit distance/time matters
export const OUT_PREY_BAIT  = 11;   // preference for available meat over live prey
export const LEGACY_NUM_OUTPUTS = 8;
export const CORE_NUM_OUTPUTS = 9;
export const NUM_OUTPUTS    = 12;
export const DRIVE_OUTPUTS  = [ OUT_FOOD, OUT_MATE, OUT_FLEE, OUT_HUNT, OUT_SELF_EAT ];
export const NUM_DRIVES     = DRIVE_OUTPUTS.length;

export const NUM_HIDDEN     = 6;

//------------------------------------------------------------
// weight layout in the brain chromosome
//------------------------------------------------------------
const W_IO = 0;                                     // [core output][input]
const W_IH = W_IO + CORE_NUM_OUTPUTS * NUM_INPUTS;  // [hidden][input]
const W_HH = W_IH + NUM_HIDDEN  * NUM_INPUTS;       // [hidden][hidden] (memory)
const W_HO = W_HH + NUM_HIDDEN  * NUM_HIDDEN;       // [core output][hidden]
const CORE_BRAIN_SIZE = W_HO + CORE_NUM_OUTPUTS * NUM_HIDDEN;
const EXTRA_OUTPUT_START = CORE_BRAIN_SIZE;          // new output neurons are appended, preserving saved layouts
export const BRAIN_SIZE = CORE_BRAIN_SIZE + ( NUM_OUTPUTS - CORE_NUM_OUTPUTS ) * ( NUM_INPUTS + NUM_HIDDEN );

// Older saves used 21 inputs and either 8 (pre-C11) or 9 (C11) outputs.
// Keep both source layouts readable while new target-selection weights stay
// out of the legacy part of the chromosome.
const LEGACY_NUM_INPUTS = 21;
const LEGACY_W_IH = LEGACY_NUM_OUTPUTS * LEGACY_NUM_INPUTS;
const LEGACY_W_HH = LEGACY_W_IH + NUM_HIDDEN * LEGACY_NUM_INPUTS;
const LEGACY_W_HO = LEGACY_W_HH + NUM_HIDDEN * NUM_HIDDEN;
export const LEGACY_BRAIN_SIZE = LEGACY_W_HO + LEGACY_NUM_OUTPUTS * NUM_HIDDEN;
const PRE_C12_W_IH = CORE_NUM_OUTPUTS * LEGACY_NUM_INPUTS;
const PRE_C12_W_HH = PRE_C12_W_IH + NUM_HIDDEN * LEGACY_NUM_INPUTS;
const PRE_C12_W_HO = PRE_C12_W_HH + NUM_HIDDEN * NUM_HIDDEN;
const PRE_C12_BRAIN_SIZE = PRE_C12_W_HO + CORE_NUM_OUTPUTS * NUM_HIDDEN;

function copySavedNetwork( target: Float32Array, source: ArrayLike<number>, outputs: number,
                           inputs: number, wIH: number, wHH: number, wHO: number ): void
{
    for ( let o = 0; o < outputs; o++ )
    {
        for ( let i = 0; i < inputs; i++ )
            target[ W_IO + o * NUM_INPUTS + i ] = Number.isFinite( Number( source[ o * inputs + i ] )) ? Number( source[ o * inputs + i ] ) : 0;
        for ( let h = 0; h < NUM_HIDDEN; h++ )
            target[ W_HO + o * NUM_HIDDEN + h ] = Number.isFinite( Number( source[ wHO + o * NUM_HIDDEN + h ] )) ? Number( source[ wHO + o * NUM_HIDDEN + h ] ) : 0;
    }
    for ( let h = 0; h < NUM_HIDDEN; h++ )
    {
        for ( let i = 0; i < inputs; i++ )
            target[ W_IH + h * NUM_INPUTS + i ] = Number.isFinite( Number( source[ wIH + h * inputs + i ] )) ? Number( source[ wIH + h * inputs + i ] ) : 0;
        for ( let j = 0; j < NUM_HIDDEN; j++ )
            target[ W_HH + h * NUM_HIDDEN + j ] = Number.isFinite( Number( source[ wHH + h * NUM_HIDDEN + j ] )) ? Number( source[ wHH + h * NUM_HIDDEN + j ] ) : 0;
    }
}

export function migrateLegacyBrainWeights( target: Float32Array, source: ArrayLike<number> ): boolean
{
    if ( source == null ) return false;
    if ( source.length === BRAIN_SIZE ) { target.set( source ); return true; }
    target.set( innateBrain() );
    if ( source.length === LEGACY_BRAIN_SIZE )
        copySavedNetwork( target, source, LEGACY_NUM_OUTPUTS, LEGACY_NUM_INPUTS, LEGACY_W_IH, LEGACY_W_HH, LEGACY_W_HO );
    else if ( source.length === PRE_C12_BRAIN_SIZE )
        copySavedNetwork( target, source, CORE_NUM_OUTPUTS, LEGACY_NUM_INPUTS, PRE_C12_W_IH, PRE_C12_W_HH, PRE_C12_W_HO );
    else return false;
    return true;
}

export const WEIGHT_LIMIT           = 8;
const BRAIN_MUTATION_RATE           = 0.03;   // per weight per birth
const BRAIN_MUTATION_STEP           = 0.25;
export const FOUNDER_BRAIN_NOISE    = 0.15;   // founders differ a little from the innate brain

export const THINK_PERIOD           = 5;      // steps between thoughts (spread over the swimbots)
export const DRIVE_HYSTERESIS       = 0.3;    // the current goal gets this bonus (no dithering)
export const EFFORT_MIN             = 0.5;
export const EFFORT_RANGE           = 0.7;    // effort = 0.5 .. 1.2
export const STEER_MAX_DEGREES      = 60;     // the largest turn the steering output can ask for

//------------------------------------------------------------
// the innate brain = the classic Gene Pool behavior
//------------------------------------------------------------
let _innate: Float32Array | null = null;

export function innateBrain(): Float32Array
{
    if ( _innate === null )
    {
        const w = new Float32Array( BRAIN_SIZE );
        const io = ( o, i, v ) => { w[ W_IO + o * NUM_INPUTS + i ] = v; };

        io( OUT_FOOD,    IN_HUNGER,  4 );      // hungry -> eat
        io( OUT_MATE,    IN_HUNGER, -4 );      // fed    -> mate
        io( OUT_HUNT,    IN_HUNGER,  4 );      // hungry predator -> hunt
        io( OUT_FLEE,    IN_THREAT, 10 );      // a hunting predator: flee when it comes within ~2/3 of the view
        io( OUT_FLEE,    IN_PREDATOR_NEAR, 4 ); // any predator very close: flee too
        io( OUT_FLEE,    IN_BIAS,   -3 );
        io( OUT_CLIMATE, IN_BIAS,    2 );      // follow the temperature more when it doesn't suit me
        io( OUT_CLIMATE, IN_FIT,    -3 );
        io( OUT_EFFORT,  IN_BIAS,    0.92 );   // effort 1.0 = classic swimming

        // hidden neurons start with tiny weights: unused, but ready for evolution
        _innate = w;
    }
    return _innate;
}

// a founder: innate brain with a little individual variation
export function founderBrain( out: Float32Array, includeExtended = false ): void
{
    const innate = innateBrain();
    out.set( innate );
    forEachLegacyWeightIndex( index => { out[index] = clampWeight( innate[index] + gaussian() * FOUNDER_BRAIN_NOISE ); });
    if ( includeExtended )
    {
        // No innate trigger: founders get a broader random response pattern,
        // then inheritance and selection can shape when the action is useful.
        const extendedFounderNoise = FOUNDER_BRAIN_NOISE;
        for ( let i = 0; i < LEGACY_NUM_INPUTS; i++ )
        {
            const index = W_IO + OUT_SELF_EAT * NUM_INPUTS + i;
            out[index] = clampWeight( gaussian() * extendedFounderNoise );
        }
        for ( let h = 0; h < NUM_HIDDEN; h++ )
        {
            const index = W_HO + OUT_SELF_EAT * NUM_HIDDEN + h;
            out[index] = clampWeight( gaussian() * extendedFounderNoise );
        }
    }
}

// Seed the new target-selection connections from the founder's existing
// identity without consuming the shared simulation RNG. That keeps BASE and
// C12 worlds identical at creation time while giving C12 founders variation.
export function seedPredatorChoiceBrain( w: Float32Array, seed: number ): void
{
    let state = ( seed >>> 0 ) || 1;
    const sample = () =>
    {
        state = ( Math.imul( state ^ ( state >>> 15 ), 0x2c1b3c6d ) + 0x297a2d39 ) >>> 0;
        state ^= state >>> 12;
        return ( state >>> 0 ) / 4294967296;
    };
    const noise = () => ( sample() * 2 - 1 ) * FOUNDER_BRAIN_NOISE;

    for ( let o = OUT_PREY_VALUE; o < NUM_OUTPUTS; o++ )
    {
        const io = extraOutputInputIndex( o );
        const ho = extraOutputHiddenIndex( o );
        for ( let i = 0; i < NUM_INPUTS; i++ ) w[ io + i ] = clampWeight( noise() );
        for ( let h = 0; h < NUM_HIDDEN; h++ ) w[ ho + h ] = clampWeight( noise() );
    }
}

//------------------------------------------------------------
// inheritance: each neuron (all its incoming weights) comes
// from one parent, then a few weights mutate
//------------------------------------------------------------
export function inheritBrain( child: Float32Array, a: Float32Array, b: Float32Array,
                              includeExtended = false, includePredatorChoice = false ): void
{
    child.set( innateBrain() );
    for ( let o = 0; o < LEGACY_NUM_OUTPUTS; o++ )
    {
        const p = ( gpRandom() < 0.5 ) ? a : b;
        copyRange( child, p, W_IO + o * NUM_INPUTS, NUM_INPUTS );
        copyRange( child, p, W_HO + o * NUM_HIDDEN, NUM_HIDDEN );
    }
    for ( let h = 0; h < NUM_HIDDEN; h++ )
    {
        const p = ( gpRandom() < 0.5 ) ? a : b;
        copyRange( child, p, W_IH + h * NUM_INPUTS, NUM_INPUTS );
        copyRange( child, p, W_HH + h * NUM_HIDDEN, NUM_HIDDEN );
    }
    if ( includeExtended )
    {
        const p = ( gpRandom() < 0.5 ) ? a : b;
        copyRange( child, p, W_IO + OUT_SELF_EAT * NUM_INPUTS, LEGACY_NUM_INPUTS );
        copyRange( child, p, W_HO + OUT_SELF_EAT * NUM_HIDDEN, NUM_HIDDEN );
    }
    if ( includePredatorChoice )
    {
        for ( let o = OUT_PREY_VALUE; o < NUM_OUTPUTS; o++ )
        {
            const p = ( gpRandom() < 0.5 ) ? a : b;
            copyRange( child, p, extraOutputInputIndex( o ), NUM_INPUTS );
            copyRange( child, p, extraOutputHiddenIndex( o ), NUM_HIDDEN );
        }
    }
    mutateBrain( child, BRAIN_MUTATION_RATE, includeExtended, includePredatorChoice );
}

export function mutateBrain( w: Float32Array, rate: number, includeExtended = false,
                             includePredatorChoice = false ): void
{
    const mutate = index => { if ( gpRandom() < rate ) w[index] = clampWeight( w[index] + gaussian() * BRAIN_MUTATION_STEP ); };
    forEachLegacyWeightIndex( mutate );
    if ( includeExtended )
    {
        for ( let i = 0; i < LEGACY_NUM_INPUTS; i++ )
        {
            const index = W_IO + OUT_SELF_EAT * NUM_INPUTS + i;
            mutate( index );
        }
        for ( let h = 0; h < NUM_HIDDEN; h++ )
        {
            const index = W_HO + OUT_SELF_EAT * NUM_HIDDEN + h;
            mutate( index );
        }
    }
    if ( includePredatorChoice )
    {
        for ( let o = OUT_PREY_VALUE; o < NUM_OUTPUTS; o++ )
        {
            const io = extraOutputInputIndex( o );
            const ho = extraOutputHiddenIndex( o );
            for ( let i = 0; i < NUM_INPUTS; i++ ) mutate( io + i );
            for ( let h = 0; h < NUM_HIDDEN; h++ ) mutate( ho + h );
        }
    }
}

function forEachLegacyWeightIndex( visit: ( index: number ) => void ): void
{
    for ( let o = 0; o < LEGACY_NUM_OUTPUTS; o++ )
        for ( let i = 0; i < LEGACY_NUM_INPUTS; i++ ) visit( W_IO + o * NUM_INPUTS + i );
    for ( let h = 0; h < NUM_HIDDEN; h++ )
        for ( let i = 0; i < LEGACY_NUM_INPUTS; i++ ) visit( W_IH + h * NUM_INPUTS + i );
    for ( let h = 0; h < NUM_HIDDEN; h++ )
        for ( let j = 0; j < NUM_HIDDEN; j++ ) visit( W_HH + h * NUM_HIDDEN + j );
    for ( let o = 0; o < LEGACY_NUM_OUTPUTS; o++ )
        for ( let h = 0; h < NUM_HIDDEN; h++ ) visit( W_HO + o * NUM_HIDDEN + h );
}

function extraOutputInputIndex( output: number ): number
{
    return EXTRA_OUTPUT_START + ( output - CORE_NUM_OUTPUTS ) * ( NUM_INPUTS + NUM_HIDDEN );
}

function extraOutputHiddenIndex( output: number ): number
{
    return extraOutputInputIndex( output ) + NUM_INPUTS;
}

function copyRange( to: Float32Array, from: Float32Array, start: number, length: number ): void
{
    for ( let k = start; k < start + length; k++ ) { to[k] = from[k]; }
}

function clampWeight( v: number ): number
{
    return v > WEIGHT_LIMIT ? WEIGHT_LIMIT : ( v < -WEIGHT_LIMIT ? -WEIGHT_LIMIT : v );
}

//------------------------------------------------------------
// one thought: inputs -> outputs (hidden keeps its state)
//------------------------------------------------------------
export function think( w: Float32Array, inputs: Float64Array, hidden: Float64Array, newHidden: Float64Array, outputs: Float64Array ): void
{
    for ( let h = 0; h < NUM_HIDDEN; h++ )
    {
        let sum = 0;
        const ih = W_IH + h * NUM_INPUTS;
        for ( let i = 0; i < NUM_INPUTS; i++ ) { sum += w[ ih + i ] * inputs[i]; }
        const hh = W_HH + h * NUM_HIDDEN;
        for ( let j = 0; j < NUM_HIDDEN; j++ ) { sum += w[ hh + j ] * hidden[j]; }
        newHidden[h] = Math.tanh( sum );
    }
    for ( let h = 0; h < NUM_HIDDEN; h++ ) { hidden[h] = newHidden[h]; }

    for ( let o = 0; o < NUM_OUTPUTS; o++ )
    {
        let sum = 0;
        const io = ( o < CORE_NUM_OUTPUTS ) ? W_IO + o * NUM_INPUTS : extraOutputInputIndex( o );
        for ( let i = 0; i < NUM_INPUTS; i++ ) { sum += w[ io + i ] * inputs[i]; }
        const ho = ( o < CORE_NUM_OUTPUTS ) ? W_HO + o * NUM_HIDDEN : extraOutputHiddenIndex( o );
        for ( let h = 0; h < NUM_HIDDEN; h++ ) { sum += w[ ho + h ] * hidden[h]; }
        outputs[o] = sum;
    }
}

export function sigmoid( x: number ): number { return 1 / ( 1 + Math.exp( -x )); }

// how far a brain has moved away from the innate one (mean absolute difference)
export function brainDistanceFromInnate( w: Float32Array, includeExtended = false,
                                         includePredatorChoice = false ): number
{
    const innate = innateBrain();
    let sum = 0, count = 0;
    forEachLegacyWeightIndex( index => { sum += Math.abs( w[index] - innate[index] ); count ++; });
    if ( includeExtended )
    {
        for ( let i = 0; i < LEGACY_NUM_INPUTS; i++ )
        {
            const index = W_IO + OUT_SELF_EAT * NUM_INPUTS + i;
            sum += Math.abs( w[index] - innate[index] ); count ++;
        }
        for ( let h = 0; h < NUM_HIDDEN; h++ )
        {
            const index = W_HO + OUT_SELF_EAT * NUM_HIDDEN + h;
            sum += Math.abs( w[index] - innate[index] ); count ++;
        }
    }
    if ( includePredatorChoice )
    {
        for ( let o = OUT_PREY_VALUE; o < NUM_OUTPUTS; o++ )
        {
            const io = extraOutputInputIndex( o ), ho = extraOutputHiddenIndex( o );
            for ( let i = 0; i < NUM_INPUTS; i++ ) { sum += Math.abs( w[ io + i ] - innate[ io + i ] ); count ++; }
            for ( let h = 0; h < NUM_HIDDEN; h++ ) { sum += Math.abs( w[ ho + h ] - innate[ ho + h ] ); count ++; }
        }
    }
    return count > 0 ? sum / count : 0;
}
