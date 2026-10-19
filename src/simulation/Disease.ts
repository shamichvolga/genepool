//------------------------------------------------------------------------------
// Diseases (DISEASE_ENABLED; docs/концепт_болезни.md): a check against one
// form taking over the world.
//
// "Key and lock": every swimbot has an immune profile - 4 genes (165-168) and
// its body colour. A disease strain has a key of the same 7 numbers. The more
// a body's profile is like the key, the more easily it catches it. Kin and
// look-alikes have similar profiles, so a common form spreads the disease
// among itself, while rare forms hardly catch it.
//
//   appears:  now and then, in a random swimbot in a crowd; the key is that swimbot's
//             profile with a little noise (it is aimed at its kind)
//   spreads:  when bodies touch; chance = DISEASE_TRANSMISSION x likeness;
//             now and then it changes a little (a new strain)
//   does:     costs energy every step; it does not kill by itself - a fed
//             body pulls through, a weak one may starve. The sick are easy
//             prey: a predator of any size can take them
//   ends:     after DISEASE_DURATION steps; then the body remembers the
//             strain (and strains like it) and does not catch it again.
//             Immunity is not inherited. With no new bodies to catch it, an
//             outbreak dies out by itself.
//
// Runs on the simulation thread (only the sick look around for contacts).
//------------------------------------------------------------------------------
import { gpRandom, simCounters } from "./Globals";
import { DISEASE_CONTACT_SCALE, DISEASE_DRAIN, DISEASE_DURATION, DISEASE_KEY_WIDTH, DISEASE_MUTATION_CHANCE,
         DISEASE_SPAWN_PERIOD, DISEASE_TRANSMISSION, DISEASE_IMMUNITY_LIKENESS, DISEASE_CROWD_NEIGHBOURS } from "./Parameters";
import { SharedState, BOT_STRIDE, B_ENERGY, B_SUM_LENGTHS } from "./SharedState";
import { MIND_STRIDE, M_DISEASE, M_DISEASE_TIMER, M_IMMUNE_0, M_IMMUNE_MEMORY, NUM_IMMUNE_MEMORY } from "./MindLayout";

export const KEY_SIZE = 7;
const strains: Float32Array[] = [ new Float32Array( KEY_SIZE ) ];   // strain 0 = "healthy"
const profileBuffer = new Float32Array( KEY_SIZE );
const nearbyBuffer  = new Int32Array( 4096 );

// a body's profile: its 4 immune genes and its colour
function profileOf( st: SharedState, s: number, out: Float32Array ): Float32Array
{
    const m = s * MIND_STRIDE;
    for (let k = 0; k < 4; k++) { out[k] = st.mind[ m + M_IMMUNE_0 + k ]; }
    out[4] = st.colorR[s]; out[5] = st.colorG[s]; out[6] = st.colorB[s];
    return out;
}

function likeness( a: Float32Array, b: Float32Array ): number
{
    let d2 = 0;
    for (let k = 0; k < KEY_SIZE; k++) { const d = a[k] - b[k]; d2 += d * d; }
    return Math.exp( -d2 / ( 2 * DISEASE_KEY_WIDTH * DISEASE_KEY_WIDTH ));
}

function newStrain( from: Float32Array, noise: number ): number
{
    const key = new Float32Array( KEY_SIZE );
    for (let k = 0; k < KEY_SIZE; k++) { key[k] = Math.min( 1, Math.max( 0, from[k] + ( gpRandom() - 0.5 ) * 2 * noise )); }
    strains.push( key );
    return strains.length - 1;
}

// immune: it has had this strain, or one very like it
function immune( st: SharedState, s: number, strain: number ): boolean
{
    const m = s * MIND_STRIDE;
    for (let k = 0; k < NUM_IMMUNE_MEMORY; k++)
    {
        const had = st.mind[ m + M_IMMUNE_MEMORY + k ];
        if ( had <= 0 ) continue;
        if (( had === strain ) || ( likeness( strains[ had ], strains[ strain ] ) > DISEASE_IMMUNITY_LIKENESS )) return true;
    }
    return false;
}

function infect( st: SharedState, s: number, strain: number ): void
{
    const m = s * MIND_STRIDE;
    st.mind[ m + M_DISEASE ] = strain;
    st.mind[ m + M_DISEASE_TIMER ] = DISEASE_DURATION;
    simCounters.diseaseInfections ++;
}

