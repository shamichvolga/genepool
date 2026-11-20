//------------------------------------------------------------------------------
// Living soil: the energy-bearing 256x256 field under the pool.
//
// The old Environment.soilNutrient grid is a slow mineral index. This field is
// different: it holds real energy. Every joule in it was taken out of the
// atmosphere, and every joule that leaves it goes either into a plant, into the
// atmosphere (the 3% return) or nowhere (diffusion only moves it around).
// Keeping all of that in one module makes the conservation invariant checkable.
//------------------------------------------------------------------------------
import { drawFromAtmosphere } from "./EnergyBudget";
import { gpRandom } from "./Globals";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { SharedState, SOIL_GRID_N } from "./SharedState";

export const SOIL_N = SOIL_GRID_N;
const CELLS = SOIL_N * SOIL_N;
const INV_W = SOIL_N / POOL_WIDTH;
const INV_H = SOIL_N / POOL_HEIGHT;

const BASE_SOIL = 3.0;              // a thin fertile background everywhere
const PATCH_COUNT = 22;             // compact oases scattered over the 256² field
// 22 x 42,500 + 65,536 x 3.0 = 1,131,608: the intended starting soil endowment.
// With a sigma of 7.8-8.0 cells the discrete peak of one patch is ~101-113,
// i.e. rich enough for full trees but no artificial energy multiplier.
const PATCH_ENERGY = 42500;         // energy per oasis, drawn from the atmosphere
const PATCH_SIGMA_MIN = 7.8;        // radius of an oasis, in soil cells
const PATCH_SIGMA_SPAN = 0.2;
const DIFFUSION = 0.04;
const DIFFUSION_INTERVAL = 16;

let _tmp: Float32Array | null = null;

function cellAt( x: number, y: number, out: { ix: number, iy: number } ): void
{
    out.ix = Math.max( 0, Math.min( SOIL_N - 1, Math.floor(( x - POOL_LEFT ) * INV_W )));
    out.iy = Math.max( 0, Math.min( SOIL_N - 1, Math.floor(( y - POOL_TOP ) * INV_H )));
}
const _cell = { ix: 0, iy: 0 };

export function depositSoilEnergy( st: SharedState, x: number, y: number, amount: number ): void
{
    if ( !( amount > 0 )) return;
    cellAt( x, y, _cell );
    st.soilField[ _cell.iy * SOIL_N + _cell.ix ] += amount;
}

// The same nine cells can fund a foraging bonus (a big gut using wood, a rare
// niche finding more, a deep belly cracking fruit). Unlike an atmospheric
// subsidy this is local fertility: a depleted patch simply pays less. The
// withdrawal is bounded by what is actually there, so it cannot create energy.
export function withdrawSoilEnergy( st: SharedState, x: number, y: number, amount: number ): number
{
    if ( !( amount > 0 )) return 0;
    cellAt( x, y, _cell );
    const ix = _cell.ix, iy = _cell.iy;
    const f = st.soilField;
    const indices: number[] = [], weights: number[] = [];
    let pool = 0, weightSum = 0;
    for ( let dy = -1; dy <= 1; dy++ )
    {
        const yy = iy + dy;
        if (( yy < 0 ) || ( yy >= SOIL_N )) continue;
        for ( let dx = -1; dx <= 1; dx++ )
        {
            const xx = ix + dx;
            if (( xx < 0 ) || ( xx >= SOIL_N )) continue;
            const i = yy * SOIL_N + xx, v = f[i];
            if ( v <= 0 ) continue;
            const w = ( dx === 0 && dy === 0 ) ? 4 : (( dx === 0 || dy === 0 ) ? 2 : 1 );
            indices.push( i ); weights.push( w );
            weightSum += w; pool += v;
        }
    }
    if ( pool <= 0 || weightSum <= 0 ) return 0;
    const want = Math.min( amount, pool );
    let taken = 0;
    for ( let k = 0; k < indices.length; k++ )
    {
        const i = indices[k];
        const share = Math.min( f[i], want * weights[k] / weightSum );
        f[i] -= share; taken += share;
    }
    return taken;
}

