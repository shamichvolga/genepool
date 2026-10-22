//------------------------------------------------------------------------------
// The map editor: a special mode, before a new world starts. The pool is a
// grey rectangle; at the side are the tools:
//   pencil   draws the outline of a zone
//   fill     gives a zone what is in it: food (green), meat (red), warm, cold, mild
//   seeder   sprays founders (a cloud of dots, each one a swimbot at the start),
//            with the number of parts chosen
//   barrier  a wall across the pool (the genetic barrier)
//   eraser   (brush) wipes dots and zones under it
// It opens with the map a new world would get anyway ("vanilla": the
// generated temperatures and the three piles of founders by body size), which
// can be changed by hand, or wiped out ("erase all") to draw everything anew.
// Ctrl+Z takes back the last change. Presets keep maps (in the browser, or as
// a file to share). The map is described in src/simulation/MapZones.ts;
// GenePool.startSimulationWithMap starts the world from it.
//------------------------------------------------------------------------------
import { lang } from "./lang";

const PRESETS_KEY = "genepool.mapPresets";
const PILE_SHARES = [ 0.406, 0.3085, 0.2855 ];     // the vanilla piles: share of founders (measured: 812 / 617 / 571 of 2000)
const MAX_UNDO    = 60;

const t = ( en: string, ru: string ) => lang() === "ru" ? ru : en;

let overlay: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let preview: any = null;            // GenePool.getMapPreview: pool size, generated temperatures, gardens
let map: any = null;                // what is being drawn (kept while the page lives)
let fieldImage: HTMLCanvasElement | null = null;
let undo: string[] = [];
let tool = "pencil", fillKind = "plants", sprayParts = 16, sprayDiet = 0, brush = 500, sprayRate = 12;
let stroke: number[] | null = null;
let wall: number[] | null = null;
let mouse: { x: number, y: number } | null = null;
let spraying: any = 0;
let message = "";

function ask( name: string, ...args: any[] ): Promise<any>
{
    return genePool.request ? genePool.request( name, ...args ) : Promise.resolve( genePool[ name ]( ...args ));
}

//------------------------------------------------------------
// maps
//------------------------------------------------------------
function vanillaMap(): any
{
    const seeds: number[] = [];
    for (let c = 0; c < 3; c++)
    {
        const g = preview.gardens[ c % preview.gardens.length ];
        const n = Math.round( preview.numSwimbots * PILE_SHARES[c] );
        for (let k = 0; k < n; k++)
        {
            const a = Math.random() * Math.PI * 2, r = preview.gardenRadius * Math.sqrt( Math.random() );
            seeds.push( g.x + Math.cos( a ) * r, g.y + Math.sin( a ) * r, -( c + 1 ));
        }
    }
    return { version: 1, base: "vanilla", environment: preview.environment, zones: [], seeds, diets: new Array( seeds.length / 3 ).fill( 0 ), barrier: null, partsMin: 3, partsMax: 16 };
}

// a map from a preset or a file made before the diets: one per seed
function normalize( m: any ): any
{
    if ( !Array.isArray( m.diets )) m.diets = [];
    while ( m.diets.length < m.seeds.length / 3 ) m.diets.push( 0 );
    m.diets.length = m.seeds.length / 3;
    return m;
}

function remember(): void
{
    undo.push( JSON.stringify( map ));
    if ( undo.length > MAX_UNDO ) undo.shift();
}

function takeBack(): void
{
    const last = undo.pop();
    if ( last ) { map = normalize( JSON.parse( last )); syncFields(); draw(); }
}

//------------------------------------------------------------
// pool <-> screen
//------------------------------------------------------------
function view()
{
    const size = Math.min( canvas!.clientWidth, canvas!.clientHeight );
    const ox = ( canvas!.clientWidth - size ) / 2, oy = ( canvas!.clientHeight - size ) / 2;
    const k = size / Math.max( preview.width, preview.height );
    return { k, ox, oy, sx: ( x: number ) => ox + ( x - preview.left ) * k, sy: ( y: number ) => oy + ( y - preview.top ) * k };
}

