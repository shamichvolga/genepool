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
import { previewFromGenes } from "../simulation/Embryology";
import { SimulationStartMode } from "../simulation/Globals";
import { setParameter } from "../simulation/ParamStore";
import { closePopupPanel, switchToChosenPresetPool, syncPetriPanel } from "./ui";
import { tr, translateHTML } from "./lang";


export const InputMode = 
{
    NULL                        : -1,
    LOAD_SWIMBOT_FROM_PRESET    :  0,
    LOAD_SWIMBOT_FROM_FILE      :  1,
    SAVE_SWIMBOT                :  2,
    LOAD_POOL_FROM_PRESET       :  3,
    LOAD_POOL_FROM_FILE         :  4,
    SAVE_POOL                   :  5
};



//----------------------------------------------------------


export let _inputFilenameString    = "";
export let _inputMode              = InputMode.NULL;
export let _chosenPoolToLoad       = 0;

//------------------------------------------------------------------------------
// Saving pools to a server (user accounts, database) was removed from this
// version, but some code below still refers to it. These stand-ins keep those
// leftover paths from crashing; no buttons lead to them at the moment.
//------------------------------------------------------------------------------
export let _savedBeforeLoad = false;
export let _database: any   = null;
export let _username        = "anonymous";

// other modules cannot assign to an imported variable, so they call this
export function setChosenPoolToLoad( pool ) { _chosenPoolToLoad = pool; }

// The two startup numbers in the pool card. They are live parameters in
// Parameters.ts, so the running world and the simulation thread both get them.
const STARTUP_KEY = "genepool.startupParams";
export function applyPoolStartupParams(): void
{
    const bots  = document.getElementById( "poolInitialBots" ) as HTMLInputElement | null;
    const energy = document.getElementById( "poolWorldEnergy" ) as HTMLInputElement | null;
    const botCount = Math.max( 0, Math.min( 20000, Math.floor( Number( bots?.value ) || 0 )));
    const worldEnergy = Math.max( 0.1, Math.min( 10, Number( energy?.value ) || 1.5 ));
    if ( bots ) { bots.value = String( botCount ); }
    if ( energy ) { energy.value = String( worldEnergy ); }
    const values = { INITIAL_NUM_SWIMBOTS: botCount, START_ENERGY_FACTOR: worldEnergy };
    try { localStorage.setItem( STARTUP_KEY, JSON.stringify( values )); } catch ( e ) { /* no storage */ }
    const setter = ( window as any ).setSimulationParameters;
    if ( typeof setter === "function" ) { setter( values ); }
    else { for ( const name in values ) { setParameter( name, ( values as any )[ name ] ); } }
}

let _lastNameBot = -1;
let _lastNameAuto = "swimbot";

// A fresh selection gets a meaningful default name. Typing in the field keeps
// the custom name until another swimbot is selected.
export function syncSwimbotNameInput(): void
{
    const field = document.getElementById( "swimbotNameInput" ) as HTMLInputElement | null;
    if ( !field || typeof genePool === "undefined" ) return;
    const id = genePool.getSelectedSwimbotID();
    if ( id === -1 ) return;
    if ( id === _lastNameBot ) return;
    _lastNameBot = id;
    const genes = genePool.getSwimbotGenes( id );
    _lastNameAuto = ( genes && genes.length ) ? previewFromGenes( genes ).name : "swimbot";
    field.value = _lastNameAuto;
    field.placeholder = _lastNameAuto;
}

export function syncPoolStartupInputs(): void
{
    let values: any = {};
    try { values = JSON.parse( localStorage.getItem( STARTUP_KEY ) || "{}" ); } catch ( e ) { /* no storage */ }
    const bots  = document.getElementById( "poolInitialBots" ) as HTMLInputElement | null;
    const energy = document.getElementById( "poolWorldEnergy" ) as HTMLInputElement | null;
    if ( bots && Number.isFinite( values.INITIAL_NUM_SWIMBOTS )) { bots.value = String( Math.max( 0, Math.floor( values.INITIAL_NUM_SWIMBOTS ))); }
    if ( energy && Number.isFinite( values.START_ENERGY_FACTOR )) { energy.value = String( values.START_ENERGY_FACTOR ); }
}










