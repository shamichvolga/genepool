//------------------------------------------------------------------------------
// The species window: who lives in the pool, as a mosaic. Each piece is one
// species (swimbots with alike genes, see GenePool.getSpeciesView); its area is
// its share of all swimbots. Inside: a live swimbot of that species, the
// count and some numbers. Right click on a piece: download the average genes of
// the species, or destroy it. Updates by itself.
//------------------------------------------------------------------------------
import { lang } from "./lang";
import { makeWindow } from "./layout";

type Species =
{
    id: number, count: number, share: number, meanMass: number, meanParts: number, predatorShare: number, meanEnergy: number,
    color: [ number, number, number ], pose: number[],
};

const POLL_MS = 300;
const t = ( en: string, ru: string ) => lang() === "ru" ? ru : en;

let windowEl: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let menu: HTMLElement | null = null;
let timer: any = 0;
let view: { total: number, species: Species[], other: number } = { total: 0, species: [], other: 0 };
let tiles: { x: number, y: number, w: number, h: number, species: Species }[] = [];

// the simulation runs in its own thread: ask it (or the pool itself, when it runs here)
function ask( name: string, ...args: any[] ): Promise<any>
{
    return genePool.request ? genePool.request( name, ...args ) : Promise.resolve( genePool[ name ]( ...args ));
}

//------------------------------------------------------------
// the mosaic: pieces by area, as square as possible (squarified treemap)
//------------------------------------------------------------
function layoutTiles( items: Species[], x: number, y: number, w: number, h: number )
{
    const out: typeof tiles = [];
    const total = items.reduce( ( a, s ) => a + s.count, 0 );
    if ( total === 0 || w <= 0 || h <= 0 ) return out;
    const scale = w * h / total;
    const rest = items.slice().sort( ( a, b ) => b.count - a.count );

    const worst = ( row: Species[], side: number ) =>
    {
        const sum = row.reduce( ( a, s ) => a + s.count * scale, 0 );
        let worstRatio = 0;
        for ( const s of row ) { const a = s.count * scale; worstRatio = Math.max( worstRatio, Math.max( side * side * a / ( sum * sum ), sum * sum / ( side * side * a ))); }
        return worstRatio;
    };

    while ( rest.length > 0 )
    {
        const side = Math.min( w, h );
        const row: Species[] = [ rest.shift()! ];
        while ( rest.length > 0 && worst( row.concat( rest[0] ), side ) <= worst( row, side )) { row.push( rest.shift()! ); }
        const sum = row.reduce( ( a, s ) => a + s.count * scale, 0 );
        if ( w >= h )
        {
            const colW = sum / h;
            let yy = y;
            for ( const s of row ) { const hh = s.count * scale / colW; out.push({ x, y: yy, w: colW, h: hh, species: s }); yy += hh; }
            x += colW; w -= colW;
        }
        else
        {
            const rowH = sum / w;
            let xx = x;
            for ( const s of row ) { const ww = s.count * scale / rowH; out.push({ x: xx, y, w: ww, h: rowH, species: s }); xx += ww; }
            y += rowH; h -= rowH;
        }
    }
    return out;
}

//------------------------------------------------------------
// a swimbot, from its pose (end points of the parts, as the simulation has them now)
//------------------------------------------------------------
function drawSwimbot( g: CanvasRenderingContext2D, pose: number[], cx: number, cy: number, size: number )
{
    const n = pose.length / 8;
    if ( n === 0 ) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let p = 0; p < n; p++)
    {
        for ( const k of [ 0, 2 ] ) { minX = Math.min( minX, pose[ p * 8 + k ] ); maxX = Math.max( maxX, pose[ p * 8 + k ] ); minY = Math.min( minY, pose[ p * 8 + k + 1 ] ); maxY = Math.max( maxY, pose[ p * 8 + k + 1 ] ); }
    }
    const extent = Math.max( maxX - minX, maxY - minY, 1 );
    const k = size / extent;
    const mx = ( minX + maxX ) / 2, my = ( minY + maxY ) / 2;
    g.lineCap = "round";
    for (let p = 0; p < n; p++)
    {
        const o = p * 8;
        g.strokeStyle = "rgb(" + Math.round( pose[ o + 5 ] * 255 ) + "," + Math.round( pose[ o + 6 ] * 255 ) + "," + Math.round( pose[ o + 7 ] * 255 ) + ")";
        g.lineWidth = Math.max( 2, pose[ o + 4 ] * k );
        g.beginPath();
        g.moveTo( cx + ( pose[ o ] - mx ) * k,     cy + ( pose[ o + 1 ] - my ) * k );
        g.lineTo( cx + ( pose[ o + 2 ] - mx ) * k, cy + ( pose[ o + 3 ] - my ) * k );
        g.stroke();
    }
}