function toPool( e: PointerEvent ): { x: number, y: number }
{
    const box = canvas!.getBoundingClientRect(), v = view();
    const x = preview.left + ( e.clientX - box.left - v.ox ) / v.k, y = preview.top + ( e.clientY - box.top - v.oy ) / v.k;
    return { x: Math.max( preview.left, Math.min( preview.left + preview.width, x )), y: Math.max( preview.top, Math.min( preview.top + preview.height, y )) };
}

//------------------------------------------------------------
// drawing
//------------------------------------------------------------
const ZONE_COLOR: { [ kind: string ]: string } =
{
    plants: "rgba( 70, 190, 70, 0.55 )", meat: "rgba( 210, 50, 50, 0.55 )",
    warm: "rgba( 230, 140, 40, 0.55 )", cold: "rgba( 60, 120, 230, 0.55 )", mild: "rgba( 160, 160, 150, 0.6 )",
};

// the generated temperature map, as a small picture (cold blue .. warm brown)
function makeFieldImage(): void
{
    const n = Math.round( Math.sqrt( preview.field.length ));
    fieldImage = document.createElement( "canvas" );
    fieldImage.width = fieldImage.height = n;
    const g = fieldImage.getContext( "2d" )!;
    const pixels = g.createImageData( n, n );
    for (let k = 0; k < n * n; k++)
    {
        const temp = preview.field[k];
        pixels.data[ k * 4     ] = 95 + temp * 95;
        pixels.data[ k * 4 + 1 ] = 105 + temp * 30;
        pixels.data[ k * 4 + 2 ] = 150 - temp * 80;
        pixels.data[ k * 4 + 3 ] = 255;
    }
    g.putImageData( pixels, 0, 0 );
}

function partsColor( code: number ): string
{
    if ( code < 0 ) return [ "#e8f4ff", "#ffe9b0", "#ffb0b0" ][ Math.min( 2, -code - 1 ) ];
    if ( code === 0 ) return "#ffffff";
    const hue = 220 - ( code - 3 ) / 13 * 220;          // 3 parts blue .. 16 parts red
    return "hsl(" + hue + ", 90%, 62%)";
}

function polygon( g: CanvasRenderingContext2D, points: number[], v ): void
{
    g.beginPath();
    for (let i = 0; i < points.length; i += 2) { const x = v.sx( points[i] ), y = v.sy( points[ i + 1 ] ); if ( i === 0 ) g.moveTo( x, y ); else g.lineTo( x, y ); }
    g.closePath();
}

