import { TWO_PLANT_TYPES } from "../simulation/Ecology";
import { WORLD_SCALE } from "../simulation/World";
import { drawPetriPreview, petriSettings, PETRI_LAYOUTS } from "../simulation/Petri";
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
import { BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_FOOD, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_FOOD, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY, BRAIN_STATE_RESTING } from "../simulation/Brain";
import { DEFAULT_FOOD_BIT_ENERGY, DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS, MAX_FOOD_BIT_ENERGY, MAX_FOOD_BIT_MAX_SPAWN_RADIUS, MIN_FOOD_BIT_ENERGY, MIN_FOOD_BIT_MAX_SPAWN_RADIUS } from "../simulation/FoodBit";
import { CameraNavigationAction, SimulationStartMode } from "../simulation/Globals";
import { NULL_INDEX } from "../simulation/MathConstants";
import { DEFAULT_CHILD_ENERGY_RATIO, DEFAULT_FOOD_REGENERATION_PERIOD, DEFAULT_MAXIMUM_AGE, DEFAULT_SWIMBOT_HUNGER_THRESHOLD, MAX_CHILD_ENERGY_RATIO, MAX_FOOD_REGENERATION_PERIOD, MAX_MAXIMUM_AGE, MAX_SWIMBOT_HUNGER_THRESHOLD, MIN_CHILD_ENERGY_RATIO, MIN_FOOD_REGENERATION_PERIOD, MIN_MAXIMUM_AGE, MIN_SWIMBOT_HUNGER_THRESHOLD, PREDATOR_LEVEL_THRESHOLD } from "../simulation/Parameters";
import { ATTRACTION_BIG, ATTRACTION_CLOSEST, ATTRACTION_COLORFUL, ATTRACTION_CROOKED, ATTRACTION_HYPER, ATTRACTION_LONG, ATTRACTION_NO_COLOR, ATTRACTION_RANDOM, ATTRACTION_SHORT, ATTRACTION_SIMILAR_COLOR, ATTRACTION_SIMILAR_HYPER, ATTRACTION_SIMILAR_LENGTH, ATTRACTION_SIMILAR_SIZE, ATTRACTION_SIMILAR_STRAIGHT, ATTRACTION_SMALL, ATTRACTION_STILL, ATTRACTION_STRAIGHT, MAX_PARTS, MIN_PARTS, NUM_ATTRACTIONS } from "../simulation/SwimbotTypes";
import { assert } from "../simulation/Utility";
import { ViewTrackingMode } from "../simulation/ViewTracking";
import { Graph } from "./graph";
import { getInfoText } from "./info";
import { _chosenPoolToLoad, _username, setChosenPoolToLoad } from "./saveLoad";
import { decorateSwimbotCard, setupHints, tr, translateHTML, translatePage } from "./lang";
import { USER_SWIMBOTS } from "./userSwimbots";


//--------------------------
export const FIRST_INFO_PAGE = 1;
export const LAST_INFO_PAGE  = 28;

export const DEFAULT_BASIC_PANEL_COLOR         = "#caccc2";
export const DEFAULT_BASIC_BUTTON_COLOR        = "#dadad0";  
export const DEFAULT_BASIC_BUTTON_BORDER_COLOR = "#7f7f77";   
export const ACTIVE_BORDER_COLOR               = '#ffffff';   

export const UI_UPDATE_PERIOD = 500;


export let _currentInfoPage            = FIRST_INFO_PAGE;
export let _graph                      = new Graph(); 
export let _tweakGenesCategory         = 0;
export let _runningFast                = false;
export let _lastSwimbotPanelHTML       = "";
export let _lastGraphDataHTML          = "";

//----------------------------
export function initializeUI()
{
    initializeEcosystemUI();    
    
    _graph.initialize();     
    setupUserSwimbots();
    setupHints();
    translatePage();
    // a new language: the parts the code fills are filled again
    window.addEventListener( "genepool:language", () =>
    {
        _lastSwimbotPanelHTML = ""; _lastGraphDataHTML = "";
        showRunning();
        setInfoPage( _currentInfoPage );
        showPetriPicture();
        if ( document.getElementById( "tweakGenesPanel" )!.style.display === "block" ) openTweakGenesPanel( genePool.getSelectedSwimbotID() );
    });
  
    //--------------------------------------------------
    // This starts an update loop that is called 
    // periodically to adjust UI states and stuff. 
    //--------------------------------------------------
    //console.log( "setTimeout" );
       
    setTimeout( updateUI, 1 );
 }

//----------------------------
export function chooseAttraction()
{
    //console.log( "chooseAttraction" );

    let radioButtons = document.getElementsByName( 'attractionRadioButton' );

    /*
    console.log( "radioButtons.length = " + radioButtons.length );

    for (let i = 0; i < radioButtons.length; i++) 
    {
        console.log( radioButtons[i].value );
    }
    */
    for (let i = 0; i < radioButtons.length; i++) 
    {
        if ( radioButtons[i].type === 'radio' ) 
        {
            //console.log( "if ( radioButtons[i].type === 'radio' ) " );

            if ( radioButtons[i].checked )
            {
                let value = radioButtons[i].value; 
                let attraction = ATTRACTION_SIMILAR_COLOR;

                     if ( value === "colorful"          ) { attraction = ATTRACTION_COLORFUL;           }
                else if ( value === "big"               ) { attraction = ATTRACTION_BIG;                }
                else if ( value === "hyper"             ) { attraction = ATTRACTION_HYPER;              }
                else if ( value === "long"              ) { attraction = ATTRACTION_LONG;               }
                else if ( value === "straight"          ) { attraction = ATTRACTION_STRAIGHT;           }
                else if ( value === "noColor"           ) { attraction = ATTRACTION_NO_COLOR;           }
                else if ( value === "small"             ) { attraction = ATTRACTION_SMALL;              }
                else if ( value === "still"             ) { attraction = ATTRACTION_STILL;              }
                else if ( value === "short"             ) { attraction = ATTRACTION_SHORT;              }
                else if ( value === "crooked"           ) { attraction = ATTRACTION_CROOKED;            }
                else if ( value === "similarColor"      ) { attraction = ATTRACTION_SIMILAR_COLOR;      }
                else if ( value === "similarSize"       ) { attraction = ATTRACTION_SIMILAR_SIZE;       }
                else if ( value === "similarHyper"      ) { attraction = ATTRACTION_SIMILAR_HYPER;      }
                else if ( value === "similarLength"     ) { attraction = ATTRACTION_SIMILAR_LENGTH;     }
                else if ( value === "similarStraight"   ) { attraction = ATTRACTION_SIMILAR_STRAIGHT;   }
                else if ( value === "random"            ) { attraction = ATTRACTION_RANDOM;             }
                else if ( value === "closest"           ) { attraction = ATTRACTION_CLOSEST;            }
            //console.log ( "Attraction set to " + attraction );
                genePool.setAttraction( attraction );
            }
        }
    }
}

