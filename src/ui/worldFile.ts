//------------------------------------------------------------------------------
// The buttons "save world" / "load world": the whole world (every swimbot and
// plant, diseases, climate, the clock, the random numbers) goes to a .gpworld
// file (gzip) and comes back to continue exactly where it was.
// A file of another world size: it is kept in the browser (IndexedDB), the page
// reloads with that size (?world=N) and loads it as soon as it starts.
// See GenePool.saveWorld / loadWorld and docs/схема_сохранения_мира.md.
//------------------------------------------------------------------------------
import { lang } from "./lang";

const DB_NAME = "genepool-world", STORE = "pending", KEY = "file";
const t = ( en: string, ru: string ) => lang() === "ru" ? ru : en;

//------------------------------------------------------------
// a short message over the pool
//------------------------------------------------------------
function toast( text: string, ms = 7000 ): void
{
    let box = document.getElementById( "worldToast" );
    if ( !box )
    {
        box = document.createElement( "div" );
        box.id = "worldToast";
        box.style.cssText = "position:fixed; top:10px; left:50%; transform:translateX(-50%); z-index:1000; max-width:90vw; padding:8px 14px;"
            + "background:rgba(30,40,50,0.92); color:#eef; font:13px/1.4 Arial,sans-serif; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.4);";
        document.body.appendChild( box );
    }
    box.textContent = text;
    box.style.display = "block";
    clearTimeout(( box as any ).hideTimer );
    ( box as any ).hideTimer = setTimeout( () => { box!.style.display = "none"; }, ms );
}

//------------------------------------------------------------
// a world kept for the reload with another size
//------------------------------------------------------------
function openDb(): Promise<IDBDatabase>
{
    return new Promise( ( resolve, reject ) =>
    {
        const r = indexedDB.open( DB_NAME, 1 );
        r.onupgradeneeded = () => r.result.createObjectStore( STORE );
        r.onsuccess = () => resolve( r.result );
        r.onerror   = () => reject( r.error );
    });
}
async function keep( mode: IDBTransactionMode, work: ( s: IDBObjectStore ) => IDBRequest ): Promise<any>
{
    const db = await openDb();
    return new Promise( ( resolve, reject ) =>
    {
        const request = work( db.transaction( STORE, mode ).objectStore( STORE ));
        request.onsuccess = () => resolve( request.result );
        request.onerror   = () => reject( request.error );
    });
}

//------------------------------------------------------------
// gzip on this page (when the simulation runs here and not in its thread)
//------------------------------------------------------------
async function pipe( bytes: Uint8Array, stream: any ): Promise<Uint8Array>
{
    return new Uint8Array( await new Response( new Blob([ bytes ]).stream().pipeThrough( stream )).arrayBuffer() );
}

//------------------------------------------------------------
// save
//------------------------------------------------------------
export async function saveWorldToFile(): Promise<void>
{
    const withTree = ( document.getElementById( "worldWithTree" ) as HTMLInputElement | null )?.checked !== false;
    toast( t( "Saving the world…", "Сохраняю мир…" ), 60000 );
    let bytes: Uint8Array, clock: number;
    try
    {
        if ( genePool.saveWorldFile ) { const r = await genePool.saveWorldFile( withTree ); if ( r.error ) throw new Error( r.error ); bytes = r.bytes; clock = r.clock; }
        else { bytes = await pipe( genePool.saveWorld( withTree ), new ( window as any ).CompressionStream( "gzip" )); clock = genePool.getTimeStep(); }
    }
    catch ( error )
    {
        toast( t( "Could not save the world: ", "Не удалось сохранить мир: " ) + error );
        return;
    }
    const d = new Date(), two = ( n: number ) => String( n ).padStart( 2, "0" );
    const name = "genepool_" + d.getFullYear() + two( d.getMonth() + 1 ) + two( d.getDate() ) + "_" + two( d.getHours() ) + two( d.getMinutes() ) + "_step" + clock + ".gpworld";
    const link = document.createElement( "a" );
    link.href = URL.createObjectURL( new Blob([ bytes ], { type: "application/octet-stream" }));
    link.download = name;
    document.body.appendChild( link );
    link.click();
    link.remove();
    setTimeout( () => URL.revokeObjectURL( link.href ), 10000 );
    toast( t( "World saved: ", "Мир сохранён: " ) + name + " (" + ( bytes.length / 1048576 ).toFixed( 1 ) + " MB)" );
}

//------------------------------------------------------------
// load
//------------------------------------------------------------
export function chooseWorldFile(): void
{
    document.getElementById( "loadWorldFile" )!.click();
}

async function sendToSimulation( bytes: Uint8Array ): Promise<any>
{
    if ( genePool.loadWorldFile ) { return genePool.loadWorldFile( bytes ); }
    const raw = ( bytes[0] === 0x1f && bytes[1] === 0x8b ) ? await pipe( bytes, new ( window as any ).DecompressionStream( "gzip" )) : bytes;
    return genePool.loadWorld( raw );
}

async function loadWorldBytes( bytes: Uint8Array ): Promise<void>
{
    toast( t( "Loading the world…", "Загружаю мир…" ), 60000 );
    const copy = bytes.slice();                                  // (the simulation thread takes the one it is given)
    const result = await sendToSimulation( bytes );
    if ( result.ok )
    {
        let text = t( "World loaded: step ", "Мир загружен: шаг " ) + result.clock + ".";
        if ( result.mismatches && result.mismatches.length > 0 ) { text += t( " Not the same in: ", " Не совпало: " ) + result.mismatches.join( ", " ) + "."; }
        if ( /\+|-dev|headless/.test( String( result.code )) || result.code === "unknown" ) { text += t( " (saved by changing code: may not go on exactly)", " (сохранено на меняющемся коде: продолжение может отличаться)" ); }
        toast( text );
        return;
    }
    if ( result.needWorld )
    {
        // another size of the world: keep the file, reload with that size
        try { await keep( "readwrite", ( s ) => s.put( copy, KEY )); }
        catch ( error ) { toast( t( "Could not keep the file for the reload: ", "Не удалось сохранить файл на перезагрузку: " ) + error ); return; }
        toast( t( "The file is from another world size: reloading…", "Файл из мира другого размера: перезагружаю…" ), 60000 );
        location.search = "?world=" + result.needWorld;
        return;
    }
    toast( t( "Could not load: ", "Не удалось загрузить: " ) + result.reason, 12000 );
}

//------------------------------------------------------------
// the page: the hidden file field, and a world kept for this reload
//------------------------------------------------------------
export function setupWorldFile(): void
{
    const input = document.getElementById( "loadWorldFile" ) as HTMLInputElement;
    input.addEventListener( "change", async () =>
    {
        const file = input.files && input.files[0];
        input.value = "";
        if ( file ) { await loadWorldBytes( new Uint8Array( await file.arrayBuffer() )); }
    });
    resumeKeptWorld();
}

async function resumeKeptWorld(): Promise<void>
{
    let bytes: Uint8Array | null = null;
    try
    {
        bytes = await keep( "readonly", ( s ) => s.get( KEY ));
        if ( bytes ) { await keep( "readwrite", ( s ) => s.delete( KEY )); }
    }
    catch ( error ) { return; }
    if ( !bytes ) return;
    for ( let i = 0; i < 200; i++ )
    {
        if (( typeof genePool !== "undefined" ) && ( genePool.getTimeStep() > 0 )) break;
        await new Promise( ( r ) => setTimeout( r, 100 ));
    }
    await loadWorldBytes( new Uint8Array( bytes ));
}