function draw(): void
{
    if ( !canvas || !preview || !map ) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if ( canvas.width !== Math.round( w * ratio ) || canvas.height !== Math.round( h * ratio )) { canvas.width = Math.round( w * ratio ); canvas.height = Math.round( h * ratio ); }
    const g = canvas.getContext( "2d" )!;
    g.setTransform( ratio, 0, 0, ratio, 0, 0 );
    g.clearRect( 0, 0, w, h );
    const v = view();
    const size = Math.max( preview.width, preview.height ) * v.k;

    // the pool: grey, with the generated temperatures on the vanilla map
    g.fillStyle = "#8a8c84";
    g.fillRect( v.ox, v.oy, size, size );
    if ( map.base === "vanilla" && fieldImage ) { g.imageSmoothingEnabled = true; g.globalAlpha = 0.85; g.drawImage( fieldImage, v.ox, v.oy, size, size ); g.globalAlpha = 1; }
    g.strokeStyle = "#d8d8cc"; g.lineWidth = 1; g.strokeRect( v.ox + 0.5, v.oy + 0.5, size - 1, size - 1 );

    // zones (in the order they were made: later ones on top)
    for ( const z of map.zones )
    {
        polygon( g, z.points, v );
        if ( ZONE_COLOR[ z.kind ] ) { g.fillStyle = ZONE_COLOR[ z.kind ]; g.fill(); }
        g.setLineDash( z.kind === "outline" ? [ 6, 4 ] : [] );
        g.strokeStyle = z.kind === "outline" ? "#ffffff" : "rgba( 255, 255, 255, 0.6 )";
        g.lineWidth = z.kind === "outline" ? 1.5 : 1;
        g.stroke();
        g.setLineDash( [] );
    }

    // founders
    const dot = Math.max( 1.5, Math.min( 3, size / 400 ));
    for (let i = 0; i < map.seeds.length; i += 3)
    {
        const x = v.sx( map.seeds[i] ) - dot / 2, y = v.sy( map.seeds[ i + 1 ] ) - dot / 2;
        const diet = map.diets[ i / 3 ] || 0;
        if ( diet === 2 ) { g.fillStyle = "#000000"; g.fillRect( x - 1, y - 1, dot + 2, dot + 2 ); }     // predators: a black rim
        g.fillStyle = partsColor( map.seeds[ i + 2 ] );
        g.fillRect( x, y, dot, dot );
    }

    // the wall
    const b = map.barrier || ( wall ? { x1: wall[0], y1: wall[1], x2: wall[2], y2: wall[3] } : null );
    if ( b ) { g.strokeStyle = "#ffd84a"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo( v.sx( b.x1 ), v.sy( b.y1 )); g.lineTo( v.sx( b.x2 ), v.sy( b.y2 )); g.stroke(); }

    // the line being drawn, the brush
    if ( stroke && stroke.length >= 4 )
    {
        g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i < stroke.length; i += 2) { const x = v.sx( stroke[i] ), y = v.sy( stroke[ i + 1 ] ); if ( i === 0 ) g.moveTo( x, y ); else g.lineTo( x, y ); }
        g.stroke();
    }
    if ( mouse && ( tool === "seeder" || tool === "eraser" ))
    {
        g.strokeStyle = tool === "eraser" ? "rgba( 255, 120, 120, 0.9 )" : "rgba( 255, 255, 255, 0.8 )";
        g.lineWidth = 1; g.beginPath(); g.arc( v.sx( mouse.x ), v.sy( mouse.y ), brush * v.k, 0, Math.PI * 2 ); g.stroke();
    }

    // counts
    const info = document.getElementById( "meInfo" );
    if ( info )
    {
        const n = map.seeds.length / 3;
        const predators = map.diets.filter( ( d: number ) => d === 2 ).length, herbivores = map.diets.filter( ( d: number ) => d === 1 ).length;
        info.textContent = t( "Founders: ", "Существ: " ) + n + t( " of ", " из " ) + preview.maxSwimbots
            + (( predators + herbivores > 0 ) ? " (" + t( "herbivores ", "травоядных " ) + herbivores + ", " + t( "predators ", "хищников " ) + predators + ")" : "" )
            + " · " + t( "zones: ", "зон: " ) + map.zones.length + ( map.barrier ? t( " · wall", " · барьер" ) : "" )
            + ( map.base === "blank" ? t( " · blank map", " · чистая карта" ) : "" );
    }
    const note = document.getElementById( "meMessage" );
    if ( note ) note.textContent = message;
}

//------------------------------------------------------------
// the tools
//------------------------------------------------------------
function zoneAt( p: { x: number, y: number } ): any
{
    for (let i = map.zones.length - 1; i >= 0; i--) { if ( inside( p.x, p.y, map.zones[i].points )) return map.zones[i]; }
    return null;
}

function inside( x: number, y: number, pts: number[] ): boolean
{
    let c = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2)
    {
        if ((( pts[ i + 1 ] > y ) !== ( pts[ j + 1 ] > y )) && ( x < ( pts[j] - pts[i] ) * ( y - pts[ i + 1 ] ) / ( pts[ j + 1 ] - pts[ i + 1 ] ) + pts[i] )) c = !c;
    }
    return c;
}