//-----------------------------------
export function addToFilenameInputString(e)
{
    //-------------------------------------------------
    // characters accumulate as the user types keys...
    //-------------------------------------------------
	_inputFilenameString = e.currentTarget.value;
		
	if ( e.key === 'Enter' )
	{
	    submitFilenameInput();
	}
}





//------------------------------
export function submitFilenameInput()
{
    if ( _savedBeforeLoad )
    {
        //--------------------------------------------------------
        // This handles the case in which the user had chosen to 
        // save the current pool before loading a new one....
        //---------------------------------------------------------
        // visibility of this button is not being handled correctly yet        
//document.getElementById( 'dataDisplayButton' ).style.visibility = "hidden";   
//document.getElementById( 'dataDisplayButton' ).style.visibility = "hidden";
        loadPool();
        _savedBeforeLoad = false;

        //----------------------------------------------
        // set input mode to LOAD_POOL_FROM_FILE
        //----------------------------------------------
        _inputMode = InputMode.LOAD_POOL_FROM_FILE;
    }
    else
    {    
        //-------------------------------------------------------
        // load swimbot
        //-------------------------------------------------------
        if ( _inputMode === InputMode.LOAD_SWIMBOT_FROM_FILE )
        {
            console.log( 'LOAD_SWIMBOT_FROM_FILE: ' + _inputFilenameString );
        
            let swimbotLookup = _database.getLookupTable( 'swimbots' );

            let userOfSwimbot = "";

            //----------------------------------------------------------
            // find the key for the swimbot with the specified name
            //----------------------------------------------------------
            let swimbotToLoad = swimbotLookup.find
            (
                function ( swimbot ) 
                {
                    userOfSwimbot = swimbot.user;
                    return swimbot.name === _inputFilenameString;
                }
            );
            
            if (( swimbotToLoad )
            &&  ( userOfSwimbot === _username ))
            {
                //--------------------
                // found it :)
                //--------------------
                document.getElementById( 'PopUpPanelError' ).style.visibility = "visible";  
                document.getElementById( 'PopUpPanelError' ).style.borderWidth = "2"; 
                document.getElementById( 'PopUpPanelError' ).style.borderColor = "#555555";
                document.getElementById( 'PopUpPanelError' ).innerHTML 
                = "<br>"
                + "&nbsp&nbsp loading data for swimbot '" + _inputFilenameString + "'";

                _database.loadObject
                (
                    'swimbots', 
                    swimbotToLoad.key, 
                
                    function( data ) 
                    {
                        if ( data ) 
                        {
                            genePool.createNewSwimbotWithGenes( data.genes );
                            closePopupPanel();
                            _inputFilenameString = "";
                        }
                    }
                );
            }
            else
            //--------------------
            // Did not find it!
            //--------------------
            {
                document.getElementById( 'cancelErrorButton' ).style.visibility = "visible";  
                  
                document.getElementById( 'PopUpPanelError' ).style.visibility = "visible";        
                document.getElementById( 'PopUpPanelError' ).style.borderWidth = "5"; 
                document.getElementById( 'PopUpPanelError' ).style.borderColor = "#883300";
                document.getElementById( 'PopUpPanelError' ).innerHTML 
                = "<br>"
                + "&nbsp&nbsp ERROR:"
                + "<br>"
                + "&nbsp&nbsp Could not find swimbot file '" + _inputFilenameString + "'"
                + "<br>"
                + "&nbsp&nbsp Try a different name";
            }
        }

        //-------------------------------------------------------
        // save swimbot
        //-------------------------------------------------------
        else if ( _inputMode === InputMode.SAVE_SWIMBOT )
        {
            let selectedSwimbot = genePool.getSelectedSwimbotID();

            if ( selectedSwimbot != -1 )
            {
                console.log( 'SAVE_SWIMBOT: ' + _inputFilenameString );
            
                let date = new Date();
                let dateInSeconds = date.getTime();
            
                let genes = genePool.getSwimbotGenes( selectedSwimbot );
                let swimbotWithMetaData = ( { 'name': _inputFilenameString, 'date' : dateInSeconds, 'user': _username, 'genes': genes } );
            
                _database.add( 'swimbots', swimbotWithMetaData );            
                closePopupPanel();
                _inputFilenameString = "";
            }
        }
    
        //---------------------------------------------------
        // load pool
        //---------------------------------------------------
        else if ( _inputMode === InputMode.LOAD_POOL_FROM_FILE )
        {
            console.log( 'LOAD_POOL_FROM_FILE: ' + _inputFilenameString );
        
            let poolLookup = _database.getLookupTable( 'pools' );

            //----------------------------------------------------------
            // find the key for the pool with the specified name
            //----------------------------------------------------------
            let poolToLoad = poolLookup.find
            (
                function ( pool ) 
                {
                    return pool.name === _inputFilenameString;
                }
            );

            if ( poolToLoad ) 
            {
                document.getElementById( 'PopUpPanelError' ).style.visibility  = "visible";   
                document.getElementById( 'PopUpPanelError' ).style.borderWidth = "2"; 
                document.getElementById( 'PopUpPanelError' ).style.borderColor = "#555555";
                document.getElementById( 'PopUpPanelError' ).innerHTML 
                = "<br>"
                + "&nbsp&nbsp loading data for pool '" + _inputFilenameString + "'";

                _database.loadObject
                (
                    'pools', 
                    poolToLoad.key, 
                
                    function( data ) 
                    {
                        if ( data ) 
                        {
                            genePool.setPoolData( data.pool );
                            syncPetriPanel();
                            closePopupPanel();
                            _inputFilenameString = "";
                        }
                    }
                );
            }       
            else
            {
                document.getElementById( 'PopUpPanelError' ).style.visibility  = "visible";  
                document.getElementById( 'PopUpPanelError' ).style.borderWidth = "5"; 
                document.getElementById( 'PopUpPanelError' ).style.borderColor = "#883300";
                document.getElementById( 'PopUpPanelError' ).innerHTML 
                = "<br>"
                + "&nbsp&nbsp ERROR:"
                + "<br>"
                + "&nbsp&nbsp Could not find pool file '" + _inputFilenameString + "'"
                + "<br>"
                + "&nbsp&nbsp Try a different name";
            } 
        }
    
        //---------------------------------------------------
        // save pool
        //---------------------------------------------------
        else if ( _inputMode === InputMode.SAVE_POOL )
        {
            console.log( 'SAVE_POOL: ' + _inputFilenameString );
        
            let date = new Date();
            let dateInSeconds = date.getTime();
            const name = _inputFilenameString;

            // (the pool may live in the simulation thread: ask for its data)
            genePool.request( "getPoolData" ).then( function( pool )
            {
                let poolWithMetaData = ( { 'name': name, 'date': dateInSeconds, 'user': _username, 'pool': pool } );
                _database.add( 'pools', poolWithMetaData );
            });
            closePopupPanel();
            _inputFilenameString = "";
        }

        //----------------------------
        // cancel input mode
        //----------------------------
        _inputMode = InputMode.NULL;
    }
}



