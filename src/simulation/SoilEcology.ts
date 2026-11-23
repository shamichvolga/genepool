//------------------------------------------------------------------------------
// SoilEcology — the closed soil fertility of the pool (256 x 256 energy cells).
// Everything that belongs to the ground lives here: the desert background, the
// dense oases, meat rotting into the ground, the roots that feed plants and the
// summed-area table that answers a 5 x 5 crown query in four reads. The energy
// in the field is real: it is taken out of the atmosphere at the start and
// every withdrawal is bounded by what the cells actually hold.
//------------------------------------------------------------------------------
import { drawFromAtmosphere } from "./EnergyBudget";
import { gpRandom } from "./Globals";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { SOIL_GRID_N } from "./SoilGrid";
import { SharedState } from "./SharedState";
export const SOIL_N = SOIL_GRID_N;
const N = SOIL_N, CELLS = N * N, STRIDE = N + 1;
const INV_W = N / POOL_WIDTH, INV_H = N / POOL_HEIGHT;
const BASE_SOIL = 3.5;              // a thin desert background, per cell
const PATCH_COUNT = Math.max( 4, Math.min( 20, Math.round( 6 * ( N / 128 ) * ( N / 128 ))));   // dense oases, one per ~1/6 of the area (capped for small worlds)
const PATCH_PEAK = 145;             // fertility at the centre of an oasis
const PATCH_SIGMA_MIN = 8.0;        // oasis radius, in soil cells (8 .. 12)
const PATCH_SIGMA_SPAN = 4.0;
const MEAN_SIGMA_SQUARED = 101.3333333333;   // mean of sigma^2, sigma uniform in [8,12]
// A 2D Gaussian of height A holds A * 2*pi*sigma^2. The whole endowment is
// drawn from the atmosphere, so it is also the budget GenePool starts with.
export const SOIL_START_ENERGY = CELLS * BASE_SOIL
                               + PATCH_COUNT * PATCH_PEAK * 2 * Math.PI * MEAN_SIGMA_SQUARED;

// The old field diffused at 0.04 every 16 steps and smeared the oases into a
// thin layer over the whole desert. One twenty-fifth of that, and only where
// there is already an excess of organic matter, keeps the oases standing.
const DIFFUSION = 0.0015;
const DIFFUSION_INTERVAL = 16;
const RICH_SOIL = 28;
// Preallocated once: the integral table and the diffusion scratch buffer.
const soilSAT = new Float64Array(( SOIL_GRID_N + 1 ) * ( SOIL_GRID_N + 1 ));
let _tmp: Float32Array | null = null;
let _cell = { ix: 0, iy: 0 };