function spray(): void
{
    if ( !mouse ) return;
    const free = preview.maxSwimbots - map.seeds.length / 3;
    if ( free <= 0 ) { message = t( "No more room: the pool holds ", "Больше нельзя: бассейн вмещает " ) + preview.maxSwimbots + "."; draw(); return; }
    for (let k = 0; k < Math.min( sprayRate, free ); k++)
    {
        const a = Math.random() * Math.PI * 2, r = brush * Math.sqrt( Math.random() );
        const x = Math.max( preview.left + 20, Math.min( preview.left + preview.width - 20, mouse.x + Math.cos( a ) * r ));
        const y = Math.max( preview.top + 20, Math.min( preview.top + preview.height - 20, mouse.y + Math.sin( a ) * r ));
        map.seeds.push( x, y, sprayParts );
        map.diets.push( sprayDiet );
    }
    draw();
}

function rub(): void
{
    if ( !mouse ) return;
    const kept: number[] = [], keptDiets: number[] = [], r2 = brush * brush;
    for (let i = 0; i < map.seeds.length; i += 3)
    {
        const dx = map.seeds[i] - mouse.x, dy = map.seeds[ i + 1 ] - mouse.y;
        if ( dx * dx + dy * dy > r2 ) { kept.push( map.seeds[i], map.seeds[ i + 1 ], map.seeds[ i + 2 ] ); keptDiets.push( map.diets[ i / 3 ] || 0 ); }
    }
    map.seeds = kept;
    map.diets = keptDiets;
    map.zones = map.zones.filter( z => !inside( mouse!.x, mouse!.y, z.points ));
    draw();
}

function onDown( e: PointerEvent ): void
{
    if ( e.button !== 0 ) return;
    try { canvas!.setPointerCapture( e.pointerId ); } catch ( err ) { /* (an event made by a script: no real pointer) */ }
    const p = toPool( e );
    mouse = p;
    message = "";
    if ( tool === "pencil" ) { stroke = [ p.x, p.y ]; }
    else if ( tool === "fill" )
    {
        const z = zoneAt( p );
        if ( !z ) { message = t( "Click inside a zone outlined with the pencil.", "Щёлкните внутри зоны, обведённой карандашом." ); draw(); return; }
        remember(); z.kind = fillKind; draw();
    }
    else if ( tool === "seeder" ) { remember(); spray(); clearInterval( spraying ); spraying = setInterval( spray, 50 ); }
    else if ( tool === "wall" ) { wall = [ p.x, p.y, p.x, p.y ]; }
    else if ( tool === "eraser" ) { remember(); rub(); }
}

function onMove( e: PointerEvent ): void
{
    if ( !preview ) return;
    const p = toPool( e );
    mouse = p;
    if ( stroke )
    {
        const lx = stroke[ stroke.length - 2 ], ly = stroke[ stroke.length - 1 ];
        if ( Math.hypot( p.x - lx, p.y - ly ) * view().k > 4 ) stroke.push( p.x, p.y );
    }
    if ( wall ) { wall[2] = p.x; wall[3] = p.y; }
    if (( e.buttons & 1 ) && tool === "eraser" ) { rub(); return; }
    draw();
}

function onUp(): void
{
    clearInterval( spraying ); spraying = 0;
    if ( stroke )
    {
        if ( stroke.length >= 8 ) { remember(); map.zones.push({ kind: "outline", points: stroke }); message = t( "Now take the fill and click inside the outline.", "Теперь возьмите заливку и щёлкните внутри контура." ); }
        stroke = null;
    }
    if ( wall )
    {
        if ( Math.hypot( wall[2] - wall[0], wall[3] - wall[1] ) > 50 ) { remember(); map.barrier = { x1: wall[0], y1: wall[1], x2: wall[2], y2: wall[3] }; }
        wall = null;
    }
    draw();
}

