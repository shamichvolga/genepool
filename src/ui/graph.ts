//--------------------------------------------------------------------------
//
//    This file is part of GenePool Swimbots.
//    Copyright (c) 2021 by Jeffrey Ventrella - All Rights Reserved.
//
//    See the README file or go to swimbots.com for full license details.
//    You may use, distribute, and modify this code only under the terms
//    of the "Commons Clause" license (commonsclause.com).
//
//    This software is intended for education, game design, and research.
//
// --------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Population graph. The data comes from the simulation itself
// (genePool.getPopulationHistory()), sampled every N simulation steps, so the
// curves don't depend on drawing or on the speed, and the whole run is shown
// (the history thins itself out when it gets long).
//
// Interactive: pointing at the graph shows the numbers at that moment; the
// legend turns a curve on and off; the buttons above choose the stretch of
// time (all / the last 50 000 / 10 000 steps); "⤢" makes the graph big, over
// the pool.
//--------------------------------------------------------------------------
import { tr } from "./lang";

export function Graph()
{
    const SERIES = [
        { key: "herbivores", label: "herbivores", color: "rgb( 210,  90,  20 )", width: 2   },
        { key: "predators",  label: "predators",  color: "rgb(  40,  40,  40 )", width: 2   },
        { key: "plants",     label: "plants",     color: "rgb(  30, 130,  30 )", width: 1.2 },
        { key: "meat",       label: "meat",       color: "rgb( 170,  20,  60 )", width: 1.2 },
    ];
    const hidden = new Set<string>();
    let _history = null;
    let _range = 0;           // steps shown (0: all)
    let _hoverX = -1;         // pointer over the graph (css pixels), -1: none
    let _wired = false;

    this.initialize = function() { _history = null; wire(); }
    this.update = function( history ) { _history = history; }
    this.setRange = function( steps ) { _range = steps; }

    this.clear = function()
    {
        const canvas = document.getElementById( 'graphCanvas' ) as HTMLCanvasElement;
        canvas.getContext( '2d' ).clearRect( 0, 0, canvas.width, canvas.height );
    }

    // the pointer and the legend (once)
    const self = this;
    function wire()
    {
        if ( _wired ) return;
        const canvas = document.getElementById( 'graphCanvas' ) as HTMLCanvasElement;
        if ( !canvas ) return;
        _wired = true;
        canvas.addEventListener( "mousemove", ( e ) => { _hoverX = e.offsetX; self.render(); });
        canvas.addEventListener( "mouseleave", () => { _hoverX = -1; self.render(); });
        canvas.addEventListener( "dblclick", () => toggleBig() );
        const legend = document.getElementById( "graphLegend" );
        legend?.addEventListener( "click", ( e ) =>
        {
            const item = ( e.target as HTMLElement ).closest( "[data-series]" ) as HTMLElement;
            if ( !item ) return;
            const key = item.dataset.series;
            if ( hidden.has( key )) hidden.delete( key ); else hidden.add( key );
            self.render();
        });
        const big = document.getElementById( "graphBigButton" );
        big?.addEventListener( "click", () => toggleBig() );
    }
    function toggleBig()
    {
        document.getElementById( "graphBox" ).classList.toggle( "big" );
        self.render();
    }

    // a round number at or above v (for the vertical scale)
    function niceCeiling( v )
    {
        if ( v <= 10 ) return 10;
        const p = Math.pow( 10, Math.floor( Math.log10( v )));
        for ( const m of [ 1, 2, 2.5, 5, 10 ] ) { if ( m * p >= v ) return m * p; }
        return 10 * p;
    }
    const short = ( v ) => v >= 1e6 ? ( v / 1e6 ).toFixed( 1 ) + "M" : ( v >= 1e4 ? Math.round( v / 1e3 ) + "k" : String( Math.round( v )));

    this.render = function()
    {
        wire();
        const canvas = document.getElementById( 'graphCanvas' ) as HTMLCanvasElement;
        if ( !canvas || canvas.clientWidth === 0 ) return;
        // sharp on any screen: as many pixels as are shown
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        if ( canvas.width !== Math.round( cw * dpr ) || canvas.height !== Math.round( ch * dpr )) { canvas.width = Math.round( cw * dpr ); canvas.height = Math.round( ch * dpr ); }
        const g = canvas.getContext( '2d' );
        g.setTransform( dpr, 0, 0, dpr, 0, 0 );
        g.clearRect( 0, 0, cw, ch );

        const left = 40, right = cw - 8, top = 8, bottom = ch - 20;
        const gw = right - left, gh = bottom - top;
        g.fillStyle = "rgb( 244, 243, 236 )";
        g.fillRect( left, top, gw, gh );

        const h = _history;
        const N = h ? h.step.length : 0;
        // the stretch shown
        let i0 = 0;
        if ( N > 0 && _range > 0 ) { const from = h.step[ N - 1 ] - _range; while ( i0 < N - 1 && h.step[ i0 ] < from ) i0 ++; }

        let maxValue = 0;
        for ( const s of SERIES ) { if ( hidden.has( s.key )) continue; for ( let i = i0; i < N; i++ ) { if ( h[ s.key ][i] > maxValue ) maxValue = h[ s.key ][i]; } }
        const yMax = niceCeiling( maxValue );

        g.font = "10px Arial, sans-serif";
        g.textAlign = "right";
        g.strokeStyle = "rgba( 100, 100, 100, 0.25 )";
        g.lineWidth = 1;
        for ( let k = 0; k <= 4; k++ )
        {
            const y = Math.round( bottom - ( k / 4 ) * gh ) + 0.5;
            g.beginPath(); g.moveTo( left, y ); g.lineTo( right, y ); g.stroke();
            g.fillStyle = "rgb( 90, 90, 90 )";
            g.fillText( short( yMax * k / 4 ), left - 4, y + 3 );
        }

        let legendValues = null;
        if ( N - i0 >= 2 )
        {
            const t0 = h.step[ i0 ], t1 = h.step[ N - 1 ];
            const xOf = ( i ) => left + ( h.step[i] - t0 ) / Math.max( 1, t1 - t0 ) * gw;
            const yOf = ( v ) => bottom - ( v / yMax ) * gh;

            for ( const s of SERIES )
            {
                if ( hidden.has( s.key )) continue;
                const a = h[ s.key ];
                g.strokeStyle = s.color;
                g.lineWidth = s.width;
                g.beginPath();
                g.moveTo( xOf( i0 ), yOf( a[ i0 ] ));
                for ( let i = i0 + 1; i < N; i++ ) { g.lineTo( xOf( i ), yOf( a[i] )); }
                g.stroke();
            }

            g.fillStyle = "rgb( 90, 90, 90 )";
            g.textAlign = "left";
            g.fillText( tr( "step" ) + " " + short( t0 ), left, bottom + 13 );
            g.textAlign = "right";
            g.fillText( short( t1 ), right, bottom + 13 );

            // the pointer: a line and the numbers of that moment
            let at = N - 1;
            if ( _hoverX >= left && _hoverX <= right )
            {
                const t = t0 + ( _hoverX - left ) / gw * ( t1 - t0 );
                at = i0; while ( at < N - 1 && h.step[ at + 1 ] <= t ) at ++;
                const x = Math.round( xOf( at )) + 0.5;
                g.strokeStyle = "rgba( 0, 0, 0, 0.45 )"; g.lineWidth = 1;
                g.beginPath(); g.moveTo( x, top ); g.lineTo( x, bottom ); g.stroke();
                for ( const s of SERIES )
                {
                    if ( hidden.has( s.key )) continue;
                    g.fillStyle = s.color;
                    g.beginPath(); g.arc( x, yOf( h[ s.key ][ at ] ), 3, 0, 2 * Math.PI ); g.fill();
                }
                g.fillStyle = "rgba( 30, 34, 30, 0.8 )";
                const label = tr( "step" ) + " " + h.step[ at ];
                g.font = "bold 10px Arial, sans-serif";
                const w = g.measureText( label ).width + 10;
                const bx = Math.min( right - w, Math.max( left, x - w / 2 ));
                g.fillRect( bx, top, w, 15 );
                g.fillStyle = "#fff"; g.textAlign = "left";
                g.fillText( label, bx + 5, top + 11 );
            }
            legendValues = at;
        }

        // the legend (HTML: a click turns a curve on and off)
        const legend = document.getElementById( "graphLegend" );
        if ( legend )
        {
            const html = SERIES.map( s =>
                "<span class='legendItem" + ( hidden.has( s.key ) ? " off" : "" ) + "' data-series='" + s.key + "'>"
                + "<i style='background:" + s.color + "'></i>" + tr( s.label )
                + ( legendValues !== null ? ": <b>" + h[ s.key ][ legendValues ] + "</b>" : "" ) + "</span>" ).join( "" );
            if ( legend.innerHTML !== html ) legend.innerHTML = html;
        }
    }
}
