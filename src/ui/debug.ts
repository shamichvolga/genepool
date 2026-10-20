//------------------------------------------------------------------------------
// Debug mode: a window with every number of Parameters.ts. A number is changed
// in its box; the check mark sends the changes to the running simulation
// (src/simulation/ParamStore.ts). Presets keep the changed numbers together
// with the layout of the windows (layout.ts); the settings of the last
// session are applied at the next start.
//------------------------------------------------------------------------------
import { PARAM_DEFAULTS, PARAM_LIST } from "../simulation/ParamStore";
import { lang } from "./lang";
import { applyLayout, getLayout, makeWindow, resetLayout } from "./layout";

const KEY_PARAMS  = "genepool.params";       // the numbers that differ from the code's: the last session
const KEY_PRESETS = "genepool.presets";      // name -> { params, layout }

let applied: Record<string, any> = {};        // what the simulation runs with now (only the changed ones)
let windowEl: HTMLElement | null = null;
const inputs: Record<string, HTMLInputElement> = {};

const t = ( en: string, ru: string ) => lang() === "ru" ? ru : en;

function read( key: string ): any { try { return JSON.parse( localStorage.getItem( key ) || "null" ); } catch ( e ) { return null; } }
function write( key: string, value: any ): void { try { localStorage.setItem( key, JSON.stringify( value )); } catch ( e ) { /* (no storage) */ } }

const same = ( a: any, b: any ) => JSON.stringify( a ) === JSON.stringify( b );
const current = ( name: string ) => ( name in applied ) ? applied[ name ] : PARAM_DEFAULTS[ name ];

//------------------------------------------------------------
// the numbers saved at the last session (main.ts hands them to the simulation at start)
//------------------------------------------------------------
export function savedParameters(): Record<string, any>
{
    const saved = read( KEY_PARAMS ) || {};
    const known: Record<string, any> = {};
    for ( const name in saved ) { if ( name in PARAM_DEFAULTS ) known[ name ] = saved[ name ]; }
    return known;
}

// send changes to the simulation (its thread, or this page)
function send( values: Record<string, any> ): void
{
    const sendToSimulation = ( window as any ).setSimulationParameters;
    if ( sendToSimulation ) { sendToSimulation( values ); }
}

//------------------------------------------------------------
// one row: name, and a box for the number (a tick for on/off)
//------------------------------------------------------------
function textOf( value: any ): string { return Array.isArray( value ) ? value.join( ", " ) : String( value ); }

function valueOf( kind: string, input: HTMLInputElement ): any
{
    if ( kind === "boolean" ) { return input.checked; }
    if ( kind === "array" )   { return input.value.split( "," ).map( s => Number( s.trim() )); }
    return input.value.trim() === "" ? NaN : Number( input.value );
}

function showValue( kind: string, input: HTMLInputElement, value: any ): void
{
    if ( kind === "boolean" ) { input.checked = !!value; } else { input.value = textOf( value ); }
}

function markRow( name: string ): void
{
    const p = PARAM_LIST.find( q => q.name === name )!;
    const input = inputs[ name ];
    const row = input.closest( ".dbgRow" ) as HTMLElement;
    row.classList.toggle( "edited",  !same( valueOf( p.kind, input ), current( name )));                  // typed, not sent yet
    row.classList.toggle( "changed", !same( current( name ), PARAM_DEFAULTS[ name ] ));                   // differs from the code
}

//------------------------------------------------------------
// buttons
//------------------------------------------------------------
function pending(): Record<string, any>
{
    const out: Record<string, any> = {};
    for ( const p of PARAM_LIST )
    {
        const v = valueOf( p.kind, inputs[ p.name ] );
        const bad = ( p.kind === "number" && !isFinite( v )) || ( p.kind === "array" && ( v.length !== p.value.length || v.some( ( x ) => !isFinite( x ))));
        inputs[ p.name ].classList.toggle( "bad", bad );
        if ( !bad && !same( v, current( p.name ))) { out[ p.name ] = v; }
    }
    return out;
}

