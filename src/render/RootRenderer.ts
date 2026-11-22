//------------------------------------------------------------------------------
// RootRenderer — visuals of the underground root network: soil suction at
// plant stems, the visible root lines with direction-of-flow dots, and the
// cut animation when a swimbot severs a root. Strictly a renderer.
//------------------------------------------------------------------------------
import * as RootNetwork from "../simulation/RootNetwork";
import { PI2 } from "../simulation/MathConstants";

const SUCTION_COLOR = "rgba(135, 225, 95, 0.85)";
const ROOT_COLOR    = "rgba(210, 245, 110, 0.90)";
const ROOT_SHADOW   = "rgba(16, 26, 12, 0.72)";
const FLOW_COLOR    = "rgba(255, 255, 175, 0.98)";
const SNIP_COLOR    = "rgba(255, 120, 80, 0.55)";

function clipView( g: any, x: number, y: number ): boolean
{
    const cam = g.camera;
    if ( !cam || !cam.getWithinView ) { return true; }
    return cam.getWithinView( { x, y }, 14 );
}

// Suction blob around each stem (ring + 6 soil-particle sparks pulling to the
// stem); animated flow dots along the real parent→child root lines.
export function drawRoots( ctx: CanvasRenderingContext2D, st: any, g: any ): void
{
    const selectedPlant = ( st.selectedPlantIndex >= 0 ) ? st.selectedPlantIndex : -1;
    const fx = st.foodX, fy = st.foodY, sucking = st.foodSucking, plantParent = st.plantParent, rootFlow = st.plantRootFlow;
    const N = st.liveFood.length, t = g.getTimeStep ? g.getTimeStep() : 0;

    for ( let f = 0; f < N; f++ )
    {
        if ( sucking[ f ] > 0.015 && clipView( g, fx[f], fy[f] ))
        {
            const rad = Math.max( 4, 7 * sucking[ f ] ), amp = 0.7 + 0.6 * sucking[ f ];
            ctx.lineWidth = Math.max( 0.9, 4 * ( 0.5 + 0.5 * sucking[ f ] ));
            ctx.fillStyle = SUCTION_COLOR;
            ctx.beginPath();
            ctx.ellipse( fx[f], fy[f], rad, rad * 0.5, 0, 0, PI2 );
            ctx.fill();
            const u = Math.sin( Math.PI * ( ( t * 0.03 + f * 0.9 ) % 1 )) * Math.sin( t * 0.3 );
            for ( let k = 0; k < 6; k++ )
            {
                const a = k * 1.047 + t * 0.02, w = Math.abs( u ) + 0.05;
                const r = 18 + Math.sin( a * 3 + t ) * 12;
                ctx.fillStyle = "rgba(95, 165, 110, " + ( 0.15 * w * amp ).toFixed( 3 ) + ")";
                ctx.beginPath();
                ctx.arc( fx[f] + Math.cos( a ) * r, fy[f] + Math.sin( a ) * r, 8 + w, 0, PI2 );
                ctx.fill();
            }
        }
    }

    // Five short rootlets at the base of every established plant.
    for ( let f = 0; f < N; f++ )
    {
        if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
        if ( st.foodEnergy[ f ] < 10 || !clipView( g, fx[f], fy[f] )) continue;
        const spin = (( f * 2654435761 ) & 0xffff) / 65535 * PI2;
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = ROOT_SHADOW;
        for ( let k = 0; k < 5; k++ )
        {
            const a = spin + k * ( PI2 / 5 ), len = 12 + ( f % 9 );
            ctx.beginPath();
            ctx.moveTo( fx[f], fy[f] );
            ctx.lineTo( fx[f] + Math.cos( a ) * len, fy[f] + Math.sin( a ) * len );
            ctx.stroke();
        }
    }

    for ( let c = 0; c < N; c++ )
    {
        const p = plantParent[ c ];
        if ( p < 0 || st.liveFood[ c ] !== 1 || !clipView( g, fx[p], fy[p] )) continue;
        const dx = fx[c] - fx[p], dy = fy[c] - fy[p], len = Math.max( 1, Math.sqrt( dx * dx + dy * dy ));
        const bend = (( c * 2654435761 ) & 0xffff) / 65535;
        const cx = fx[p] + dx * 0.65 + (-dy / len) * 2.5 * bend, cy = fy[p] + dy * 0.65 + (dx / len) * 2.5 * bend;
        ctx.lineWidth = 3.2; ctx.strokeStyle = ROOT_SHADOW;
        ctx.beginPath(); ctx.moveTo( fx[p], fy[p] ); ctx.quadraticCurveTo( cx, cy, fx[c], fy[c] ); ctx.stroke();
        ctx.lineWidth = 1.8; ctx.strokeStyle = ROOT_COLOR;
        ctx.beginPath(); ctx.moveTo( fx[p], fy[p] ); ctx.quadraticCurveTo( cx, cy, fx[c], fy[c] ); ctx.stroke();
        const flow = rootFlow[ c ];
        if ( flow !== 0 )
        {
            const x = fx[p] + dx * ( flow > 0 ? 0.9 : 0.1 ), y = fy[p] + dy * ( flow > 0 ? 0.9 : 0.1 );
            ctx.fillStyle = FLOW_COLOR;
            ctx.beginPath();
            ctx.arc( x, y, 1.6, 0, PI2 );
            ctx.fill();
        }
    }
    // highlighted dynasty square + lineage roots for the selected plant
    if ( selectedPlant >= 0 && st.liveFood[ selectedPlant ] === 1 )
    {
        const sq = rootSquareSide( st, selectedPlant );
        if ( sq > 0 ) highlightRootSquare( ctx, st, selectedPlant, fx[selectedPlant], fy[selectedPlant] );
    }
}