function recover( st: SharedState, s: number ): void
{
    const m = s * MIND_STRIDE;
    const strain = st.mind[ m + M_DISEASE ];
    // remember it (the oldest memory goes)
    for (let k = NUM_IMMUNE_MEMORY - 1; k > 0; k--) { st.mind[ m + M_IMMUNE_MEMORY + k ] = st.mind[ m + M_IMMUNE_MEMORY + k - 1 ]; }
    st.mind[ m + M_IMMUNE_MEMORY ] = strain;
    st.mind[ m + M_DISEASE ] = 0;
    st.mind[ m + M_DISEASE_TIMER ] = 0;
}

// a newborn starts healthy and with no immunity (call when it is created)
export function clearDisease( st: SharedState, s: number ): void
{
    const m = s * MIND_STRIDE;
    st.mind[ m + M_DISEASE ] = 0;
    st.mind[ m + M_DISEASE_TIMER ] = 0;
    for (let k = 0; k < NUM_IMMUNE_MEMORY; k++) { st.mind[ m + M_IMMUNE_MEMORY + k ] = 0; }
}

export function isSick( st: SharedState, s: number ): boolean { return st.mind[ s * MIND_STRIDE + M_DISEASE ] > 0; }

//------------------------------------------------------------------------------
// one step: maybe a new disease; the sick pay, spread it, get well
// (alive: the living swimbots; returns how many are sick)
//------------------------------------------------------------------------------
export function updateDiseases( st: SharedState, alive: ArrayLike<number>, numAlive: number, step: number ): number
{
    // a new disease, now and then
    if (( numAlive > 0 ) && ( gpRandom() < 1 / DISEASE_SPAWN_PERIOD ))
    {
        const s = alive[ Math.floor( gpRandom() * numAlive ) ];
        // (only in a crowd: a disease of crowding; where bodies are few it never starts)
        const crowd = st.swimbotGrid.collect( st.botX[s], st.botY[s], st.bots[ s * BOT_STRIDE + B_SUM_LENGTHS ] * DISEASE_CONTACT_SCALE * 4 + 100, nearbyBuffer );
        if ( !isSick( st, s ) && ( crowd > DISEASE_CROWD_NEIGHBOURS ))
        {
            infect( st, s, newStrain( profileOf( st, s, profileBuffer ), 0.05 ));
            simCounters.diseaseOutbreaks ++;
        }
    }

    let sick = 0;
    const grid = st.swimbotGrid;
    for (let i = 0; i < numAlive; i++)
    {
        const s = alive[i];
        const m = s * MIND_STRIDE;
        const strain = st.mind[ m + M_DISEASE ];
        if ( !( strain > 0 )) continue;
        sick ++;

        // it costs energy
        const b = s * BOT_STRIDE;
        st.bots[ b + B_ENERGY ] = Math.max( 0, st.bots[ b + B_ENERGY ] - DISEASE_DRAIN );

        // getting well
        if ( -- st.mind[ m + M_DISEASE_TIMER ] <= 0 ) { recover( st, s ); continue; }

        // touching others (every 4th step, spread over the bodies)
        if ((( step + s ) & 3 ) !== 0 ) continue;
        const reachS = st.bots[ b + B_SUM_LENGTHS ] * DISEASE_CONTACT_SCALE;
        const n = grid.collect( st.botX[s], st.botY[s], reachS * 2 + 50, nearbyBuffer );
        for (let k = 0; k < n; k++)
        {
            const o = nearbyBuffer[k];
            if (( o === s ) || ( st.liveSwimbot[o] !== 1 ) || isSick( st, o ) || ( st.eternal[o] === 1 )) continue;
            const reach = reachS + st.bots[ o * BOT_STRIDE + B_SUM_LENGTHS ] * DISEASE_CONTACT_SCALE;
            const dx = st.botX[o] - st.botX[s], dy = st.botY[o] - st.botY[s];
            if ( dx * dx + dy * dy > reach * reach ) continue;
            if ( immune( st, o, strain )) continue;
            if ( gpRandom() < DISEASE_TRANSMISSION * likeness( strains[ strain ], profileOf( st, o, profileBuffer )))
            {
                // now and then the disease changes a little on the way
                const passed = ( gpRandom() < DISEASE_MUTATION_CHANCE ) ? newStrain( strains[ strain ], 0.08 ) : strain;
                infect( st, o, passed );
            }
        }
    }
    return sick;
}