// The oasis centres, in world coordinates, saved for the founder colonies.
let _oasisX = new Float64Array( PATCH_COUNT );
let _oasisY = new Float64Array( PATCH_COUNT );
let _oasisE = new Float64Array( PATCH_COUNT );
function cellAt( x: number, y: number, out: { ix: number, iy: number } ): void
{
    out.ix = Math.max( 0, Math.min( N - 1, Math.floor(( x - POOL_LEFT ) * INV_W )));
    out.iy = Math.max( 0, Math.min( N - 1, Math.floor(( y - POOL_TOP ) * INV_H )));
}
export function depositSoilEnergy( st: SharedState, x: number, y: number, amount: number ): void
{
    if ( !( amount > 0 )) return;
    cellAt( x, y, _cell );
    st.soilField[ _cell.iy * N + _cell.ix ] += amount;
}
// A big gut digging in the ground may take energy from the nine cells under
// it; the withdrawal is bounded by what is really there, so it cannot print
// energy. (Root nutrition uses the 5 x 5 crown query below instead.)
export function withdrawSoilEnergy( st: SharedState, x: number, y: number, amount: number ): number
{
    if ( !( amount > 0 )) return 0;
    cellAt( x, y, _cell );
    const ix = _cell.ix, iy = _cell.iy, f = st.soilField;
    const indices: number[] = [], weights: number[] = [];
    let pool = 0, weightSum = 0;
    for ( let dy = -1; dy <= 1; dy++ )
    {
        const yy = iy + dy;
        if (( yy < 0 ) || ( yy >= N )) continue;
        for ( let dx = -1; dx <= 1; dx++ )
        {
            const xx = ix + dx;
            if (( xx < 0 ) || ( xx >= N )) continue;
            const i = yy * N + xx, v = f[i];
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
// SAT(x+1, y+1) = soil(x, y) + SAT(x, y+1) + SAT(x+1, y) - SAT(x, y).
// Rebuilt in one linear pass every fourth step.
export function rebuildSoilSAT( st: SharedState ): void
{
    const f = st.soilField;
    for ( let y = 0; y < N; y++ )
    {
        const row = y * N, satRow = ( y + 1 ) * STRIDE, prevRow = y * STRIDE;
        let running = 0;
        for ( let x = 0; x < N; x++ )
        {
            running += f[ row + x ];
            soilSAT[ satRow + x + 1 ] = soilSAT[ prevRow + x + 1 ] + running;
        }
    }
}
// Sum / mean of a 5 x 5 cell square around a plant (radius 2 cells = 125 world
// units in the default world: exactly the crown of a tree). Four reads, O(1).
export function meanSoilAt( st: SharedState, x: number, y: number ): number
{
    cellAt( x, y, _cell );
    const x0 = Math.max( 0, _cell.ix - 2 ), x1 = Math.min( N - 1, _cell.ix + 2 );
    const y0 = Math.max( 0, _cell.iy - 2 ), y1 = Math.min( N - 1, _cell.iy + 2 );
    const sum = soilSAT[ ( y1 + 1 ) * STRIDE + x1 + 1 ]
              - soilSAT[ y0 * STRIDE + x1 + 1 ]
              - soilSAT[ ( y1 + 1 ) * STRIDE + x0 ]
              + soilSAT[ y0 * STRIDE + x0 ];
    return sum / (( x1 - x0 + 1 ) * ( y1 - y0 + 1 ));
}

//------------------------------------------------------------------------------
// Block 1: stage-scaled root zones. The roots follow the plant's own growth:
// radius 1 (3x3) for sprouts, 2 (5x5) for young bushes, 3 (7x7) for grown
// bushes and 4 (9x9) for 12-ray trees, by food energy tiers.
//------------------------------------------------------------------------------
export function rootZoneRadius( foodEnergy: number ): number
{
    return foodEnergy < 10 ? 1 : foodEnergy < 22 ? 2 : foodEnergy < 42 ? 3 : 4;
}
export function rootSquare( r: number ): number { const s = 2 * r + 1; return s * s; }
// Sum of the soil square of the root zone, read through the SAT (four reads).
export function poolRoot( st: SharedState, x: number, y: number, r: number ): number
{
    cellAt( x, y, _cell );
    const ix = _cell.ix, iy = _cell.iy;
    const x0 = Math.max( 0, ix - r ), x1 = Math.min( N - 1, ix + r );
    const y0 = Math.max( 0, iy - r ), y1 = Math.min( N - 1, iy + r );
    return soilSAT[ ( y1 + 1 ) * STRIDE + x1 + 1 ]
         - soilSAT[ y0 * STRIDE + x1 + 1 ]
         - soilSAT[ ( y1 + 1 ) * STRIDE + x0 ]
         + soilSAT[ y0 * STRIDE + x0 ];
}
export function meanSoilRoot( st: SharedState, x: number, y: number, r: number ): number
{
    const s = rootSquare( r );
    return s > 0 ? poolRoot( st, x, y, r ) / s : 0;
}
export function effectiveFertility( st: SharedState, x: number, y: number, r: number, foodEnergy: number ): number
{
    return meanSoilRoot( st, x, y, r ) * 0.90 + foodEnergy * 0.50;
}
function stageCapOf( f: number ): number
{
    return f < 8 ? 6.5 : f < 14 ? 18 : f < 21 ? 36 : Math.min( 95, 36 + ( f - 21 ) * 1.25 );
}
// Stage from the root zone: soil under the roots plus the energy already in
// the plant. This lets a seed on a rich oasis grow all the way to a tree.
export function plantStageCap( st: SharedState, x: number, y: number, currentEnergy: number ): number
{
    return stageCapOf( effectiveFertility( st, x, y, rootZoneRadius( currentEnergy ), currentEnergy ));
}

// The root pump, conservative: the withdrawal never exceeds what is there.
// Nine nodes: the central cell (weight 2), four inner diagonals on the root
// square's half radius (weight 1 each) and four root tips on the axes
// (weight 1 each). Suck is withdrawn proportionally and lands exactly.
function withdrawRootZone( st: SharedState, x: number, y: number, r: number, suck: number ): number
{
    const f = st.soilField;
    cellAt( x, y, _cell );
    const ix0 = _cell.ix, iy0 = _cell.iy;
    const half = Math.max( 1, r >> 1 );
    const nodeX: number[] = [], nodeY: number[] = [], nodeW: number[] = [];
    let totalW = 0;
    for ( let k = 0; k < 9; k++ )
    {
        let dx: number, dy: number, w: number;
        if ( k === 0 ) { dx = 0; dy = 0; w = 2; }
        else if ( k <= 4 ) { dx = ( k === 1 ) ? -half : ( k === 2 ) ? half : 0; dy = ( k === 1 ) ? -half : ( k === 2 ) ? half : 0; w = 1; }
        else { dx = ( k === 5 ) ? -r : ( k === 6 ) ? r : 0; dy = ( k === 7 ) ? -r : ( k === 8 ) ? r : 0; w = 1; }
        const gx = Math.max( 0, Math.min( N - 1, ix0 + dx )), gy = Math.max( 0, Math.min( N - 1, iy0 + dy ));
        // merge duplicates (in a 3x3 zone the axis tips can coincide with the centre)
        let found = false;
        for ( let q = 0; q < nodeX.length; q++ ) { if (( nodeX[q] === gx ) && ( nodeY[q] === gy )) { nodeW[q] += w; found = true; break; } }
        if ( !found ) { nodeX.push( gx ); nodeY.push( gy ); nodeW.push( w ); }
        totalW += w;
    }
    if ( totalW <= 0 ) return 0;
    const taken: number[] = [];
    let remaining = suck;
    for ( let k = 0; k < nodeX.length && ( remaining > 0 ); k++ )
    {
        const avail = Math.max( 0, f[ nodeY[k] * N + nodeX[k] ]);
        let take = suck * nodeW[k] / totalW;
        if ( take > remaining ) { take = remaining; }
        if ( take > avail ) { take = avail; }
        f[ nodeY[k] * N + nodeX[k] ] -= take;
        taken.push( take ); remaining -= take;
    }
    // when the zone is poor there is not enough to take; give back the rest to
    // the biggest-weight node with soil (we never print energy, and this loses
    // at most the fraction of the expected take)
    for ( let k = 0; k < nodeX.length && ( remaining > 1e-12 ); k++ )
    {
        const avail = Math.max( 0, f[ nodeY[k] * N + nodeX[k] ]);
        if ( avail <= 0 ) continue;
        const take = Math.min( avail, remaining );
        f[ nodeY[k] * N + nodeX[k] ] -= take;
        if ( k < taken.length ) { taken[ k ] += take; } else { taken.push( take ); }
        remaining -= take;
    }
    let out = 0;
    for ( const t of taken ) out += t;
    return out;
}

// A plant is a pump, not a printer: the stage grows only when the root square
// has bandwidth; the pump takes the energy from that same square.
export function soilPlantGrowth( st: SharedState, x: number, y: number, currentEnergy: number, maxOverride?: number ): number
{
    const maxPlantE = ( maxOverride !== undefined ) ? maxOverride : plantStageCap( st, x, y, currentEnergy );
    const wanted = maxPlantE - currentEnergy;
    if ( wanted <= 0 ) return 0;
    const r = rootZoneRadius( currentEnergy );
    const pool = poolRoot( st, x, y, r );
    // capacity scales with the root square: a zone of 256 world units at
    // scale 2, so the max was ~17 before; now the whole square counts.
    const maxUptake = Math.min( 0.45, 0.04 + pool * 0.00065 );
    const suck = Math.min( maxUptake, wanted * 0.045, pool * 0.015 );
    if ( suck <= 0 ) return 0;
    return withdrawRootZone( st, x, y, r, suck );
}
// Gaussian oases plus the desert background, all paid for out of the
// atmosphere. The multiplier is worldEnergy / 5 from the pool panel.
export function seedSoilField( st: SharedState, energyMult = 1 ): void
{
    const field = st.soilField;
    const mult = energyMult > 0 ? energyMult : 1;
    const sigmas = new Float64Array( PATCH_COUNT );
    for ( let p = 0; p < PATCH_COUNT; p++ ) { sigmas[p] = PATCH_SIGMA_MIN + gpRandom() * PATCH_SIGMA_SPAN; }
    let patchEnergy = 0;
    for ( let p = 0; p < PATCH_COUNT; p++ ) { patchEnergy += PATCH_PEAK * mult * 2 * Math.PI * sigmas[p] * sigmas[p]; }
    const target = CELLS * BASE_SOIL * mult + patchEnergy;
    const funded = drawFromAtmosphere( target );
    const scale = target > 0 ? funded / target : 0;
    field.fill( BASE_SOIL * mult * scale );
    if ( scale <= 0 ) { rebuildSoilSAT( st ); return; }
    const cx = new Float64Array( PATCH_COUNT ), cy = new Float64Array( PATCH_COUNT ), norm = new Float64Array( PATCH_COUNT );
    for ( let p = 0; p < PATCH_COUNT; p++ )
    {
        const minDist = 3.0 * sigmas[p], margin = 2.6 * sigmas[p];
        let x = 0, y = 0;
        for ( let tries = 0; tries < 60; tries++ )
        {
            x = margin + gpRandom() * ( N - 1 - 2 * margin );
            y = margin + gpRandom() * ( N - 1 - 2 * margin );
            let clear = true;
            for ( let q = 0; q < p; q++ ) { const dx = x - cx[q], dy = y - cy[q]; if ( dx * dx + dy * dy < minDist * minDist ) { clear = false; break; } }
            if ( clear ) break;
        }
        cx[p] = x; cy[p] = y;
        // Normalise over the discrete grid: the sum is exactly the paid energy.
        let sum = 0;
        const r = Math.ceil( 3 * sigmas[p] ), s2 = 2 * sigmas[p] * sigmas[p];
        for ( let dy = -r; dy <= r; dy++ )
        {
            const yy = Math.round( y ) + dy;
            if (( yy < 0 ) || ( yy >= N )) continue;
            for ( let dx = -r; dx <= r; dx++ )
            {
                const xx = Math.round( x ) + dx;
                if (( xx < 0 ) || ( xx >= N )) continue;
                const d2 = ( xx - x ) * ( xx - x ) + ( yy - y ) * ( yy - y );
                sum += Math.exp( -d2 / s2 );
            }
        }
        const energy = PATCH_PEAK * mult * 2 * Math.PI * sigmas[p] * sigmas[p];
        norm[p] = sum > 0 ? energy * scale / sum : 0;
        _oasisX[p] = POOL_LEFT + ( x + 0.5 ) * POOL_WIDTH / N;
        _oasisY[p] = POOL_TOP + ( y + 0.5 ) * POOL_HEIGHT / N;
        _oasisE[p] = energy * scale;
    }
    for ( let p = 0; p < PATCH_COUNT; p++ )
    {
        const amp = norm[p];
        if ( amp <= 0 ) continue;
        const r = Math.ceil( 3 * sigmas[p] ), s2 = 2 * sigmas[p] * sigmas[p];
        for ( let dy = -r; dy <= r; dy++ )
        {
            const yy = Math.round( cy[p] ) + dy;
            if (( yy < 0 ) || ( yy >= N )) continue;
            for ( let dx = -r; dx <= r; dx++ )
            {
                const xx = Math.round( cx[p] ) + dx;
                if (( xx < 0 ) || ( xx >= N )) continue;
                const d2 = ( xx - cx[p] ) * ( xx - cx[p] ) + ( yy - cy[p] ) * ( yy - cy[p] );
                field[ yy * N + xx ] += amp * Math.exp( -d2 / s2 );
            }
        }
    }
    rebuildSoilSAT( st );
}
// The richest oases first: founder colonies are centred on these.
export function oasisCentersWorld(): { x: number, y: number, energy: number }[]
{
    const centers: { x: number, y: number, energy: number }[] = [];  // 14 colonies use the first 14
    for ( let p = 0; p < PATCH_COUNT; p++ ) { centers.push({ x: _oasisX[p], y: _oasisY[p], energy: _oasisE[p] }); }
    centers.sort( ( a, b ) => b.energy - a.energy );
    return centers;
}
// Every fourth step refresh the integral table. Every sixteenth step the
// ambient reservoir returns 3% evenly, and only the rich cells diffuse.
// Mirroring a missing/desert neighbour with the cell's own value keeps the
// update exactly conservative: no flux out of the field, none into the desert.
export function stepSoilEcology( st: SharedState, clock: number ): number
{
    if (( clock & 3 ) === 0 ) rebuildSoilSAT( st );
    if (( clock & ( DIFFUSION_INTERVAL - 1 )) !== 0 ) return 0;
    if ( _tmp === null ) { _tmp = new Float32Array( CELLS ); }
    const tmp = _tmp, f = st.soilField;
    for ( let y = 0; y < N; y++ )
    {
        const row = y * N;
        for ( let x = 0; x < N; x++ )
        {
            const i = row + x, v = f[i];
            tmp[i] = v;
            if ( v <= RICH_SOIL ) continue;
            const l = ( x > 0 && f[i - 1] > RICH_SOIL ) ? f[i - 1] : v;
            const r = ( x < N - 1 && f[i + 1] > RICH_SOIL ) ? f[i + 1] : v;
            const u = ( y > 0 && f[i - N] > RICH_SOIL ) ? f[i - N] : v;
            const d = ( y < N - 1 && f[i + N] > RICH_SOIL ) ? f[i + N] : v;
            const next = v + DIFFUSION * ( l + r + u + d - 4 * v );
            tmp[i] = next > 0 ? next : 0;
        }
    }
    f.set( tmp );
    return 0;
}
// Carcasses rot in place: the rot is real energy returned to the ground under
// them, never an invisible disappearance into the atmosphere.
export function decayMeat( st: SharedState, x: number, y: number, e: number ): { e: number, dead: boolean, rot: number, remains: number }
{
    const rot = Math.min( e, Math.max( 0.008, e * 0.004 ));
    const remains = e - rot;
    if ( rot > 0 ) { depositSoilEnergy( st, x, y, rot ); }
    if ( remains <= 0.02 )
    {
        if ( remains > 0 ) { depositSoilEnergy( st, x, y, remains ); }
        return { e: 0, dead: true, rot, remains };
    }
    return { e: remains, dead: false, rot, remains };
}
