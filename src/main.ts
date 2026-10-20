//------------------------------------------------------------------------------
// Entry point: loads every module, exposes them to the inline onclick="..."
// handlers in index.html, prepares the UI and starts the simulation.
//------------------------------------------------------------------------------
import { setupDevResume } from "./devResume";
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
import * as lang     from "./ui/lang";

import { CapsuleRenderer } from "./render/CapsuleRenderer";
import { ParallelRunner } from "./parallel/ParallelRunner";
import { sharedState } from "./simulation/SharedState";
import { SIM_IN_THREAD } from "./threadMode";
import { createRemotePool } from "./RemotePool";
import { WORLD_SCALE } from "./simulation/World";
import { petriSettings } from "./simulation/Petri";

//------------------------------------------------------------------------------
// The HTML buttons call functions and constants by their global names
// (onclick="choosePoolToLoad( SimulationStartMode.RANDOM )" and so on),
// so everything every module exports is also put on `window`.
//------------------------------------------------------------------------------
Object.assign( window,
    Brain, Camera, Embryology, FamilyTree, FoodBit, GenePoolModule, Genotype, Globals,
    MathConstants, Obstacle, Parameters, PhyloTree, Pool, Swimbot,
    SwimbotRenderer, SwimbotTypes, Touch, Utility, Vector2D, ViewTracking,
    graph, info, logger, saveLoad, ui, lang );

//------------------------------------------------------------------------------
// prepare the UI: turn on the info panel and set it to the first page
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
// graphics-card layer: same size and place as the pool canvas
//------------------------------------------------------------------------------
const glCanvas = document.getElementById( "GLCanvas" ) as HTMLCanvasElement;
// (it is not shown itself: the pool copies its picture into the 2D canvas, so
// that selection circles and the like are drawn on top of the bodies)
glCanvas.style.visibility = "hidden";
const capsuleRenderer = SIM_IN_THREAD ? null : CapsuleRenderer.create( glCanvas );
if ( !SIM_IN_THREAD && ( capsuleRenderer === null )) { console.warn( "No WebGL2: drawing everything the old way." ); }

function resizeAll()
{
    ui.resize();
    if ( !( window as any ).simThreadResize )      // (once handed to the thread, only the thread sizes it)
    {
        glCanvas.width  = canvasID.width;
        glCanvas.height = canvasID.height;
    }
    glCanvas.style.width  = canvasID.style.width;
    glCanvas.style.height = canvasID.style.height;
    glCanvas.style.left   = canvasID.offsetLeft + "px";
    glCanvas.style.top    = canvasID.offsetTop  + "px";
}

resizeAll();
ui.openPanel( "menuInfoButton" );
ui.setInfoPage( 2 );
ui.initializeUI();

window.addEventListener( "resize", resizeAll );

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
//------------------------------------------------------------------------------
// While the page is hidden (another tab, minimized window) the browser draws no
// frames; the metronome thread keeps the simulation going without drawing.
//------------------------------------------------------------------------------
function startBackgroundMetronome()
{
    const metronome = new Worker( new URL( "./metronome.worker.ts", import.meta.url ), { type: "module" } );
    let lastFrameEnd = 0;
    metronome.onmessage = () =>
    {
        if ( typeof genePool == "undefined" ) return;

        // ticks that piled up while the last frame was computed are skipped:
        // otherwise the page never gets a free moment (no panel updates, no
        // graph) - a frame of the fastest speed takes longer than a tick
        const now = performance.now();
        if ( now - lastFrameEnd < 10 ) return;

        // hidden page, or the browser stopped giving us screen refreshes
        // (a covered window, an embedded view): keep simulating without drawing
        if ( document.hidden || genePool.screenRefreshStalled( now ))
        {
            genePool.runFrame( now, false );
            lastFrameEnd = performance.now();
        }
    };
}

//------------------------------------------------------------------------------
// The whole simulation in its own thread (simhost.worker.ts): the canvases are
// handed over, the page keeps only the panels (genePool is a stand-in, see
// RemotePool.ts).
//------------------------------------------------------------------------------
function startGenePoolThread()
{
    const worker = new Worker( new URL( "./simhost.worker.ts", import.meta.url ), { type: "module", name: "world=" + WORLD_SCALE } );
    worker.onerror = ( e ) => console.error( "simulation thread failed:", e.message );

    const width  = canvasID.width, height = canvasID.height;
    const canvas2D = ( canvasID as any ).transferControlToOffscreen();
    const canvasGL = ( glCanvas as any ).transferControlToOffscreen();
    const numWorkers = Math.max( 1, Math.min( 7, ( navigator.hardwareConcurrency || 2 ) - 1 ));
    worker.postMessage({ type: "init", canvas: canvas2D, glCanvas: canvasGL, width, height, numWorkers,
                         petri: { zones: petriSettings.zones, layout: petriSettings.layout, softness: petriSettings.softness }},
                       [ canvas2D, canvasGL ] );

    ( window as any ).genePool = createRemotePool( worker, () => ui.syncPetriPanel() );
    ( window as any ).simThreadResize = ( w: number, h: number ) => worker.postMessage({ type: "resize", width: w, height: h });
    document.addEventListener( "visibilitychange", () => worker.postMessage({ type: "visibility", hidden: document.hidden }));
    resizeAll();

    ui.showWorldSize();
    ui.setupPetriPanel();
}

function startGenePool()
{
    if ( SIM_IN_THREAD ) { startGenePoolThread(); return; }

    const pool = new GenePoolModule.GenePool();
    ( window as any ).genePool = pool;

    pool.initialize();
    pool.setCanvas( canvas );
    pool.setCanvasDimensions( canvasID.width, canvasID.height );
    pool.setShowingViewTrackingMode( true );
    pool.setCapsuleRenderer( capsuleRenderer );

    //--------------------------------------------------------------------
    // stage 7: several threads move the bodies and look around. Needs
    // shared memory (the page is cross-origin isolated, see vite.config.ts).
    //--------------------------------------------------------------------
    const st = sharedState();
    if ( st.shared && ( typeof crossOriginIsolated !== "undefined" ) && crossOriginIsolated )
    {
        const numWorkers = Math.max( 1, Math.min( 7, ( navigator.hardwareConcurrency || 2 ) - 1 ));
        pool.setParallelRunner( new ParallelRunner( st, numWorkers ));
    }
    else
    {
        console.warn( "No shared memory: the simulation runs in one thread." );
    }

    startBackgroundMetronome();
    ui.showWorldSize();
    ui.setupPetriPanel();
}

setupDevResume();

if ( document.readyState === "complete" )
{
    startGenePool();
}
else
{
    window.addEventListener( "load", startGenePool );
}