function nameOf( s: Species ): string
{
    if ( s.id === 0 ) return t( "Small ones", "Мелкие виды" );
    return t( "Species ", "Вид " ) + s.id + ( s.predatorShare > 0.5 ? t( " · predators", " · хищники" ) : "" );
}

function draw(): void
{
    if ( !canvas ) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if ( canvas.width !== Math.round( w * ratio ) || canvas.height !== Math.round( h * ratio )) { canvas.width = Math.round( w * ratio ); canvas.height = Math.round( h * ratio ); }
    const g = canvas.getContext( "2d" )!;
    g.setTransform( ratio, 0, 0, ratio, 0, 0 );
    g.clearRect( 0, 0, w, h );

    const gap = 3;
    // the small ones together, so that the mosaic is the whole population
    const shown: Species[] = view.species.slice();
    if ( view.other > 0 ) { shown.push({ id: 0, count: view.other, share: view.other / Math.max( 1, view.total ), meanMass: 0, meanParts: 0, predatorShare: 0, meanEnergy: 0, color: [ 0.2, 0.2, 0.2 ], pose: [] }); }
    tiles = layoutTiles( shown, 0, 0, w, h );
    if ( tiles.length === 0 ) { g.fillStyle = "#666"; g.font = "13px Arial"; g.fillText( t( "no swimbots yet", "пока нет свимботов" ), 12, 24 ); return; }

    for ( const tile of tiles )
    {
        const s = tile.species;
        const x = tile.x + gap / 2, y = tile.y + gap / 2, tw = tile.w - gap, th = tile.h - gap;
        if ( tw < 4 || th < 4 ) continue;
        const [ r, gr, b ] = s.color.map( c => Math.round( 70 + c * 150 ));
        const grad = g.createLinearGradient( x, y, x, y + th );
        grad.addColorStop( 0, "rgb(" + r + "," + gr + "," + b + ")" );
        grad.addColorStop( 1, "rgb(" + Math.round( r * 0.55 ) + "," + Math.round( gr * 0.55 ) + "," + Math.round( b * 0.55 ) + ")" );
        g.fillStyle = grad;
        g.beginPath(); ( g as any ).roundRect( x, y, tw, th, 8 ); g.fill();

        // the swimbot
        const room = Math.min( tw, th );
        if ( room > 60 ) { drawSwimbot( g, s.pose, x + tw / 2, y + th / 2 + 6, Math.min( room * 0.55, 220 )); }

        // the words
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 3;
        g.font = "bold " + ( room > 120 ? 14 : 11 ) + "px Arial";
        g.textBaseline = "top";
        if ( tw > 70 ) { g.fillText( nameOf( s ), x + 8, y + 6, tw - 16 ); }
        g.font = ( room > 120 ? 13 : 11 ) + "px Arial";
        const pct = ( s.share * 100 ).toFixed( s.share < 0.1 ? 1 : 0 ) + "%";
        if ( tw > 70 ) { g.fillText( s.count + " · " + pct, x + 8, y + ( room > 120 ? 24 : 20 ), tw - 16 ); }
        else if ( tw > 30 ) { g.fillText( pct, x + 4, y + 4, tw - 8 ); }
        if ( th > 110 && tw > 130 && s.id !== 0 )
        {
            g.font = "11px Arial";
            g.textBaseline = "bottom";
            g.fillText( t( "mass ", "масса " ) + Math.round( s.meanMass ) + " · " + t( "parts ", "частей " ) + s.meanParts.toFixed( 1 ), x + 8, y + th - 20, tw - 16 );
            g.fillText( t( "energy ", "энергия " ) + Math.round( s.meanEnergy ) + " · " + t( "predators ", "хищников " ) + Math.round( s.predatorShare * 100 ) + "%", x + 8, y + th - 6, tw - 16 );
        }
        g.shadowBlur = 0;
    }
    const title = document.getElementById( "speciesInfo" );
    if ( title )
    {
        title.textContent = view.total + " " + t( "swimbots, ", "свимботов, " ) + view.species.length + " " + t( "species", "видов" )
                          + ( view.other > 0 ? " (+" + view.other + " " + t( "in small ones", "в мелких" ) + ")" : "" );
    }
}

async function poll(): Promise<void>
{
    if ( !windowEl || !windowEl.classList.contains( "open" ) || document.hidden ) return;
    try { view = await ask( "getSpeciesView" ) || view; } catch ( e ) { /* (the thread is busy: next time) */ }
    draw();
}