function commit( values: Record<string, any> ): void
{
    if ( Object.keys( values ).length > 0 )
    {
        send( values );
        for ( const name in values )
        {
            if ( same( values[ name ], PARAM_DEFAULTS[ name ] )) { delete applied[ name ]; } else { applied[ name ] = values[ name ]; }
        }
        write( KEY_PARAMS, applied );
    }
    refreshAll();
}

function refreshAll(): void
{
    for ( const p of PARAM_LIST )
    {
        showValue( p.kind, inputs[ p.name ], current( p.name ));
        inputs[ p.name ].classList.remove( "bad" );
        markRow( p.name );
    }
    const n = Object.keys( applied ).length;
    const count = document.getElementById( "dbgCount" );
    if ( count ) { count.textContent = n === 0 ? t( "all as in the code", "всё как в коде" ) : t( n + " changed", "изменено: " + n ); }
    filterRows();
}

function applyAll()    { commit( pending() ); }
function cancelEdits() { refreshAll(); }
function resetToDefaults()
{
    const all: Record<string, any> = {};
    for ( const name in applied ) { all[ name ] = PARAM_DEFAULTS[ name ]; }
    commit( all );
}

//------------------------------------------------------------
// presets
//------------------------------------------------------------
function presets(): Record<string, any> { return read( KEY_PRESETS ) || {}; }

function fillPresetList( chosen = "" ): void
{
    const select = document.getElementById( "dbgPresets" ) as HTMLSelectElement;
    select.innerHTML = "";
    const none = document.createElement( "option" );
    none.value = "";
    none.textContent = t( "— preset —", "— пресет —" );
    select.appendChild( none );
    for ( const name of Object.keys( presets() ))
    {
        const o = document.createElement( "option" );
        o.value = o.textContent = name;
        select.appendChild( o );
    }
    select.value = chosen;
}

function savePreset(): void
{
    const name = ( prompt( t( "Name of the preset (the numbers and the layout of the windows):", "Название пресета (числа и расположение окон):" ), "" ) || "" ).trim();
    if ( name === "" ) return;
    const all = presets();
    all[ name ] = { params: applied, layout: getLayout() };
    write( KEY_PRESETS, all );
    fillPresetList( name );
}

function loadPreset( name: string ): void
{
    const preset = presets()[ name ];
    if ( !preset ) return;
    const values: Record<string, any> = {};
    for ( const p of PARAM_LIST ) { values[ p.name ] = ( preset.params && p.name in preset.params ) ? preset.params[ p.name ] : PARAM_DEFAULTS[ p.name ]; }
    commit( values );
    applyLayout( preset.layout || {} );
}

function deletePreset(): void
{
    const name = ( document.getElementById( "dbgPresets" ) as HTMLSelectElement ).value;
    if ( name === "" || !confirm( t( "Delete the preset " + name + "?", "Удалить пресет " + name + "?" ))) return;
    const all = presets();
    delete all[ name ];
    write( KEY_PRESETS, all );
    fillPresetList();
}

function filterRows(): void
{
    const word = ( document.getElementById( "dbgFilter" ) as HTMLInputElement ).value.trim().toLowerCase();
    const onlyChanged = ( document.getElementById( "dbgOnlyChanged" ) as HTMLInputElement ).checked;
    for ( const p of PARAM_LIST )
    {
        const row = inputs[ p.name ].closest( ".dbgRow" ) as HTMLElement;
        const hit = ( word === "" || p.name.toLowerCase().includes( word ) || p.note.toLowerCase().includes( word ))
                 && ( !onlyChanged || !same( current( p.name ), PARAM_DEFAULTS[ p.name ] ));
        row.style.display = hit ? "" : "none";
    }
}