//--------------------------------------------------
// these four save/load calls are made from html...
//--------------------------------------------------





export function readLocalFile( event )
{
    //console.log( event );
    
    let fileList = event.target.files;
    
    let file = fileList[0];    
    
    let reader = new FileReader();
    
    
    console.log( file );
}





//--------------------------
export function printFamilyTree()
{
    // open the window now (a click opened it), fill it when the data comes
    let w = window.open
    (
        "",
        "swimbot data",
        "left = 400, top = 100, width = 600, height = 700, status = 0, resizable = 0, channelmode = 0, menubar = 0, toolbar = 0, location = 0, titlebar = 0"
    );
    if ( !w ) return;
    w.document.title = tr( "Swimbot Data (copy and paste into a text file, then load into Gene Pool Lab)" );
    w.document.body.innerHTML = tr( "collecting the data…" );

    genePool.request( "getFamilyTreeText" ).then( function( text ) { w.document.body.innerHTML = translateHTML( text ); });
}



//--------------------
export function loadPool()
{
    console.log( "loadPool!!!!" );
    
    if ( _chosenPoolToLoad === SimulationStartMode.FILE )
    {
        openPopupPanelForInput( "Load a new pool from a file", InputMode.LOAD_POOL_FROM_FILE );               
    }
    else
    {
        switchToChosenPresetPool();
    }
}