//-------------------------
export function openTweakPanel()
{
    document.getElementById( 'tweakPanel' ).classList.add( 'active' );
    updateEcosystemUI();
    showCurrentAttraction();
}

//------------------------------------------------------------
// tick the radio button of the mate preference now in use
//------------------------------------------------------------
const RADIO_OF_ATTRACTION =
{
    [ ATTRACTION_COLORFUL         ]: "radioColorful",
    [ ATTRACTION_BIG              ]: "radioBig",
    [ ATTRACTION_HYPER            ]: "radioHyper",
    [ ATTRACTION_LONG             ]: "radioLong",
    [ ATTRACTION_STRAIGHT         ]: "radioStraight",
    [ ATTRACTION_NO_COLOR         ]: "radioNoColor",
    [ ATTRACTION_SMALL            ]: "radioSmall",
    [ ATTRACTION_STILL            ]: "radioStill",
    [ ATTRACTION_SHORT            ]: "radioShort",
    [ ATTRACTION_CROOKED          ]: "radioCrooked",
    [ ATTRACTION_SIMILAR_COLOR    ]: "radioSimilarColor",
    [ ATTRACTION_SIMILAR_SIZE     ]: "radioSimilarSize",
    [ ATTRACTION_SIMILAR_HYPER    ]: "radioSimilarHyper",
    [ ATTRACTION_SIMILAR_LENGTH   ]: "radioSimilarLength",
    [ ATTRACTION_SIMILAR_STRAIGHT ]: "radioSimilarStraight",
    [ ATTRACTION_RANDOM           ]: "radioRandom",
    [ ATTRACTION_CLOSEST          ]: "radioClosest",
};

function showCurrentAttraction()
{
    const id = RADIO_OF_ATTRACTION[ genePool.getAttraction() ];
    if ( id !== undefined ) { ( document.getElementById( id ) as HTMLInputElement ).checked = true; }
}

//--------------------------------
export function setEcosystemValue( id )
{
    let input = document.getElementById( id );
    if ( id === "foodGrowthDelaySlider"    ) { genePool.setFoodGrowthDelay     ( input.value ); }
    else if ( id === "foodSpreadSlider"         ) { genePool.setFoodSpread          ( input.value ); }
    else if ( id === "foodBitEnergySlider"      ) { genePool.setFoodBitEnergy       ( input.value ); }
    else if ( id === "maxAgeSlider"             ) { genePool.setMaximumSwimbotAge   ( input.value ); }
    updateEcosystemUI();
}

export function setPopulationLimitEnabled( value )
{
    genePool.setPopulationLimitEnabled( value );
    updateEcosystemUI();
}

export function setMaximumSwimbotParts( value )
{
    genePool.setMaximumSwimbotParts( value );
    updateEcosystemUI();
}

//------------------------------------
export function setEcosystemToDefaults()
{
    genePool.setFoodGrowthDelay     ( DEFAULT_FOOD_REGENERATION_PERIOD  );
    genePool.setFoodSpread          ( DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS );
    genePool.setFoodBitEnergy       ( DEFAULT_FOOD_BIT_ENERGY           );
    genePool.setHungerThreshold     ( DEFAULT_SWIMBOT_HUNGER_THRESHOLD  );
    genePool.setOffspringEnergyRatio( DEFAULT_CHILD_ENERGY_RATIO        );
    genePool.setMaximumSwimbotAge   ( DEFAULT_MAXIMUM_AGE               );
    genePool.setPopulationLimitEnabled( true );
    genePool.setMaximumSwimbotParts ( 16 );
    updateEcosystemUI();
}

//----------------------------
export function initializeEcosystemUI()
{
    document.getElementById( 'foodGrowthDelaySlider'    ).min = MIN_FOOD_REGENERATION_PERIOD;
    document.getElementById( 'foodGrowthDelaySlider'    ).max = MAX_FOOD_REGENERATION_PERIOD;
    document.getElementById( 'foodSpreadSlider'         ).min = MIN_FOOD_BIT_MAX_SPAWN_RADIUS;
    document.getElementById( 'foodSpreadSlider'         ).max = MAX_FOOD_BIT_MAX_SPAWN_RADIUS;
    document.getElementById( 'foodBitEnergySlider'      ).min = MIN_FOOD_BIT_ENERGY;
    document.getElementById( 'foodBitEnergySlider'      ).max = MAX_FOOD_BIT_ENERGY;
    document.getElementById( 'maxAgeSlider'             ).min = MIN_MAXIMUM_AGE;
    document.getElementById( 'maxAgeSlider'             ).max = MAX_MAXIMUM_AGE;
    document.getElementById( 'maxPartsInput'            ).min = MIN_PARTS;
    document.getElementById( 'maxPartsInput'            ).max = MAX_PARTS;
    updateEcosystemUI();
}

