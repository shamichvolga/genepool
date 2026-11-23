//------------------------------------------------------------------------------
// RootRenderer — visuals of the underground root network: soil suction at
// plant stems, parent->child->grandchild stolon curves with sap pulses,
// highlighted dynasty tree on selection, and sever snap animations.
//------------------------------------------------------------------------------
import * as RootNetwork from "../simulation/RootNetwork";
import { PI2 } from "../simulation/MathConstants";

const SUCTION_COLOR     = "rgba(135, 225, 95, 0.85)";
const ROOT_COLOR        = "rgba(210, 245, 110, 0.88)";
const ROOT_SHADOW       = "rgba(16, 26, 12, 0.72)";
const FLOW_COLOR        = "rgba(255, 255, 175, 0.98)";
const ANCESTOR_COLOR    = "rgba(255, 215, 90, 0.98)";
const CHILD_COLOR       = "rgba(130, 255, 110, 0.98)";
const GRANDCHILD_COLOR  = "rgba(85, 235, 255, 0.95)";

function clipView( g: any, x: number, y: number ): boolean
{
    const cam = g.camera;
    if ( !cam || !cam.getWithinView ) return true;
    return cam.getWithinView({ x, y }, 200 );
}

function drawStolonCurve( ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, color: string, width: number, flow: number, t: number ): void
{
    const dx = x2 - x1, dy = y2 - y1, len = Math.max( 1, Math.sqrt( dx * dx + dy * dy ));
    const bend = ((( seed * 2654435761 ) & 0xffff ) / 65535 - 0.5 ) * 22;
    const cx = x1 + dx * 0.55 + ( -dy / len ) * bend;
    const cy = y1 + dy * 0.55 + ( dx / len ) * bend;

    ctx.lineWidth = width + 1.4;
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
        ctx.arc( px, py, Math.max( 1.8, width * 0.95 ), 0, PI2 );
        ctx.fill();
    }
}

export function drawRoots( ctx: CanvasRenderingContext2D, st: any, g: any ): void
{
    const selectedPlant = ( st.selectedPlantIndex >= 0 ) ? st.selectedPlantIndex : -1;
    const fx = st.foodX, fy = st.foodY, sucking = st.foodSucking, plantParent = st.plantParent, rootFlow = st.plantRootFlow;
    const N = st.liveFood.length, t = g.getTimeStep ? g.getTimeStep() : 0;

    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        if ( sucking[ f ] > 0.015 && clipView( g, fx[ f ], fy[ f ] ))
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

    // Short rootlets at the base of established plants
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        if ( st.foodEnergy[ f ] < 10 || !clipView( g, fx[ f ], fy[ f ] )) continue;
        const spin = ((( f * 2654435761 ) & 0xffff ) / 65535 ) * PI2;
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = ROOT_SHADOW;
        for ( let k = 0; k < 5; k++ )
        {
            const a = spin + k * ( PI2 / 5 ), len = 12 + ( f % 9 );
            ctx.beginPath();
            ctx.moveTo( fx[ f ], fy[ f ] );
            ctx.lineTo( fx[ f ] + Math.cos( a ) * len, fy[ f ] + Math.sin( a ) * len );
            ctx.stroke();
        }
    }

    // All parent -> child stolons
    for ( let c = 0; c < N; c++ )
    {
        const p = plantParent[ c ];
        if ( p < 0 || st.liveFood[ c ] !== 1 || st.liveFood[ p ] !== 1 ) continue;
        if ( !clipView( g, fx[ p ], fy[ p ] ) && !clipView( g, fx[ c ], fy[ c ] )) continue;
        drawStolonCurve( ctx, fx[ p ], fy[ p ], fx[ c ], fy[ c ], c, ROOT_COLOR, 1.8, rootFlow[ c ] || 0.05, t );
    }

    // Highlighted dynasty (ancestors + children + grandchildren+) for selected plant
    if ( selectedPlant >= 0 && st.liveFood[ selectedPlant ] === 1 )
    {
        highlightRootSquare( ctx, st, selectedPlant, fx[ selectedPlant ], fy[ selectedPlant ] );
        const lineage = RootNetwork.computePlantLineage( plantParent, st.liveFood, selectedPlant );

        // Ancestors upward (parent, grandparent...)
        let childNode = selectedPlant;
        for ( let i = 0; i < lineage.ancestors.length; i++ )
        {
            const anc = lineage.ancestors[ i ];
            drawStolonCurve( ctx, fx[ anc ], fy[ anc ], fx[ childNode ], fy[ childNode ], childNode, ANCESTOR_COLOR, 3.0, 0.1, t );
            ctx.lineWidth = 2.0;
            ctx.strokeStyle = ANCESTOR_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ anc ], fy[ anc ], 16, 0, PI2 );
            ctx.stroke();
            childNode = anc;
        }

        // Direct children (1st generation)
        for ( let i = 0; i < lineage.children.length; i++ )
        {
            const ch = lineage.children[ i ];
            drawStolonCurve( ctx, fx[ selectedPlant ], fy[ selectedPlant ], fx[ ch ], fy[ ch ], ch, CHILD_COLOR, 3.2, 0.12, t );
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = CHILD_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ ch ], fy[ ch ], 14, 0, PI2 );
            ctx.stroke();
        }

        // Grandchildren & deeper descendants (2+ generations)
        for ( let i = 0; i < lineage.grandchildren.length; i++ )
        {
            const gc = lineage.grandchildren[ i ];
            const par = plantParent[ gc ];
            if ( par >= 0 && st.liveFood[ par ] === 1 )
            {
                drawStolonCurve( ctx, fx[ par ], fy[ par ], fx[ gc ], fy[ gc ], gc, GRANDCHILD_COLOR, 2.5, 0.09, t );
            }
            ctx.lineWidth = 1.8;
            ctx.strokeStyle = GRANDCHILD_COLOR;
            ctx.beginPath();
            ctx.arc( fx[ gc ], fy[ gc ], 11, 0, PI2 );
            ctx.stroke();
        }
    }
}

export function drawSnaps( ctx: CanvasRenderingContext2D, clock: number ): void
{
    const snaps = RootNetwork.getSeverSnaps();
    for ( let i = 0; i < snaps.length; i++ )
    {
        const s = snaps[ i ];
        const a = Math.max( 0.08, Math.min( 0.9, ( s.age / 30 ) * ( 0.65 + 0.35 * Math.sin( clock * 0.25 ))));
        ctx.lineWidth = 2.0;
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

export function highlightRootSquare( ctx: CanvasRenderingContext2D, st: any, f: number, x: number, y: number ): void
{
    const side = rootSquareSide( st, f );
    if ( side === 0 ) return;
    ctx.lineWidth = 2.4;
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