//------------------------------------------------------------
// the menu on the right button
//------------------------------------------------------------
function hideMenu(): void { if ( menu ) menu.style.display = "none"; }

function showMenu( x: number, y: number, s: Species ): void
{
    if ( !menu )
    {
        menu = document.createElement( "div" );
        menu.id = "speciesMenu";
        document.body.appendChild( menu );
        document.addEventListener( "pointerdown", ( e ) => { if ( menu && !menu.contains( e.target as Node )) hideMenu(); }, true );
        window.addEventListener( "blur", hideMenu );
    }
    menu.innerHTML = "";
    const item = ( text: string, action: () => void, danger = false ) =>
    {
        const b = document.createElement( "button" );
        b.textContent = text;
        if ( danger ) b.className = "danger";
        b.onclick = () => { hideMenu(); action(); };
        menu!.appendChild( b );
    };
    const head = document.createElement( "div" );
    head.textContent = nameOf( s ) + " · " + s.count;
    menu.appendChild( head );
    item( t( "Download average genes", "Скачать средние гены" ), () => downloadGenes( s ));
    item( t( "Destroy this species", "Уничтожить вид" ), () => destroy( s ), true );
    menu.style.display = "flex";
    menu.style.left = Math.min( x, window.innerWidth - 230 ) + "px";
    menu.style.top  = Math.min( y, window.innerHeight - 120 ) + "px";
}

async function downloadGenes( s: Species ): Promise<void>
{
    const genes = await ask( "getSpeciesGenes", s.id );
    if ( !genes ) return;
    const blob = new Blob([ JSON.stringify({ genes }, null, 2 ) ], { type: "application/json" });
    const link = document.createElement( "a" );
    link.href = URL.createObjectURL( blob );
    link.download = "species_" + s.id + "_average_genes.json";
    document.body.appendChild( link );
    link.click();
    link.remove();
    setTimeout( () => URL.revokeObjectURL( link.href ), 10000 );
}

function destroy( s: Species ): void
{
    if ( !confirm( t( "Destroy species " + s.id + " (" + s.count + " swimbots)? This cannot be undone.", "Уничтожить вид " + s.id + " (свимботов: " + s.count + ")? Это нельзя отменить." ))) return;
    genePool.killSpecies( s.id );
    setTimeout( poll, 150 );
}

//------------------------------------------------------------
// the window
//------------------------------------------------------------
function build(): HTMLElement
{
    const el = document.createElement( "div" );
    el.id = "speciesPanel";
    el.innerHTML =
        "<div id='spTitle'><b>" + t( "Dominant species", "Доминирующие виды" ) + "</b> <span id='speciesInfo'></span>"
        + "<button id='spClose' title='" + t( "close", "закрыть" ) + "'>&times;</button></div>"
        + "<canvas id='speciesCanvas'></canvas>"
        + "<div id='spHint'>" + t( "Right click on a piece: genes, destroy. The area is the share of all swimbots.", "Правая кнопка мыши на куске: гены, уничтожить. Площадь — доля всех свимботов." ) + "</div>";
    document.body.appendChild( el );
    canvas = el.querySelector( "#speciesCanvas" ) as HTMLCanvasElement;
    ( el.querySelector( "#spClose" ) as HTMLElement ).onclick = () => toggleSpecies();

    canvas.addEventListener( "contextmenu", ( e ) =>
    {
        e.preventDefault();
        const box = canvas!.getBoundingClientRect();
        const x = e.clientX - box.left, y = e.clientY - box.top;
        const tile = tiles.find( q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h );
        if ( tile && tile.species.id !== 0 ) showMenu( e.clientX, e.clientY, tile.species ); else hideMenu();
    });
    new ResizeObserver( () => draw() ).observe( canvas );
    makeWindow( "species", el, el.querySelector( "#spTitle" ) as HTMLElement );
    return el;
}

export function toggleSpecies(): void
{
    if ( !windowEl ) { windowEl = build(); }
    const open = windowEl.classList.toggle( "open" );
    document.getElementById( "speciesButton" )?.classList.toggle( "activeButton", open );
    clearInterval( timer );
    if ( open ) { timer = setInterval( poll, POLL_MS ); poll(); } else { hideMenu(); }
}

// another language: the window is built again
window.addEventListener( "genepool:language", () =>
{
    if ( !windowEl ) return;
    const wasOpen = windowEl.classList.contains( "open" );
    clearInterval( timer );
    windowEl.remove();
    windowEl = null; canvas = null;
    if ( wasOpen ) { toggleSpecies(); }
});
