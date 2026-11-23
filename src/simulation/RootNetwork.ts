//------------------------------------------------------------------------------
// RootNetwork  multi-generation underground stolon network (parents ->
// children -> grandchildren+), conserved sap sharing across the lineage,
// root severing by swimbots, and natural aging.
//------------------------------------------------------------------------------
import { depositSoilEnergy, plantStageCap } from "./SoilEcology";
import { POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_BOTTOM, POOL_WIDTH, POOL_HEIGHT } from "./Pool";
import { PARAM_STEP } from "./SharedState";
import { gpRandom } from "./Globals";

const STOLON_DIST_MIN = 90, STOLON_DIST_MAX = 195;
const STOLON_COST     = 4.2;
const STOLON_COOLDOWN = 20;
const SHARING_PASSES  = 2;

function getStepClock( st: any, explicitClock?: number ): number
{
    if ( typeof explicitClock === "number" && explicitClock > 0 ) return explicitClock;
    if ( st && st.params && st.params[ PARAM_STEP ] > 0 ) return st.params[ PARAM_STEP ];
    return ( st && typeof st.clock === "number" ) ? st.clock : 0;
}

function getSoilValue( st: any, wx: number, wy: number ): number
{
    if ( !st || !st.soilField ) return 5.0;
    const gn = st.soilGridN || Math.max( 1, Math.floor( Math.sqrt( st.soilField.length )));
    const ix = Math.max( 0, Math.min( gn - 1, Math.floor(( wx - POOL_LEFT ) / POOL_WIDTH * gn )));
    const iy = Math.max( 0, Math.min( gn - 1, Math.floor(( wy - POOL_TOP ) / POOL_HEIGHT * gn )));
    const row = st.soilField[ iy * gn ];
    if ( typeof row === "number" ) return st.soilField[ iy * gn + ix ] ?? 0;
    if ( Array.isArray( row ) || ArrayBuffer.isView( row )) return (row as any)[ ix ] ?? 0;
    return st.soilField[ iy * gn + ix ] ?? 0;
}

function isGrown( st: any, f: number ): boolean
{
    return ( st.liveFood[ f ] === 1 ) && ( st.foodType[ f ] !== 2 ) && ( st.foodEnergy[ f ] >= 20 );
}

function countDirectChildren( st: any, parentIdx: number ): number
{
    let count = 0;
    const pp = st.plantParent, lf = st.liveFood;
    if ( !pp || !lf ) return 0;
    for ( let c = 0; c < pp.length; c++ )
    {
        if ( pp[ c ] === parentIdx && lf[ c ] === 1 ) count++;
    }
    return count;
}

function pickStolonSpot( st: any, p: number ): { x: number, y: number } | null
{
    const X = st.foodX, Y = st.foodY;
    if ( !X || !Y || X[ p ] === undefined || Y[ p ] === undefined ) return null;
    const limit = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    for ( let k = 0; k < 24; k++ )
    {
        const ang = gpRandom() * Math.PI * 2;
        const dist = STOLON_DIST_MIN + gpRandom() * ( STOLON_DIST_MAX - STOLON_DIST_MIN );
        const cx = X[ p ] + Math.cos( ang ) * dist;
        const cy = Y[ p ] + Math.sin( ang ) * dist;
        if (( cx < POOL_LEFT + 120 ) || ( cx > POOL_RIGHT - 120 ) || ( cy < POOL_TOP + 120 ) || ( cy > POOL_BOTTOM - 120 )) continue;
        if ( getSoilValue( st, cx, cy ) < 2.0 ) continue;
        let clear = true;
        for ( let q = 0; q < limit; q++ )
        {
            if ( st.liveFood[ q ] !== 1 || st.foodType[ q ] === 2 ) continue;
            const dx = X[ q ] - cx, dy = Y[ q ] - cy;
            if ( dx * dx + dy * dy < 52 * 52 ) { clear = false; break; }
        }
        if ( clear ) return { x: cx, y: cy };
    }
    return null;
}

function findFreeFoodBit( st: any ): number
{
    const limit = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    for ( let f = 0; f < limit; f++ )
    {
        if ( st.liveFood[ f ] === 0 ) return f;
    }
    return -1;
}

