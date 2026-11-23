@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$candidates = @('%~dp0'.TrimEnd('\'), (Join-Path $env:USERPROFILE 'genepool'), (Join-Path $env:USERPROFILE 'Desktop\genepool'), (Join-Path $env:USERPROFILE 'Documents\genepool'), (Join-Path $env:USERPROFILE 'Downloads\genepool'), (Join-Path $env:USERPROFILE 'source\repos\genepool'), 'C:\genepool', 'D:\genepool', 'E:\genepool');" ^
  "$repo = $null; foreach ($c in $candidates) { if ($c -and (Test-Path (Join-Path $c 'src\simulation\GenePool.ts'))) { $repo = $c; break } }" ^
  "if (-not $repo) { $hit = Get-ChildItem -Path $env:USERPROFILE, 'C:\', 'D:\' -Directory -Depth 2 -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'src\simulation\GenePool.ts') } | Select-Object -First 1; if ($hit) { $repo = $hit.FullName } }" ^
  "if (-not $repo) { Write-Host '[ERROR] GenePool folder not found.' -ForegroundColor Red; exit 1 }" ^
  "Write-Host ('Project folder: ' + $repo) -ForegroundColor Cyan;" ^
  "$lines = Get-Content -LiteralPath '%~f0' -Encoding UTF8;" ^
  "$idx = [Array]::IndexOf($lines, '::JS_START');" ^
  "$js = ($lines[($idx+1)..($lines.Length-1)] -join [Environment]::NewLine);" ^
  "$patchPath = Join-Path $repo '_fix_roots.mjs';" ^
  "Set-Content -LiteralPath $patchPath -Value $js -Encoding UTF8;" ^
  "Set-Location -LiteralPath $repo;" ^
  "node _fix_roots.mjs; if ($LASTEXITCODE -ne 0) { Remove-Item _fix_roots.mjs -Force -ErrorAction SilentlyContinue; git checkout -- src/ 2>$null; exit 1 }" ^
  "Remove-Item _fix_roots.mjs -Force -ErrorAction SilentlyContinue;" ^
  "$env:TEMP = '.tmp'; $env:TMP = '.tmp';" ^
  "npm run build; $buildCode = $LASTEXITCODE;" ^
  "Remove-Item '.tmp' -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "if ($buildCode -ne 0) { Write-Host '[ROLLBACK] Build failed, reverting...' -ForegroundColor Yellow; git checkout -- src/ 2>$null; exit 1 }" ^
  "git add src/;" ^
  "git commit -m 'fix(roots+ecology): run stepRootNetwork every tick, render roots in GenePoolRenderer, and restrict sprouts to parent groves' | Out-Host;" ^
  "Write-Host ''; Write-Host '========================================================' -ForegroundColor Green;" ^
  "Write-Host '  DONE! Roots, sap flow & grove dispersal active! Ctrl+Shift+R' -ForegroundColor Green;" ^
  "Write-Host '========================================================' -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo [ERROR] Script aborted. See message above.
  pause
  exit /b 1
)

pause
exit /b 0
::JS_START
import fs from "node:fs";

function patchFile(file, replacer) {
  const raw = fs.readFileSync(file, "utf8");
  const norm = raw.replace(/\r\n/g, "\n");
  const next = replacer(norm);
  if (next === norm) {
    throw new Error("Anchor not found in " + file);
  }
  fs.writeFileSync(file, next, "utf8");
  console.log("OK: " + file);
}

// =============================================================================
// 1. RootNetwork.ts — fix clock source (PARAM_STEP), active-list iteration,
//    and multi-generation stolon growth (parents -> children -> grandchildren+)
// =============================================================================
fs.writeFileSync("src/simulation/RootNetwork.ts", `//------------------------------------------------------------------------------
// RootNetwork — multi-generation underground stolon network (parents ->
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
    return ( st && st.clock ) ? st.clock : 0;
}

function isGrown( st: any, f: number ): boolean
{
    return ( st.liveFood[ f ] === 1 ) && ( st.foodType[ f ] !== 2 ) && ( st.foodEnergy[ f ] >= 20 );
}

function countDirectChildren( st: any, parentIdx: number ): number
{
    let count = 0;
    const pp = st.plantParent, lf = st.liveFood;
    for ( let c = 0; c < pp.length; c++ )
    {
        if ( pp[ c ] === parentIdx && lf[ c ] === 1 ) count++;
    }
    return count;
}

function pickStolonSpot( st: any, p: number ): { x: number, y: number } | null
{
    const X = st.foodX, Y = st.foodY;
    const gn = st.soilGridN || 256;
    const limit = Math.floor( st.liveFood.length * 0.75 );
    for ( let k = 0; k < 24; k++ )
    {
        const ang = gpRandom() * Math.PI * 2;
        const dist = STOLON_DIST_MIN + gpRandom() * ( STOLON_DIST_MAX - STOLON_DIST_MIN );
        const cx = X[ p ] + Math.cos( ang ) * dist;
        const cy = Y[ p ] + Math.sin( ang ) * dist;
        if (( cx < POOL_LEFT + 120 ) || ( cx > POOL_RIGHT - 120 ) || ( cy < POOL_TOP + 120 ) || ( cy > POOL_BOTTOM - 120 )) continue;
        const ix = Math.max( 0, Math.min( gn - 1, Math.floor(( cx - POOL_LEFT ) / POOL_WIDTH * gn )));
        const iy = Math.max( 0, Math.min( gn - 1, Math.floor(( cy - POOL_TOP ) / POOL_HEIGHT * gn )));
        if ( st.soilField[ iy * gn + ix ] < 2.0 ) continue;
        let clear = true;
        for ( let q = 0; q < limit; q++ )
        {
            if ( st.liveFood[ q ] !== 1 || st.foodType[ q ] === 2 ) continue;
            const dx = st.foodX[ q ] - cx, dy = st.foodY[ q ] - cy;
            if ( dx * dx + dy * dy < 52 * 52 ) { clear = false; break; }
        }
        if ( clear ) return { x: cx, y: cy };
    }
    return null;
}

function findFreeFoodBit( st: any ): number
{
    const limit = Math.floor( st.liveFood.length * 0.75 );
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
    st.foodAlive[ c ]     = 1;
    st.foodType[ c ]      = st.foodType[ p ];
    st.foodEnergy[ c ]    = STOLON_COST;
    st.foodEnergy[ p ]    = energy - STOLON_COST;
    st.foodX[ c ]         = spot.x;
    st.foodY[ c ]         = spot.y;
    st.foodWood[ c ]      = STOLON_COST;
    st.foodFruit[ c ]     = 0;
    if ( st.foodAge ) st.foodAge[ c ] = 0;
    st.foodBorn[ c ]      = clock;
    st.plantParent[ c ]   = p;
    st.plantRootFlow[ c ] = 0.05;
    return true;
}

function shareChainEnergy( st: any ): void
{
    const links: number[] = [];
    const N = Math.floor( st.liveFood.length * 0.75 );
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
                st.plantRootFlow[ c ] = delta;
            }
            else if ( delta < 0 )
            {
                if ( st.foodEnergy[ c ] + delta < 4 ) delta = -Math.max( 0, st.foodEnergy[ c ] - 4 );
                st.foodEnergy[ p ] -= delta;
                st.foodEnergy[ c ] += delta;
                st.plantRootFlow[ c ] = delta;
            }
        }
    }
}

export function severRoots( st: any, clock: number, bots?: any[] ): void
{
    if (( clock & 3 ) !== 0 ) return;
    const botCount = st.liveSwimbot ? st.liveSwimbot.length : 0;
    if ( botCount === 0 ) return;
    let hasLiveBots = false;
    for ( let s = 0; s < botCount; s++ ) { if ( st.liveSwimbot[ s ] === 1 ) { hasLiveBots = true; break; } }
    if ( !hasLiveBots ) return;

    const N = Math.floor( st.liveFood.length * 0.75 );
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
                st.plantRootFlow[ f ] = 0;
                break;
            }
        }
    }
}

export function ageTrees( st: any ): void
{
    const N = Math.floor( st.liveFood.length * 0.75 );
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        st.plantAge[ f ] = ( st.plantAge[ f ] || 0 ) + 1;
        if ( st.plantAge[ f ] >= 26000 + ( f % 6000 ) && st.foodEnergy[ f ] > 0 )
        {
            depositSoilEnergy( st, st.foodX[ f ], st.foodY[ f ], st.foodEnergy[ f ] );
            st.foodEnergy[ f ] = 0;
            st.liveFood[ f ] = 0;
            st.foodAlive[ f ] = 0;
            st.plantParent[ f ] = -1;
            st.plantRootFlow[ f ] = 0;
            for ( let c = 0; c < N; c++ )
            {
                if ( st.plantParent[ c ] === f ) { st.plantParent[ c ] = -1; st.plantRootFlow[ c ] = 0; }
            }
        }
    }
}

export function isAncestor( st: any, maybeAncestor: number, node: number ): boolean
{
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
    const trees: number[] = [];
    const N = Math.floor( st.liveFood.length * 0.75 );
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] === 1 && st.foodType[ f ] !== 2 && st.foodEnergy[ f ] >= 22 ) trees.push( f );
    }
    if ( trees.length === 0 ) return;
    // Pass 1: link young plants to grown trees/bushes (children)
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
            st.plantRootFlow[ c ] = 0.05;
        }
    }
    // Pass 2: link sprouts near children to form grandchildren
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
            st.plantRootFlow[ gc ] = 0.03;
        }
    }
}

export function stepRootNetwork( st: any, explicitClock?: number, bots?: any[] ): void
{
    tickSeverSnaps();
    if ( !st ) return;
    const clock = getStepClock( st, explicitClock );
    const N = Math.floor( st.liveFood.length * 0.75 );
    const maxSpawns = Math.max( 6, Math.round( N / 1000 ));
    let spawned = 0;
    const offset = N > 0 ? (( clock * 37 ) % N ) : 0;
    for ( let i = 0; i < N && spawned < maxSpawns; i++ )
    {
        const f = ( offset + i ) % N;
        if ( isGrown( st, f ) && spawnStolon( st, f, clock )) spawned++;
    }
    severRoots( st, clock, bots );
    shareChainEnergy( st );
    ageTrees( st );
}

export function unlinkChildren( st: any, f: number ): void
{
    if ( !st ) return;
    st.plantParent[ f ] = -1;
    st.plantRootFlow[ f ] = 0;
    const N = Math.floor( st.liveFood.length * 0.75 );
    for ( let c = 0; c < N; c++ )
    {
        if ( st.plantParent[ c ] === f ) { st.plantParent[ c ] = -1; st.plantRootFlow[ c ] = 0; }
    }
}

export function computePlantLineage( plantParent: ArrayLike<number>, liveFood: ArrayLike<number> | null, f: number )
{
    const ancestors: number[] = [];
    const seenUp = new Set<number>([ f ]);
    let cur = ( f >= 0 && f < plantParent.length ) ? plantParent[ f ] : -1;
    while ( cur >= 0 && ancestors.length < 32 && !seenUp.has( cur ))
    {
        if ( liveFood && liveFood[ cur ] !== 1 ) break;
        seenUp.add( cur );
        ancestors.push( cur );
        cur = plantParent[ cur ];
    }

    const children: number[] = [];
    const grandchildren: number[] = [];
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
`, "utf8");
console.log("OK: src/simulation/RootNetwork.ts");

// =============================================================================
// 2. RootRenderer.ts — zoom-adaptive thickness + clear multi-gen root rendering
// =============================================================================
fs.writeFileSync("src/render/RootRenderer.ts", `//------------------------------------------------------------------------------
// RootRenderer — visuals of the underground root network: soil suction at
// plant stems, parent->child->grandchild stolon curves with sap pulses,
// highlighted dynasty tree on selection, and sever snap animations.
//------------------------------------------------------------------------------
import * as RootNetwork from "../simulation/RootNetwork";
import { PI2 } from "../simulation/MathConstants";

const SUCTION_COLOR     = "rgba(135, 225, 95, 0.85)";
const ROOT_COLOR        = "rgba(195, 240, 95, 0.90)";
const ROOT_SHADOW       = "rgba(14, 24, 10, 0.78)";
const FLOW_COLOR        = "rgba(255, 255, 175, 0.98)";
const ANCESTOR_COLOR    = "rgba(255, 215, 90, 0.98)";
const CHILD_COLOR       = "rgba(120, 255, 110, 0.98)";
const GRANDCHILD_COLOR  = "rgba(85, 235, 255, 0.96)";

function clipView( g: any, x: number, y: number ): boolean
{
    const cam = g && g.camera;
    if ( !cam || !cam.getWithinView ) return true;
    return cam.getWithinView({ x, y }, 260 );
}

function drawStolonCurve( ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, color: string, width: number, flow: number, t: number ): void
{
    const dx = x2 - x1, dy = y2 - y1, len = Math.max( 1, Math.sqrt( dx * dx + dy * dy ));
    const bend = ((( seed * 2654435761 ) & 0xffff ) / 65535 - 0.5 ) * 24;
    const cx = x1 + dx * 0.52 + ( -dy / len ) * bend;
    const cy = y1 + dy * 0.52 + ( dx / len ) * bend;

    ctx.lineWidth = width + 1.6;
    ctx.strokeStyle = ROOT_SHADOW;
    ctx.beginPath(); ctx.moveTo( x1, y1 ); ctx.quadraticCurveTo( cx, cy, x2, y2 ); ctx.stroke();

    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo( x1, y1 ); ctx.quadraticCurveTo( cx, cy, x2, y2 ); ctx.stroke();

    if ( flow !== 0 )
    {
        const phase = (( t * 0.035 + seed * 0.13 ) % 1 + 1 ) % 1;
        const u = flow > 0 ? phase : ( 1 - phase );
        const omt = 1 - u;
        const px = omt * omt * x1 + 2 * omt * u * cx + u * u * x2;
        const py = omt * omt * y1 + 2 * omt * u * cy + u * u * y2;
        ctx.fillStyle = FLOW_COLOR;
        ctx.beginPath();
        ctx.arc( px, py, Math.max( 2.2, width * 0.95 ), 0, PI2 );
        ctx.fill();
    }
}

export function drawRoots( ctx: CanvasRenderingContext2D, st: any, g: any ): void
{
    if ( !ctx || !st ) return;
    const selectedPlant = ( st.selectedPlantIndex >= 0 ) ? st.selectedPlantIndex : -1;
    const fx = st.foodX, fy = st.foodY, sucking = st.foodSucking, plantParent = st.plantParent, rootFlow = st.plantRootFlow;
    const N = st.liveFood.length;
    const t = ( g && g.getTimeStep ) ? g.getTimeStep() : (( g && g.clock ) || 0 );
    const vs = ( g && g.viewScale > 0 ) ? g.viewScale : 0.25;
    const wScale = Math.min( 2.4, Math.max( 0.85, 0.32 / vs ));

    // Suction halos around actively feeding plants
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        if ( sucking[ f ] > 0.012 && clipView( g, fx[ f ], fy[ f ] ))
        {
            const rad = Math.max( 4, 7 * sucking[ f ] ), amp = 0.7 + 0.6 * sucking[ f ];
            ctx.fillStyle = SUCTION_COLOR;
            ctx.beginPath();
            ctx.ellipse( fx[ f ], fy[ f ], rad, rad * 0.5, 0, 0, PI2 );
            ctx.fill();
            const u = Math.sin( Math.PI * (( t * 0.03 + f * 0.9 ) % 1 )) * Math.sin( t * 0.3 );
            for ( let k = 0; k < 6; k++ )
            {
                const a = k * 1.047 + t * 0.02, w = Math.abs( u ) + 0.05;
                const r = 18 + Math.sin( a * 3 + t ) * 12;
                ctx.fillStyle = "rgba(95, 165, 110, " + ( 0.16 * w * amp ).toFixed( 3 ) + ")";
                ctx.beginPath();
                ctx.arc( fx[ f ] + Math.cos( a ) * r, fy[ f ] + Math.sin( a ) * r, 7 + w, 0, PI2 );
                ctx.fill();
            }
        }
    }

    // Short rootlets at the base of established bushes & trees
    if ( vs >= 0.08 )
    {
        ctx.lineWidth = 1.2 * wScale;
        ctx.strokeStyle = ROOT_SHADOW;
        for ( let f = 0; f < N; f++ )
        {
            if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
            if ( st.foodEnergy[ f ] < 14 || !clipView( g, fx[ f ], fy[ f ] )) continue;
            const spin = ((( f * 2654435761 ) & 0xffff ) / 65535 ) * PI2;
            for ( let k = 0; k < 5; k++ )
            {
                const a = spin + k * ( PI2 / 5 ), len = 13 + ( f % 9 );
                ctx.beginPath();
                ctx.moveTo( fx[ f ], fy[ f ] );
                ctx.lineTo( fx[ f ] + Math.cos( a ) * len, fy[ f ] + Math.sin( a ) * len );
                ctx.stroke();
            }
        }
    }

    // All parent -> child -> grandchild underground stolon connections
    for ( let c = 0; c < N; c++ )
    {
        const p = plantParent[ c ];
        if ( p < 0 || st.liveFood[ c ] !== 1 || st.liveFood[ p ] !== 1 ) continue;
        if ( !clipView( g, fx[ p ], fy[ p ] ) && !clipView( g, fx[ c ], fy[ c ] )) continue;
        drawStolonCurve( ctx, fx[ p ], fy[ p ], fx[ c ], fy[ c ], c, ROOT_COLOR, 2.1 * wScale, rootFlow[ c ] || 0.05, t );
    }

    // Highlighted dynasty (ancestors + children + grandchildren+) for selected plant
    if ( selectedPlant >= 0 && st.liveFood[ selectedPlant ] === 1 )
    {
        highlightRootSquare( ctx, st, selectedPlant, fx[ selectedPlant ], fy[ selectedPlant ], wScale );
        const lineage = RootNetwork.computePlantLineage( plantParent, st.liveFood, selectedPlant );

        // Ancestors upward (parent, grandparent...)
        let childNode = selectedPlant;
        for ( let i = 0; i < lineage.ancestors.length; i++ )
        {
            const anc = lineage.ancestors[ i ];
            drawStolonCurve( ctx, fx[ anc ], fy[ anc ], fx[ childNode ], fy[ childNode ], childNode, ANCESTOR_COLOR, 3.4 * wScale, 0.1, t );
            ctx.lineWidth = 2.2 * wScale;
            ctx.strokeStyle = ANCESTOR_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ anc ], fy[ anc ], 18, 0, PI2 );
            ctx.stroke();
            childNode = anc;
        }

        // Direct children (1st generation)
        for ( let i = 0; i < lineage.children.length; i++ )
        {
            const ch = lineage.children[ i ];
            drawStolonCurve( ctx, fx[ selectedPlant ], fy[ selectedPlant ], fx[ ch ], fy[ ch ], ch, CHILD_COLOR, 3.6 * wScale, 0.12, t );
            ctx.lineWidth = 2.4 * wScale;
            ctx.strokeStyle = CHILD_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ ch ], fy[ ch ], 15, 0, PI2 );
            ctx.stroke();
        }

        // Grandchildren & deeper descendants (2+ generations)
        for ( let i = 0; i < lineage.grandchildren.length; i++ )
        {
            const gc = lineage.grandchildren[ i ];
            const par = plantParent[ gc ];
            if ( par >= 0 && st.liveFood[ par ] === 1 )
            {
                drawStolonCurve( ctx, fx[ par ], fy[ par ], fx[ gc ], fy[ gc ], gc, GRANDCHILD_COLOR, 2.8 * wScale, 0.09, t );
            }
            ctx.lineWidth = 2.0 * wScale;
            ctx.strokeStyle = GRANDCHILD_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ gc ], fy[ gc ], 12, 0, PI2 );
            ctx.stroke();
        }
    }
}

export function drawSnaps( ctx: CanvasRenderingContext2D, clock: number ): void
{
    if ( !ctx ) return;
    const snaps = RootNetwork.getSeverSnaps();
    for ( let i = 0; i < snaps.length; i++ )
    {
        const s = snaps[ i ];
        const a = Math.max( 0.08, Math.min( 0.9, ( s.age / 30 ) * ( 0.65 + 0.35 * Math.sin( clock * 0.25 ))));
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = "rgba(255, 110, 75, " + a.toFixed( 3 ) + ")";
        ctx.beginPath();
        ctx.moveTo( s.xCut, s.yCut ); ctx.lineTo( s.xP, s.yP );
        ctx.moveTo( s.xCut, s.yCut ); ctx.lineTo( s.xC, s.yC );
        ctx.stroke();
    }
}

export function rootSquareSide( st: any, f: number ): number
{
    if ( f < 0 || st.liveFood[ f ] !== 1 ) return 0;
    const e = st.foodEnergy[ f ], w = st.foodWood[ f ];
    return ( e >= 42 ) ? 9 : ( w >= 24 ) ? 7 : ( e >= 22 ) ? 5 : ( e >= 10 ) ? 3 : 1;
}

export function highlightRootSquare( ctx: CanvasRenderingContext2D, st: any, f: number, x: number, y: number, wScale = 1 ): void
{
    const side = rootSquareSide( st, f );
    if ( side === 0 ) return;
    ctx.lineWidth = 2.4 * wScale;
    ctx.strokeStyle = "rgba(255, 215, 96, 0.92)";
    ctx.beginPath();
    ctx.rect( x - side * 30, y - side * 30, side * 60, side * 60 );
    ctx.stroke();
}

export function suctionRate( st: any, f: number ): number { return st.foodSucking[ f ] > 0 ? st.foodSucking[ f ] : 0; }

export function lineageSize( st: any, f: number ): number
{
    const l = RootNetwork.computePlantLineage( st.plantParent, st.liveFood, f );
    return 1 + l.ancestors.length + l.totalDescendants;
}
`, "utf8");
console.log("OK: src/render/RootRenderer.ts");

// =============================================================================
// 3. GenePool.ts — run full RootNetwork.stepRootNetwork every step AND
//    make seedlings sprout near mature parent bushes/trees in fertile soil
// =============================================================================
patchFile("src/simulation/GenePool.ts", (src) => {
  let out = src;

  // 3a. Call RootNetwork.stepRootNetwork( _st, _clock, _swimbots ) inside updateFood
  const oldUpdateFood = `this.updateFood = function() { FoodEcology.updateFood( _foodContext ); RootNetwork.severRoots( _st, _clock, _swimbots ); }`;
  const newUpdateFood = `this.updateFood = function() { FoodEcology.updateFood( _foodContext ); RootNetwork.stepRootNetwork( _st, _clock, _swimbots ); }`;
  if (!out.includes(oldUpdateFood)) throw new Error("GenePool updateFood anchor not found");
  out = out.replace(oldUpdateFood, newUpdateFood);

  // 3b. Replace random-across-pool regrowFoodOriginal with ecologically grounded
  //     parent-grove dispersal + fertile-soil check (so young plants don't appear randomly in desert)
  const oldRegrow = `\tthis.regrowFoodOriginal = function( numPlants )
\t{
\t    const lowDensity = numPlants < Math.max( 200, INITIAL_NUM_FOODBITS * 0.45 );
\t    const period = lowDensity ? Math.max( 2, Math.floor( globalTweakers.foodRegenerationPeriod * 0.20 )) : globalTweakers.foodRegenerationPeriod;
\t    if ( _clock % period !== 0 ) return;
\t    const spread = globalTweakers.foodSpread * WORLD_SCALE;
\t    const left = POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN, right  = POOL_RIGHT  - FOOD_BIT_BOUNDARY_MARGIN;
\t    const top  = POOL_TOP  + FOOD_BIT_BOUNDARY_MARGIN, bottom = POOL_BOTTOM - FOOD_BIT_BOUNDARY_MARGIN;
\t    const oases = _colonyCenters.length > 0 ? _colonyCenters : oasisCentersWorld();
\t    const spawnsPerTick = Math.max( 10, Math.round( ( lowDensity ? 20 : 10 ) * WORLD_AREA_FACTOR ));
\t    for (let n = 0; n < spawnsPerTick; n++)
\t    {
\t        if ( numPlants >= 2 * MAX_FOODBITS_PER_TYPE ) return;
\t        const child = this.findLowestDeadFoodBitInArray();
\t        if ( child === NULL_INDEX ) return;
\t        const parent = ( gpRandom() < 0.70 ) ? this.findRandomLivingPlant() : null;
\t        let plantType = 0;
\t        if ( parent !== null )
\t        {
\t            plantType = parent.getType();
\t            const from = parent.getPosition();
\t            for (let attempt = 0; attempt < 10; attempt++)
\t            {
\t                let xx = gpRandom() * gpRandom(), yy = gpRandom() * gpRandom();
\t                if ( gpRandom() < ONE_HALF ) { xx = -xx; }
\t                if ( gpRandom() < ONE_HALF ) { yy = -yy; }
\t                let x = from.x + xx * spread, y = from.y + yy * spread;
\t                if ( y < top ) { y += ( top - y ) * 2; } else if ( y > bottom ) { y += ( bottom - y ) * 2; }
\t                if ( x > right ) { x += ( right - x ) * 2; } else if ( x < left ) { x += ( left - x ) * 2; }
\t                _vectorUtility.x = Math.min( right, Math.max( left, x ));
\t                _vectorUtility.y = Math.min( bottom, Math.max( top, y ));
\t                if ( !_obstacle.getObstruction( from, _vectorUtility ) ) break;
\t            }
\t        }
\t        else if ( oases.length > 0 && gpRandom() < 0.80 )
\t        {
\t            const o = oases[ Math.floor( gpRandom() * oases.length ) ];
\t            const a = gpRandom() * PI2, r = 680 * Math.sqrt( gpRandom() );
\t            _vectorUtility.x = Math.min( right, Math.max( left, o.x + Math.cos( a ) * r ));
\t            _vectorUtility.y = Math.min( bottom, Math.max( top, o.y + Math.sin( a ) * r ));
\t        }
\t        else
\t        {
\t            this.randomPointInPool( _vectorUtility );
\t        }
\t        _foodBits[ child ].initialize( child );
\t        _foodBits[ child ].setType( plantType );
\t        if ( !fundPlant( child, globalTweakers.foodBitEnergy )) return;
\t        _foodBits[ child ].setPosition( _vectorUtility );
\t        environment.plantCount[ plantType ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
\t        numPlants ++;
\t    }
\t}`;

  const newRegrow = `\tthis.regrowFoodOriginal = function( numPlants )
\t{
\t    const lowDensity = numPlants < Math.max( 200, INITIAL_NUM_FOODBITS * 0.45 );
\t    const period = lowDensity ? Math.max( 2, Math.floor( globalTweakers.foodRegenerationPeriod * 0.25 )) : globalTweakers.foodRegenerationPeriod;
\t    if ( _clock % period !== 0 ) return;
\t    const left = POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN, right  = POOL_RIGHT  - FOOD_BIT_BOUNDARY_MARGIN;
\t    const top  = POOL_TOP  + FOOD_BIT_BOUNDARY_MARGIN, bottom = POOL_BOTTOM - FOOD_BIT_BOUNDARY_MARGIN;
\t    const oases = _colonyCenters.length > 0 ? _colonyCenters : oasisCentersWorld();
\t    const gn = _st.soilGridN || SOIL_GRID_N;
\t    const spawnsPerTick = Math.max( 6, Math.round( ( lowDensity ? 14 : 7 ) * WORLD_AREA_FACTOR ));

\t    const soilAt = ( wx: number, wy: number ) => {
\t        const ix = Math.max( 0, Math.min( gn - 1, Math.floor(( wx - POOL_LEFT ) / POOL_WIDTH * gn )));
\t        const iy = Math.max( 0, Math.min( gn - 1, Math.floor(( wy - POOL_TOP ) / POOL_HEIGHT * gn )));
\t        return _st.soilField[ iy * gn + ix ];
\t    };

\t    for (let n = 0; n < spawnsPerTick; n++)
\t    {
\t        if ( numPlants >= 2 * MAX_FOODBITS_PER_TYPE ) return;
\t        const child = this.findLowestDeadFoodBitInArray();
\t        if ( child === NULL_INDEX ) return;

\t        // Prefer mature parent bushes/trees (energy >= 18) so young plants grow around real groves
\t        let parent = ( gpRandom() < 0.94 ) ? this.findRandomLivingPlant() : null;
\t        if ( parent !== null && _st.foodEnergy[ parent.getIndex() ] < 18 )
\t        {
\t            for ( let tries = 0; tries < 6; tries++ )
\t            {
\t                const cand = this.findRandomLivingPlant();
\t                if ( cand !== null && _st.foodEnergy[ cand.getIndex() ] >= 18 ) { parent = cand; break; }
\t            }
\t        }

\t        let plantType = 0;
\t        let validSpot = false;
\t        let parentIdx = -1;
\t        let distToParent = Infinity;

\t        if ( parent !== null )
\t        {
\t            plantType = parent.getType();
\t            parentIdx = parent.getIndex();
\t            const from = parent.getPosition();
\t            for (let attempt = 0; attempt < 10; attempt++)
\t            {
\t                const ang = gpRandom() * PI2;
\t                const d = 105 + gpRandom() * 260;
\t                const x = Math.min( right, Math.max( left, from.x + Math.cos( ang ) * d ));
\t                const y = Math.min( bottom, Math.max( top, from.y + Math.sin( ang ) * d ));
\t                if ( soilAt( x, y ) < 3.5 ) continue;
\t                _vectorUtility.x = x;
\t                _vectorUtility.y = y;
\t                if ( !_obstacle.getObstruction( from, _vectorUtility ) )
\t                {
\t                    validSpot = true;
\t                    distToParent = d;
\t                    break;
\t                }
\t            }
\t        }
\t        else if ( oases.length > 0 )
\t        {
\t            // Rare wind/current seed rain lands strictly inside fertile oasis soil
\t            const o = oases[ Math.floor( gpRandom() * oases.length ) ];
\t            const a = gpRandom() * PI2, r = 640 * Math.sqrt( gpRandom() );
\t            const x = Math.min( right, Math.max( left, o.x + Math.cos( a ) * r ));
\t            const y = Math.min( bottom, Math.max( top, o.y + Math.sin( a ) * r ));
\t            if ( soilAt( x, y ) >= 10.0 )
\t            {
\t                _vectorUtility.x = x;
\t                _vectorUtility.y = y;
\t                validSpot = true;
\t            }
\t        }

\t        if ( !validSpot ) continue;

\t        _foodBits[ child ].initialize( child );
\t        _foodBits[ child ].setType( plantType );
\t        if ( !fundPlant( child, globalTweakers.foodBitEnergy )) return;
\t        _foodBits[ child ].setPosition( _vectorUtility );
\t        if ( parentIdx >= 0 && distToParent <= 195 && _st.foodEnergy[ parentIdx ] >= 22 && !RootNetwork.isAncestor( _st, child, parentIdx ))
\t        {
\t            _st.plantParent[ child ] = parentIdx;
\t            _st.plantRootFlow[ child ] = 0.04;
\t        }
\t        environment.plantCount[ plantType ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
\t        numPlants ++;
\t    }
\t}`;

  if (!out.includes(oldRegrow)) throw new Error("GenePool regrowFoodOriginal anchor not found");
  out = out.replace(oldRegrow, newRegrow);

  return out;
});

// =============================================================================
// 4. GenePoolRenderer.ts — ensure RootRenderer.drawRoots & drawSnaps are called!
// =============================================================================
if (fs.existsSync("src/simulation/GenePoolRenderer.ts")) {
  patchFile("src/simulation/GenePoolRenderer.ts", (src) => {
    let out = src;
    if (!out.includes("RootRenderer")) {
      out = `import * as RootRenderer from "../render/RootRenderer";\n` + out;
    }

    // If drawRoots is already called, make sure it's not blocked by an overly strict zoom check
    if (out.includes("RootRenderer.drawRoots")) {
      out = out.replace(
        /if\s*\([^)]*viewScale[^)]*\)\s*\{\s*RootRenderer\.drawRoots\([^)]+\);\s*\}/g,
        `RootRenderer.drawRoots( canvas, st, ctx );`
      );
      return out;
    }

    // Otherwise inject RootRenderer.drawRoots & drawSnaps right before renderFoodBits call in render()
    const foodCallPatterns = [
      "renderFoodBits( canvas );",
      "this.renderFoodBits( canvas );",
      "renderFoodBits( g );",
      "this.renderFoodBits( g );",
    ];
    let injected = false;
    for (const pat of foodCallPatterns) {
      if (out.includes(pat)) {
        out = out.replace(
          pat,
          `RootRenderer.drawRoots( ctx.canvas, ctx.st, ctx );\n        RootRenderer.drawSnaps( ctx.canvas, ctx.clock );\n        ` + pat
        );
        injected = true;
        break;
      }
    }
    if (!injected) {
      throw new Error("Could not find renderFoodBits call in GenePoolRenderer.ts");
    }
    return out;
  });
}

// =============================================================================
// 5. FoodEcology.ts — ensure foodSucking is recorded when roots draw soil energy
// =============================================================================
if (fs.existsSync("src/simulation/FoodEcology.ts")) {
  patchFile("src/simulation/FoodEcology.ts", (src) => {
    if (src.includes("foodSucking")) return src;
    if (src.includes("soilPlantGrowth(")) {
      return src.replace(
        /const\s+gained\s*=\s*soilPlantGrowth\(([^)]+)\);/,
        `const gained = soilPlantGrowth($1);\n            st.foodSucking[f] = gained;`
      );
    }
    return src;
  });
}

console.log("Root network & grove dispersal fixes applied!");
