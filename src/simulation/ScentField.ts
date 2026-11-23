//------------------------------------------------------------------------------
// ScentField — 64x64 diffusion smell grids (food, prey, predator traces),
// Z-order Morton spatial sorting for cache locality, and herbivore morph shares.
//------------------------------------------------------------------------------
import { MAX_FOODBITS, MAX_SWIMBOTS, PREDATOR_LEVEL_THRESHOLD } from "./Parameters";
import { POOL_HEIGHT, POOL_WIDTH } from "./Pool";
import * as SS from "./SharedState";

const _mortonCodes     = new Int32Array( MAX_SWIMBOTS );
const _foodMortonCodes = new Int32Array( MAX_FOODBITS );
const _scentTmp        = new Float32Array( SS.SCENT_GRID_N * SS.SCENT_GRID_N );
const _scentCellW      = POOL_WIDTH  / SS.SCENT_GRID_N;
const _scentCellH      = POOL_HEIGHT / SS.SCENT_GRID_N;

export interface ScentContext {
    readonly st: SS.SharedState;
    readonly swimbots: any[];
    readonly aliveSwimbotIndices: number[];
    readonly aliveFoodBitIndices: number[];
    readonly clock: number;
}

function mortonBits( v: number ): number
{
    v &= 0xff;
    v = ( v | ( v << 4 )) & 0x0f0f;
    v = ( v | ( v << 2 )) & 0x3333;
    v = ( v | ( v << 1 )) & 0x5555;
    return v;
}

export function updateScentFields( ctx: ScentContext ): void
{
    const st = ctx.st;
    const N = SS.SCENT_GRID_N, cells = N * N;
    const food = st.foodField, prey = st.preyField, pred = st.predField;

    if (( ctx.clock & 1 ) === 0 )
    {
        for ( let i = 0; i < cells; i++ )
        {
            food[i] *= 0.74;
            prey[i] *= 0.74;
            pred[i] *= 0.74;
        }
    }

    const aliveFood = ctx.aliveFoodBitIndices;
    for ( let k = 0; k < aliveFood.length; k++ )
    {
        const f = aliveFood[k];
        const ix = Math.max( 0, Math.min( N - 1, Math.floor( st.foodX[f] / _scentCellW )));
        const iy = Math.max( 0, Math.min( N - 1, Math.floor( st.foodY[f] / _scentCellH )));
        food[ iy * N + ix ] += st.foodEnergy[f] * 0.02;
    }

    const aliveBots = ctx.aliveSwimbotIndices;
    for ( let k = 0; k < aliveBots.length; k++ )
    {
        const s = aliveBots[k];
        const ix = Math.max( 0, Math.min( N - 1, Math.floor( st.botX[s] / _scentCellW )));
        const iy = Math.max( 0, Math.min( N - 1, Math.floor( st.botY[s] / _scentCellH )));
        const idx = iy * N + ix;
        if ( st.predator[s] > PREDATOR_LEVEL_THRESHOLD ) { pred[idx] += 1.0; }
        else                                             { prey[idx] += st.mass[s] * 0.003; }
    }

    if (( ctx.clock & 1 ) === 0 )
    {
        const tmp = _scentTmp;
        for ( let f = 0; f < 3; f++ )
        {
            const a = f === 0 ? food : ( f === 1 ? prey : pred );
            tmp.set( a );
            for ( let y = 0; y < N; y++ )
            {
                const row = y * N;
                const up = y > 0 ? row - N : row;
                const down = y < N - 1 ? row + N : row;
                for ( let x = 0; x < N; x++ )
                {
                    const i = row + x;
                    const l = x > 0 ? i - 1 : i;
                    const r = x < N - 1 ? i + 1 : i;
                    const avg = 0.25 * ( tmp[l] + tmp[r] + tmp[up + x] + tmp[down + x] );
                    a[i] = tmp[i] + 0.11 * ( avg - tmp[i] );
                }
            }
        }
    }
}

export function sortAliveByMorton( ctx: ScentContext ): void
{
    const st = ctx.st;
    const cols = SS.SCENT_GRID_N - 1;
    const list = ctx.aliveSwimbotIndices, n = list.length;
    for ( let i = 0; i < n; i++ )
    {
        const s = list[i];
        const ix = Math.max( 0, Math.min( cols, Math.floor( st.botX[s] / POOL_WIDTH  * cols )));
        const iy = Math.max( 0, Math.min( cols, Math.floor( st.botY[s] / POOL_HEIGHT * cols )));
        _mortonCodes[i] = mortonBits( ix ) | ( mortonBits( iy ) << 1 );
    }
    for ( let i = 1; i < n; i++ )
    {
        const code = _mortonCodes[i], s = list[i];
        let j = i - 1;
        while ( j >= 0 && _mortonCodes[j] > code )
        {
            _mortonCodes[j + 1] = _mortonCodes[j];
            list[j + 1] = list[j];
            j--;
        }
        _mortonCodes[j + 1] = code;
        list[j + 1] = s;
    }
}

export function updateMorphBucketShares( ctx: ScentContext ): void
{
    const st = ctx.st, bots = ctx.swimbots;
    const share = st.morphBucketShare;
    share.fill( 0 );
    let total = 0;
    const list = ctx.aliveSwimbotIndices;
    for ( let i = 0; i < list.length; i++ )
    {
        const s = list[i];
        if ( st.predator[s] > PREDATOR_LEVEL_THRESHOLD ) continue;
        const morph = bots[s].getMorphologySummary();
        share[ SS.getMorphBucket( morph.numParts, morph.branchFraction > 0, morph.meanWidth ) ]++;
        total++;
    }
    if ( total > 0 ) { for ( let b = 0; b < share.length; b++ ) share[b] /= total; }
}

export function sortAliveFoodByMorton( ctx: ScentContext ): void
{
    const st = ctx.st;
    const cols = SS.SCENT_GRID_N - 1;
    const list = ctx.aliveFoodBitIndices, n = list.length;
    for ( let i = 0; i < n; i++ )
    {
        const f = list[i];
        const ix = Math.max( 0, Math.min( cols, Math.floor( st.foodX[f] / POOL_WIDTH  * cols )));
        const iy = Math.max( 0, Math.min( cols, Math.floor( st.foodY[f] / POOL_HEIGHT * cols )));
        _foodMortonCodes[i] = mortonBits( ix ) | ( mortonBits( iy ) << 1 );
    }
    for ( let i = 1; i < n; i++ )
    {
        const code = _foodMortonCodes[i], f = list[i];
        let j = i - 1;
        while ( j >= 0 && _foodMortonCodes[j] > code )
        {
            _foodMortonCodes[j + 1] = _foodMortonCodes[j];
            list[j + 1] = list[j];
            j--;
        }
        _foodMortonCodes[j + 1] = code;
        list[j + 1] = f;
    }
}