/*
//-----------------------------------------
function showAccountRequiredPopup( text )
{
    console.log( "oops - cannot save or load: user is '" + _username + "'" );
    
    document.getElementById( 'noSavePopUpPanelButton'   ).style.visibility = "hidden";   
    document.getElementById( 'savePopUpPanelButton'     ).style.visibility = "hidden";      
    
    document.getElementById( 'popUpPanel'               ).style.visibility = "visible"; document.getElementById( 'popUpPanel' ).style.display = 'block';   
    document.getElementById( 'cancelPopUpPanelButton'   ).style.visibility = "visible";
    document.getElementById( 'popUpPanel' ).innerHTML
    = "<font size = 3 color = '#770000' face='arial'>" + text + "</font>"
    + "<br>"
    + "<br>"
    + "<font size = 3 color = '#770000' face='arial'>You must have an account and be signed-in.</font>" 
    + "<br>"
    + "<br>"
    + "<br>"
    + "<font size = 2 color = '#000000' face='arial'>If you don't have an account, select the 'create account' button at the upper-right. (It's free :)"
    + "<br>"
    + "<br>"
    + "Once you are signed in, you will be able to save and load swimbots and pools.</font>";
}
*/

//----------------------------------------------
export function openPopupPanelForInput( text, mode )
{
    //-----------------------------------------------
    // set the input mode to the incoming mode ...
    //-----------------------------------------------
    _inputMode = mode;

    //----------------------------------------------------------------------------------    
    // make sure these are turned off  
    //----------------------------------------------------------------------------------   
    document.getElementById( 'noSavePopUpPanelButton'   ).style.visibility = "hidden";   
    document.getElementById( 'savePopUpPanelButton'     ).style.visibility = "hidden";  
    document.getElementById( 'dataDisplayButton'        ).style.visibility = "hidden";    


    //----------------------------------------------------------------------------------    
    // turn these on  
    //----------------------------------------------------------------------------------    
    document.getElementById( 'popUpPanel'               ).style.visibility = "visible"; document.getElementById( 'popUpPanel' ).style.display = 'block';   
    document.getElementById( 'cancelPopUpPanelButton'   ).style.visibility = "visible";    
    document.getElementById( 'popUpPanelInput'          ).style.visibility = "visible";   
    document.getElementById( 'submitFilenameButton'     ).style.visibility = "visible";   
    
    
    //----------------------------------------------------
    // give focus to the input
    //----------------------------------------------------
    document.getElementById( "popUpPanelInput" ).focus();

    // default case...
    document.getElementById( "popUpPanelInput"      ).style.top = "185px";
    document.getElementById( "submitFilenameButton" ).style.top = "185px";

    // not working in all cases...test it...
    if ( _inputMode === InputMode.SAVE_SWIMBOT )
    {
        document.getElementById( "loadedList"   ).style.visibility = "hidden";

        document.getElementById( "PopupText" ).style.visibility = "visible";
        document.getElementById( "PopupText" ).innerHTML
        = tr( text )
        + "<br>"
        + "<br>"
        + tr( "Name this swimbot..." );

        //----------------------------------------------------
        // give user option to display data...
        //----------------------------------------------------
        document.getElementById( 'dataDisplayButton'    ).style.visibility = "visible";
    }
    else if ( _inputMode === InputMode.LOAD_SWIMBOT_FROM_FILE )
    {
        document.getElementById( "PopupText" ).style.visibility = "visible";
        document.getElementById( "PopupText" ).innerHTML
        = tr( text )
        + "<br>"
        + "<br>"
        + tr( "choose from the list of saved swimbots:" )
        + "<br>"
        + "<br>";

        document.getElementById( "popUpPanelInput"      ).style.top = "290px";
        document.getElementById( "submitFilenameButton" ).style.top = "290px";

        //--------------------------------------------------------------------------
        // display the list of the swimbots that the user has previously loaded...
        //--------------------------------------------------------------------------
        document.getElementById( "loadedList" ).style.visibility = "visible";
        document.getElementById( "loadedList" ).innerHTML = "";

        let swimbotLookup = _database.getLookupTable( 'swimbots' );

        for (let s=0; s<swimbotLookup.length; s++)
        {
            if ( swimbotLookup[s].user === _username )
            {
                //------------------------------------------------
                // construct a button for this loaded swimbot...
                //------------------------------------------------
                let loadSwimbotButton = document.createElement( "BUTTON" );

                loadSwimbotButton.id = "swimbotLoadButton_" + s.toString();

                loadSwimbotButton.innerHTML = swimbotLookup[s].name

                document.getElementById( "loadedList" ).appendChild( loadSwimbotButton );

                loadSwimbotButton.onmousedown = function(e)
                {
                    console.log( loadSwimbotButton.id );
                    _inputFilenameString = swimbotLookup[s].name;
                    document.getElementById('popUpPanelInput').value = swimbotLookup[s].name;
                }
            }
        }
    }

    //-----------------------------
    // clear-out input string...
    //-----------------------------
    _inputFilenameString = "";
    document.getElementById('popUpPanelInput').value = '';
}