export function totalSoilEnergy( st: SharedState ): number
{
    let total = 0;
    const f = st.soilField;
    for ( let i = 0; i < CELLS; i++ ) { total += f[i]; }
    return total;
}

// Gaussian oases plus a thin background. The whole endowment comes out of the
// atmosphere, so the total world energy does not jump at the start of a run.
export function seedSoilField( st: SharedState ): void
{
    const field = st.soilField;
    const target = CELLS * BASE_SOIL + PATCH_COUNT * PATCH_ENERGY;
    const funded = drawFromAtmosphere( target );
    const scale = target > 0 ? funded / target : 0;
    field.fill( BASE_SOIL * scale );
    if ( scale <= 0 ) return;

    const cx = new Float32Array( PATCH_COUNT ), cy = new Float32Array( PATCH_COUNT );
    const sigma = new Float32Array( PATCH_COUNT ), norm = new Float32Array( PATCH_COUNT );
    for ( let p = 0; p < PATCH_COUNT; p++ )
    {
        sigma[p] = PATCH_SIGMA_MIN + gpRandom() * PATCH_SIGMA_SPAN;
        // Keep the oases apart: two overlapping Gaussians would double the
        // local peak and break the intended 75-115 cells of a fertile crown.
        const minDist = 3.2 * sigma[p];
        const margin = 3 * sigma[p];
        let x = 0, y = 0;
        for ( let tryCount = 0; tryCount < 40; tryCount++ )
        {
            // Keep all three sigma inside the field: a clipped patch would be
            // renormalised and its peak would shoot far above the 75-115 range.
            x = margin + gpRandom() * ( SOIL_N - 1 - 2 * margin );
            y = margin + gpRandom() * ( SOIL_N - 1 - 2 * margin );
            let clear = true;
            for ( let q = 0; q < p; q++ )
            {
                const dx = x - cx[q], dy = y - cy[q];
                if ( dx * dx + dy * dy < minDist * minDist ) { clear = false; break; }
            }
            if ( clear ) break;
        }
        cx[p] = x;
        cy[p] = y;
    }
    // Normalise each patch over the discrete grid: its sum is then exactly the
    // energy we took from the atmosphere, not an approximation.
    for ( let p = 0; p < PATCH_COUNT; p++ )
    {
        let sum = 0;
        const r = Math.ceil( 3 * sigma[p] );
        for ( let dy = -r; dy <= r; dy++ )
        {
            const y = Math.round( cy[p] ) + dy;
            if (( y < 0 ) || ( y >= SOIL_N )) continue;
            for ( let dx = -r; dx <= r; dx++ )
            {
                const x = Math.round( cx[p] ) + dx;
                if (( x < 0 ) || ( x >= SOIL_N )) continue;
                const d2 = ( x - cx[p] ) * ( x - cx[p] ) + ( y - cy[p] ) * ( y - cy[p] );
                sum += Math.exp( -d2 / ( 2 * sigma[p] * sigma[p] ));
            }
        }
        norm[p] = sum > 0 ? PATCH_ENERGY * scale / sum : 0;
    }
    for ( let p = 0; p < PATCH_COUNT; p++ )
    {
        const amp = norm[p];
        if ( amp <= 0 ) continue;
        const r = Math.ceil( 3 * sigma[p] );
        for ( let dy = -r; dy <= r; dy++ )
        {
            const y = Math.round( cy[p] ) + dy;
            if (( y < 0 ) || ( y >= SOIL_N )) continue;
            for ( let dx = -r; dx <= r; dx++ )
            {
                const x = Math.round( cx[p] ) + dx;
                if (( x < 0 ) || ( x >= SOIL_N )) continue;
                const d2 = ( x - cx[p] ) * ( x - cx[p] ) + ( y - cy[p] ) * ( y - cy[p] );
                field[ y * SOIL_N + x ] += amp * Math.exp( -d2 / ( 2 * sigma[p] * sigma[p] ));
            }
        }
    }
}