export function spawnStolon( st: any, p: number, clock: number ): boolean
{
    if ( !isGrown( st, p )) return false;
    if (( clock + p ) % STOLON_COOLDOWN !== 0 ) return false;
    const energy = st.foodEnergy[ p ];
    if ( energy <= STOLON_COST + 10 ) return false;
    if ( countDirectChildren( st, p ) >= 5 ) return false;
    const spot = pickStolonSpot( st, p );
    if ( !spot ) return false;
    const c = findFreeFoodBit( st );
    if ( c < 0 || c === p || isAncestor( st, c, p )) return false;
    st.liveFood[ c ]      = 1;
    if ( st.foodAlive ) st.foodAlive[ c ] = 1;
    st.foodType[ c ]      = st.foodType[ p ];
    st.foodEnergy[ c ]    = STOLON_COST;
    st.foodEnergy[ p ]    = energy - STOLON_COST;
    st.foodX[ c ]         = spot.x;
    st.foodY[ c ]         = spot.y;
    if ( st.foodWood )  st.foodWood[ c ]  = STOLON_COST;
    if ( st.foodFruit ) st.foodFruit[ c ] = 0;
    if ( st.foodAge )   st.foodAge[ c ]   = 0;
    if ( st.plantAge )  st.plantAge[ c ]  = 0;
    if ( st.foodBorn )  st.foodBorn[ c ]  = clock;
    st.plantParent[ c ]   = p;
    if ( st.plantRootFlow ) st.plantRootFlow[ c ] = 0.05;
    return true;
}

function shareChainEnergy( st: any ): void
{
    if ( !st.plantParent || !st.foodEnergy ) return;
    const links: number[] = [];
    const N = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] === 1 && st.plantParent[ f ] >= 0 ) links.push( f );
    }
    if ( links.length === 0 ) return;

    for ( let pass = 0; pass < SHARING_PASSES; pass++ )
    {
        const start = pass === 0 ? 0 : links.length - 1;
        const end   = pass === 0 ? links.length : -1;
        const step  = pass === 0 ? 1 : -1;
        for ( let i = start; i !== end; i += step )
        {
            const c = links[ i ];
            const p = st.plantParent[ c ];
            if ( p < 0 || st.liveFood[ c ] !== 1 || st.liveFood[ p ] !== 1 ) continue;
            const maxP = plantStageCap( st, st.foodX[ p ], st.foodY[ p ], st.foodEnergy[ p ] );
            const maxC = plantStageCap( st, st.foodX[ c ], st.foodY[ c ], st.foodEnergy[ c ] );
            if ( maxP <= 0 || maxC <= 0 ) continue;
            const target = ( st.foodEnergy[ p ] + st.foodEnergy[ c ] ) / ( maxP + maxC );
            let delta = ( st.foodEnergy[ p ] - target * maxP ) * 0.16;
            if ( delta > 0 )
            {
                if ( st.foodEnergy[ p ] - delta < 4 ) delta = Math.max( 0, st.foodEnergy[ p ] - 4 );
                st.foodEnergy[ p ] -= delta;
                st.foodEnergy[ c ] += delta;
                if ( st.plantRootFlow ) st.plantRootFlow[ c ] = delta;
            }
            else if ( delta < 0 )
            {
                if ( st.foodEnergy[ c ] + delta < 4 ) delta = -Math.max( 0, st.foodEnergy[ c ] - 4 );
                st.foodEnergy[ p ] -= delta;
                st.foodEnergy[ c ] += delta;
                if ( st.plantRootFlow ) st.plantRootFlow[ c ] = delta;
            }
        }
    }
}