//--------------------------------
export function displayData( filename )
{
    if ( _inputMode === InputMode.SAVE_SWIMBOT )
    {
        console.log( "showSwimbotGenes..." );
        showSwimbotGenes( genePool.getSelectedSwimbotID() );
    }
    else if ( _inputMode === InputMode.SAVE_POOL )
    {
        console.log( "show pool data..." );

        genePool.request( "getPoolData" ).then( function( pool ) { showPoolData( pool ); });
    }
}

function showPoolData( pool )
{
    {
        let json = JSON.stringify( { pool } );

        document.getElementById( 'dataDisplay'      ).style.visibility = "visible"; document.getElementById( 'dataDisplay' ).style.display = 'block';
        document.getElementById( 'closeDataDisplay' ).style.visibility = "visible";
        document.getElementById( 'dataDisplay'      ).innerHTML
        = tr( "Copy the text below, put it in a new text file, and then give" )
        + "<br>"
        + tr( "the file a unique name ending in '.json' (example: 'my_pool.json')" )
        + "<br>"
        + "<br>"
        + "_________________"
        + "<br>"
        + "<br>"
        + json;
    }
}


//----------------------------
export function showSwimbotGenes(s)
{
    if ( s != -1 )
    {
        let genes = genePool.getSwimbotGenes(s);
        let json = JSON.stringify( { genes } );

        document.getElementById( 'dataDisplay'      ).style.visibility = "visible"; document.getElementById( 'dataDisplay' ).style.display = 'block';
        document.getElementById( 'closeDataDisplay' ).style.visibility = "visible";
        document.getElementById( 'dataDisplay'      ).innerHTML
        = "<br>"
        + "<big><b>" + tr( "Save genes of swimbot" ) + " " + s.toString() + "</b></big>"
        + "<br>"
        + "<br>"
        + tr( "Please copy the genetic data below and put it in an" )
        + "<br>"
        + tr( "empty text file. Give it a cool name and save it." )
        + "<br>"
        + "<br>"
        + tr( "This is formatted as JSON, which is required" )
        + "<br>"
        + tr( "for it to be loaded back into the pool." )
        + "<br>"
        + "<br>"
        + "<br>"
        + "<br>"
        + json;
    }
}
// The name typed in the swimbot panel becomes both the file name and a field
// inside the file, so the gallery can show it again when the file is loaded.
export function sanitizeBotName( raw: string ): string
{
    const cleaned = String( raw || "" ).trim().replace( /[^\w\u0400-\u04ff\-]+/g, "_" ).replace( /^_+|_+$/g, "" );
    return cleaned.slice( 0, 48 ) || "swimbot";
}

export function downloadSwimbotGenes(s)
{
    if (s == -1) return;

    let genes = genePool.getSwimbotGenes(s);
    const field = document.getElementById( "swimbotNameInput" ) as HTMLInputElement | null;
    const name = sanitizeBotName( field && field.value.trim() ? field.value : previewFromGenes( genes ).name );
    if ( field && !field.value.trim() ) { field.value = name; }

    let json = JSON.stringify({ name, genes }, null, 2);
    let blob = new Blob([json], { type: "application/json" });
    let url = URL.createObjectURL(blob);

    let a = document.createElement("a");
    a.href = url;
    a.download = name + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

//----------------------------
export function closeDataDisplay()
{
    document.getElementById( 'dataDisplay'      ).style.visibility = "hidden"; document.getElementById( 'dataDisplay' ).style.display = 'none'; 
    document.getElementById( 'closeDataDisplay' ).style.visibility = "hidden"; 
}


