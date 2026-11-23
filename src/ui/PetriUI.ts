//------------------------------------------------------------------------------
// PetriUI — petri dish preview, layout cycling, and persistence extracted from ui.ts.
//------------------------------------------------------------------------------
import { SimulationStartMode } from "../simulation/Globals";
import { drawPetriPreview, petriSettings, PETRI_LAYOUTS } from "../simulation/Petri";
import { tr } from "./lang";
import { setChosenPoolToLoad } from "./saveLoad";

const PETRI_STORAGE_KEY = "genepool.petri";

function readPetriSettings(): void
{
    const zonesInput = document.getElementById( "petriZones" ) as HTMLInputElement | null;
    const softInput  = document.getElementById( "petriSoftness" ) as HTMLInputElement | null;
    if ( !zonesInput || !softInput ) return;
    const zones    = parseInt( zonesInput.value, 10 );
    const softness = parseFloat( softInput.value );
    petriSettings.zones    = Math.min( 12, Math.max( 2, isFinite( zones ) ? zones : 7 ));
    petriSettings.softness = Math.min( 1, Math.max( 0, isFinite( softness ) ? softness : 0.1 ));
}

function rememberPetriSettings(): void
{
    try { localStorage.setItem( PETRI_STORAGE_KEY, JSON.stringify( petriSettings )); } catch ( e ) {}
}

function recallPetriSettings(): void
{
    try
    {
        const saved = JSON.parse( localStorage.getItem( PETRI_STORAGE_KEY ) || "null" );
        if ( saved )
        {
            const zones = Math.round( Number( saved.zones )), layout = Math.round( Number( saved.layout )), softness = Number( saved.softness );
            if ( Number.isFinite( zones ))    petriSettings.zones    = Math.min( 12, Math.max( 2, zones ));
            if ( Number.isFinite( layout ))   petriSettings.layout   = (( layout % PETRI_LAYOUTS.length ) + PETRI_LAYOUTS.length ) % PETRI_LAYOUTS.length;
            if ( Number.isFinite( softness )) petriSettings.softness = Math.min( 1, Math.max( 0, softness ));
        }
    }
    catch ( e ) {}
}

export function showPetriPicture(): void
{
    readPetriSettings();
    const canvas = document.getElementById( "petriPicture" ) as HTMLCanvasElement;
    if ( canvas ) { drawPetriPreview( canvas, petriSettings.zones, petriSettings.layout, petriSettings.softness ); }
    const name = document.getElementById( "petriLayoutName" );
    if ( name ) { name.innerHTML = tr( "shape" ) + ": " + tr( PETRI_LAYOUTS[ petriSettings.layout ] ) + " · " + petriSettings.zones + " " + tr( "zones (click the picture to change the shape)" ); }
    rememberPetriSettings();
}

export function nextPetriLayout(): void
{
    petriSettings.layout = ( petriSettings.layout + 1 ) % PETRI_LAYOUTS.length;
    showPetriPicture();
}

export function syncPetriPanel(): void
{
    petriSettings.layout = (( petriSettings.layout % PETRI_LAYOUTS.length ) + PETRI_LAYOUTS.length ) % PETRI_LAYOUTS.length;
    const zones    = document.getElementById( "petriZones" )    as HTMLInputElement;
    const softness = document.getElementById( "petriSoftness" ) as HTMLInputElement;
    if ( zones )    { zones.value    = String( petriSettings.zones ); }
    if ( softness ) { softness.value = String( petriSettings.softness ); }
    showPetriPicture();
    rememberPetriSettings();
}

export function startPetri( onSwitch: () => void ): void
{
    readPetriSettings();
    showPetriPicture();
    setChosenPoolToLoad( SimulationStartMode.PETRI );
    onSwitch();
}

export function setupPetriPanel(): void
{
    for ( const id of [ "petriZones", "petriSoftness" ] )
    {
        const input = document.getElementById( id );
        if ( input ) { input.addEventListener( "input", showPetriPicture ); }
    }
    recallPetriSettings();
    syncPetriPanel();
}