//----------------------------
export function updateEcosystemUI()
{
    if ( typeof genePool != "undefined" )
    {
        document.getElementById( "foodGrowthDelaySlider"    ).value     = genePool.getFoodGrowthDelay();
        document.getElementById( "foodGrowthDelayValue"     ).innerHTML = genePool.getFoodGrowthDelay();
        document.getElementById( "foodSpreadSlider"         ).value     = genePool.getFoodSpread();
        document.getElementById( "foodSpreadValue"          ).innerHTML = genePool.getFoodSpread();
        document.getElementById( "foodBitEnergySlider"      ).value     = genePool.getFoodBitEnergy();
        document.getElementById( "foodBitEnergyValue"       ).innerHTML = genePool.getFoodBitEnergy();
        document.getElementById( "maxAgeSlider"             ).value     = genePool.getMaximumSwimbotAge();
        document.getElementById( "maxAgeValue"              ).innerHTML = genePool.getMaximumSwimbotAge();
        ( document.getElementById( "populationLimitToggle" ) as HTMLInputElement ).checked = genePool.getPopulationLimitEnabled();
        document.getElementById( "maxPartsInput"            ).value     = genePool.getMaximumSwimbotParts();
        let radioButtons = document.getElementsByName( 'attractionRadioButton' );
        for (let i = 0; i < radioButtons.length; i++)
        {
            assert( i < NUM_ATTRACTIONS, "ui.js: updateEcosystemUI: i < NUM_ATTRACTIONS" );
            if ( radioButtons[i].type === 'radio' )
            {
                if ( genePool.getAttraction() === i )
                {
                    radioButtons[i].checked = true;
                }
                else
                {
                    radioButtons[i].checked = false;
                }
            }
        }
    }
}

//----------------------------
export function closeAllPanels()
{
    for ( const tab in PANEL_OF_TAB )
    {
        document.getElementById( tab                 ).classList.remove( 'active' );
        document.getElementById( PANEL_OF_TAB[ tab ] ).classList.remove( 'active' );
    }

    closePopupPanel();
    _graph.clear();
}

//------------------------------------------------------------
// which tab button opens which panel
//------------------------------------------------------------
const PANEL_OF_TAB =
{
    menuPoolButton    : 'poolPanel',
    menuSwimbotButton : 'swimbotPanel',
    menuTweakButton   : 'tweakPanel',
    menuGraphButton   : 'graphPanel',
    menuInfoButton    : 'infoPanel',
};

// show or hide one part of a panel
function showPart( id, show )
{
    document.getElementById( id ).classList.toggle( 'hiddenPart', !show );
}

// the panel tab currently open?
function panelIsOpen( id )
{
    return document.getElementById( id ).classList.contains( 'active' );
}

//----------------------------
export function openPanel( buttonID )
{
    closeAllPanels();
    document.getElementById( buttonID ).classList.add( 'active' );

    if ( buttonID === 'menuPoolButton'      ) { openPoolPanel();    }
    if ( buttonID === 'menuSwimbotButton'   ) { openSwimbotPanel(); }
    if ( buttonID === 'menuTweakButton'     ) { openTweakPanel();   }
    if ( buttonID === 'menuInfoButton'      ) { openInfoPanel();    }
    if ( buttonID === 'menuGraphButton'     ) { openGraphPanel()    }
}

//--------------------------
export function openPoolPanel()
{
    document.getElementById( 'poolPanel' ).classList.add( 'active' );
}

//--------------------------
export function openGraphPanel()
{
    document.getElementById( 'graphPanel' ).classList.add( 'active' );
}

//--------------------------
export function openSwimbotPanel()
{
    document.getElementById( 'swimbotPanel' ).classList.add( 'active' );
    let selected = genePool.getASwimbotIsSelected();
    showPart( 'selectedSwimbotPanel',   selected );
    showPart( 'noSelectedSwimbotPanel', !selected );
}

//------------------------------------------------
export function openTweakGenesPanel( selectedSwimbotID )
{
    if ( selectedSwimbotID != NULL_INDEX )
    {
        document.getElementById( 'tweakGenesPanel'      ).style.visibility = 'visible'; document.getElementById( 'tweakGenesPanel' ).style.display = 'block';
        document.getElementById( 'closeTweakGenesPanel' ).style.display = "block";
        document.getElementById( 'tweakGenesPanel' ).innerHTML = "<div id = 'tweakGenesTitle' >" + tr( "Tweak the genes of swimbot" ) + " " + selectedSwimbotID + "</div>";
        document.getElementById( 'tweakGenesPanel' ).innerHTML += "<div id = 'tweakGenesCategoryNote' >" + tr( "(choose which limb type to tweak)" ) + "</div>";
        let numCategories = genePool.getNumGeneCategories();
        for (let c=0; c<numCategories; c++)
        {
            document.getElementById( 'tweakGenesPanel' ).innerHTML
            += "<div id = 'category" + (c+1) + "' >" + (c+1)
            +  "<input "
            +  "type         = 'radio' "
            +  "id           = 'geneTweakerCategory" + c + "'"
            +  "name         = 'geneTweakerCategory'"
            +  "oninput      = 'setGeneTweakCategory( " + selectedSwimbotID + ", " + c + ")' "
            +  "onchange     = 'setGeneTweakCategory( " + selectedSwimbotID + ", " + c + ")' "
            +  "></div>";
        }
        let num = genePool.getNumGenesPerCategory();
        num += 2; //add the two first (global: non-category) genes
        let width = 150;
        for (let g=0; g<num; g++)
        {
            let geneTweakerName  = genePool.getGeneName(g);
            let geneTweakerValue = genePool.getGeneValue( selectedSwimbotID, g );
            let top = 60 + g * 20;
            if ( g > 1 ) //skip the two first (global: non-category) genes
            {
                top += 80.0;
            }
            document.getElementById( 'tweakGenesPanel' ).innerHTML
            += "<div class = 'geneTweakerValue' id = 'gene" + g + "Value' style = 'top:" + top + "px;'>" + geneTweakerValue + "</div>";
            document.getElementById( 'tweakGenesPanel' ).innerHTML
            += "<input "
            +  "style        = 'top:" + ( top - 3 ) + "px; width:" + width + "px;'"
            +  "type         = 'range' "
            +  "class        = 'geneTweakerSlider' "
            +  "min          = '0'"
            +  "max          = '255'"
            +  "value        = '" + geneTweakerValue + "'"
            +  "id           = 'geneTweaker" + g + "'"
            +  "name         = 'geneTweaker"
            +  "step         = 1 "
            +  "autocomplete = 'off' "
            +  "oninput      = 'tweakGene( " + selectedSwimbotID + ", " + g + ")' "
            +  ">";
            document.getElementById( 'tweakGenesPanel' ).innerHTML
            += "<div class = 'geneTweakerName' style = 'top:" + top + "px;'>" + tr( geneTweakerName ) + "</div>";
        }
        _tweakGenesCategory = 0;
        let radioButtons = document.getElementsByName( 'geneTweakerCategory' );
        for (let i = 0; i < radioButtons.length; i++)
        {
            if ( i === _tweakGenesCategory )
            {
                radioButtons[i].checked = true;
            }
            else
            {
                radioButtons[i].checked = false;
            }
        }
    }
    else
    {
        document.getElementById( 'tweakGenesPanel'      ).style.visibility = 'hidden'; document.getElementById( 'tweakGenesPanel' ).style.display = 'none';
        document.getElementById( 'closeTweakGenesPanel' ).style.display = "none";
    }
}