//------------------------------------------------------------
// presets: in the browser, or as a file
//------------------------------------------------------------
function presets(): any { try { return JSON.parse( localStorage.getItem( PRESETS_KEY ) || "{}" ) || {}; } catch ( e ) { return {}; } }

function fillPresets( chosen = "" ): void
{
    const select = document.getElementById( "mePresets" ) as HTMLSelectElement;
    select.innerHTML = "";
    const none = document.createElement( "option" ); none.value = ""; none.textContent = t( "— preset —", "— пресет —" ); select.appendChild( none );
    for ( const name of Object.keys( presets() )) { const o = document.createElement( "option" ); o.value = o.textContent = name; select.appendChild( o ); }
    select.value = chosen;
}

function savePreset(): void
{
    const name = ( prompt( t( "Name of the map preset:", "Название пресета карты:" ), "" ) || "" ).trim();
    if ( name === "" ) return;
    const all = presets();
    all[ name ] = map;
    try { localStorage.setItem( PRESETS_KEY, JSON.stringify( all )); }
    catch ( e ) { message = t( "The browser has no room for it: download it as a file.", "В браузере нет места: скачайте карту файлом." ); draw(); return; }
    fillPresets( name );
}

function loadPreset( name: string ): void
{
    const m = presets()[ name ];
    if ( !m ) return;
    remember(); map = normalize( JSON.parse( JSON.stringify( m ))); syncFields(); draw();
}

function deletePreset(): void
{
    const name = ( document.getElementById( "mePresets" ) as HTMLSelectElement ).value;
    if ( name === "" || !confirm( t( "Delete the preset " + name + "?", "Удалить пресет " + name + "?" ))) return;
    const all = presets(); delete all[ name ];
    try { localStorage.setItem( PRESETS_KEY, JSON.stringify( all )); } catch ( e ) { /* (no storage) */ }
    fillPresets();
}

function downloadMap(): void
{
    const link = document.createElement( "a" );
    link.href = URL.createObjectURL( new Blob([ JSON.stringify( map ) ], { type: "application/json" }));
    link.download = "genepool_map.json";
    document.body.appendChild( link ); link.click(); link.remove();
    setTimeout( () => URL.revokeObjectURL( link.href ), 10000 );
}

function uploadMap( file: File ): void
{
    file.text().then( ( text ) =>
    {
        try
        {
            const m = JSON.parse( text );
            if ( !m || !Array.isArray( m.seeds ) || !Array.isArray( m.zones )) throw new Error( "no map" );
            remember(); map = normalize( m ); syncFields(); draw();
        }
        catch ( e ) { message = t( "This file is not a map.", "Этот файл — не карта." ); draw(); }
    });
}

//------------------------------------------------------------
// the window
//------------------------------------------------------------
function button( id: string, text: string, title = "" ): string { return "<button id='" + id + "' title='" + title + "'>" + text + "</button>"; }

