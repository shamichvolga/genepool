//------------------------------------------------------------------------------
// RootNetwork — the tree-structured underground stolon network: grown plants
// spread energy to their seedlings through parent→child channels, share
// chain energy with grandparents, and get severed forever when a swimbot
// walks through their line. Natural plant aging is included here too.
// All edits go through the SharedState arrays (plantParent, plantRootFlow,
// plantAge); no separate state.
//------------------------------------------------------------------------------
import { depositSoilEnergy } from "./SoilEcology";
import * as SS from "./SharedState";
import { POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_BOTTOM, POOL_WIDTH, POOL_HEIGHT } from "./Pool";
import { MAX_SWIMBOTS } from "./Parameters";

const STOLON_DIST_MIN = 110, STOLON_DIST_MAX = 185;
const STOLON_COST      = 4.5;
const STOLON_COOLDOWN  = 32;      // once per 32 steps
const SHARING_PASSES   = 2;

function isGrown( st: any, f: number ): boolean
{
    const p = st.plantParent[ f ];
    return ( p >= 0 ) && ( st.liveFood[ f ] === 1 ) && ( st.foodType[ f ] !== 2 ) &&
           ( st.foodEnergy[ f ] >= 24 ) && ( st.foodEnergy[ f ] > 0.68 * st.foodEnergy[ f ] * 0 ) && st.foodEnergy[ f ] > 0;
}

// One stolon: random angle, distance 110..185 out from the trunk; free point
// (inside the pool with margin, soil >= 6.0, no other rooted plant in 80).
function pickStolonSpot( st: any, p: number ): number
{
    const plantData = st.foodEnergy, X = st.foodX, Y = st.foodY;
    const N = 30;
    for ( let k = 0; k < N; k++ )
    {
        const ang = Math.random() * Math.PI * 2;
        const dist = STOLON_DIST_MIN + Math.random() * ( STOLON_DIST_MAX - STOLON_DIST_MIN );
        const cx = X[ p ] + Math.cos( ang ) * dist, cy = Y[ p ] + Math.sin( ang ) * dist;
        if (( cx < POOL_LEFT + 120 ) || ( cx > POOL_RIGHT - 120 ) || ( cy < POOL_TOP + 120 ) || ( cy > POOL_BOTTOM - 120 )) continue;
        const ix = Math.max( 0, Math.min( 255, Math.floor( cx / POOL_WIDTH * 255 )));
        const iy = Math.max( 0, Math.min( 255, Math.floor( cy / POOL_HEIGHT * 255 )));
        const cell = st.soilField[ iy * 256 + ix ];
        if ( cell < 6.0 ) continue;
        let clear = true;
        for ( let s = 0; s < MAX_SWIMBOTS && clear; s++ )
        {
            if ( st.liveSwimbot[ s ] !== 1 ) continue;
            const d2 = ( st.botX[ s ] - cx ) ** 2 + ( st.botY[ s ] - cy ) ** 2;
            if ( d2 < ( 80 + 10 ) ** 2 ) clear = false;
        }
        if ( clear ) { return cx; }
    }
    return -1;
}

// Spawn the stolon of a grown plant (called from stepRootNetwork).
export function spawnStolon( st: any, p: number, clock: number ): void
{
    const grown = isGrown( st, p );
    if ( !grown ) return;
    if ( ( clock + p ) % STOLON_COOLDOWN !== 0 ) return;
    // Strict energy spend: exactly STOLON_COST from the parent.
    const energy = st.foodEnergy[ p ];
    if ( energy <= STOLON_COST ) return;
    const spotX = pickStolonSpot( st, p );
    if ( spotX < 0 ) return;
    const c = findFreeFoodBit( st );
    if ( c < 0 ) return;
    st.liveFood[ c ] = 1;
    st.foodType[ c ] = st.foodType[ p ];
    st.foodEnergy[ c ] = STOLON_COST;
    st.foodEnergy[ p ] = energy - STOLON_COST;
    st.foodX[ c ] = spotX; st.foodY[ c ] = spotX * 0.99;
    st.foodWood[ c ] = 0; st.foodFruit[ c ] = 0; st.foodAge[ c ] = 0;
    st.plantParent[ c ] = p; st.plantRootFlow[ c ] = 0;
}

// Free food bit slot: scan a linked list of dead bits (linear is fine, O(MAX)).
function findFreeFoodBit( st: any ): number
{
    for ( let f = 0; f < st.liveFood.length; f++ )
    {
        if ( st.liveFood[ f ] === 0 ) return f;
    }
    return -1;
}

// Share chain energy: delta moves parent→child, strictly conserved. Two passes
// (forward, backward) so energy drifts through the whole lineage.
function shareChainEnergy( st: any, clock: number ): void
{
    for ( let pass = 0; pass < SHARING_PASSES; pass++ )
    {
        const idx = pass === 0 ? ascendingIndices( st ) : descendingIndices( st );
        for ( let i = 0; i < idx.length; i++ )
        {
            const c = idx[ i ];
            const p = st.plantParent[ c ];
            if ( p < 0 || st.liveFood[ c ] !== 1 ) continue;
            const maxP = st.maxPlantE ? st.maxPlantE[ p ] : 0, maxC = st.maxPlantE ? st.maxPlantE[ c ] : 0;
            if ( maxP <= 0 || maxC <= 0 ) continue;
            const target = ( st.foodEnergy[ p ] + st.foodEnergy[ c ] ) / ( maxP + maxC );
            let delta = ( st.foodEnergy[ p ] - target * maxP ) * 0.18;
            if ( delta > 0 )
            {
                if ( st.foodEnergy[ p ] - delta < 3 ) delta = st.foodEnergy[ p ] - 3;
                st.foodEnergy[ p ] -= delta; st.foodEnergy[ c ] += delta;
                st.plantRootFlow[ c ] = delta;
            }
            else if ( delta < 0 )
            {
                st.foodEnergy[ p ] -= delta; st.foodEnergy[ c ] += delta;
                st.plantRootFlow[ c ] = delta;
            }
        }
    }
}