//----------------------------
export function closeTweakGenesPanel()
{
    document.getElementById( 'tweakGenesPanel'      ).style.display = "none";
    document.getElementById( 'closeTweakGenesPanel' ).style.display = "none";
}

//---------------------------------------------
export function updateGeneSliders( selectedSwimbotID )
{
    let num = genePool.getNumGenesPerCategory();
    num += 2; //add the two first (global: non-category) genes
    for (let g=0; g<num; g++)
    {
        let geneIndex = g;
        if ( g > 1 )
        {
            geneIndex += genePool.getNumGenesPerCategory() * _tweakGenesCategory;
        }
        let geneTweakerValue = genePool.getGeneValue( selectedSwimbotID, geneIndex );
        let id = "geneTweaker" + g;
        let slider = document.getElementById( id );
        slider.value = geneTweakerValue;
        id = "gene" + g + "Value";
        document.getElementById( id ).innerHTML = geneTweakerValue;
    }
}

//-------------------------
export function closePopupPanel()
{
    document.getElementById( 'popUpPanel'               ).style.visibility = 'hidden'; document.getElementById( 'popUpPanel' ).style.display = 'none';
    document.getElementById( 'cancelPopUpPanelButton'   ).style.visibility = 'hidden';
    document.getElementById( 'dataDisplayButton'        ).style.display = "none";
    document.getElementById( "Canvas" ).focus();
}

//-------------------------
export function closeAccountPanel()
{
    document.getElementById( 'cancelAccountPanelButton' ).style.display = "none";
    document.getElementById( 'accountPanel'             ).style.display = "none";
    document.getElementById( 'accountEmailInput'        ).style.display = "none";
    document.getElementById( 'accountPasswordInput'     ).style.display = "none";
    document.getElementById( 'submitAccountButton'      ).style.visibility = 'hidden';
    document.getElementById( 'accountButton'    ).style.display = "block";
    document.getElementById( 'loginButton'      ).style.display = "block";
}

//-------------------------
export function closeErrorPanel()
{
    document.getElementById( 'PopUpPanelError'      ).style.display = "none";
    document.getElementById( 'cancelErrorButton'    ).style.display = "none";
}

//----------------------------------
export function toggleSimulationRunning()
{
    genePool.setSimulationRunning( !genePool.getSimulationRunning() );
    showRunning();
}

// the pause button: lit while paused (the speed buttons dim)
function showRunning()
{
    const paused = !genePool.getSimulationRunning();
    document.getElementById( "freezeButton" ).classList.toggle( "activeButton", paused );
    document.getElementById( "viewOptionsPanel" ).classList.toggle( "paused", paused );
}

//----------------------------------------------------------
// simulation speed buttons:  >  >>  >>>  (they also end a pause)
//----------------------------------------------------------
export function setSpeed( level )
{
    genePool.setSpeedLevel( level );
    if ( !genePool.getSimulationRunning() ) { genePool.setSimulationRunning( true ); }
    showRunning();
    for ( let l = 1; l <= 3; l++ )
    {
        document.getElementById( "speed" + l + "Button" ).classList.toggle( "activeButton", l === level );
    }
}

// (kept for old code that still calls it)
export function toggleFastRendering()
{
    setSpeed( genePool.getSpeedLevel() === 3 ? 1 : 3 );
}

//-------------------------
export function toggleRendering()
{
    if ( genePool.getRendering() )
    {
        setRendering( false );
    }
    else
    {
        setRendering( true );
    }
}

//-------------------------
export function setRendering(r)
{
    if ( r )
    {
        genePool.setRendering( true );
        canvasID.style.visibility = 'visible';
        document.getElementById( "noRenderPanel" ).style.visibility = 'hidden';
        document.getElementById( "noRenderPanel" ).style.display    = 'none';
    }
    else
    {
        genePool.setRendering( false );
        canvasID.style.visibility = 'hidden';
        document.getElementById( "noRenderPanel" ).style.visibility = 'visible';
        document.getElementById( "noRenderPanel" ).style.display    = 'block';
        updateHud();
    }
}

//---------------------------
export function toggleCurrents()
{
    genePool.toggleCurrents();
    // (the thread answers with the next snapshot: the button follows a little later)
    setTimeout( () => { document.getElementById( "currentsButton" ).classList.toggle( "activeButton", genePool.getCurrentsOn() ); }, 300 );
}

export function toggleGoalOverlay()
{
    genePool.toggleGoalOverlay();
    document.getElementById( "viewGoalButton" ).style = "border-color: " + ACTIVE_BORDER_COLOR
    document.getElementById( "viewGoalButton" ).style.borderWidth = "3px";
}

//-------------------------------
export function clearViewMode()
{
    genePool.clearViewMode();
    clearViewModeButtons();
}