function build(): void
{
    overlay = document.createElement( "div" );
    overlay.id = "mapEditor";
    const partsOptions = "<option value='0'>" + t( "random (in the range)", "случайно (в диапазоне)" ) + "</option>"
        + Array.from({ length: 14 }, ( _, i ) => "<option value='" + ( i + 3 ) + "'>" + ( i + 3 ) + "</option>" ).join( "" );
    overlay.innerHTML =
        "<div id='meBox'><canvas id='meCanvas'></canvas></div>"
        + "<div id='meTools'>"
        +   "<div class='meTitle'>" + t( "Map editor", "Редактор карты" ) + "</div>"
        +   "<div class='meHead'>" + t( "Tools", "Инструменты" ) + "</div>"
        +   "<div class='meGrid' id='meToolButtons'>"
        +     button( "meTool-pencil", "&#x270F;&#xFE0F; " + t( "pencil", "карандаш" ), t( "draw the outline of a zone", "обвести зону" ))
        +     button( "meTool-fill", "&#x1FAA3; " + t( "fill", "заливка" ), t( "fill a zone outlined with the pencil", "залить обведённую зону" ))
        +     button( "meTool-seeder", "&#x1F331; " + t( "seeder", "сеялка" ), t( "spray founders: each dot is a swimbot at the start", "распылить существ: каждая точка — существо при старте" ))
        +     button( "meTool-wall", "&#x1F9F1; " + t( "barrier", "барьер" ), t( "a wall across the pool (genetic barrier)", "стена поперёк бассейна (генетический барьер)" ))
        +     button( "meTool-eraser", "&#x1F9FD; " + t( "rubber", "стёрка" ), t( "wipe dots and zones under the brush", "стереть точки и зоны под кистью" ))
        +   "</div>"
        +   "<div class='meHead'>" + t( "Fill with", "Чем заливать" ) + "</div>"
        +   "<div class='meGrid' id='meFillButtons'>"
        +     button( "meFill-plants", "<i style='background:#46be46'></i>" + t( "food", "еда" ), t( "plants grow here at the normal density (on a blank map: only here)", "здесь растут растения обычной плотности (на чистой карте — только здесь)" ))
        +     button( "meFill-meat", "<i style='background:#d23232'></i>" + t( "meat", "мясо" ), t( "only meat here: at the start and falling as fast as it rots", "здесь только мясо: при старте и потом, сколько сгнило" ))
        +     button( "meFill-warm", "<i style='background:#e68c28'></i>" + t( "warm", "тепло" ), "" )
        +     button( "meFill-cold", "<i style='background:#3c78e6'></i>" + t( "cold", "холод" ), "" )
        +     button( "meFill-mild", "<i style='background:#a0a096'></i>" + t( "mild", "умеренно" ), "" )
        +   "</div>"
        +   "<div class='meHead'>" + t( "Seeder", "Сеялка" ) + "</div>"
        +   "<label>" + t( "parts", "члеников" ) + " <select id='meParts'>" + partsOptions + "</select></label>"
        +   "<label>" + t( "diet", "питание" ) + " <select id='meDiet'><option value='0'>" + t( "as usual (a tenth predators)", "как обычно (десятая часть — хищники)" ) + "</option>"
        +     "<option value='1'>" + t( "herbivores only", "только травоядные" ) + "</option><option value='2'>" + t( "predators only", "только хищники" ) + "</option></select></label>"
        +   "<label>" + t( "brush", "кисть" ) + " <input id='meBrush' type='range' min='50' max='3000' step='50'></label>"
        +   "<label>" + t( "density", "плотность" ) + " <input id='meRate' type='range' min='1' max='60' step='1'></label>"
        +   "<div class='meHead'>" + t( "Parts of the random founders", "Членики случайных существ" ) + "</div>"
        +   "<label>" + t( "from", "от" ) + " <input id='mePartsMin' type='number' min='3' max='16'> " + t( "to", "до" ) + " <input id='mePartsMax' type='number' min='3' max='16'></label>"
        +   "<div class='meHead'>" + t( "Map", "Карта" ) + "</div>"
        +   "<div class='meGrid'>"
        +     button( "meUndo", "&#x21B6; " + t( "undo", "отменить" ), "Ctrl+Z" )
        +     button( "meVanilla", t( "vanilla map", "ванильная карта" ), t( "the map a new world would get anyway", "карта, которую новый мир получил бы сам" ))
        +     button( "meClear", "&#x1F9FD; " + t( "erase all", "ластик: всё" ), t( "wipe everything and draw it yourself", "стереть всё и нарисовать самому" ))
        +   "</div>"
        +   "<div class='meHead'>" + t( "Presets", "Пресеты" ) + "</div>"
        +   "<select id='mePresets'></select>"
        +   "<div class='meGrid'>"
        +     button( "meSavePreset", t( "save preset", "сохранить пресет" ))
        +     button( "meDeletePreset", "&#x1F5D1;", t( "delete the chosen preset", "удалить выбранный пресет" ))
        +     button( "meDownload", t( "download file", "скачать файл" ), t( "the map as a file, to share", "карта файлом, чтобы поделиться" ))
        +     button( "meUpload", t( "load file…", "загрузить файл…" ))
        +   "</div>"
        +   "<input id='meFile' type='file' accept='.json' style='display:none'>"
        +   "<div id='meInfo'></div><div id='meMessage'></div>"
        +   "<button id='meStart' class='meBig'>&#x25B6; " + t( "start the world on this map", "начать мир по этой карте" ) + "</button>"
        +   "<button id='meClose'>" + t( "close", "закрыть" ) + "</button>"
        + "</div>";
    document.body.appendChild( overlay );
    canvas = overlay.querySelector( "#meCanvas" ) as HTMLCanvasElement;
    canvas.addEventListener( "pointerdown", onDown );
    canvas.addEventListener( "pointermove", onMove );
    canvas.addEventListener( "pointerup", onUp );
    canvas.addEventListener( "pointercancel", onUp );
    canvas.addEventListener( "pointerleave", () => { mouse = null; draw(); });
    new ResizeObserver( () => draw() ).observe( canvas );

    const on = ( id: string, handler: () => void ) => { ( overlay!.querySelector( "#" + id ) as HTMLElement ).onclick = handler; };
    for ( const name of [ "pencil", "fill", "seeder", "wall", "eraser" ] ) { on( "meTool-" + name, () => { tool = name; message = ""; syncFields(); draw(); }); }
    for ( const kind of [ "plants", "meat", "warm", "cold", "mild" ] ) { on( "meFill-" + kind, () => { fillKind = kind; tool = "fill"; syncFields(); draw(); }); }
    on( "meUndo", takeBack );
    on( "meVanilla", () => { remember(); map = vanillaMap(); syncFields(); draw(); });
    on( "meClear", () => { remember(); map = { ...map, base: "blank", zones: [], seeds: [], diets: [], barrier: null }; message = t( "A blank map: no food and no swimbots until you draw them.", "Чистая карта: ни еды, ни существ, пока вы их не нарисуете." ); draw(); });
    on( "meSavePreset", savePreset );
    on( "meDeletePreset", deletePreset );
    on( "meDownload", downloadMap );
    on( "meUpload", () => ( overlay!.querySelector( "#meFile" ) as HTMLInputElement ).click() );
    ( overlay.querySelector( "#meFile" ) as HTMLInputElement ).onchange = ( e ) => { const f = ( e.target as HTMLInputElement ).files?.[0]; if ( f ) uploadMap( f ); ( e.target as HTMLInputElement ).value = ""; };
    ( overlay.querySelector( "#mePresets" ) as HTMLSelectElement ).onchange = ( e ) => { const v = ( e.target as HTMLSelectElement ).value; if ( v ) loadPreset( v ); };
    ( overlay.querySelector( "#meParts" ) as HTMLSelectElement ).onchange = ( e ) => { sprayParts = Number(( e.target as HTMLSelectElement ).value ); tool = "seeder"; syncFields(); };
    ( overlay.querySelector( "#meDiet" ) as HTMLSelectElement ).onchange = ( e ) => { sprayDiet = Number(( e.target as HTMLSelectElement ).value ); tool = "seeder"; syncFields(); };
    ( overlay.querySelector( "#meBrush" ) as HTMLInputElement ).oninput = ( e ) => { brush = Number(( e.target as HTMLInputElement ).value ); draw(); };
    ( overlay.querySelector( "#meRate" ) as HTMLInputElement ).oninput = ( e ) => { sprayRate = Number(( e.target as HTMLInputElement ).value ); };
    const range = () =>
    {
        const a = Math.max( 3, Math.min( 16, Math.round( Number(( overlay!.querySelector( "#mePartsMin" ) as HTMLInputElement ).value ) || 3 )));
        const b = Math.max( 3, Math.min( 16, Math.round( Number(( overlay!.querySelector( "#mePartsMax" ) as HTMLInputElement ).value ) || 16 )));
        remember(); map.partsMin = Math.min( a, b ); map.partsMax = Math.max( a, b ); syncFields();
    };
    ( overlay.querySelector( "#mePartsMin" ) as HTMLInputElement ).onchange = range;
    ( overlay.querySelector( "#mePartsMax" ) as HTMLInputElement ).onchange = range;
    on( "meStart", start );
    on( "meClose", closeMapEditor );
    fillPresets();
}