export function severRoots( st: any, clock: number, _bots?: any[] ): void
{
    if (( clock & 3 ) !== 0 ) return;
    if ( !st.liveSwimbot || !st.botX || !st.botY || !st.plantParent ) return;
    const botCount = st.liveSwimbot.length;
    let hasLiveBots = false;
    for ( let s = 0; s < botCount; s++ ) { if ( st.liveSwimbot[ s ] === 1 ) { hasLiveBots = true; break; } }
    if ( !hasLiveBots ) return;

    const N = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    for ( let f = 0; f < N; f++ )
    {
        const p = st.plantParent[ f ];
        if ( p < 0 || st.liveFood[ f ] !== 1 ) continue;
        const x1 = st.foodX[ p ], y1 = st.foodY[ p ];
        const dx = st.foodX[ f ] - x1, dy = st.foodY[ f ] - y1;
        const len2 = dx * dx + dy * dy;
        if ( len2 < 1e-6 ) continue;
        for ( let s = 0; s < botCount; s++ )
        {
            if ( st.liveSwimbot[ s ] !== 1 ) continue;
            const bx = st.botX[ s ], by = st.botY[ s ];
            const t = (( bx - x1 ) * dx + ( by - y1 ) * dy ) / len2;
            if ( t < 0.05 || t > 0.95 ) continue;
            const cx = x1 + t * dx, cy = y1 + t * dy;
            const ex = cx - bx, ey = cy - by;
            if ( ex * ex + ey * ey <= 144 )
            {
                pushSeverSnap( cx, cy, x1, y1, st.foodX[ f ], st.foodY[ f ] );
                st.plantParent[ f ] = -1;
                if ( st.plantRootFlow ) st.plantRootFlow[ f ] = 0;
                break;
            }
        }
    }
}

export function ageTrees( st: any ): void
{
    const ageArr = st.plantAge || st.foodAge;
    if ( !ageArr || !st.plantParent ) return;
    const N = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        ageArr[ f ] = ( ageArr[ f ] || 0 ) + 1;
        if ( ageArr[ f ] >= 26000 + ( f % 6000 ) && st.foodEnergy[ f ] > 0 )
        {
            depositSoilEnergy( st, st.foodX[ f ], st.foodY[ f ], st.foodEnergy[ f ] );
            st.foodEnergy[ f ] = 0;
            st.liveFood[ f ] = 0;
            if ( st.foodAlive ) st.foodAlive[ f ] = 0;
            st.plantParent[ f ] = -1;
            if ( st.plantRootFlow ) st.plantRootFlow[ f ] = 0;
            for ( let c = 0; c < N; c++ )
            {
                if ( st.plantParent[ c ] === f )
                {
                    st.plantParent[ c ] = -1;
                    if ( st.plantRootFlow ) st.plantRootFlow[ c ] = 0;
                }
            }
        }
    }
}

export function isAncestor( st: any, maybeAncestor: number, node: number ): boolean
{
    if ( !st.plantParent ) return false;
    let cur = st.plantParent[ node ], depth = 0;
    while ( cur >= 0 && depth < 32 )
    {
        if ( cur === maybeAncestor ) return true;
        cur = st.plantParent[ cur ];
        depth++;
    }
    return false;
}

export function seedDynasties( st: any ): void
{
    if ( !st || !st.plantParent || !st.liveFood || !st.foodEnergy ) return;
    const trees: number[] = [];
    const N = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] === 1 && st.foodType[ f ] !== 2 && st.foodEnergy[ f ] >= 22 ) trees.push( f );
    }
    if ( trees.length === 0 ) return;

    for ( let c = 0; c < N; c++ )
    {
        if ( st.plantParent[ c ] >= 0 || st.liveFood[ c ] !== 1 || st.foodType[ c ] === 2 ) continue;
        if ( st.foodEnergy[ c ] >= 22 ) continue;
        let best = -1, bestD = 200 * 200;
        for ( const p of trees )
        {
            if ( p === c ) continue;
            const d2 = ( st.foodX[ p ] - st.foodX[ c ] ) ** 2 + ( st.foodY[ p ] - st.foodY[ c ] ) ** 2;
            if ( d2 < bestD ) { bestD = d2; best = p; }
        }
        if ( best >= 0 && !isAncestor( st, c, best ))
        {
            st.plantParent[ c ] = best;
            if ( st.plantRootFlow ) st.plantRootFlow[ c ] = 0.05;
        }
    }

    const children: number[] = [];
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] === 1 && st.plantParent[ f ] >= 0 ) children.push( f );
    }
    for ( let gc = 0; gc < N; gc++ )
    {
        if ( st.plantParent[ gc ] >= 0 || st.liveFood[ gc ] !== 1 || st.foodType[ gc ] === 2 ) continue;
        let best = -1, bestD = 185 * 185;
        for ( const ch of children )
        {
            if ( ch === gc ) continue;
            const d2 = ( st.foodX[ ch ] - st.foodX[ gc ] ) ** 2 + ( st.foodY[ ch ] - st.foodY[ gc ] ) ** 2;
            if ( d2 < bestD ) { bestD = d2; best = ch; }
        }
        if ( best >= 0 && !isAncestor( st, gc, best ))
        {
            st.plantParent[ gc ] = best;
            if ( st.plantRootFlow ) st.plantRootFlow[ gc ] = 0.03;
        }
    }
}

