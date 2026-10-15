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
export const NUM_INPUTS     = 21;

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
export const LEGACY_NUM_OUTPUTS = 8;
export const NUM_OUTPUTS    = 9;
export const DRIVE_OUTPUTS  = [ OUT_FOOD, OUT_MATE, OUT_FLEE, OUT_HUNT, OUT_SELF_EAT ];
export const NUM_DRIVES     = DRIVE_OUTPUTS.length;

export const NUM_HIDDEN     = 6;

//------------------------------------------------------------
// weight layout in the brain chromosome
//------------------------------------------------------------
const W_IO = 0;                                     // [output][input]
const W_IH = W_IO + NUM_OUTPUTS * NUM_INPUTS;       // [hidden][input]
const W_HH = W_IH + NUM_HIDDEN  * NUM_INPUTS;       // [hidden][hidden] (memory)
const W_HO = W_HH + NUM_HIDDEN  * NUM_HIDDEN;       // [output][hidden]
export const BRAIN_SIZE = W_HO + NUM_OUTPUTS * NUM_HIDDEN;

// Previous saves and BASE runs use this eight-output network. Keep its weight
// ordering and random draw count stable when the optional C11 action is off.
const LEGACY_W_IO = 0;
const LEGACY_W_IH = LEGACY_W_IO + LEGACY_NUM_OUTPUTS * NUM_INPUTS;
const LEGACY_W_HH = LEGACY_W_IH + NUM_HIDDEN * NUM_INPUTS;
const LEGACY_W_HO = LEGACY_W_HH + NUM_HIDDEN * NUM_HIDDEN;
export const LEGACY_BRAIN_SIZE = LEGACY_W_HO + LEGACY_NUM_OUTPUTS * NUM_HIDDEN;

function currentIndexForLegacyWeight( index: number ): number
{
    if ( index < LEGACY_W_IH ) return W_IO + index;
    if ( index < LEGACY_W_HH ) return W_IH + index - LEGACY_W_IH;
    if ( index < LEGACY_W_HO ) return W_HH + index - LEGACY_W_HH;
    return W_HO + index - LEGACY_W_HO;
}

export function migrateLegacyBrainWeights( target: Float32Array, source: ArrayLike<number> ): boolean
{
    if ( source == null || source.length !== LEGACY_BRAIN_SIZE ) return false;
    target.set( innateBrain() );
    for ( let i = 0; i < LEGACY_BRAIN_SIZE; i++ )
    {
        const value = Number( source[i] );
        target[ currentIndexForLegacyWeight( i ) ] = Number.isFinite( value ) ? value : 0;
    }
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
    for ( let k = 0; k < LEGACY_BRAIN_SIZE; k++ )
    {
        const index = currentIndexForLegacyWeight( k );
        out[index] = clampWeight( innate[index] + gaussian() * FOUNDER_BRAIN_NOISE );
    }
    if ( includeExtended )
    {
        // No innate trigger: founders get a broader random response pattern,
        // then inheritance and selection can shape when the action is useful.
        const extendedFounderNoise = FOUNDER_BRAIN_NOISE;
        for ( let i = 0; i < NUM_INPUTS; i++ )
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

//------------------------------------------------------------
// inheritance: each neuron (all its incoming weights) comes
// from one parent, then a few weights mutate
//------------------------------------------------------------
export function inheritBrain( child: Float32Array, a: Float32Array, b: Float32Array, includeExtended = false ): void
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
        copyRange( child, p, W_IO + OUT_SELF_EAT * NUM_INPUTS, NUM_INPUTS );
        copyRange( child, p, W_HO + OUT_SELF_EAT * NUM_HIDDEN, NUM_HIDDEN );
    }
    mutateBrain( child, BRAIN_MUTATION_RATE, includeExtended );
}

export function mutateBrain( w: Float32Array, rate: number, includeExtended = false ): void
{
    for ( let k = 0; k < LEGACY_BRAIN_SIZE; k++ )
    {
        const index = currentIndexForLegacyWeight( k );
        if ( gpRandom() < rate ) { w[index] = clampWeight( w[index] + gaussian() * BRAIN_MUTATION_STEP ); }
    }
    if ( includeExtended )
    {
        for ( let i = 0; i < NUM_INPUTS; i++ )
        {
            const index = W_IO + OUT_SELF_EAT * NUM_INPUTS + i;
            if ( gpRandom() < rate ) { w[index] = clampWeight( w[index] + gaussian() * BRAIN_MUTATION_STEP ); }
        }
        for ( let h = 0; h < NUM_HIDDEN; h++ )
        {
            const index = W_HO + OUT_SELF_EAT * NUM_HIDDEN + h;
            if ( gpRandom() < rate ) { w[index] = clampWeight( w[index] + gaussian() * BRAIN_MUTATION_STEP ); }
        }
    }
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
        const io = W_IO + o * NUM_INPUTS;
        for ( let i = 0; i < NUM_INPUTS; i++ ) { sum += w[ io + i ] * inputs[i]; }
        const ho = W_HO + o * NUM_HIDDEN;
        for ( let h = 0; h < NUM_HIDDEN; h++ ) { sum += w[ ho + h ] * hidden[h]; }
        outputs[o] = sum;
    }
}

export function sigmoid( x: number ): number { return 1 / ( 1 + Math.exp( -x )); }

// how far a brain has moved away from the innate one (mean absolute difference)
export function brainDistanceFromInnate( w: Float32Array, includeExtended = false ): number
{
    const innate = innateBrain();
    let sum = 0;
    for ( let k = 0; k < LEGACY_BRAIN_SIZE; k++ )
    {
        const index = currentIndexForLegacyWeight( k );
        sum += Math.abs( w[index] - innate[index] );
    }
    if ( includeExtended )
    {
        for ( let i = 0; i < NUM_INPUTS; i++ )
        {
            const index = W_IO + OUT_SELF_EAT * NUM_INPUTS + i;
            sum += Math.abs( w[index] - innate[index] );
        }
        for ( let h = 0; h < NUM_HIDDEN; h++ )
        {
            const index = W_HO + OUT_SELF_EAT * NUM_HIDDEN + h;
            sum += Math.abs( w[index] - innate[index] );
        }
    }
    return sum / ( includeExtended ? BRAIN_SIZE : LEGACY_BRAIN_SIZE );
}
