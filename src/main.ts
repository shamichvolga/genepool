//------------------------------------------------------------------------------
// Entry point: loads every module, exposes them to the inline onclick="..."
// handlers in index.html, prepares the UI and starts the simulation.
//------------------------------------------------------------------------------
import "./setupCanvas";

import * as Brain           from "./simulation/Brain";
import * as Camera          from "./simulation/Camera";
import * as Embryology      from "./simulation/Embryology";
import * as FamilyTree      from "./simulation/FamilyTree";
import * as FoodBit         from "./simulation/FoodBit";
import * as GenePoolModule  from "./simulation/GenePool";
import * as Genotype        from "./simulation/Genotype";
import * as Globals         from "./simulation/Globals";
import * as MathConstants   from "./simulation/MathConstants";
import * as Obstacle        from "./simulation/Obstacle";
import * as Parameters      from "./simulation/Parameters";
import * as PhyloTree       from "./simulation/PhyloTree";
import * as Pool            from "./simulation/Pool";
import * as SpatialGrid     from "./simulation/SpatialGrid";
import * as Swimbot         from "./simulation/Swimbot";
import * as SwimbotRenderer from "./simulation/SwimbotRenderer";
import * as SwimbotTypes    from "./simulation/SwimbotTypes";
import * as Touch           from "./simulation/Touch";
import * as Utility         from "./simulation/Utility";
import * as Vector2D        from "./simulation/Vector2D";
import * as ViewTracking    from "./simulation/ViewTracking";

import * as graph    from "./ui/graph";
import * as info     from "./ui/info";
import * as logger   from "./ui/logger";
import * as saveLoad from "./ui/saveLoad";
import * as ui       from "./ui/ui";

//------------------------------------------------------------------------------
// The HTML buttons call functions and constants by their global names
// (onclick="choosePoolToLoad( SimulationStartMode.RANDOM )" and so on),
// so everything every module exports is also put on `window`.
//------------------------------------------------------------------------------
Object.assign( window,
    Brain, Camera, Embryology, FamilyTree, FoodBit, GenePoolModule, Genotype, Globals,
    MathConstants, Obstacle, Parameters, PhyloTree, Pool, SpatialGrid, Swimbot,
    SwimbotRenderer, SwimbotTypes, Touch, Utility, Vector2D, ViewTracking,
    graph, info, logger, saveLoad, ui );

//------------------------------------------------------------------------------
// prepare the UI: turn on the info panel and set it to the first page
//------------------------------------------------------------------------------
ui.resize();
ui.openInfoPanel();
ui.setInfoPage( 2 );
ui.initializeUI();

window.addEventListener( "resize", () => ui.resize() );

//------------------------------------------------------------------------------
// loading a single swimbot from a .json gene file
//------------------------------------------------------------------------------
document.getElementById( "loadSwimbotFile" ).addEventListener( "change", function( event: any )
{
    let file = event.target.files[0];
    if ( !file ) return;

    let reader = new FileReader();
    reader.onload = function( e: any )
    {
        try
        {
            let data = JSON.parse( e.target.result );
            let hasValidGenes = false;

            if ( data.genes && Array.isArray( data.genes ) && data.genes.length === Genotype.NUM_GENES )
            {
                hasValidGenes = true;
                for ( let i = 0; i < data.genes.length; i++ )
                {
                    let gene = data.genes[i];
                    let isInteger = ( typeof gene === "number" ) && isFinite( gene ) && ( Math.floor( gene ) === gene );
                    if ( !isInteger || gene < 0 || gene >= MathConstants.BYTE_SIZE )
                    {
                        hasValidGenes = false;
                        break;
                    }
                }
            }

            if ( hasValidGenes )
            {
                genePool.createNewSwimbotWithGenes( data.genes );
                alert( "Swimbot загружен успешно!" );
            }
            else
            {
                alert( "Ошибка: файл не содержит валидных генов." );
            }
        }
        catch ( err )
        {
            alert( "Ошибка чтения файла: " + err.message );
        }
    };
    reader.readAsText( file );
});

//------------------------------------------------------------------------------
// start the simulation once the page (images, styles) has loaded
//------------------------------------------------------------------------------
function startGenePool()
{
    const pool = new GenePoolModule.GenePool();
    ( window as any ).genePool = pool;

    pool.initialize();
    pool.setCanvas( canvas );
    pool.setCanvasDimensions( canvasID.width, canvasID.height );
    pool.setShowingViewTrackingMode( true );
}

if ( document.readyState === "complete" )
{
    startGenePool();
}
else
{
    window.addEventListener( "load", startGenePool );
}
