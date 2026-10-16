//------------------------------------------------------------------------------
// Development mode ("Запустить GenePool.bat"): a change in the code no longer
// restarts the running world. The dev server only says "the code changed"
// (see vite.config.ts), and a small banner offers:
//   - apply, keeping the world: the population is saved in the browser
//     (IndexedDB), the page reloads with the new code and the world goes on;
//   - apply from scratch: a plain reload;
//   - later: the banner goes away until the next change.
// In the built version (the "долгий прогон" launcher) none of this exists.
//------------------------------------------------------------------------------
const DB_NAME = "genepool-dev", STORE = "resume", KEY = "world";
const MAX_AGE_MS = 30 * 60 * 1000;   // an older saved world is not resumed

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
async function store( mode: IDBTransactionMode, work: ( s: IDBObjectStore ) => IDBRequest ): Promise<any>
{
    const db = await openDb();
    return new Promise( ( resolve, reject ) =>
    {
        const request = work( db.transaction( STORE, mode ).objectStore( STORE ));
        request.onsuccess = () => resolve( request.result );
        request.onerror   = () => reject( request.error );
    });
}

//------------------------------------------------------------------------------
// the banner
//------------------------------------------------------------------------------
let changedFiles: string[] = [];

function banner(): HTMLElement
{
    let b = document.getElementById( "codeChangedBanner" );
    if ( b ) return b;
    b = document.createElement( "div" );
    b.id = "codeChangedBanner";
    b.style.cssText = "position:fixed; top:8px; left:50%; transform:translateX(-50%); z-index:1000; max-width:92vw;"
        + "background:rgba(30,40,50,0.92); color:#eef; font:14px/1.4 system-ui,sans-serif; padding:8px 12px; border-radius:8px;"
        + "box-shadow:0 2px 10px rgba(0,0,0,0.4); display:flex; gap:8px; align-items:center; flex-wrap:wrap;";
    document.body.appendChild( b );
    return b;
}

function button( text: string, title: string, action: () => void ): HTMLButtonElement
{
    const k = document.createElement( "button" );
    k.textContent = text;
    k.title = title;
    k.style.cssText = "font:inherit; padding:3px 10px; border-radius:6px; border:1px solid #9ab; background:#dde6ee; color:#123; cursor:pointer;";
    k.onclick = action;
    return k;
}

function showChanged( file: string )
{
    if ( !changedFiles.includes( file )) { changedFiles.push( file ); }
    const b = banner();
    b.innerHTML = "";
    const text = document.createElement( "span" );
    text.textContent = "Код изменился (" + changedFiles.slice( -3 ).join( ", " ) + ( changedFiles.length > 3 ? "…" : "" ) + ").";
    b.append( text,
        button( "применить, сохранив мир", "сохранить популяцию, перезагрузить страницу с новым кодом и продолжить", applyKeepingWorld ),
        button( "применить с нуля", "перезагрузить страницу: новый мир", () => location.reload() ),
        button( "позже", "убрать до следующего изменения", () => { b.remove(); }));
}

async function applyKeepingWorld()
{
    const b = banner();
    b.textContent = "Сохраняю мир…";
    try
    {
        const pool = await genePool.request( "getPoolData" );
        await store( "readwrite", ( s ) => s.put({ time: Date.now(), pool }, KEY ));
    }
    catch ( error )
    {
        console.error( "could not keep the world:", error );
        b.textContent = "Не удалось сохранить мир — перезагружаю с нуля.";
    }
    location.reload();
}

function toast( text: string )
{
    const b = banner();
    b.textContent = text;
    setTimeout( () => b.remove(), 6000 );
}

//------------------------------------------------------------------------------
// at start: listen for code changes; bring back a world saved just before
//------------------------------------------------------------------------------
export function setupDevResume(): void
{
    const hot = ( import.meta as any ).hot;
    if ( !hot ) return;
    hot.on( "genepool:code-changed", ( data: { file: string } ) => showChanged( data.file ));
    resumeSavedWorld();
}

async function resumeSavedWorld()
{
    let saved = null;
    try
    {
        saved = await store( "readonly", ( s ) => s.get( KEY ));
        if ( saved ) { await store( "readwrite", ( s ) => s.delete( KEY )); }
    }
    catch ( error ) { return; }
    if ( !saved || ( Date.now() - saved.time > MAX_AGE_MS )) return;

    // wait until the simulation answers (in its own thread it starts a moment later)
    for ( let i = 0; i < 200; i++ )
    {
        if (( typeof genePool !== "undefined" ) && ( genePool.getTimeStep() > 0 )) break;
        await new Promise( ( r ) => setTimeout( r, 100 ));
    }
    genePool.setPoolData( saved.pool );
    toast( "Мир продолжен на новом коде (шаг " + ( saved.pool.clock || "?" ) + ", существ " + ( saved.pool.numSwimbots || "?" ) + ")." );
}