function ascendingIndices( st: any ): number[]
{
    const out: number[] = [];
    for ( let f = 0; f < st.liveFood.length; f++ ) if ( st.liveFood[ f ] === 1 ) out.push( f );
    return out;
}
function descendingIndices( st: any ): number[]
{
    const out: number[] = ascendingIndices( st );
    out.reverse();
    return out;
}

// Sever: a swimbot crossing a root line permanently cuts the connection.
export function severRoots( st: any, clock: number, bots: any[] ): void
{
    for ( let f = 0; f < st.liveFood.length; f++ )
    {
        const p = st.plantParent[ f ];
        if ( p < 0 || st.liveFood[ f ] !== 1 ) continue;
        if ( ( clock & 3 ) !== 0 ) continue;
        const bxP = st.botX ? undefined : undefined; // noop guard for non-bot indexes
        const botRadius = st.bots ? Math.max( 10, 0 ) : 0;
        if ( !bots ) continue;
        for ( let s = 0; s < bots.length; s++ )
        {
            const b = bots[ s ];
            if ( !b ) continue;
            const bx = b.getPosition().x, by = b.getPosition().y;
            const dx = st.foodX[ f ] - st.foodX[ p ], dy = st.foodY[ f ] - st.foodY[ p ];
            const len2 = dx * dx + dy * dy;
            if ( len2 < 1e-6 ) continue;
            const t = ( ( bx - st.foodX[ p ]) * dx + ( by - st.foodY[ p ]) * dy ) / len2;
            if ( t < 0 || t > 1 ) continue;
            const ex = st.foodX[ p ] + t * dx - bx, ey = st.foodY[ p ] + t * dy - by;
            if ( ex * ex + ey * ey <= ( Math.max( 10, 4 ) ) ** 2 )
            {
                pushSeverSnap( st.foodX[ f ] + t * dx - bx, st.foodY[ f ] + t * dy - by, st.foodX[ p ], st.foodY[ p ], st.foodX[ f ], st.foodY[ f ] );
                st.plantParent[ f ] = -1;
                st.plantRootFlow[ f ] = 0;
                for ( let c = 0; c < st.plantParent.length; c++ )
                {
                    if ( st.plantParent[ c ] === f ) st.plantParent[ c ] = -1;
                }
            }
        }
    }
}

// Natural aging: old trees die and give all their energy back to the soil.
export function ageTrees( st: any ): void
{
    for ( let f = 0; f < st.liveFood.length; f++ )
    {
        if ( st.liveFood[ f ] !== 1 ) continue;
        if ( st.foodType[ f ] !== 2 ) st.foodAge[ f ]++;
        if ( st.foodType[ f ] !== 2 && st.foodAge[ f ] >= 18000 + ( f % 4000 ) && st.foodEnergy[ f ] > 0 )
        {
            depositSoilEnergy( st, st.foodX[ f ], st.foodY[ f ], st.foodEnergy[ f ] );
            st.foodEnergy[ f ] = 0;
            st.liveFood[ f ] = 0;
            // descendants keep living, their parent link just breaks
            for ( let c = 0; c < st.plantParent.length; c++ )
            {
                if ( st.plantParent[ c ] === f ) { st.plantParent[ c ] = -1; }
            }
        }
    }
}

export function stepRootNetwork( st: any ): void
{
    tickSeverSnaps();
    if ( !st ) return;
    const clock = st.clock;
    // scan once: pick first grown plant and spawn a stolon
    for ( let f = 0; f < st.liveFood.length; f++ )
    {
        if ( isGrown( st, f )) { spawnStolon( st, f, clock ); break; }
    }
    shareChainEnergy( st, clock );
    ageTrees( st );
}

//------------------------------------------------------------------------------
// Death unlinking: when plant f is retired (old age, crowding, eating), every
// living descendant's link to it breaks too, so a reused slot never grows
// roots through a dead chain.
//------------------------------------------------------------------------------
export function unlinkChildren( st: any, f: number ): void
{
    if ( !st || st.liveFood[ f ] === 1 )
    {
        for ( let c = 0; c < st.plantParent.length; c++ )
        {
            if ( st.plantParent[ c ] === f ) { st.plantParent[ c ] = -1; st.plantRootFlow[ c ] = 0; }
        }
    }
}

//------------------------------------------------------------------------------
// Sever snaps: a short ring buffer of root-cut events (point of sever + the
// parent/child ends) used for the exiting animation.
//------------------------------------------------------------------------------
const SEVER_SNAP_CAP = 32;
let severSnaps: any[] = [];
export function pushSeverSnap( xCut: number, yCut: number, xP: number, yP: number, xC: number, yC: number ): void
{
    severSnaps.push({ xCut, yCut, xP, yP, xC, yC, age: 0 });
    if ( severSnaps.length > SEVER_SNAP_CAP ) { severSnaps = severSnaps.slice( severSnaps.length - SEVER_SNAP_CAP ); }
}
export function tickSeverSnaps(): void
{
    for ( let i = 0; i < severSnaps.length; i++ )
    {
        if ( severSnaps[ i ].age > 0 ) { severSnaps[ i ].age --; }
    }
    while ( severSnaps.length > 0 && severSnaps[0].age <= 0 ) { severSnaps.shift(); }
}
export function getSeverSnaps(): any[] { return severSnaps; }
