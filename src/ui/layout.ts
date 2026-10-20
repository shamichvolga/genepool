//------------------------------------------------------------------------------
// Windows that can be moved and resized: the panel on the right (by its
// header; a double click puts it back), the status line over the pool and the
// debug window. Where each one is and how big is remembered (localStorage), so
// the next start looks the same. Presets (debug.ts) keep the layout too.
//------------------------------------------------------------------------------
export type Rect = { left: number, top: number, width?: number, height?: number, floating?: boolean };
export type Layout = Record<string, Rect>;

const KEY = "genepool.layout";
const windows: Record<string, { el: HTMLElement, dockable: boolean }> = {};
let layout: Layout = {};

function load(): Layout { try { return JSON.parse( localStorage.getItem( KEY ) || "{}" ) || {}; } catch ( e ) { return {}; } }
function store(): void { try { localStorage.setItem( KEY, JSON.stringify( layout )); } catch ( e ) { /* (no storage) */ } }

export function getLayout(): Layout { return JSON.parse( JSON.stringify( layout )); }

export function applyLayout( saved: Layout ): void
{
    layout = JSON.parse( JSON.stringify( saved || {} ));
    for ( const key in windows ) { place( key ); }
    store();
    window.dispatchEvent( new Event( "resize" ));
}

// a window is put where it was, but never out of sight
function place( key: string ): void
{
    const { el, dockable } = windows[ key ];
    const r = layout[ key ];
    if ( !r || ( dockable && !r.floating )) { dock( key, false ); return; }
    el.classList.add( "floating" );
    if ( dockable ) { document.body.classList.add( "panelFloating" ); }
    // (a page without a size yet: take the saved numbers as they are)
    const vw = window.innerWidth  > 100 ? window.innerWidth  : 1e6;
    const vh = window.innerHeight > 100 ? window.innerHeight : 1e6;
    const w = Math.min( r.width  || el.offsetWidth,  vw - 20 );
    const h = Math.min( r.height || el.offsetHeight, vh - 20 );
    el.style.left   = Math.max( 0, Math.min( vw - 60, r.left )) + "px";
    el.style.top    = Math.max( 0, Math.min( vh - 30, r.top  )) + "px";
    el.style.right  = el.style.bottom = "auto";
    if ( r.width  ) { el.style.width  = w + "px"; }
    if ( r.height ) { el.style.height = h + "px"; }
}

// the panel on the right goes back to its place at the edge
function dock( key: string, save = true ): void
{
    const { el } = windows[ key ];
    el.classList.remove( "floating" );
    el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.width = el.style.height = "";
    if ( key === "panel" ) { document.body.classList.remove( "panelFloating" ); }
    if ( save ) { delete layout[ key ]; store(); window.dispatchEvent( new Event( "resize" )); }
}

function remember( key: string ): void
{
    const { el, dockable } = windows[ key ];
    const box = el.getBoundingClientRect();
    layout[ key ] = { left: Math.round( box.left ), top: Math.round( box.top ), width: Math.round( box.width ), height: Math.round( box.height ), floating: true };
    if ( !dockable ) { layout[ key ].floating = true; }
    store();
}

//------------------------------------------------------------
// el: the window; handle: where to grab it; dockable: starts docked at the
// edge and floats once it is moved
//------------------------------------------------------------
export function makeWindow( key: string, el: HTMLElement, handle: HTMLElement, dockable = false ): void
{
    windows[ key ] = { el, dockable };
    handle.classList.add( "dragHandle" );

    handle.addEventListener( "pointerdown", ( e: PointerEvent ) =>
    {
        if ( e.button !== 0 || ( e.target as HTMLElement ).closest( "button, a, input, select, textarea" )) return;
        const box = el.getBoundingClientRect();
        const grabX = e.clientX - box.left, grabY = e.clientY - box.top;
        const wasDocked = !el.classList.contains( "floating" );
        let moved = false;
        handle.setPointerCapture( e.pointerId );

        const move = ( m: PointerEvent ) =>
        {
            if ( !moved && Math.abs( m.clientX - e.clientX ) + Math.abs( m.clientY - e.clientY ) < 4 ) return;
            if ( !moved )
            {
                moved = true;
                el.classList.add( "floating" );
                if ( dockable ) { document.body.classList.add( "panelFloating" ); }
                el.style.width  = box.width  + "px";
                el.style.height = box.height + "px";
                el.style.right  = el.style.bottom = "auto";
                if ( wasDocked ) { window.dispatchEvent( new Event( "resize" )); }
            }
            el.style.left = Math.max( 0, Math.min( window.innerWidth  - 60, m.clientX - grabX )) + "px";
            const top = Math.max( 0, Math.min( window.innerHeight - 30, m.clientY - grabY ));
            el.style.top    = top + "px";
            el.style.height = Math.max( 120, Math.min( box.height, window.innerHeight - top - 4 )) + "px";   // (the corner for resizing stays in view)
        };
        const up = () =>
        {
            handle.removeEventListener( "pointermove", move );
            handle.removeEventListener( "pointerup", up );
            handle.removeEventListener( "pointercancel", up );
            if ( moved ) { remember( key ); }
        };
        handle.addEventListener( "pointermove", move );
        handle.addEventListener( "pointerup", up );
        handle.addEventListener( "pointercancel", up );
    });

    if ( dockable ) { handle.addEventListener( "dblclick", ( e ) => { if ( !( e.target as HTMLElement ).closest( "button, a" )) dock( key ); }); }

    // a window that was dragged by its corner (CSS "resize"): remember the size
    let timer: any = 0;
    new ResizeObserver( () =>
    {
        if ( !el.classList.contains( "floating" )) return;
        clearTimeout( timer );
        timer = setTimeout( () => { if ( el.offsetWidth > 0 ) remember( key ); }, 300 );
    }).observe( el );

    if ( !( key in layout )) { layout = { ...load(), ...layout }; }
    place( key );
}

export function initializeLayout(): void
{
    layout = load();
    const panel = document.getElementById( "masterPanel" )!;
    makeWindow( "panel", panel, document.getElementById( "panelHeader" )!, true );
    const hud = document.getElementById( "hud" )!;
    makeWindow( "hud", hud, hud );
    window.addEventListener( "resize", () => { for ( const key in windows ) { if ( layout[ key ] && windows[ key ].el.classList.contains( "floating" )) place( key ); } });
}

export function resetLayout(): void
{
    layout = {};
    for ( const key in windows ) { dock( key, false ); }
    store();
    window.dispatchEvent( new Event( "resize" ));
}
