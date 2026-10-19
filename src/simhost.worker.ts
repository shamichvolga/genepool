//------------------------------------------------------------------------------
// The simulation thread. The whole Gene Pool lives here: the swimbots, the
// steps, the camera and the drawing (on the page's canvases, handed over as
// OffscreenCanvas). The page only shows the panels and sends what the user
// does; it never waits for the simulation, so the buttons stay responsive.
//
// page -> here : init, resize, visibility, call (do something), request
//                (do something and answer)
// here -> page : ready (things that never change), snapshot (what the panels
//                show, a few times a second and after every call), reply
//
// See RemotePool.ts for the page's side.
//------------------------------------------------------------------------------
import "./simulation/Globals";
import { GenePool } from "./simulation/GenePool";
import { CapsuleRenderer } from "./render/CapsuleRenderer";
import { ParallelRunner } from "./parallel/ParallelRunner";
import { sharedState } from "./simulation/SharedState";
import { petriSettings } from "./simulation/Petri";

const SNAPSHOT_PERIOD_MS = 250;
const TICK_MS            = 20;     // background ticks when no screen refresh comes

let pool: any = null;
let offscreen: any = null;
let glOffscreen: any = null;
let hidden = false;
let snapshotSoon = 0;

const post = ( message: any ) => ( self as any ).postMessage( message );

//------------------------------------------------------------
// what the panels show
//------------------------------------------------------------
function makeSnapshot()
{
    const selected    = pool.getSelectedSwimbotID();
    const environment = pool.getEnvironment();
    const history     = pool.getPopulationHistory();
    const phaseTimes  = pool.getPhaseTimes();

    const snapshot =
    {
        timeStep          : pool.getTimeStep(),
        numSwimbots       : pool.getNumSwimbots(),
        stepsPerSecond    : pool.getStepsPerSecond(),
        renderMs          : pool.getRenderMs(),
        numSick           : pool.getNumSick(),
        currentsOn        : pool.getCurrentsOn(),
        numThreads        : pool.getNumThreads(),
        speedLevel        : pool.getSpeedLevel(),
        simulationRunning : pool.getSimulationRunning(),
        rendering         : pool.getRendering(),
        selectedSwimbotID : selected,
        aSwimbotIsSelected: pool.getASwimbotIsSelected(),
        viewMode          : pool.getViewMode(),
        attraction        : pool.getAttraction(),
        foodGrowthDelay   : pool.getFoodGrowthDelay(),
        foodSpread        : pool.getFoodSpread(),
        foodBitEnergy     : pool.getFoodBitEnergy(),
        energyToOffspring : pool.getEnergyToOffspring(),
        maximumSwimbotAge : pool.getMaximumSwimbotAge(),
        hungerThreshold   : pool.getHungerThreshold(),
        history           : { interval: history.interval, step: history.step.slice(), herbivores: history.herbivores.slice(),
                              predators: history.predators.slice(), plants: history.plants.slice(), meat: history.meat.slice() },
        phaseTimes        : Array.from( phaseTimes ),
        environment       : { active: environment.active, season: environment.active ? environment.seasonName() : "" },
        foodOfType        : [ pool.getNumFoodBitsOfType( 0 ), pool.getNumFoodBitsOfType( 1 ), pool.getNumFoodBitsOfType( 2 ) ],
        swimbotPanelHTML  : ( selected >= 0 ) ? pool.getSwimbotPanelHTML() : "",
        geneticClustersText: pool.getGeneticClustersText(),
        petri             : { zones: petriSettings.zones, layout: petriSettings.layout, softness: petriSettings.softness },
        selected          : ( selected >= 0 ) ? {
                                id      : selected,
                                genes   : Array.from( pool.getSwimbotGenes( selected )),
                                energy  : pool.getSwimbotEnergy( selected ),
                                eternal : pool.getSwimbotEternalStatus( selected ),
                            } : null,
    };
    phaseTimes.fill( 0 );   // (the times are per snapshot)
    return snapshot;
}