// Every 16 steps: give back 3% of the ambient reservoir, spread evenly over the
// field, then diffuse with mirrored boundaries. Mirroring a missing neighbour
// with the cell's own value makes the update exactly conservative (no flux out
// of the field and no flux in from outside). Returns what left the reservoir.
export function stepSoilField( st: SharedState, clock: number, ambient: number ): number
{
    if (( clock & ( DIFFUSION_INTERVAL - 1 )) !== 0 ) return 0;
    let drawn = 0;
    if ( ambient > 0 )
    {
        drawn = Math.min( ambient * 0.03, ambient );
        if ( drawn > 0 )
        {
            const per = drawn / CELLS;
            const f = st.soilField;
            for ( let i = 0; i < CELLS; i++ ) { f[i] += per; }
        }
    }

    if ( _tmp === null ) { _tmp = new Float32Array( CELLS ); }
    const tmp = _tmp, f = st.soilField;
    for ( let y = 0; y < SOIL_N; y++ )
    {
        const row = y * SOIL_N;
        for ( let x = 0; x < SOIL_N; x++ )
        {
            const i = row + x, v = f[i];
            const l = x > 0 ? f[i - 1] : v;
            const r = x < SOIL_N - 1 ? f[i + 1] : v;
            const u = y > 0 ? f[i - SOIL_N] : v;
            const d = y < SOIL_N - 1 ? f[i + SOIL_N] : v;
            const next = v + DIFFUSION * ( l + r + u + d - 4 * v );
            tmp[i] = next > 0 ? next : 0;
        }
    }
    f.set( tmp );
    return drawn;
}

// A plant can only suck from the nine cells under its crown. The 3x3 weighted
// mean chooses how much energy its tier can hold; the three caps keep each
// sucking event small, finite and limited by what the soil actually has.
export function soilPlantGrowth( st: SharedState, x: number, y: number, currentEnergy: number ): number
{
    cellAt( x, y, _cell );
    const ix = _cell.ix, iy = _cell.iy;
    const f = st.soilField;
    let weighted = 0, weightSum = 0, pool = 0;
    const indices: number[] = [];
    const weights: number[] = [];
    for ( let dy = -1; dy <= 1; dy++ )
    {
        const yy = iy + dy;
        if (( yy < 0 ) || ( yy >= SOIL_N )) continue;
        for ( let dx = -1; dx <= 1; dx++ )
        {
            const xx = ix + dx;
            if (( xx < 0 ) || ( xx >= SOIL_N )) continue;
            const w = ( dx === 0 && dy === 0 ) ? 4 : (( dx === 0 || dy === 0 ) ? 2 : 1 );
            const i = yy * SOIL_N + xx;
            const v = f[i];
            if ( v <= 0 ) continue;
            indices.push( i ); weights.push( w );
            weighted += w * v; weightSum += w; pool += v;
        }
    }
    if ( pool <= 0 || weightSum <= 0 ) return 0;
    const local = weighted / weightSum;
    // Four soil niches on the 256x256 grid: bare ground carries sprouts only,
    // the oases can carry full trees. The caps stay finite and local, so a
    // crown can never pull more energy than the soil under it really holds.
    const maxPlantE = local < 14 ? 5.5
                    : local < 32 ? 16
                    : local < 58 ? 34
                    : Math.min( 85, 34 + ( local - 58 ) * 0.85 );
    const wanted = maxPlantE - currentEnergy;
    if ( wanted <= 0 ) return 0;
    const suck = Math.min( 0.28, wanted * 0.02, pool * 0.015 );
    if ( suck <= 0 ) return 0;
    let taken = 0;
    for ( let k = 0; k < indices.length; k++ )
    {
        const i = indices[k];
        // Normalise by the weight sum, not by the raw energy: the nine shares
        // must add up to exactly `suck`, so a plant cannot draw four times its
        // cap just because the crown cell is the heaviest one.
        const share = Math.min( f[i], suck * weights[k] / weightSum );
        f[i] -= share; taken += share;
    }
    return taken;
}