//------------------------------------------------------------
// the window
//------------------------------------------------------------
function build(): HTMLElement
{
    const el = document.createElement( "div" );
    el.id = "debugPanel";
    el.innerHTML =
        "<div id='dbgTitle'><b>" + t( "Debug mode", "Режим отладки" ) + "</b> <span id='dbgCount'></span>"
        + "<button id='dbgClose' title='" + t( "close", "закрыть" ) + "'>&times;</button></div>"
        + "<div id='dbgBar'>"
        +   "<button id='dbgApply' class='dbgOk' title='" + t( "apply the changes to the running world", "применить изменения в работающем мире" ) + "'>&#x2714;</button>"
        +   "<button id='dbgCancel' title='" + t( "cancel the typed changes", "отменить введённые изменения" ) + "'>&#x2716;</button>"
        +   "<button id='dbgDefaults' title='" + t( "back to the numbers of the code", "вернуть числа из кода" ) + "'>" + t( "defaults", "по умолчанию" ) + "</button>"
        +   "<select id='dbgPresets'></select>"
        +   "<button id='dbgSavePreset' title='" + t( "save the numbers and the window layout as a preset", "сохранить числа и расположение окон как пресет" ) + "'>" + t( "save preset", "сохранить пресет" ) + "</button>"
        +   "<button id='dbgDeletePreset' title='" + t( "delete the chosen preset", "удалить выбранный пресет" ) + "'>&#x1F5D1;</button>"
        +   "<button id='dbgResetLayout' title='" + t( "put the windows back in their places", "вернуть окна на места" ) + "'>" + t( "reset windows", "сбросить окна" ) + "</button>"
        + "</div>"
        + "<div id='dbgSearch'><input id='dbgFilter' placeholder='" + t( "search by name or note", "поиск по названию или описанию" ) + "'>"
        +   "<label><input type='checkbox' id='dbgOnlyChanged'> " + t( "only changed", "только изменённые" ) + "</label></div>"
        + "<div id='dbgList'></div>";
    document.body.appendChild( el );

    const list = el.querySelector( "#dbgList" ) as HTMLElement;
    for ( const p of PARAM_LIST )
    {
        const row = document.createElement( "label" );
        row.className = "dbgRow";
        row.title = p.name + ( p.note ? "\n" + p.note : "" );
        const name = document.createElement( "span" );
        name.className = "dbgName";
        name.textContent = p.name;
        const input = document.createElement( "input" );
        input.type = ( p.kind === "boolean" ) ? "checkbox" : "text";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.addEventListener( "input", () => markRow( p.name ));
        input.addEventListener( "change", () => markRow( p.name ));
        input.addEventListener( "keydown", ( e ) => { e.stopPropagation(); if ( e.key === "Enter" ) applyAll(); if ( e.key === "Escape" ) cancelEdits(); });
        inputs[ p.name ] = input;
        row.appendChild( name );
        row.appendChild( input );
        list.appendChild( row );
    }

    const on = ( id: string, event: string, handler: any ) => { ( el.querySelector( "#" + id ) as any )[ "on" + event ] = handler; };
    on( "dbgClose",        "click",    () => toggleDebug() );
    on( "dbgApply",        "click",    applyAll );
    on( "dbgCancel",       "click",    cancelEdits );
    on( "dbgDefaults",     "click",    resetToDefaults );
    on( "dbgSavePreset",   "click",    savePreset );
    on( "dbgDeletePreset", "click",    deletePreset );
    on( "dbgResetLayout",  "click",    resetLayout );
    on( "dbgPresets",      "change",   ( e ) => { const v = ( e.target as HTMLSelectElement ).value; if ( v !== "" ) loadPreset( v ); } );
    on( "dbgFilter",       "input",    filterRows );
    on( "dbgFilter",       "keydown",  ( e ) => e.stopPropagation() );
    on( "dbgOnlyChanged",  "change",   filterRows );

    makeWindow( "debug", el, el.querySelector( "#dbgTitle" ) as HTMLElement );
    return el;
}

export function toggleDebug(): void
{
    if ( !windowEl )
    {
        windowEl = build();
        fillPresetList();
        refreshAll();
    }
    const open = windowEl.classList.toggle( "open" );
    document.getElementById( "debugButton" )?.classList.toggle( "activeButton", open );
}

// the numbers of the last session, known before the window is ever opened
export function initializeDebug(): void
{
    applied = savedParameters();
}