// the fields and the pressed buttons show what is chosen
function syncFields(): void
{
    if ( !overlay ) return;
    for ( const name of [ "pencil", "fill", "seeder", "wall", "eraser" ] ) { overlay.querySelector( "#meTool-" + name )!.classList.toggle( "on", tool === name ); }
    for ( const kind of [ "plants", "meat", "warm", "cold", "mild" ] ) { overlay.querySelector( "#meFill-" + kind )!.classList.toggle( "on", fillKind === kind ); }
    ( overlay.querySelector( "#meParts" ) as HTMLSelectElement ).value = String( sprayParts );
    ( overlay.querySelector( "#meDiet" ) as HTMLSelectElement ).value = String( sprayDiet );
    ( overlay.querySelector( "#meBrush" ) as HTMLInputElement ).value = String( brush );
    ( overlay.querySelector( "#meRate" ) as HTMLInputElement ).value = String( sprayRate );
    if ( map )
    {
        ( overlay.querySelector( "#mePartsMin" ) as HTMLInputElement ).value = String( map.partsMin );
        ( overlay.querySelector( "#mePartsMax" ) as HTMLInputElement ).value = String( map.partsMax );
    }
}

function start(): void
{
    if ( map.seeds.length === 0 && !confirm( t( "There are no swimbots on the map. Start an empty world?", "На карте нет существ. Начать пустой мир?" ))) return;
    genePool.startSimulationWithMap( JSON.parse( JSON.stringify( map )));
    closeMapEditor();
}