// Two short root fragments from the cut toward ancestor and descendant.
export function drawSnaps( ctx: CanvasRenderingContext2D, clock: number ): void
{
    const snaps = RootNetwork.getSeverSnaps();
    for ( let i = 0; i < snaps.length; i++ )
    {
        const s = snaps[ i ];
        const age = Math.max( 0, Math.min( 30, 30 - s.age ));
        const fade = 0.35 + 0.45 * Math.sin( clock * 0.08 );
        const a = Math.max( 0.05, fade * age / 30 );
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = SNIP_COLOR.replace( "0.55", a.toFixed( 3 ) + "" );
        ctx.beginPath();
        ctx.moveTo( s.xCut, s.yCut ); ctx.lineTo( s.xP, s.yP );
        ctx.moveTo( s.xCut, s.yCut ); ctx.lineTo( s.xC, s.yC );
        ctx.stroke();
    }
}

export function rootSquareSide( st: any, f: number ): number
{
    if ( st.plantParent[ f ] !== -1 || f < 0 ) return 0;
    const e = st.foodEnergy[ f ], w = st.foodWood[ f ];
    return ( e >= 42 ) ? 9 : ( w >= 24 ) ? 7 : ( e >= 22 ) ? 5 : ( e >= 10 ) ? 3 : 1;
}

export function highlightRootSquare( ctx: CanvasRenderingContext2D, st: any, f: number, x: number, y: number ): void
{
    const side = rootSquareSide( st, f );
    if ( side === 0 ) return;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(255, 215, 96, 0.95)";
    ctx.beginPath();
    ctx.rect( x - side * 30, y - side * 30, side * 60, side * 60 );
    ctx.stroke();
}

export function suctionRate( st: any, f: number ): number { return st.foodSucking[ f ] > 0 ? st.foodSucking[ f ] : 0; }

export function lineageSize( st: any, f: number ): number
{
    const seen = new Set<number>([ f ]);
    let p = st.plantParent[ f ], steps = 0;
    while ( p >= 0 && steps < 32 && !seen.has( p )) { seen.add( p ); p = st.plantParent[ p ]; steps ++; }
    let down = 0;
    for ( let c = 0; c < st.plantParent.length; c++ ) { if ( st.plantParent[ c ] === f ) down ++; }
    let grand = 0;
    for ( let c = 0; c < st.plantParent.length; c++ ) { if ( st.plantParent[ st.plantParent[ c ] === -1 ? -1 : c ] === f ) grand ++; }
    return seen.size + down + grand;
}