export function stepRootNetwork( st: any, explicitClock?: number, _bots?: any[] ): void
{
    tickSeverSnaps();
    if ( !st || !st.liveFood || !st.plantParent ) return;
    const clock = getStepClock( st, explicitClock );
    const N = Math.min( st.liveFood.length, Math.floor( st.liveFood.length * 0.75 ));
    if ( N <= 0 ) return;
    const maxSpawns = Math.max( 6, Math.round( N / 1000 ));
    let spawned = 0;
    const offset = ( clock * 37 ) % N;
    for ( let i = 0; i < N && spawned < maxSpawns; i++ )
    {
        const f = ( offset + i ) % N;
        if ( isGrown( st, f ) && spawnStolon( st, f, clock )) spawned++;
    }
    shareChainEnergy( st );
    ageTrees( st );
}

export function unlinkChildren( st: any, f: number ): void
{
    if ( !st || !st.plantParent ) return;
    st.plantParent[ f ] = -1;
    if ( st.plantRootFlow ) st.plantRootFlow[ f ] = 0;
    const N = Math.min( st.plantParent.length, Math.floor( st.plantParent.length * 0.75 ));
    for ( let c = 0; c < N; c++ )
    {
        if ( st.plantParent[ c ] === f )
        {
            st.plantParent[ c ] = -1;
            if ( st.plantRootFlow ) st.plantRootFlow[ c ] = 0;
        }
    }
}

export function computePlantLineage( plantParent: ArrayLike<number> | null | undefined, liveFood: ArrayLike<number> | null | undefined, f: number )
{
    const ancestors: number[] = [];
    const children: number[] = [];
    const grandchildren: number[] = [];
    if ( !plantParent || f < 0 || f >= plantParent.length )
    {
        return { parent: -1, ancestors, children, grandchildren, totalDescendants: 0, maxDepth: 0 };
    }

    const seenUp = new Set<number>([ f ]);
    let cur = plantParent[ f ];
    while ( cur >= 0 && cur < plantParent.length && ancestors.length < 32 && !seenUp.has( cur ))
    {
        if ( liveFood && liveFood[ cur ] !== 1 ) break;
        seenUp.add( cur );
        ancestors.push( cur );
        cur = plantParent[ cur ];
    }

    const visited = new Set<number>([ f ]);
    let frontier: number[] = [ f ];
    let depth = 0;
    let maxDepth = 0;

    while ( frontier.length > 0 && depth < 32 )
    {
        const nextFrontier: number[] = [];
        for ( let i = 0; i < frontier.length; i++ )
        {
            const node = frontier[ i ];
            for ( let c = 0; c < plantParent.length; c++ )
            {
                if ( plantParent[ c ] === node && !visited.has( c ))
                {
                    if ( liveFood && liveFood[ c ] !== 1 ) continue;
                    visited.add( c );
                    nextFrontier.push( c );
                    if ( depth === 0 ) children.push( c );
                    else grandchildren.push( c );
                }
            }
        }
        if ( nextFrontier.length > 0 ) maxDepth = depth + 1;
        frontier = nextFrontier;
        depth++;
    }

    return {
        parent: ancestors.length > 0 ? ancestors[ 0 ] : -1,
        ancestors,
        children,
        grandchildren,
        totalDescendants: children.length + grandchildren.length,
        maxDepth,
    };
}

const SEVER_SNAP_CAP = 32;
let severSnaps: any[] = [];
export function pushSeverSnap( xCut: number, yCut: number, xP: number, yP: number, xC: number, yC: number ): void
{
    severSnaps.push({ xCut, yCut, xP, yP, xC, yC, age: 30 });
    if ( severSnaps.length > SEVER_SNAP_CAP ) { severSnaps = severSnaps.slice( severSnaps.length - SEVER_SNAP_CAP ); }
}
export function tickSeverSnaps(): void
{
    for ( let i = 0; i < severSnaps.length; i++ ) { severSnaps[ i ].age--; }
    while ( severSnaps.length > 0 && severSnaps[ 0 ].age <= 0 ) { severSnaps.shift(); }
}
export function getSeverSnaps(): any[] { return severSnaps; }
