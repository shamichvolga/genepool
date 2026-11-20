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
import { startRunRecorder } from "./RunRecorder";
import { SimulationStartMode } from "./simulation/Globals";
import { WORLD_SCALE } from "./simulation/World";
import { setParameter } from "./simulation/ParamStore";
import { PROFILER_ENABLED, profEnter, profExit, PROF_SNAPSHOT } from "./simulation/Profiler";

const SNAPSHOT_PERIOD_MS = 500;
const CLUSTERS_CACHE_MS  = 2000;   // the genetic clustering is costly: twice a second is plenty
const TICK_MS            = 20;     // background ticks when no screen refresh comes

let pool: any = null;
let offscreen: any = null;
let glOffscreen: any = null;
let clustersText = "";
let clustersCachedAt = -1e9;
let hidden = false;
let snapshotSoon = 0;

const post = ( message: any, transfer: any[] = [] ) => ( self as any ).postMessage( message, transfer );

//------------------------------------------------------------
// what the panels show
//------------------------------------------------------------
function makeSnapshot()
{
    const profT0 = PROFILER_ENABLED ? profEnter( PROF_SNAPSHOT ) : 0;
    try
    {
    const selected    = pool.getSelectedSwimbotID();
    const environment = pool.getEnvironment();
    const history     = pool.getPopulationHistory();
    const phaseTimes  = pool.getPhaseTimes();

    // the genetic clustering is expensive; the panel does not need it fresh
    const now = ( typeof performance !== "undefined" ) ? performance.now() : Date.now();
    if ( now - clustersCachedAt > CLUSTERS_CACHE_MS )
    {
        clustersText = pool.getGeneticClustersText();
        clustersCachedAt = now;
    }

    const snapshot =
    {
        timeStep          : pool.getTimeStep(),
        numSwimbots       : pool.getNumSwimbots(),
        stepsPerSecond    : pool.getStepsPerSecond(),
        renderMs          : pool.getRenderMs(),
        numSick           : pool.getNumSick(),
        currentsOn        : pool.getCurrentsOn(),
        soilOn            : pool.getShowSoil(),
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
        populationLimitEnabled: pool.getPopulationLimitEnabled(),
        maximumSwimbotParts: pool.getMaximumSwimbotParts(),
        history           : { interval: history.interval, step: history.step.slice(), herbivores: history.herbivores.slice(),
                              predators: history.predators.slice(), plants: history.plants.slice(), meat: history.meat.slice() },
        phaseTimes        : Array.from( phaseTimes ),
        environment       : { active: environment.active, season: environment.active ? environment.seasonName() : "" },
        foodOfType        : [ pool.getNumFoodBitsOfType( 0 ), pool.getNumFoodBitsOfType( 1 ), pool.getNumFoodBitsOfType( 2 ) ],
        swimbotPanelHTML  : ( selected >= 0 ) ? pool.getSwimbotPanelHTML() : "",
        geneticClustersText: clustersText,
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
    finally { if ( PROFILER_ENABLED ) { profExit( PROF_SNAPSHOT, profT0 ); } }
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
    for ( const name in ( message.params || {} )) { setParameter( name, message.params[ name ] ); }   // (debug mode: the last settings)
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

    // what happens in this pool is written to runs/ (src/RunRecorder.ts)
    startRunRecorder( pool, () =>
    {
        const name = Object.keys( SimulationStartMode ).find( k => SimulationStartMode[ k ] === pool.startMode ) || "start";
        return name.toLowerCase() + "-world" + WORLD_SCALE;
    });

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
//------------------------------------------------------------
// the whole world to a file and back (gzip; see GenePool.saveWorld)
//------------------------------------------------------------
async function gzip( bytes: Uint8Array ): Promise<Uint8Array>
{
    const stream = new Blob([ bytes ]).stream().pipeThrough( new ( self as any ).CompressionStream( "gzip" ));
    return new Uint8Array( await new Response( stream ).arrayBuffer() );
}
async function gunzip( bytes: Uint8Array ): Promise<Uint8Array>
{
    const stream = new Blob([ bytes ]).stream().pipeThrough( new ( self as any ).DecompressionStream( "gzip" ));
    return new Uint8Array( await new Response( stream ).arrayBuffer() );
}

async function saveWorld( id: number, withFamilyTree: boolean )
{
    // (the snapshot is taken in one go, between two frames; the packing goes on while the world runs)
    const raw = pool.saveWorld( withFamilyTree );
    const clock = pool.getTimeStep();
    let value: any;
    try { value = { bytes: await gzip( raw ), clock }; }
    catch ( error ) { value = { error: String( error ) }; }
    post({ type: "reply", id, value }, value.bytes ? [ value.bytes.buffer ] : []);
}

async function loadWorld( id: number, bytes: Uint8Array )
{
    let value: any;
    try
    {
        const raw = ( bytes[0] === 0x1f && bytes[1] === 0x8b ) ? await gunzip( bytes ) : bytes;   // (gzip, or a plain file)
        value = pool.loadWorld( raw );
        if ( value.ok && pool.onWorldLoaded ) { pool.onWorldLoaded(); }
    }
    catch ( error ) { console.error( "loadWorld failed:", error ); value = { ok: false, reason: String(( error && ( error as any ).stack ) || error ) }; }
    post({ type: "reply", id, value });
    snapshotAfterCall();
}

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
    else if ( m.type === "saveWorld" ) { saveWorld( m.id, m.withFamilyTree !== false ); }
    else if ( m.type === "loadWorld" ) { loadWorld( m.id, m.bytes ); }
    else if ( m.type === "params" )
    {
        for ( const name in m.values ) { setParameter( name, m.values[ name ] ); }
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
