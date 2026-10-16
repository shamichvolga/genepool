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
//--------------------------------------------------------------------------
export function Graph()
{
    const MARGIN_LEFT   = 70;
    const MARGIN_RIGHT  = 20;
    const MARGIN_TOP    = 30;
    const MARGIN_BOTTOM = 150;

    const SERIES = [
        { key: "herbivores", label: "herbivores", color: "rgb( 210,  90,  20 )", width: 2.5 },
        { key: "predators",  label: "predators",  color: "rgb(  20,  20,  20 )", width: 2.5 },
        { key: "plants",     label: "plants",     color: "rgb(  30, 130,  30 )", width: 1.5 },
        { key: "meat",       label: "meat",       color: "rgb( 170,  20,  60 )", width: 1.5 },
    ];

    let _history = null;

    this.initialize = function() { _history = null; }

    this.update = function( history ) { _history = history; }

    this.clear = function()
    {
        const canvas = document.getElementById( 'graphCanvas' ) as HTMLCanvasElement;
        canvas.getContext( '2d' ).clearRect( 0, 0, canvas.width, canvas.height );
    }

    // a round number at or above v (for the vertical scale)
    function niceCeiling( v )
    {
        if ( v <= 10 ) return 10;
        const p = Math.pow( 10, Math.floor( Math.log10( v )));
        for ( const m of [ 1, 2, 2.5, 5, 10 ] ) { if ( m * p >= v ) return m * p; }
        return 10 * p;
    }

    this.render = function()
    {
        const canvas = document.getElementById( 'graphCanvas' ) as HTMLCanvasElement;
        const g = canvas.getContext( '2d' );
        const W = canvas.width, H = canvas.height;
        g.clearRect( 0, 0, W, H );

        const left = MARGIN_LEFT, right = W - MARGIN_RIGHT;
        const top = MARGIN_TOP, bottom = H - MARGIN_BOTTOM;
        const gw = right - left, gh = bottom - top;

        g.fillStyle = "rgb( 240, 238, 230 )";
        g.fillRect( left, top, gw, gh );
        g.strokeStyle = "rgb( 0, 0, 0 )";
        g.lineWidth = 1;
        g.strokeRect( left, top, gw, gh );

        const h = _history;
        const n = h ? h.step.length : 0;

        // vertical scale: the largest value seen
        let maxValue = 0;
        for ( const s of SERIES ) for ( let i = 0; i < n; i++ ) { if ( h[ s.key ][i] > maxValue ) maxValue = h[ s.key ][i]; }
        const yMax = niceCeiling( maxValue );

        g.font = "18px sans-serif";
        g.fillStyle = "rgb( 90, 90, 90 )";
        g.textAlign = "right";
        g.strokeStyle = "rgba( 100, 100, 100, 0.35 )";
        for ( let k = 0; k <= 4; k++ )
        {
            const y = bottom - ( k / 4 ) * gh;
            g.beginPath(); g.moveTo( left, y ); g.lineTo( right, y ); g.stroke();
            g.fillText( String( Math.round( yMax * k / 4 )), left - 6, y + 6 );
        }

        if ( n >= 2 )
        {
            const t0 = h.step[0], t1 = h.step[ n - 1 ];
            const xOf = ( i ) => left + ( h.step[i] - t0 ) / Math.max( 1, t1 - t0 ) * gw;
            const yOf = ( v ) => bottom - ( v / yMax ) * gh;

            for ( const s of SERIES )
            {
                const a = h[ s.key ];
                g.strokeStyle = s.color;
                g.lineWidth = s.width;
                g.beginPath();
                g.moveTo( xOf( 0 ), yOf( a[0] ));
                for ( let i = 1; i < n; i++ ) { g.lineTo( xOf( i ), yOf( a[i] )); }
                g.stroke();
            }

            g.fillStyle = "rgb( 90, 90, 90 )";
            g.textAlign = "left";
            g.fillText( "step " + t0, left, bottom + 22 );
            g.textAlign = "right";
            g.fillText( "step " + t1, right, bottom + 22 );
        }

        // legend with the latest values
        g.textAlign = "left";
        g.font = "20px sans-serif";
        SERIES.forEach( ( s, k ) =>
        {
            const x = left + ( k % 2 ) * ( gw / 2 );
            const y = bottom + 60 + Math.floor( k / 2 ) * 34;
            g.strokeStyle = s.color;
            g.lineWidth = 4;
            g.beginPath(); g.moveTo( x, y - 7 ); g.lineTo( x + 40, y - 7 ); g.stroke();
            g.fillStyle = "rgb( 40, 40, 40 )";
            g.fillText( s.label + ( n > 0 ? ": " + h[ s.key ][ n - 1 ] : "" ), x + 50, y );
        });
    }
}
