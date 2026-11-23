//------------------------------------------------------------------------------
// RootRenderer  refined organic visuals of the underground root network:
// soft soil suction halos, graceful curved stolons with sap pulses,
// and dynasty highlight rings (no spiky stars or rigid squares).
//------------------------------------------------------------------------------
import * as RootNetwork from "../simulation/RootNetwork";
import { PI2 } from "../simulation/MathConstants";

const SUCTION_COLOR     = "rgba(135, 225, 95, 0.55)";
const ROOT_COLOR        = "rgba(182, 226, 118, 0.72)";
const ROOT_SHADOW       = "rgba(14, 24, 12, 0.36)";
const FLOW_COLOR        = "rgba(248, 255, 196, 0.92)";
const ANCESTOR_COLOR    = "rgba(245, 206, 92, 0.92)";
const CHILD_COLOR       = "rgba(126, 238, 122, 0.92)";
const GRANDCHILD_COLOR  = "rgba(96, 218, 240, 0.88)";

function clipView( g: any, x: number, y: number ): boolean
{
    const cam = g && g.camera;
    if ( !cam || !cam.getWithinView ) return true;
    return cam.getWithinView({ x, y }, 220 );
}

function drawStolonCurve(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number,
    color: string,
    width: number,
    flow: number,
    t: number
): void
{
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.max( 1, Math.sqrt( dx * dx + dy * dy ));
    const nx = -dy / len, ny = dx / len;
    const wave = ((( seed * 2654435761 ) & 0xffff ) / 65535 - 0.5 ) * Math.min( 28, len * 0.16 );
    const cx = x1 + dx * 0.5 + nx * wave;
    const cy = y1 + dy * 0.5 + ny * wave;

    ctx.lineCap = "round";
    ctx.lineWidth = width + 1.0;
    ctx.strokeStyle = ROOT_SHADOW;
    ctx.beginPath();
    ctx.moveTo( x1, y1 );
    ctx.quadraticCurveTo( cx, cy, x2, y2 );
    ctx.stroke();

    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo( x1, y1 );
    ctx.quadraticCurveTo( cx, cy, x2, y2 );
    ctx.stroke();

    if ( flow !== 0 )
    {
        const phase = (( t * 0.028 + seed * 0.17 ) % 1 + 1 ) % 1;
        const u = flow > 0 ? phase : ( 1 - phase );
        const omt = 1 - u;
        const px = omt * omt * x1 + 2 * omt * u * cx + u * u * x2;
        const py = omt * omt * y1 + 2 * omt * u * cy + u * u * y2;
        ctx.fillStyle = FLOW_COLOR;
        ctx.beginPath();
        ctx.arc( px, py, Math.max( 1.5, width * 0.85 ), 0, PI2 );
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
    const wScale = Math.min( 1.8, Math.max( 0.75, 0.24 / vs ));

    // Soft soil absorption glow around feeding plants
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        if ( sucking && sucking[ f ] > 0.02 && clipView( g, fx[ f ], fy[ f ] ))
        {
            const rad = Math.max( 5, 11 * Math.min( 1.5, sucking[ f ] ));
            ctx.fillStyle = SUCTION_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ f ], fy[ f ], rad, 0, PI2 );
            ctx.fill();
        }
    }

    // Graceful curved stolons connecting parent -> child -> grandchild+
    for ( let c = 0; c < N; c++ )
    {
        const p = plantParent[ c ];
        if ( p < 0 || st.liveFood[ c ] !== 1 || st.liveFood[ p ] !== 1 ) continue;
        if ( !clipView( g, fx[ p ], fy[ p ] ) && !clipView( g, fx[ c ], fy[ c ] )) continue;
        drawStolonCurve(
            ctx,
            fx[ p ],
            fy[ p ],
            fx[ c ],
            fy[ c ],
            c,
            ROOT_COLOR,
            1.45 * wScale,
            rootFlow ? ( rootFlow[ c ] || 0.04 ) : 0.04,
            t
        );
    }

    // Smooth dynasty halo & branches for the selected plant (no rigid square)
    if ( selectedPlant >= 0 && st.liveFood[ selectedPlant ] === 1 )
    {
        highlightRootSquare( ctx, st, selectedPlant, fx[ selectedPlant ], fy[ selectedPlant ], wScale );
        const lineage = RootNetwork.computePlantLineage( plantParent, st.liveFood, selectedPlant );

        let childNode = selectedPlant;
        for ( let i = 0; i < lineage.ancestors.length; i++ )
        {
            const anc = lineage.ancestors[ i ];
            drawStolonCurve( ctx, fx[ anc ], fy[ anc ], fx[ childNode ], fy[ childNode ], childNode, ANCESTOR_COLOR, 2.4 * wScale, 0.08, t );
            ctx.lineWidth = 1.6 * wScale;
            ctx.strokeStyle = ANCESTOR_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ anc ], fy[ anc ], 14, 0, PI2 );
            ctx.stroke();
            childNode = anc;
        }

        for ( let i = 0; i < lineage.children.length; i++ )
        {
            const ch = lineage.children[ i ];
            drawStolonCurve( ctx, fx[ selectedPlant ], fy[ selectedPlant ], fx[ ch ], fy[ ch ], ch, CHILD_COLOR, 2.5 * wScale, 0.1, t );
            ctx.lineWidth = 1.7 * wScale;
            ctx.strokeStyle = CHILD_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ ch ], fy[ ch ], 12, 0, PI2 );
            ctx.stroke();
        }

        for ( let i = 0; i < lineage.grandchildren.length; i++ )
        {
            const gc = lineage.grandchildren[ i ];
            const par = plantParent[ gc ];
            if ( par >= 0 && st.liveFood[ par ] === 1 )
            {
                drawStolonCurve( ctx, fx[ par ], fy[ par ], fx[ gc ], fy[ gc ], gc, GRANDCHILD_COLOR, 2.0 * wScale, 0.08, t );
            }
            ctx.lineWidth = 1.5 * wScale;
            ctx.strokeStyle = GRANDCHILD_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ gc ], fy[ gc ], 10, 0, PI2 );
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
        const a = Math.max( 0.08, Math.min( 0.85, ( s.age / 30 ) * ( 0.7 + 0.3 * Math.sin( clock * 0.25 ))));
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "rgba(255, 128, 88, " + a.toFixed( 3 ) + ")";
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
    const radius = side * 24;
    ctx.lineWidth = 1.8 * wScale;
    ctx.strokeStyle = "rgba(242, 214, 118, 0.65)";
    ctx.beginPath();
    ctx.arc( x, y, radius, 0, PI2 );
    ctx.stroke();
}

export function suctionRate( st: any, f: number ): number { return st.foodSucking && st.foodSucking[ f ] > 0 ? st.foodSucking[ f ] : 0; }

export function lineageSize( st: any, f: number ): number
{
    const l = RootNetwork.computePlantLineage( st.plantParent, st.liveFood, f );
    return 1 + l.ancestors.length + l.totalDescendants;
}
