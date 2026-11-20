//------------------------------------------------------------------------------
// Галерея существ: reads a folder (or dropped files) of saved creatures and
// shows a real 96x96 picture of each body, made from its genes by Embryology.
// Nothing is spawned until one of the three card buttons is pressed.
//------------------------------------------------------------------------------
import { CreaturePreview, previewFromGenes } from "../simulation/Embryology";
import { NUM_GENES } from "../simulation/Genotype";
import { BYTE_SIZE } from "../simulation/MathConstants";
import { lang } from "./lang";
import { makeWindow } from "./layout";

type Creature = { name: string, genes: number[], preview: CreaturePreview };
type Parsed = { name: string, genes: number[] };

const t = ( en: string, ru: string ) => lang() === "ru" ? ru : en;

let windowEl: HTMLElement | null = null;
let gridEl: HTMLElement | null = null;
let infoEl: HTMLElement | null = null;
let creatures: Creature[] = [];
let initialized = false;

//------------------------------------------------------------
// gene files: JSON with { name, genes }, a bare array, plain
// numbers separated by spaces/commas, or 256 binary bytes.
//------------------------------------------------------------
function cleanName( raw: string, fallback: string ): string
{
    const s = String( raw || "" ).trim().replace( /[\\/:*?"<>|]+/g, "_" ).replace( /\s+/g, " " );
    return s.slice( 0, 48 ) || fallback;
}

function fileStem( name: string ): string
{
    return cleanName( name.replace( /\.[^.]+$/, "" ), "swimbot" );
}

function validGenes( value: any ): number[] | null
{
    if ( !Array.isArray( value ) || value.length !== NUM_GENES ) return null;
    const genes: number[] = [];
    for (let i = 0; i < NUM_GENES; i++)
    {
        const v = value[i];
        if (( typeof v !== "number" ) || !isFinite( v ) || ( Math.floor( v ) !== v ) || ( v < 0 ) || ( v >= BYTE_SIZE )) return null;
        genes.push( v );
    }
    return genes;
}

export function parseCreatureBytes( fileName: string, buffer: ArrayBuffer ): Parsed | null
{
    const bytes = new Uint8Array( buffer );
    if ( bytes.length === NUM_GENES )
    {
        const genes = validGenes( Array.from( bytes ));
        if ( genes ) return { name: fileStem( fileName ), genes };
    }

    const text = new TextDecoder().decode( bytes ).replace( /^\uFEFF/, "" ).trim();
    if ( !text ) return null;
    try
    {
        const data = JSON.parse( text );
        const source = Array.isArray( data ) ? data : ( data && Array.isArray( data.genes )) ? data.genes : null;
        const genes = validGenes( source );
        if ( genes )
        {
            const named = ( !Array.isArray( data ) && typeof data.name === "string" && data.name.trim() ) ? data.name : fileStem( fileName );
            return { name: cleanName( named, fileStem( fileName )), genes };
        }
    }
    catch ( e ) { /* not JSON: try plain numbers */ }

    const parts = text.split( /[\s,;\[\]]+/ ).filter( x => x.length > 0 );
    if ( parts.length === NUM_GENES && parts.every( x => /^\d+$/.test( x )))
    {
        const genes = validGenes( parts.map( x => parseInt( x, 10 )));
        if ( genes ) return { name: fileStem( fileName ), genes };
    }
    return null;
}

//------------------------------------------------------------
// the picture: the same pose style as the species mosaic
//------------------------------------------------------------
function drawPreview( canvas: HTMLCanvasElement, pose: number[] ): void
{
    const g = canvas.getContext( "2d" );
    if ( !g || pose.length === 0 ) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let p = 0; p < pose.length / 8; p++)
    {
        for ( const k of [ 0, 2 ])
        {
            minX = Math.min( minX, pose[p * 8 + k] ); maxX = Math.max( maxX, pose[p * 8 + k] );
            minY = Math.min( minY, pose[p * 8 + k + 1] ); maxY = Math.max( maxY, pose[p * 8 + k + 1] );
        }
    }
    const extent = Math.max( maxX - minX, maxY - minY, 1 );
    const k = 78 / extent;
    const mx = ( minX + maxX ) / 2, my = ( minY + maxY ) / 2;
    g.clearRect( 0, 0, 96, 96 );
    g.lineCap = "round";
    for (let p = 0; p < pose.length / 8; p++)
    {
        const o = p * 8;
        g.strokeStyle = "rgb(" + Math.round( pose[o + 5] * 255 ) + "," + Math.round( pose[o + 6] * 255 ) + "," + Math.round( pose[o + 7] * 255 ) + ")";
        g.lineWidth = Math.max( 1.5, pose[o + 4] * k );
        g.beginPath();
        g.moveTo( 48 + ( pose[o]     - mx ) * k, 48 + ( pose[o + 1] - my ) * k );
        g.lineTo( 48 + ( pose[o + 2] - mx ) * k, 48 + ( pose[o + 3] - my ) * k );
        g.stroke();
    }
}

function note( text: string ): void { if ( infoEl ) infoEl.textContent = text; }

function makeCard( creature: Creature ): HTMLElement
{
    const card = document.createElement( "div" );
    card.className = "cgCard";
    const canvas = document.createElement( "canvas" );
    canvas.width = canvas.height = 96;
    drawPreview( canvas, creature.preview.pose );

    const name = document.createElement( "div" );
    name.className = "cgName"; name.textContent = creature.name; name.title = creature.name;

    const meta = document.createElement( "div" );
    meta.className = "cgMeta";
    meta.textContent = creature.preview.parts + " " + t( "segments", "сегменты" )
        + " · " + creature.genes.length + " " + t( "genes", "гены" )
        + " (" + creature.preview.genesUsed + " " + t( "used", "исп." ) + ")"
        + " · " + ( creature.preview.diet === "predator" ? t( "predator", "хищник" ) : t( "herbivore", "травоядное" ));

    const actions = document.createElement( "div" );
    actions.className = "cgActions";
    const action = ( label: string, run: () => void ) =>
    {
        const b = document.createElement( "button" );
        b.textContent = label; b.onclick = run; actions.appendChild( b );
    };
    action( t( "spawn at centre", "появиться в центре" ), () =>
    {
        genePool.createNewSwimbotWithGenes( creature.genes.slice() );
        note( creature.name );
    });
    action( t( "replace selected", "заменить выбранного" ), () =>
    {
        genePool.replaceSelectedWithGenes( creature.genes.slice() );
        note( creature.name );
    });
    action( t( "spawn herd (10)", "заселить стаю (10 шт.)" ), () =>
    {
        genePool.spawnHerdFromGenes( creature.genes.slice(), 10 );
        note( creature.name + " ×10" );
    });

    card.appendChild( canvas ); card.appendChild( name ); card.appendChild( meta ); card.appendChild( actions );
    return card;
}

function render(): void
{
    if ( !gridEl ) return;
    gridEl.innerHTML = "";
    for ( const creature of creatures ) { gridEl.appendChild( makeCard( creature )); }
    note( creatures.length + " " + t( "creatures", "существ" ));
}

//------------------------------------------------------------
// the window
//------------------------------------------------------------
function build(): HTMLElement
{
    const el = document.createElement( "div" );
    el.id = "creatureGalleryPanel";
    el.innerHTML =
        "<div id='cgTitle'><b>" + t( "Creature gallery", "Галерея существ" ) + "</b>"
        + "<span id='cgInfo'></span><button id='cgClose' title='" + t( "close", "закрыть" ) + "'>&times;</button></div>"
        + "<div id='cgTools'><button id='cgOpenFolder' class='basicButton'>" + t( "Open folder…", "Открыть папку…" ) + "</button>"
        + "<button id='cgOpenFiles' class='basicButton'>" + t( "open files…", "открыть файлы…" ) + "</button></div>"
        + "<div id='cgDrop'></div>"
        + "<div id='cgHint'>" + t( "Drop .dna / .json / .txt files here, or open a folder. Drag and drop works.", "Перетащите сюда файлы .dna / .json / .txt или откройте папку. Работает перетаскивание." ) + "</div>";
    document.body.appendChild( el );
    windowEl = el;
    gridEl = el.querySelector( "#cgDrop" ) as HTMLElement;
    infoEl = el.querySelector( "#cgInfo" ) as HTMLElement;
    ( el.querySelector( "#cgClose" ) as HTMLElement ).onclick = () => el.classList.remove( "open" );
    ( el.querySelector( "#cgOpenFolder" ) as HTMLElement ).onclick = () => { requestCreatureFolder(); };
    ( el.querySelector( "#cgOpenFiles" ) as HTMLElement ).onclick = () =>
    {
        const input = document.getElementById( "loadCreatureFolder" ) as HTMLInputElement;
        input.removeAttribute( "webkitdirectory" );
        input.click();
        input.setAttribute( "webkitdirectory", "webkitdirectory" );
    };

    gridEl.addEventListener( "dragover", ( e: DragEvent ) => { e.preventDefault(); gridEl!.classList.add( "dragging" ); });
    gridEl.addEventListener( "dragleave", () => gridEl!.classList.remove( "dragging" ));
    gridEl.addEventListener( "drop", ( e: DragEvent ) =>
    {
        e.preventDefault(); gridEl!.classList.remove( "dragging" );
        if ( e.dataTransfer ) { addCreatureFiles( Array.from( e.dataTransfer.files )); }
    });
    el.addEventListener( "dragover", ( e: DragEvent ) => e.preventDefault() );
    el.addEventListener( "drop", ( e: DragEvent ) => e.preventDefault() );

    makeWindow( "creatureGallery", el, el.querySelector( "#cgTitle" ) as HTMLElement );
    render();
    return el;
}

//------------------------------------------------------------
// folder / files
//------------------------------------------------------------
async function addCreatureFiles( files: File[] ): Promise<void>
{
    const wanted = /\.(dna|json|txt)$/i;
    let added = 0;
    for ( const file of files )
    {
        if ( !wanted.test( file.name )) continue;
        try
        {
            const parsed = parseCreatureBytes( file.name, await file.arrayBuffer());
            if ( !parsed ) continue;
            creatures.push({ name: parsed.name, genes: parsed.genes, preview: previewFromGenes( parsed.genes )});
            added ++;
        }
        catch ( e ) { /* one bad file must not stop the folder */ }
    }
    if ( added > 0 ) render();
    else note( t( "No valid creatures found", "Подходящих существ не найдено" ));
}

async function readEntries( reader: any ): Promise<any[]>
{
    const all: any[] = [];
    for (;;)
    {
        const batch: any[] = await new Promise( ( resolve ) => reader.readEntries( resolve, () => resolve( [] )));
        if ( batch.length === 0 ) return all;
        all.push( ...batch );
    }
}

async function walkDirectory( entry: any, out: File[] ): Promise<void>
{
    if ( entry.kind === "file" ) { out.push( await entry.getFile()); return; }
    if ( entry.kind !== "directory" ) return;
    if ( typeof entry.values === "function" )
    {
        for await ( const child of entry.values()) { await walkDirectory( child, out ); }
        return;
    }
    if ( typeof entry.createReader === "function" )
    {
        for ( const child of await readEntries( entry.createReader())) { await walkDirectory( child, out ); }
    }
}

export async function requestCreatureFolder(): Promise<void>
{
    if ( !windowEl || !windowEl.classList.contains( "open" )) { openFolderGallery(); return; }
    const picker = ( window as any ).showDirectoryPicker;
    if ( typeof picker === "function" )
    {
        try
        {
            const dir = await picker();
            const files: File[] = [];
            await walkDirectory( dir, files );
            await addCreatureFiles( files );
            return;
        }
        catch ( e )
        {
            if (( e as any )?.name === "AbortError" ) return;
        }
    }
    document.getElementById( "loadCreatureFolder" )!.click();
}

export function openFolderGallery(): void
{
    if ( !windowEl ) { build(); }
    windowEl!.classList.add( "open" );
    if ( creatures.length === 0 ) { requestCreatureFolder(); }
}

export function initializeGallery(): void
{
    if ( initialized ) return;
    initialized = true;
    const folderInput = document.getElementById( "loadCreatureFolder" ) as HTMLInputElement;
    if ( folderInput )
    {
        folderInput.addEventListener( "change", async () =>
        {
            const files = Array.from( folderInput.files || [] );
            folderInput.value = "";
            if ( files.length > 0 ) { openFolderGallery(); await addCreatureFiles( files ); }
        });
    }
    const panel = document.getElementById( "swimbotPanel" );
    if ( panel )
    {
        panel.addEventListener( "dragover", ( e: DragEvent ) => e.preventDefault() );
        panel.addEventListener( "drop", ( e: DragEvent ) =>
        {
            e.preventDefault();
            if ( e.dataTransfer ) { openFolderGallery(); addCreatureFiles( Array.from( e.dataTransfer.files )); }
        });
    }
    window.addEventListener( "genepool:language", () =>
    {
        if ( !windowEl ) return;
        const wasOpen = windowEl.classList.contains( "open" );
        windowEl.remove();
        windowEl = null; gridEl = null; infoEl = null;
        if ( wasOpen ) { build(); windowEl!.classList.add( "open" ); }
    });
}