function sendSnapshot()
{
    snapshotSoon = 0;
    if ( pool !== null ) { post({ type: "snapshot", data: makeSnapshot() }); }
}

// after a call: a fresh snapshot in a moment (several calls -> one snapshot)
function snapshotAfterCall()
{
    if ( snapshotSoon === 0 ) { snapshotSoon = setTimeout( sendSnapshot, 30 ) as any; }
}

//------------------------------------------------------------
// start
//------------------------------------------------------------
function init( message )
{
    offscreen   = message.canvas;
    glOffscreen = message.glCanvas;
    offscreen.width  = glOffscreen.width  = message.width;
    offscreen.height = glOffscreen.height = message.height;

    // the drawing code uses the global "canvas" (the 2D context), as on the page
    const context = offscreen.getContext( "2d" );
    ( self as any ).canvas   = context;
    ( self as any ).canvasID = offscreen;

    Object.assign( petriSettings, message.petri || {} );

    pool = new ( GenePool as any )();
    ( self as any ).genePool = pool;
    pool.initialize();
    pool.setCanvas( context );
    pool.setCanvasDimensions( message.width, message.height );
    pool.setShowingViewTrackingMode( true );
    pool.setCapsuleRenderer( CapsuleRenderer.create( glOffscreen ));

    // the step's threads (workers of this thread)
    const st = sharedState();
    if ( st.shared && ( typeof crossOriginIsolated === "undefined" || crossOriginIsolated ))
    {
        pool.setParallelRunner( new ParallelRunner( st, Math.max( 1, message.numWorkers )));
    }

    // things that never change, for the panels
    const numCategories = pool.getNumGeneCategories();
    const perCategory   = pool.getNumGenesPerCategory();
    const geneNames = [];
    for (let g = 0; g < numCategories * perCategory; g++) { geneNames.push( pool.getGeneName( g )); }
    post({ type: "ready", data: { numGeneCategories: numCategories, numGenesPerCategory: perCategory, geneNames }});

    setInterval( sendSnapshot, SNAPSHOT_PERIOD_MS );

    // no screen refresh (a hidden page): keep simulating without drawing.
    // Ticks that piled up while a frame was computed are skipped.
    let lastFrameEnd = 0;
    setInterval( () =>
    {
        const now = performance.now();
        if ( now - lastFrameEnd < 10 ) return;
        if ( hidden || pool.screenRefreshStalled( now ))
        {
            pool.runFrame( now, false );
            lastFrameEnd = performance.now();
        }
    }, TICK_MS );

    sendSnapshot();
}

//------------------------------------------------------------
// messages from the page
//------------------------------------------------------------
self.onmessage = ( e: MessageEvent ) =>
{
    const m = e.data;
    if ( m.type === "init" ) { init( m ); return; }
    if ( pool === null ) return;

    if ( m.type === "resize" )
    {
        m.width  = Math.max( 1, Math.floor( m.width  ));
        m.height = Math.max( 1, Math.floor( m.height ));
        offscreen.width  = glOffscreen.width  = m.width;
        offscreen.height = glOffscreen.height = m.height;
        pool.setCanvasDimensions( m.width, m.height );
    }
    else if ( m.type === "visibility" )
    {
        hidden = m.hidden;
    }
    else if ( m.type === "petri" )
    {
        Object.assign( petriSettings, m.petri );
    }
    else if ( m.type === "call" )
    {
        if ( typeof pool[ m.name ] === "function" ) { pool[ m.name ]( ...m.args ); }
        else { console.warn( "simulation thread: no such call:", m.name ); }
        snapshotAfterCall();
    }
    else if ( m.type === "request" )
    {
        let value = null;
        try { value = pool[ m.name ]( ...m.args ); }
        catch ( error ) { console.error( "simulation thread: request failed:", m.name, error ); }
        post({ type: "reply", id: m.id, value });
        snapshotAfterCall();
    }
};