// keys while the editor is open: Ctrl+Z, Escape; the pool's own keys wait
function onKey( e: KeyboardEvent ): void
{
    if ( !overlay || !overlay.classList.contains( "open" )) return;
    e.stopPropagation();
    const typing = ( e.target as HTMLElement ).closest?.( "input, select, textarea" );
    if (( e.ctrlKey || e.metaKey ) && ( e.key === "z" || e.key === "Z" || e.code === "KeyZ" ) && !typing ) { e.preventDefault(); takeBack(); }
    else if ( e.key === "Escape" ) { closeMapEditor(); }
}

export async function openMapEditor(): Promise<void>
{
    if ( !overlay ) { build(); window.addEventListener( "keydown", onKey, true ); }
    overlay!.classList.add( "open" );
    if ( !preview )
    {
        message = t( "Making the map…", "Готовлю карту…" );
        preview = await ask( "getMapPreview" );
        makeFieldImage();
        map = vanillaMap();
        undo = [];
        message = t( "This is the map a new world would get. Change it, or erase all and draw your own.", "Это карта, которую новый мир получил бы сам. Измените её или сотрите всё и нарисуйте свою." );
    }
    syncFields();
    draw();
}

export function closeMapEditor(): void
{
    if ( overlay ) overlay.classList.remove( "open" );
    clearInterval( spraying ); spraying = 0;
}

// another language: the tools are built again (the map stays)
window.addEventListener( "genepool:language", () =>
{
    if ( !overlay ) return;
    const wasOpen = overlay.classList.contains( "open" );
    overlay.remove(); overlay = null; canvas = null;
    window.removeEventListener( "keydown", onKey, true );
    if ( wasOpen ) openMapEditor();
});