//-------------------------------
export function clearViewModeButtons()
{
    document.getElementById( 'viewWholePoolButton'  ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewAutoTrackButton'  ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewSelectedButton'   ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewMutualButton'     ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewProlificButton'   ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewEfficientButton'  ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewVirginButton'     ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewGluttonButton'    ).style.borderColor = DEFAULT_BASIC_BUTTON_BORDER_COLOR;
    document.getElementById( 'viewWholePoolButton'  ).style.borderWidth = "1px";
    document.getElementById( 'viewAutoTrackButton'  ).style.borderWidth = "1px";
    document.getElementById( 'viewSelectedButton'   ).style.borderWidth = "1px";
    document.getElementById( 'viewMutualButton'     ).style.borderWidth = "1px";
    document.getElementById( 'viewProlificButton'   ).style.borderWidth = "1px";
    document.getElementById( 'viewEfficientButton'  ).style.borderWidth = "1px";
    document.getElementById( 'viewVirginButton'     ).style.borderWidth = "1px";
    document.getElementById( 'viewGluttonButton'    ).style.borderWidth = "1px";
    document.getElementById( 'viewWholePoolButton'  ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewAutoTrackButton'  ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewSelectedButton'   ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewMutualButton'     ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewProlificButton'   ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewEfficientButton'  ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewVirginButton'     ).style.borderBottomWidth = "4px";
    document.getElementById( 'viewGluttonButton'    ).style.borderBottomWidth = "4px";
}

//---------------------------------------
export function setViewMode( buttonID, viewMode )
{
    clearViewModeButtons();
    genePool.setViewMode( viewMode );
    closePopupPanel();
    if ( buttonID === 'viewSelectedButton' )
    {
        if ( genePool.getSelectedSwimbotID() != -1 )
        {
            document.getElementById( buttonID ).style = "border-color: " + ACTIVE_BORDER_COLOR
            document.getElementById( buttonID ).style.borderWidth =  "3px";
        }
    }
    else
    {
        document.getElementById( buttonID ).style = "border-color: " + ACTIVE_BORDER_COLOR
        document.getElementById( buttonID ).style.borderWidth =  "3px";
    }
}

//-------------------------------
export function choosePoolToLoad( pool )
{
    setChosenPoolToLoad( pool );
}

//------------------------------------
export function requestToLoadPoolFromFile()
{
    if ( _username === "anonymous" )
    {
        console.warn( tr("Cannot load pool: saving to a server is not available in this version") );
    }
    else
    {
        let poolText = tr("from file");
        document.getElementById( 'popUpPanel'               ).style.display = "block";
        document.getElementById( 'cancelPopUpPanelButton'   ).style.display = "block";
        document.getElementById( 'savePopUpPanelButton'     ).style.display = "block";
        document.getElementById( 'noSavePopUpPanelButton'   ).style.display = "block";
        document.getElementById( 'popUpPanel' ).innerHTML
        = "<br>"
        + tr("Do you want to save the current pool")
        + "<br>"
        + tr("before loading") + " " + poolText + "?";
    }
}

//--------------------------------------
export function requestToLoadPoolFromPreset()
{
    let poolText = "(ERROR)";
    if ( _chosenPoolToLoad === SimulationStartMode.RANDOM         ) { poolText = "'random'";        }
    else if ( _chosenPoolToLoad === SimulationStartMode.NEIGHBORHOOD   ) { poolText = "'neighborhood'";  }
    else if ( _chosenPoolToLoad === SimulationStartMode.FROGGIES       ) { poolText = "'froggies'";      }
    else if ( _chosenPoolToLoad === SimulationStartMode.TANGO          ) { poolText = "'tango'";         }
    else if ( _chosenPoolToLoad === SimulationStartMode.RACE           ) { poolText = "'race'";          }
    else if ( _chosenPoolToLoad === SimulationStartMode.BIG_BANG       ) { poolText = "'big bang'";      }
    else if ( _chosenPoolToLoad === SimulationStartMode.BAD_PARENTS    ) { poolText = "'bad parents'";   }
    else if ( _chosenPoolToLoad === SimulationStartMode.EMPTY          ) { poolText = "'empty'";         }
    switchToChosenPresetPool();
}

//----------------------------------
export function switchToChosenPresetPool()
{
    closePopupPanel();
    genePool.startSimulation( _chosenPoolToLoad );
    clearViewMode();
    updateEcosystemUI();
    _graph.initialize();
    setRendering( true );
}

//------------------------------------------------------------
// the user's own swimbots (src/ui/userSwimbots.ts): one button each
//------------------------------------------------------------
function setupUserSwimbots()
{
    const panel = document.getElementById( "userSwimbotsPanel" );
    if ( !panel ) return;
    panel.innerHTML = USER_SWIMBOTS.map( ( b, i ) =>
        "<button class='basicButton userSwimbotName' title='" + b.name + "' onClick='loadUserSwimbot(" + i + ")'>" + b.name + "</button>" ).join( "" );
}

export function loadUserSwimbot( i )
{
    genePool.createNewSwimbotWithGenes( USER_SWIMBOTS[i].genes.slice() );
}

//------------------------------------------------------------
// the graph: which stretch of time it shows
//------------------------------------------------------------
export function setGraphRange( steps )
{
    _graph.setRange( steps );
    document.querySelectorAll( "#graphRange .rangeButton" ).forEach( ( b: any ) => b.classList.toggle( "activeButton", Number( b.dataset.range ) === steps ));
    _graph.render();
}

//--------------------------------
export function loadSwimbotFromPreset(p)
{
    genePool.createSwimbotFromPreset( p );
}

//------------------------------------------------------
export function setGeneTweakCategory( selectedSwimbotID, c )
{
    _tweakGenesCategory = c;
    updateGeneSliders( selectedSwimbotID );
}

//---------------------------------------------
export function tweakGene( swimbotIndex, sliderIndex )
{
    let geneIndex = sliderIndex;
    if ( sliderIndex > 1 )
    {
        geneIndex += genePool.getNumGenesPerCategory() * _tweakGenesCategory;
    }
    let id = "geneTweaker" + sliderIndex;
    let input = document.getElementById( id );
    let geneValue = input.value;
    genePool.tweakGene( swimbotIndex, geneIndex, geneValue );
    id = "gene" + sliderIndex + "Value";
    document.getElementById( id ).innerHTML = geneValue;
}

//----------------------------
export function openInfoPanel()
{
    document.getElementById( 'infoPanel' ).classList.add( 'active' );
    setInfoPage( _currentInfoPage );
}

//---------------------------------------
export function advanceInfoPage( increment )
{
    _currentInfoPage += increment;
    if ( _currentInfoPage < FIRST_INFO_PAGE )
    {
        _currentInfoPage = FIRST_INFO_PAGE;
    }
    if ( _currentInfoPage > LAST_INFO_PAGE )
    {
        _currentInfoPage = LAST_INFO_PAGE;
    }
    setInfoPage( _currentInfoPage );
}

//---------------------------------------------
export function setInfoPage( pageNumber )
{
    document.getElementById( 'pageNumberLabel'  ).innerHTML = tr( "page" ) + " " + _currentInfoPage + " " + tr( "of" ) + " " + LAST_INFO_PAGE;
    document.getElementById( "infoText"         ).innerHTML = getInfoText( _currentInfoPage );
    if ( _currentInfoPage === FIRST_INFO_PAGE )
    {
        document.getElementById( 'prevInfoButton' ).style.visibility = 'hidden'
    }
    else
    {
        document.getElementById( 'prevInfoButton' ).style.visibility = 'visible'
    }
    if ( _currentInfoPage === LAST_INFO_PAGE )
    {
        document.getElementById( 'nextInfoButton' ).style.visibility = 'hidden'
    }
    else
    {
        document.getElementById( 'nextInfoButton' ).style.visibility = 'visible'
    }
}

//-----------------------
export function updateUI()
{
    let genePoolIsDefined = typeof genePool != 'undefined';
    if ( genePoolIsDefined )
    {
        if ( genePool.getViewMode() === ViewTrackingMode.NULL )
        {
            clearViewModeButtons();
        }
        if ( panelIsOpen( 'swimbotPanel' ) )
        {
            let selectedSwimbot = genePool.getSelectedSwimbotID();
            if ( selectedSwimbot === NULL_INDEX )
            {
                showPart( 'selectedSwimbotPanel',   false );
                showPart( 'noSelectedSwimbotPanel', true  );
                _lastSwimbotPanelHTML = "";
            }
            else
            {
                showPart( 'selectedSwimbotPanel',   true  );
                showPart( 'noSelectedSwimbotPanel', false );
                let swimbotPanelHTML = genePool.getSwimbotPanelHTML();

                if (swimbotPanelHTML !== _lastSwimbotPanelHTML)
                {
                    const card = document.getElementById( 'swimbotDataPanel' );
                    // (a pinned hint stays: the card is not rebuilt under the pointer while a "?" is held)
                    card.innerHTML = swimbotPanelHTML;
                    decorateSwimbotCard( card );
                    _lastSwimbotPanelHTML = swimbotPanelHTML;
                }
            }
        }
        if ( genePoolIsDefined )
        {
            _graph.update( genePool.getPopulationHistory() );
        }
        if ( panelIsOpen( 'graphPanel' ) )
        {
            const environment = genePool.getEnvironment();
            const history = genePool.getPopulationHistory();
            const predators = history.step.length > 0 ? history.predators[ history.step.length - 1 ] : 0;
            let graphDataHTML =
                tr("time step:") + " " + genePool.getTimeStep()
                + ( environment.active ? " (" + environment.seasonName() + ")" : "" )
                + "<br>"
                + "speed: " + Math.round( genePool.getStepsPerSecond() ) + " steps/sec"
                + " (threads: " + genePool.getNumThreads() + ")"
                
                + phaseTimesText()
                + "<br>"
                + "swimbots: " + genePool.getNumSwimbots() + " (predators: " + predators + ")"
                + "<br>"
                + genePool.getGeneticClustersText()
                + "<br>"
                + tr("green plants:") + " " + genePool.getNumFoodBitsOfType(0)
                + ( TWO_PLANT_TYPES ? "<br>" + tr("blue plants:") + " " + genePool.getNumFoodBitsOfType(1) : "" )
                + "<br>"
                + "meat: " + genePool.getNumFoodBitsOfType(2);
            if (graphDataHTML !== _lastGraphDataHTML)
            {
                document.getElementById( 'graphData' ).innerHTML = translateHTML( graphDataHTML );
                _lastGraphDataHTML = graphDataHTML;
            }
            _graph.render();
        }
    }
    updateHud();
    setTimeout( updateUI, UI_UPDATE_PERIOD );
}

//------------------------------------------------------------
// the status over the pool (also while the drawing is off)
//------------------------------------------------------------
function updateHud()
{
    if ( typeof genePool == "undefined" ) return;
    const history = genePool.getPopulationHistory();
    const n = history.step.length;
    const herbivores = n > 0 ? history.herbivores[ n - 1 ] : 0;
    const predators  = n > 0 ? history.predators [ n - 1 ] : 0;
    const plants     = n > 0 ? history.plants    [ n - 1 ] : 0;
    const environment = genePool.getEnvironment();
    const paused = !genePool.getSimulationRunning();
    const speedName = [ "", ">", ">>", ">>>" ][ genePool.getSpeedLevel() ] || "";

    const html =
        ( paused ? "<span class='hudPaused'>FROZEN (space)</span> · " : "" )
        + "step <b>" + genePool.getTimeStep() + "</b>"
        + ( environment.active ? " · " + environment.seasonName() : "" )
        + " · " + Math.round( genePool.getStepsPerSecond() ) + " steps/s " + speedName
        + "<br>"
        + "<span class='hudHerb'>herbivores " + herbivores + "</span> · "
        + "<span class='hudPred'>predators " + predators + "</span> · "
        + "<span class='hudPlant'>plants " + plants + "</span>"
        + (( genePool.getNumSick && genePool.getNumSick() > 0 ) ? " · <span style='color:#e6dc8c'>sick " + genePool.getNumSick() + "</span>" : "" );

    const shown = translateHTML( html );
    const hud = document.getElementById( "hud" );
    if ( hud && hud.innerHTML !== shown ) { hud.innerHTML = shown; }

    // the same, big, while the drawing is off (so it is clear what goes on)
    if ( !genePool.getRendering() )
    {
        const stats = document.getElementById( "noRenderStats" );
        if ( stats && stats.innerHTML !== shown ) { stats.innerHTML = shown; }
    }
}

//------------------------------------------------------------
// the keys help (press ? or F1)
//------------------------------------------------------------
export function toggleHelp()
{
    document.body.classList.toggle( "helpShown" );
}

// the tabs in order, for the Tab key
const TAB_ORDER = [ "menuPoolButton", "menuSwimbotButton", "menuTweakButton", "menuGraphButton", "menuInfoButton" ];

function nextTab()
{
    let current = 0;
    for ( let k = 0; k < TAB_ORDER.length; k++ )
    {
        const button = document.getElementById( TAB_ORDER[k] );
        if ( button && button.classList.contains( "active" )) { current = k; }
    }
    openPanel( TAB_ORDER[ ( current + 1 ) % TAB_ORDER.length ] );
}

// keys that are not camera keys; true = handled
function handleCommandKey( e ): boolean
{
    if ( e.repeat ) return false;
    switch ( e.code )
    {
        case "Space":  toggleSimulationRunning(); return true;
        case "Digit1": case "Numpad1": setSpeed( 1 ); return true;
        case "Digit2": case "Numpad2": setSpeed( 2 ); return true;
        case "Digit3": case "Numpad3": setSpeed( 3 ); return true;
        case "KeyR":   toggleRendering(); return true;
        case "KeyG":   toggleGoalOverlay(); return true;
        case "KeyC":   toggleCurrents(); return true;
        case "KeyV":   genePool.toggleGpuUpClose(); return true;
        case "KeyH":   togglePanel(); return true;
        case "Tab":    nextTab(); return true;
        case "F1":     toggleHelp(); return true;
        case "Slash":  if ( e.shiftKey ) { toggleHelp(); return true; } return false;
        case "Escape": document.body.classList.remove( "helpShown" ); return true;
    }
    return false;
}

//----------------------------------------
// how long a step takes, by phase (averaged since the last panel update)
//----------------------------------------
function phaseTimesText()
{
    const T = genePool.getPhaseTimes();
    const n = T[6];
    if ( !( n > 0 )) return "";
    const f = ( x ) => ( x / n ).toFixed( 1 );
    const text = "<br>step: " + f( T[5] ) + " " + tr("ms (brain") + " " + f( T[0] ) + tr(", move") + " " + f( T[1] ) + tr(", look") + " " + f( T[2] + T[3] ) + tr(", act") + " " + f( T[4] ) + ")";
    T.fill( 0 );
    return text;
}

//----------------------------------------
export function notifyGeneTweakPanelMouseDown()
{
    let selectedSwimbotID = genePool.getSelectedSwimbotID();
    if ( selectedSwimbotID === -1 )
    {
        closeTweakGenesPanel();
    }
    else
    {
        if ( document.getElementById( 'tweakGenesPanel' ).style.display === 'block' )
        {
            openTweakGenesPanel( selectedSwimbotID );
        }
    }
}

//------------------------------------------------------------
// hide the whole right panel to see more of the pool (key H)
//------------------------------------------------------------
export function togglePanel()
{
    const hidden = document.body.classList.toggle( "panelHidden" );
    const button = document.getElementById( "panelToggleButton" );
    button.innerHTML = hidden ? "&#x276E;" : "&#x276F;";
    button.title     = tr( hidden ? "show the panel (H)" : "hide the panel (H)" );
    window.dispatchEvent( new Event( "resize" ));
}

//----------------------
// under construction
//----------------------
export function resize()
{
    let rightMargin = ( document.body.classList.contains( "panelHidden" ) || document.body.classList.contains( "panelFloating" )) ? 0 : 400;   // (a panel moved off the edge floats over the pool)
    let width  = Math.max( 1, Math.floor( window.innerWidth  - rightMargin ));   // (a narrow window: at least 1)
    let height = Math.max( 1, Math.floor( window.innerHeight - 15 ));
    canvasID.style.width  = width  + "px";
    canvasID.style.height = height + "px";

    // the canvas was handed to the simulation thread: tell it the new size
    const resizeThread = ( window as any ).simThreadResize;
    if ( resizeThread ) { resizeThread( width, height ); return; }

    canvasID.width  = width;
    canvasID.height = height;
    let genePoolIsDefined = typeof genePool != 'undefined';
    if ( genePoolIsDefined )
    {
        genePool.setCanvasDimensions( canvasID.width, canvasID.height );
    }
}

//------------------------------------------------------------
// mouse position relative to the pool canvas
//------------------------------------------------------------
function canvasX( e ) { return e.pageX - document.getElementById( 'Canvas' ).offsetLeft; }
function canvasY( e ) { return e.pageY - document.getElementById( 'Canvas' ).offsetTop;  }

// middle mouse button held down: drag the view around
let _middleDragging = false;
let _middleDragX    = 0;
let _middleDragY    = 0;

//------------------------------------------------------------
document.getElementById( 'Canvas' ).onmousedown = function(e)
{
    if ( e.button === 1 ) // middle mouse button (the wheel)
    {
        e.preventDefault();
        _middleDragging = true;
        _middleDragX = canvasX(e);
        _middleDragY = canvasY(e);
        if ( typeof genePool != "undefined" ) { clearViewMode(); }
        return;
    }
    clearViewMode();
    if ( typeof genePool != "undefined" )
    {
        genePool.touchDown( canvasX(e), canvasY(e) );
    }
    notifyGeneTweakPanelMouseDown();
}

//------------------------------------------------------------
document.getElementById( 'Canvas' ).onmousemove = function(e)
{
    if ( typeof genePool == "undefined" ) return;

    if ( _middleDragging )
    {
        genePool.panCameraByScreenPixels( canvasX(e) - _middleDragX, canvasY(e) - _middleDragY );
        _middleDragX = canvasX(e);
        _middleDragY = canvasY(e);
        return;
    }
    genePool.touchMove( canvasX(e), canvasY(e) );
}

//------------------------------------------------------------
document.getElementById( 'Canvas' ).onmouseup = function(e)
{
    if ( e.button === 1 )
    {
        _middleDragging = false;
        return;
    }
    if ( typeof genePool != "undefined" )
    {
        genePool.touchUp( canvasX(e), canvasY(e) );
    }
}

// releasing the middle button outside the canvas also ends the drag
window.addEventListener( "mouseup", function(e) { if ( e.button === 1 ) { _middleDragging = false; } } );

//------------------------------------------------------------
document.getElementById( 'Canvas' ).onmouseout = function(e)
{
    if ( typeof genePool != "undefined" )
    {
        genePool.touchOut( canvasX(e), canvasY(e) );
    }
}

//------------------------------------------------------------
// mouse wheel: zoom towards the point under the cursor
//------------------------------------------------------------
document.getElementById( 'Canvas' ).onwheel = function(e)
{
    e.preventDefault(); // prevent page scrolling
    if ( typeof genePool != "undefined" )
    {
        clearViewMode();
        // deltaMode 1 = lines (some mice / Firefox), 0 = pixels
        let delta = ( e.deltaMode === 1 ) ? e.deltaY * 33 : e.deltaY;
        genePool.zoomCameraAtScreenPoint( canvasX(e), canvasY(e), delta );
    }
}

//------------------------------------------------------------
// keyboard: WASD / arrows move, Q E / - + zoom.
// e.code names the physical key, so it works with any keyboard
// layout (Russian too).
//------------------------------------------------------------
const CAMERA_KEYS =
{
    KeyW: CameraNavigationAction.UP,    ArrowUp:    CameraNavigationAction.UP,
    KeyS: CameraNavigationAction.DOWN,  ArrowDown:  CameraNavigationAction.DOWN,
    KeyA: CameraNavigationAction.LEFT,  ArrowLeft:  CameraNavigationAction.LEFT,
    KeyD: CameraNavigationAction.RIGHT, ArrowRight: CameraNavigationAction.RIGHT,
    KeyE: CameraNavigationAction.IN,    Equal:      CameraNavigationAction.IN,   NumpadAdd:      CameraNavigationAction.IN,
    KeyQ: CameraNavigationAction.OUT,   Minus:      CameraNavigationAction.OUT,  NumpadSubtract: CameraNavigationAction.OUT,
};

function isTypingInAField( e )
{
    const tag = e.target && e.target.tagName;
    return ( tag === "INPUT" ) || ( tag === "TEXTAREA" ) || ( tag === "SELECT" );
}

//--------------------------------
// key down
//--------------------------------
document.onkeydown = function(e: any)
{
    if ( typeof genePool == "undefined" ) return;
    if ( isTypingInAField(e) || e.ctrlKey || e.metaKey || e.altKey ) return;

    if ( handleCommandKey( e )) { e.preventDefault(); return; }

    const action = CAMERA_KEYS[ e.code ];
    if ( action === undefined ) return;

    e.preventDefault(); // arrows would scroll the page
    if ( ! genePool.getCameraNavigationActive( action ) )
    {
        genePool.startCameraNavigation( action );
        clearViewMode();
    }
}

//------------------------------
document.onkeyup = function(e: any)
{
    if ( typeof genePool == "undefined" ) return;

    const action = CAMERA_KEYS[ e.code ];
    if ( action !== undefined )
    {
        genePool.stopCameraNavigation( action );
    }
};

// switching to another window while a key is held: stop moving
window.addEventListener( "blur", function()
{
    if ( typeof genePool != "undefined" ) { genePool.stopAllCameraNavigation(); }
    _middleDragging = false;
});

// Add the toggleEternalSwimbot function
export function toggleEternalSwimbot( swimbotID )
{
    // the info panel is redrawn every frame, so it picks up the new status by itself
    genePool.toggleEternalSwimbot( swimbotID );
}


//----------------------------------------------------------
// world size: reload the page with ?world=1..4 (see World.ts)
//----------------------------------------------------------
export function setWorldSize( scale )
{
    if ( scale === WORLD_SCALE ) return;
    const url = new URL( window.location.href );
    url.searchParams.set( "world", String( scale ));
    window.location.href = url.toString();
}

export function showWorldSize()
{
    for ( let w = 1; w <= 4; w++ )
    {
        const button = document.getElementById( "world" + w + "Button" );
        if ( button ) { button.classList.toggle( "activeButton", w === WORLD_SCALE ); }
    }
}


//----------------------------------------------------------
// "petri" pool: read the settings typed in the panel, start
//----------------------------------------------------------
function readPetriSettings()
{
    const zones    = parseInt( ( document.getElementById( "petriZones" ) as HTMLInputElement ).value, 10 );
    const softness = parseFloat( ( document.getElementById( "petriSoftness" ) as HTMLInputElement ).value );
    petriSettings.zones    = Math.min( 12, Math.max( 2, isFinite( zones ) ? zones : 7 ));
    petriSettings.softness = Math.min( 1, Math.max( 0, isFinite( softness ) ? softness : 0.1 ));
}

export function showPetriPicture()
{
    readPetriSettings();
    const canvas = document.getElementById( "petriPicture" ) as HTMLCanvasElement;
    if ( canvas ) { drawPetriPreview( canvas, petriSettings.zones, petriSettings.layout, petriSettings.softness ); }
    const name = document.getElementById( "petriLayoutName" );
    if ( name ) { name.innerHTML = tr( "shape" ) + ": " + tr( PETRI_LAYOUTS[ petriSettings.layout ] ) + " · " + petriSettings.zones + " " + tr( "zones (click the picture to change the shape)" ); }
    rememberPetriSettings();
}

export function nextPetriLayout()
{
    petriSettings.layout = ( petriSettings.layout + 1 ) % PETRI_LAYOUTS.length;
    showPetriPicture();
}

// the petri settings are remembered in this browser (a convenience only)
const PETRI_STORAGE_KEY = "genepool.petri";

function rememberPetriSettings()
{
    try { localStorage.setItem( PETRI_STORAGE_KEY, JSON.stringify( petriSettings )); } catch ( e ) {}
}

function recallPetriSettings()
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

// put petriSettings into the panel (after a pool was loaded, at the start)
export function syncPetriPanel()
{
    petriSettings.layout = (( petriSettings.layout % PETRI_LAYOUTS.length ) + PETRI_LAYOUTS.length ) % PETRI_LAYOUTS.length;
    const zones    = document.getElementById( "petriZones" )    as HTMLInputElement;
    const softness = document.getElementById( "petriSoftness" ) as HTMLInputElement;
    if ( zones )    { zones.value    = String( petriSettings.zones ); }
    if ( softness ) { softness.value = String( petriSettings.softness ); }
    showPetriPicture();
    rememberPetriSettings();
}

export function startPetri()
{
    readPetriSettings();
    showPetriPicture();
    choosePoolToLoad( SimulationStartMode.PETRI );
    switchToChosenPresetPool();
}

export function setupPetriPanel()
{
    for ( const id of [ "petriZones", "petriSoftness" ] )
    {
        const input = document.getElementById( id );
        if ( input ) { input.addEventListener( "input", showPetriPicture ); }
    }
    recallPetriSettings();
    syncPetriPanel();
}
