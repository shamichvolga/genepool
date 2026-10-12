//------------------------------------------------------------------------------
// A tiny background thread that just ticks. Browsers stop drawing frames for
// hidden pages and slow their timers down, but a worker keeps ticking, so the
// simulation can go on while the page is in the background (see main.ts).
//------------------------------------------------------------------------------
setInterval( () => postMessage( 0 ), 20 );
