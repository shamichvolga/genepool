//------------------------------------------------------------------------------
// The page's side of the simulation thread (simhost.worker.ts).
//
// The panels call genePool.something() as before. Here genePool is a stand-in:
//   - what the panels read comes from the latest snapshot the thread sent
//     (a few times a second, and right after every action);
//   - everything else is sent to the thread as an action ("call"); the page
//     does not wait for it;
//   - things that take a while or return data (save the pool, the family
//     tree) go through genePool.request( name, ... ), a promise.
// A setter also changes the snapshot at once, so a button shows its new
// state immediately.
//------------------------------------------------------------------------------
import { petriSettings } from "./simulation/Petri";

export function createRemotePool( worker: Worker, onPetriLoaded: () => void )
{
    // until the first snapshot comes
    let S: any =
    {
        timeStep: 0, numSwimbots: 0, stepsPerSecond: 0, renderMs: 0, numThreads: 1, speedLevel: 1, simulationRunning: true, rendering: true,
        selectedSwimbotID: -1, aSwimbotIsSelected: false, viewMode: 0, attraction: 0,
        foodGrowthDelay: 0, foodSpread: 0, foodBitEnergy: 0, energyToOffspring: 0, maximumSwimbotAge: 0, hungerThreshold: 0,
        populationLimitEnabled: true, maximumSwimbotParts: 16,
        history: { interval: 50, step: [], herbivores: [], predators: [], plants: [], meat: [] },
        phaseTimes: [ 0, 0, 0, 0, 0, 0, 0, 0 ], environment: { active: false, season: "" }, foodOfType: [ 0, 0, 0 ],
        telemetry: { eTotal: 0, eInitial: 0, eDelta: 0, eBots: 0, ePlants: 0, eMeat: 0, eSoil: 0, eAmbient: 0, eAtmosphere: 0,
                     sprouts: 0, young: 0, grown: 0, trees: 0, herbSmall: 0, herbMed: 0, herbLarge: 0, predators: 0, soilTotal: 0 },
        swimbotPanelHTML: "", geneticClustersText: "genetic clusters: …", petri: null, selected: null,
    };
    let fixed: any = { numGeneCategories: 1, numGenesPerCategory: 1, geneNames: [] };
    const pending = new Map<number, ( value: any ) => void>();
    let nextId = 1;
    const cameraKeys = new Set<any>();

    worker.addEventListener( "message", ( e: MessageEvent ) =>
    {
        const m = e.data;
        if      ( m.type === "snapshot" ) { S = m.data; }
        else if ( m.type === "ready"    ) { fixed = m.data; }
        else if ( m.type === "reply"    )
        {
            const resolve = pending.get( m.id );
            if ( resolve ) { pending.delete( m.id ); resolve( m.value ); }
        }
    });

    const call    = ( name: string, ...args ) => worker.postMessage({ type: "call", name, args });
    const request = ( name: string, ...args ) => new Promise( ( resolve ) =>
    {
        const id = nextId ++;
        pending.set( id, resolve );
        worker.postMessage({ type: "request", id, name, args });
    });
    // the whole world as a file (gzip) and back: the thread answers with a "reply"
    const ask = ( message: any, transfer: any[] = [] ) => new Promise<any>( ( resolve ) =>
    {
        const id = nextId ++;
        pending.set( id, resolve );
        worker.postMessage({ ...message, id }, transfer );
    });
    const sel = ( id ) => ( S.selected && S.selected.id === id ) ? S.selected : null;

    const local: any =
    {
        request,

        saveWorldFile: ( withFamilyTree = true ) => ask({ type: "saveWorld", withFamilyTree }),
        loadWorldFile: ( bytes: Uint8Array ) => ask({ type: "loadWorld", bytes }, [ bytes.buffer ]),

        // renders 9 frames in the simulation thread and returns PNG bytes
        captureFilmstrip: () => request( "captureFilmstrip" ),

        // read from the snapshot
        getTimeStep:            () => S.timeStep,
        getNumSwimbots:         () => S.numSwimbots,
        getStepsPerSecond:      () => S.stepsPerSecond,
        getRenderMs:            () => S.renderMs,
        getNumSick:             () => S.numSick || 0,
        getCurrentsOn:          () => S.currentsOn,
        getShowSoil:            () => S.soilOn === true,
        getNumThreads:          () => S.numThreads,
        getSpeedLevel:          () => S.speedLevel,
        getSimulationRunning:   () => S.simulationRunning,
        getRendering:           () => S.rendering,
        getSelectedSwimbotID:   () => S.selectedSwimbotID,
        getASwimbotIsSelected:  () => S.aSwimbotIsSelected,
        getViewMode:            () => S.viewMode,
        getAttraction:          () => S.attraction,
        getFoodGrowthDelay:     () => S.foodGrowthDelay,
        getFoodSpread:          () => S.foodSpread,
        getFoodBitEnergy:       () => S.foodBitEnergy,
        getEnergyToOffspring:   () => S.energyToOffspring,
        getMaximumSwimbotAge:   () => S.maximumSwimbotAge,
        getHungerThreshold:     () => S.hungerThreshold,
        getPopulationLimitEnabled: () => S.populationLimitEnabled,
        getMaximumSwimbotParts: () => S.maximumSwimbotParts,
        getPopulationHistory:   () => S.history,
        getPhaseTimes:          () => S.phaseTimes,
        getTelemetry:           () => S.telemetry,
        getEnvironment:         () => ({ active: S.environment.active, seasonName: () => S.environment.season }),
        getNumFoodBitsOfType:   ( type ) => S.foodOfType[ type ] || 0,
        getSwimbotPanelHTML:    () => S.swimbotPanelHTML,
        getGeneticClustersText: () => S.geneticClustersText,
        getSwimbotGenes:        ( id ) => { const s = sel( id ); return s ? s.genes : []; },
        getGeneValue:           ( id, g ) => { const s = sel( id ); return s ? s.genes[g] : 0; },
        getSwimbotEnergy:       ( id ) => { const s = sel( id ); return s ? s.energy : 0; },
        getSwimbotEternalStatus:( id ) => { const s = sel( id ); return s ? s.eternal : false; },
        getGeneName:            ( g ) => fixed.geneNames[g] || "",
        getNumGenesPerCategory: () => fixed.numGenesPerCategory,
        getNumGeneCategories:   () => fixed.numGeneCategories,
        getCameraNavigationActive: ( action ) => cameraKeys.has( action ),

        // actions whose result the panel shows at once
        setRendering:            ( r ) => { S.rendering = r;                     call( "setRendering", r ); },
        setSimulationRunning:    ( r ) => { S.simulationRunning = r;             call( "setSimulationRunning", r ); },
        setSpeedLevel:           ( l ) => { S.speedLevel = l;                    call( "setSpeedLevel", l ); },
        setViewMode:             ( v ) => { S.viewMode = v;                      call( "setViewMode", v ); },
        setAttraction:           ( a ) => { S.attraction = a;                    call( "setAttraction", a ); },
        setFoodGrowthDelay:      ( v ) => { S.foodGrowthDelay = Number( v );     call( "setFoodGrowthDelay", v ); },
        setFoodSpread:           ( v ) => { S.foodSpread = Number( v );          call( "setFoodSpread", v ); },
        setFoodBitEnergy:        ( v ) => { S.foodBitEnergy = Number( v );       call( "setFoodBitEnergy", v ); },
        setOffspringEnergyRatio: ( v ) => { S.energyToOffspring = Number( v );   call( "setOffspringEnergyRatio", v ); },
        setMaximumSwimbotAge:    ( v ) => { S.maximumSwimbotAge = Number( v );   call( "setMaximumSwimbotAge", v ); },
        setHungerThreshold:      ( v ) => { S.hungerThreshold = Number( v );     call( "setHungerThreshold", v ); },
        setPopulationLimitEnabled: ( v ) => { S.populationLimitEnabled = Boolean( v ); call( "setPopulationLimitEnabled", v ); },
        setMaximumSwimbotParts:  ( v ) => { S.maximumSwimbotParts = Number( v );  call( "setMaximumSwimbotParts", v ); },
        startCameraNavigation:   ( a ) => { cameraKeys.add( a );    call( "startCameraNavigation", a ); },
        stopCameraNavigation:    ( a ) => { cameraKeys.delete( a ); call( "stopCameraNavigation", a ); },
        stopAllCameraNavigation: () => { cameraKeys.clear(); call( "stopAllCameraNavigation" ); },

        // a new pool uses the petri settings of the panel (they live here)
        startSimulation: ( mode ) =>
        {
            worker.postMessage({ type: "petri", petri: { zones: petriSettings.zones, layout: petriSettings.layout, softness: petriSettings.softness }});
            call( "startSimulation", mode );
        },

        // a loaded pool may bring its own petri settings: show them
        setPoolData: ( data ) =>
        {
            call( "setPoolData", data );
            request( "getPetriSettings" ).then( ( p ) =>
            {
                if ( p ) { Object.assign( petriSettings, p ); }
                onPetriLoaded();
            });
        },

        // the page's own loop does nothing: the thread runs the simulation
        runFrame:             () => {},
        screenRefreshStalled: () => false,
        setCanvas:            () => {},
        setCanvasDimensions:  () => {},
        setCapsuleRenderer:   () => {},
    };

    // anything else: an action for the thread
    return new Proxy( local, {
        get( target, name )
        {
            if ( name in target ) return target[ name ];
            if ( typeof name !== "string" || name === "then" ) return undefined;
            return ( ...args ) => call( name, ...args );
        },
    });
}
