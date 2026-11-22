import { WORLD_AREA_FACTOR } from "./World";
import { CARCASS_ENABLED, DISEASE_ENABLED, CANNIBAL_GENE_FOUNDER_MAX, FOUNDER_ENERGY_FACTOR, LOD_MOUTH_MIN_SCALE, PLANT_REGROW_CHANCE, PLANT_REGROW_DELAY } from "./Parameters";
import { exportStrains, importStrains, seedDisease, updateDiseases } from "./Disease";
import { PILE_PARTS, PreparedZone, barrierFlat, insideAny, prepareZones, randomPointInZone } from "./MapZones";
import { plantCrown, plantLifespan, plantSize } from "./PlantSize";
import { PLANT_SIZE_ENABLED, PLANT_SEEDS_BY_SIZE, PLANT_LEAF_REGROWTH, PLANT_LIFESPAN, PLANT_SPROUT_ENERGY, PLANT_TREE_ENERGY,
         WOOD_PER_FRUIT_TIER, PLANT_FRUIT_PERIOD, PLANT_FRUIT_ENERGY, PLANT_CANOPY_RADIUS, SHADED_PLANT_AGING_FACTOR, WOOD_DECAY_STEPS } from "./Parameters";
import { Environment } from "./Environment";
import { Chunk, WORLD_FORMAT, layoutFingerprint, packWorld, unpackWorld } from "./WorldFile";
import { PARAM_DEFAULTS, PARAM_LIST, changedParams, setParameter } from "./ParamStore";
import { BRAIN_SIZE } from "./NeuralBrain";
import { WORLD_SCALE } from "./World";
import { MAX_PARTS, MIN_PARTS } from "./SwimbotTypes";
import { PROFILER_ENABLED, profEnter, profExit, profReportText, profReset, setProfilerEnabled, PROF_INTERACT, PROF_UPDATE_FOOD } from "./Profiler";
declare const __GENEPOOL_VERSION__: string;
import { currentAt, currentDriftX, currentDriftY, currentStrength, randomPointInCurrent } from "./Currents";
import { bindPlantGenes, inheritPlantGenes, plantMatureAge, plantOldAge, plantRotAge, plantSeedDistance } from "./PlantGenes";
import { geneAverage, convertOldGenes, GENE_LAYOUT_VERSION, setTrait, gaussian, thermalWidthToGene, preyTargetScore, GENES_PREDATOR, GENES_THERMAL_OPTIMUM, GENES_THERMAL_WIDTH, GENES_DIGESTION, GENES_BRIGHTNESS, GENES_CHOOSINESS, GENES_HUNGER, GENES_AUTOTOMY_BITE, GENES_AUTOTOMY_THREAT, GENES_AUTOTOMY_AMOUNT, GENES_AUTOTOMY_WHICH, GENES_PERSISTENCE, GENES_INVESTMENT, GENES_SIZE_PICKINESS, GENES_DEFERENCE, GENES_RUDDER, GENES_WEAK_PREY, GENES_IMMUNE, GENES_CANNIBAL, GENES_CURRENT, GENES_ASYMMETRY } from "./EcologyGenes";
import { environment, isFlatEnvironment, INITIAL_SOIL_NUTRIENT_PER_CELL, NUTRIENT_CYCLE_ENABLED, SWIMMING_ENERGY_RECYCLE_ENABLED, PLANT_CELL_SIZE, SOIL_DIFFUSION_INTERVAL, PLANT_TYPE_WARM, PLANT_TYPE_COLD, SEASONAL_PLANT_GROWTH_ENABLED, SEASONAL_PLANT_GROWTH_AMPLITUDE, SOIL_NUTRIENT_CAPACITY_PER_CELL } from "./Environment";
import { petriSettings, petriStartZone } from "./Petri";
import { IGNORE_FOOD_EFFICIENCY, preyVisibility, TWO_PLANT_TYPES } from "./Ecology";
import { START_ENERGY_FACTOR, PLANT_ROT_ENABLED, START_FOOD_FILL, START_FOOD_CLUMP, START_FOOD_CLUMP_RADIUS, PLANT_STAGES_SHOWN, NURSERY_ENABLED, NURSERY_STEPS, NURSERY_START_FOOD_FACTOR, NURSERY_EXTRA_SEEDS, PLANT_EVOLUTION_ENABLED, PLANT_SEED_PARENT_TRIES, CURRENTS_ENABLED, CURRENT_SPEED, CLASSIC_SEED_RAIN_FRACTION, MEAT_PIECE_ENERGY, MEAT_PIECE_SCATTER, PLANT_STAGES_ENABLED, PLANT_ROT_AGE, DIET_SWITCH_RATE, CLASSIC_NUM_SWIMBOTS, CLASSIC_NUM_FOODBITS, GARDEN_RADIUS, ENVIRONMENT_PLANT_SPREAD_RATE, ENVIRONMENT_SEEDS_PER_PERIOD, LOCAL_ENVIRONMENT_PLANT_GROWTH, PLANT_CELL_CAPACITY, PLANT_PARENT_SEED_FRACTION, PLANT_SEED_MIN_DISTANCE, PLANT_SEED_MAX_DISTANCE } from "./Parameters";

import { BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY } from "./Brain";
import { Camera } from "./Camera";
import { asymmetryFromGene, BRIGHTNESS_FROM_GENES, Embryology, isExperimentalEmbryologyGene } from "./Embryology";
import { FamilyTree } from "./FamilyTree";
import { DEFAULT_FOOD_BIT_ENERGY, DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS, FOOD_BIT_BOUNDARY_MARGIN, FOOD_BIT_GRAB_RADIUS, FOOD_BIT_SIZE, FOOD_BIT_SIZE_VIEW_SCALE, FOOD_OPACITY_INCREMENT, FoodBit, MAX_FOOD_BIT_ENERGY, MAX_FOOD_BIT_MAX_SPAWN_RADIUS, MIN_FOOD_BIT_ENERGY, MIN_FOOD_BIT_MAX_SPAWN_RADIUS } from "./FoodBit";
import { Genotype, NUM_GENES, PRESET_GENOTYPE_DARWIN, PRESET_GENOTYPE_DENNETT, PRESET_GENOTYPE_MENDEL, PRESET_GENOTYPE_TURING, PRESET_GENOTYPE_WILSON } from "./Genotype";
import { CameraNavigationAction, NUM_GENES_USED, SimulationStartMode, energyCycleCounters, getRandomState, globalTweakers, gpRandom, resetSimulationCounters, setRandomState, simClock, simCounters } from "./Globals";
import { drawFromAtmosphere, getAtmosphereEnergy, resetAtmosphere, transferToAtmosphere } from "./EnergyBudget";
import { BYTE_SIZE, MILLISECONDS_PER_SECOND, NULL_INDEX, ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { Obstacle } from "./Obstacle";
import { BARRIER_EXPERIMENT, DEFAULT_CHILD_ENERGY_RATIO, DEFAULT_FOOD_REGENERATION_PERIOD, DEFAULT_GARDEN_OF_EDEN_RADIUS, DEFAULT_MAXIMUM_AGE, DEFAULT_SWIMBOT_HUNGER_THRESHOLD, FOOD_LOCAL_CAPACITY, FOOD_LOCAL_RADIUS, FOOD_RANDOM_SEED_CHANCE, FOOD_SPROUT_RATE, INITIAL_NUM_FOODBITS, INITIAL_NUM_SWIMBOTS, INITIAL_PREDATOR_FRACTION, LOCAL_PLANT_GROWTH, LOCAL_PLANT_SEED_RADIUS, MAX_CHILD_ENERGY_RATIO, MAX_FOODBITS, MAX_FOODBITS_PER_TYPE, MAX_FOOD_REGENERATION_PERIOD, MEAT_SLOT_SHARE, MAX_MAXIMUM_AGE, MAX_SWIMBOTS, MAX_SWIMBOT_HUNGER_THRESHOLD, MEAT_DECAY_TIME, MIN_CHILD_ENERGY_RATIO, MIN_FOOD_REGENERATION_PERIOD, MIN_MAXIMUM_AGE, MIN_SWIMBOT_HUNGER_THRESHOLD, NON_REPRODUCING_JUNK_DNA_LIMIT, OBSTACLE_ENABLED, POPULATION_LIMIT, PREDATOR_LEVEL_THRESHOLD, PREY_MAX_MASS_RATIO, RANDOM_MATING_CONTROL, RENDER_SWIMBOT_AS_DOT, SWIMBOT_LEVEL_OF_DETAIL_DOT, SWIMBOT_LEVEL_OF_DETAIL_HIGH, SWIMBOT_LEVEL_OF_DETAIL_LOW, YOUNG_AGE_DURATION, CLOSED_ENERGY_CYCLE_ENABLED, ATMOSPHERE_RESERVE_WORLDS } from "./Parameters";
import { PhyloTree } from "./PhyloTree";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH, Pool } from "./Pool";
import { UniformGrid } from "./UniformGrid";
import * as SS from "./SharedState";
import { MATING_COOLDOWN_STEPS } from "./SharedState";
import { buildFamilyTreeText, buildSwimbotPanelHTML, geneticClustersText } from "../ui/panelTexts";
import { doTask, TASK_DECIDE, TASK_DECIDE_PHYSICS, TASK_LOOK, TASK_PHYSICS, TASK_PREPARE_LOOK, TASK_RENDER_DATA } from "../parallel/ParallelWork";
import { perceive, PerceptionScratch } from "./PerceptionKernel";
import { physicsStep, stepWakeGrid } from "./PhysicsKernel";
import { ORIGINAL_FOOD_ENABLED, WAKE_GRID_ENABLED } from "./Parameters";
import { Swimbot } from "./Swimbot";
import { ATTRACTION_RANDOM, ATTRACTION_SIMILAR_COLOR, NUM_ATTRACTIONS, STARVING, SWIMBOT_MOUTH_LENGTH, SWIMBOT_VIEW_RADIUS } from "./SwimbotTypes";
import { Touch, TouchState } from "./Touch";
import { assert, getRandomAngleInDegrees } from "./Utility";
import { Vector2D } from "./Vector2D";
import { ATTACK_SUCCESS_CHANCE, ENVIRONMENT_ATTACK_SUCCESS_CHANCE, PREDATOR_TARGET_SELECTION_ENABLED, PREDATION_ENERGY_TRANSFER, PREY_BODY_ENERGY, PREY_SCAN_COOLDOWN, SWIMBOT_MAX_ENERGY } from "./Parameters";
import { seedPredatorChoiceBrain } from "./NeuralBrain";
import { ViewTracking, ViewTrackingMode } from "./ViewTracking";
import { GenePoolState } from "./core/GenePoolState";
import { createGenePoolRenderer } from "./GenePoolRenderer";
import * as Serializer from "./GenePoolSerializer";
import { decayMeat, depositSoilEnergy, oasisCentersWorld, plantStageCap, seedSoilField, soilPlantGrowth, SOIL_START_ENERGY, stepSoilEcology } from "./SoilEcology";
import * as Telemetry from "./WorldTelemetry";
import * as FoodEcology from "./FoodEcology";
import * as Spawner from "./WorldSpawner";
import * as MapOps from "./MapOps";
import { rStrategyCooldownFactor, rStrategyReproductionEnergyFactor, killWinnerPressure, KILL_WINNER_REPRO_MULT } from "./Parameters";

// The living soil has its own ambient reservoir. Energy that a swimmer spends
// is split 70/30 between the soil under it and this reservoir; every sixteenth
// step 3% of the reservoir trickles back into the soil. Both buffers are part
// of the world total, so the split never creates or destroys energy.
let _totalWorldEnergy = 0;
let _showSoil = true;             // the soil overlay is on by default

//------------------
export function GenePool()
{
    let _this = this;

    function scheduleNextUpdate()
    {
        // in a browser the screen refresh drives the loop (see animationFrame)
        if ( _useAnimationFrames ) return;

        _this.timer = setTimeout(function() { _this.update(); }, _millisecondsPerUpdate);
    }

    //--------------------------------------------------------------------------
    // Browser main loop. The screen refresh (usually 60 times a second) calls
    // animationFrame. Each frame runs as many simulation steps as the chosen
    // speed asks for - within a time budget, so drawing never stalls - and
    // then draws once.
    //--------------------------------------------------------------------------
    const NORMAL_STEPS_PER_SECOND   = 50;   // speed ">"   (like the old 20 ms timer)
    const FAST_STEPS_PER_SECOND     = 250;  // speed ">>"
    const NORMAL_FRAME_BUDGET_MS    = 12;   // at most this much simulation per frame
    const FAST_FRAME_BUDGET_MS      = 25;   // speed ">>"
    const MAX_FRAME_BUDGET_MS       = 40;   // speed ">>>": as many steps as fit
    const OUTSIDE_POOL_COLOR        = "rgb( 22, 26, 30 )";   // the screen beyond the pool's edges
    const MAX_FRAME_BUDGET_DRAWN_MS = 14;   // leaves generous headroom for smooth 60fps UI & rendering
    let _speedLevel                 = 1;
    let _useAnimationFrames         = false;
    let _lastFrameTime              = 0;
    let _stepDebt                   = 0;    // simulation steps owed at normal speed
    let _stepsThisSecond            = 0;
    let _stepsPerSecond             = 0;    // measured, for display
    let _renderMs                   = 0;    // how long drawing a frame takes (smoothed)
    let _stepsSecondStart           = 0;

    let _lastAnimationFrame         = 0;    // when the screen refresh last called us

    function animationFrame( now )
    {
        _lastAnimationFrame = now;
        _this.runFrame( now );
        requestAnimationFrame( animationFrame );
    }

	//-----------------------------------
	// count-related constants
	//-----------------------------------
//const MAX_FOODBITS          = 2000;
//const INITIAL_NUM_SWIMBOTS  = 200;
//const INITIAL_NUM_FOODBITS  = 800;
    const TRAIL_LENGTH = 100;

    const NUM_NEIGHBORHOOD_SWIMBOTS = 14 * 14;
    const NUM_NEIGHBORHOOD_FOODBITS = 28 * 28;

	//---------------------------------------------
	// rendering-related constants
	//---------------------------------------------
    const DEFAULT_MILLISECONDS_PER_UPDATE = 20;

// viewScale is screen pixels per world unit. It is the same number the
    // renderers use for screen-space line widths, so the LOD switch and the
    // overlays stay in step when the camera is raised 3-4 times.
    const COLONY_COUNT = 14;    // the 14 richest oases, shared with WorldSpawner

    const INITIAL_VIEW_SCALE                = POOL_WIDTH * 0.1;
    const RACE_VIEW_SCALE                   = POOL_WIDTH * 0.3;
    const BANG_VIEW_SCALE                   = POOL_WIDTH * 0.2;
    const PARENT_VIEW_SCALE                 = POOL_WIDTH * 0.05;
    const NEIGHBORHOOD_VIEW_SCALE           = POOL_WIDTH * 0.4;
    const TEST_MINI_POOL_VIEW_SCALE         = 3200;   // a compact world for watching a few swimbots
    const NEIGHBORHOOD_FREQ                 = 5.0;
    const DEBUG_SHOW_SWIMBOT_TRAIL          = false;
    //const SWIMBOT_DATA_UPDATE_PERIOD        = 30;
    const CAMERA_TRACKING_UPDATE_PERIOD     = 10;
    const CLONE_SEPARATION                  = 10.0;
	//----------------------------------------------------
	// variables
	//----------------------------------------------------
	let _millisecondsPerUpdate  = 0;
	let _touch                  = new Touch();
	let _swimbots: any[]       = new Array( Swimbot );
	let _foodBits		        = new Array( MAX_FOODBITS );
    let _nearbySwimbotsArray    = new Array( BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS );
	let _viewTracking		    = new ViewTracking();
    let _potentialMate          = new Swimbot();
	let _chosenFoodBit          = new FoodBit();
	let _camera  		        = new Camera();
	let _obstacle               = new Obstacle();
	let _pool			        = new Pool();
	let _embryology		        = new Embryology();
	let _vectorUtility          = new Vector2D();
	let _myGenotype             = new Genotype();
    let _mateGenotype           = new Genotype();
    let _childGenotype          = new Genotype();
    let _neighborhoodX          = new Array();
    let _neighborhoodY          = new Array();
    let _neighborhoodAxis       = new Array();
	let _simulationRunning      = false;
	let _rendering              = false;
	let _swimbotBeingDragged    = false;
	let _foodBitBeingDragged    = false;
	let _poolCenter             = new Vector2D();
	let _canvas                 = null;
	let _clock                  = 0;
	let _lastFoodGridCount      = -1;   // food grid is rebuilt only when it must be
	let _numSwimbots 	        = 0;
    let _numNearbySwimbots      = 0;
	let _numFoodBits 	        = 0;
	let _canvasWidth            = 0;
	let _canvasHeight           = 0;
	let _mousedOverSwimbot      = NULL_INDEX;
    let _mousedOverFoodBit      = NULL_INDEX;
	let _selectedSwimbot        = NULL_INDEX;
	let _selectedFoodBit        = NULL_INDEX;
	let _startTime		        = ZERO;
	let _seconds		        = ZERO;
    let _gardenOfEdenRadius     = ZERO;
    const MATING_RECORD_SIZE = 2048;
    const _matingRecord      = new Float64Array( MATING_RECORD_SIZE * 2 );   // preferred temperatures of both parents
    const _matingBrightnessDifference = new Float64Array( MATING_RECORD_SIZE );
    const _matingChoosinessMean = new Float64Array( MATING_RECORD_SIZE );
    let _matingCount         = 0;
    let _gardens             = [];
    let _colonyCenters: { x: number, y: number, energy: number }[] = [];
    let _colonySites: { x: number, y: number }[][] = [];
    let _map: any            = null;    // a drawn map (map editor): its zones keep working while the world runs
    let _pendingMap: any     = null;
    let _mapPlantZones: PreparedZone[] = [], _mapMeatZones: PreparedZone[] = [];
    let _mapMeatRate         = 0;       // meat pieces per step that fall in the meat zones
    let _meatZoneDebt        = 0;
    let _nurseryDebt         = 0;       // (NURSERY_ENABLED)
    let _classicSeedDebt     = 0;
    let _serial              = 0;         // birth numbers (KIN_NOT_EATEN_ENABLED)
    let _seedDebt            = 0;       // fractional seeds carried to the next step
    const _energyBeforePhysics = ( SWIMMING_ENERGY_RECYCLE_ENABLED || CLOSED_ENERGY_CYCLE_ENABLED ) ? new Float64Array( MAX_SWIMBOTS ) : null;
    let _environmentImage    = null;    // picture of the temperature map (drawn behind the pool)
    const STARVING_FOOD_CHOICE = 15;   // below this energy a swimbot eats anything
	let _levelOfDetail	        = SWIMBOT_LEVEL_OF_DETAIL_LOW;
	let _viewScale		        = 1;   // screen pixels per pool unit
	let _previousTime           = ZERO;
	let _frameRate              = ZERO;
	let _debugTrail 		    = new Array( TRAIL_LENGTH );
	let _familyTree             = new FamilyTree();
	let _phyloTree              = new PhyloTree();
	let _panningLeft            = false;
	let _panningRight           = false;
	let _panningUp              = false;
	let _panningDown            = false;
    let _zoomingIn              = false;
    let _zoomingOut             = false;
    let _renderingGoals         = true;
    let _showViewTrackingMode   = false;
    let _windowWidth            = 0;
    let _windowHeight           = 0;
    let _fastMode               = false;
    let _fastRenderInterval     = 6;
    let _fastRenderCounter      = 0;
    let _savedRenderingGoals    = true;

    // camera control speeds
    const CAMERA_PAN_SPEED          = 0.9;      // view heights per second (keys)
    const CAMERA_KEY_ZOOM_SPEED     = 1.6;      // zoom speed with keys (bigger = faster)
    const CAMERA_WHEEL_ZOOM_SPEED   = 0.0015;   // zoom per unit of mouse wheel movement
    let _lastCameraNavigationTime   = 0;

    //--------------------------------------------------------------------------
    // Fast neighbour search: swimbot positions are copied into plain number
    // arrays, and two grids (swimbots, food) are rebuilt from them every step.
    //--------------------------------------------------------------------------
    // (stage 7: these arrays and grids live in the shared state, so that
    //  worker threads can read them; see SharedState.ts)
    const _st           = SS.sharedState();
    bindPlantGenes( _st );
    let _swimbotGrid    = _st.swimbotGrid;
    let _foodBitGrid    = _st.foodGrid;
    let _botX           = _st.botX;         // body center
    let _botY           = _st.botY;
    let _genitalX       = _st.genitalX;
    let _genitalY       = _st.genitalY;
    let _botAlive       = _st.alive;        // kept exact: see notifySwimbotDeathTime
    let _botEternal     = _st.eternal;
    let _botPredator    = _st.predator;     // predator level 0..1
    let _botBrightness  = _st.brightness;   // body brightness 0..1 (camouflage)
    let _botMass        = _st.mass;
    let _foodX          = _st.foodX;
    let _foodY          = _st.foodY;
    let _foodType       = _st.foodType;     // 0, 1 = plants, 2 = meat
    const _perceptionScratch = new PerceptionScratch( MAX_SWIMBOTS, MAX_FOODBITS );

    // runs the heavy phases over a list of swimbot slots (one thread here;
    // setParallelRunner can replace it with worker threads)
    let _runner: any =
    {
        getNumThreads() { return 1; },
        task( task, list, n ) { for (let i = 0; i < n; i++) { doTask( task, _st, _perceptionScratch, list[i], 0 ); } },
    };
    this.setParallelRunner = function( runner ) { _runner = runner; }
    this.getNumThreads     = function() { return _runner.getNumThreads(); }
    this.getParallelRunner = function() { return _runner; }
    let _perceptionMismatches = 0;          // PERCEPTION_CHECK: kernel and old code disagreed
    let _perceptionChecks     = 0;
    let _gridResult     = new Int32Array( MAX_SWIMBOTS * 2 );  // scratch for grid queries
    let _foodGridResult = new Int32Array( MAX_FOODBITS * 2 );
    const _plantShade   = new Float32Array( environment.plantCount[0].length );
    let _nearbyIndices  = new Int32Array( MAX_SWIMBOTS );      // swimbots within search radius
    // preallocated scratch: Z-order keys and one diffusion scratch grid
    const _mortonCodes  = new Int32Array( MAX_SWIMBOTS );
    const _foodMortonCodes = new Int32Array( MAX_FOODBITS );
    const _scentTmp     = new Float32Array( SS.SCENT_GRID_N * SS.SCENT_GRID_N );
    const _scentCellW   = POOL_WIDTH  / SS.SCENT_GRID_N;
    const _scentCellH   = POOL_HEIGHT / SS.SCENT_GRID_N;

    let _distanceCache = new Array(MAX_SWIMBOTS);
    let _lastSwimbotPositions = new Array(MAX_SWIMBOTS);
    let _aliveSwimbotIndices = [];
    let _aliveFoodBitIndices = [];
    let _aliveCachesDirty = true;
    let _swimbotWasAlive = new Array(MAX_SWIMBOTS);
    let _lastCameraPosition = new Vector2D();
    let _seedSource = new FoodBit(); // scratch: a stand-in parent position for seeding
    let _genitalPositionUtility = new Vector2D(); // scratch: another swimbot's genital position
    let _capsuleRenderer        = null;           // graphics-card renderer (browser only, may be absent)
    _lastCameraPosition.setXY(0, 0);

    let hhh = 0;

    //-------------------------------------
    // Renderer context: геттеры на переменные замыкания для GenePoolRenderer
    //-------------------------------------
    const _rendererContext = {
        get canvas() { return _canvas; },
        get camera() { return _camera; },
        get pool() { return _pool; },
        get obstacle() { return _obstacle; },
        get viewTracking() { return _viewTracking; },
        get swimbots() { return _swimbots; },
        get foodBits() { return _foodBits; },
        get aliveSwimbotIndices() { return _aliveSwimbotIndices; },
        get aliveFoodBitIndices() { return _aliveFoodBitIndices; },
        get st() { return _st; },
        get capsuleRenderer() { return _capsuleRenderer; },
        get canvasWidth() { return _canvasWidth; },
        get canvasHeight() { return _canvasHeight; },
        get selectedSwimbot() { return _selectedSwimbot; },
        get mousedOverSwimbot() { return _mousedOverSwimbot; },
        get selectedFoodBit() { return _selectedFoodBit; },
        get mousedOverFoodBit() { return _mousedOverFoodBit; },
        get levelOfDetail() { return _levelOfDetail; },
        get viewScale() { return _viewScale; },
        get renderingGoals() { return _renderingGoals; },
        get showViewTrackingMode() { return _showViewTrackingMode; },
        get gpuUpClose() { return _gpuUpClose; },
        get currentSpeed() { return _currentSpeed; },
        get clock() { return _clock; },
        get seconds() { return _seconds; },
        get runner() { return _runner; },
        get lastCameraPosition() { return _lastCameraPosition; },
        get lastSwimbotPositions() { return _lastSwimbotPositions; },
        get distanceCache() { return _distanceCache; },
        showSwimbotTrail: (s: number) => _this.showSwimbotTrail(s),
    };
    let _renderer: any = null;  // создаётся после инициализации переменных
    // the highest swimbot slot ever used (the pool has 24 000 of them, most empty)
    let _maxSwimbotSlot = 0;
    // where the last free slot was found: births start looking there, not at 0
    let _deadBotHint   = 0;
    let _deadPlantHint = 0;
    let _deadMeatHint  = 0;
    // the profiler window (the "P" key)
    let _profileStepsLeft   = 0;
    let _profileWindowSteps = 0;
    let _profilerText       = "";
    let _profileAutoPrint   = true;   // the browser "P" key prints; Node tools print themselves

	//-------------------------------------
	// create fixed-sized swimbot array
	//-------------------------------------
	for (let s=0; s<MAX_SWIMBOTS; s++)
	{
		_swimbots[s] = new Swimbot();
		_swimbots[s].setParent(this);
		_swimbots[s].bindSharedState(s);
        _lastSwimbotPositions[s] = new Vector2D();
        _distanceCache[s] = 0;
        _swimbotWasAlive[s] = false;
	}


    //------------------------------------------------------------
    // scratch arrays for picking the nearest perceived swimbots
    //------------------------------------------------------------
    let _candidateIndices   = new Int32Array(MAX_SWIMBOTS);
    let _candidateDistances = new Float64Array(MAX_SWIMBOTS);
    let _nearestIndices     = new Int32Array(BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS);
    let _nearestDistances   = new Float64Array(BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS);

    // a is "closer" than b: by distance, ties broken by swimbot index,
    // so the order never depends on how the grid happens to store them
    function isCloser( distanceA, indexA, distanceB, indexB )
    {
        return ( distanceA < distanceB ) || ( distanceA === distanceB && indexA < indexB );
    }

    //------------------------------------------------------------------
    // sort all candidates, nearest first (insertion sort)
    //------------------------------------------------------------------
    function sortCandidatesByDistance(count)
    {
        for (let i = 1; i < count; i++)
        {
            const index = _candidateIndices[i];
            const d     = _candidateDistances[i];
            let j = i - 1;
            while (j >= 0 && isCloser( d, index, _candidateDistances[j], _candidateIndices[j] ))
            {
                _candidateIndices  [j + 1] = _candidateIndices  [j];
                _candidateDistances[j + 1] = _candidateDistances[j];
                j--;
            }
            _candidateIndices  [j + 1] = index;
            _candidateDistances[j + 1] = d;
        }
    }

    //------------------------------------------------------------------
    // the `limit` nearest candidates, nearest first, into _nearestIndices
    // (keeps a short sorted list instead of sorting everything)
    //------------------------------------------------------------------
    function selectNearestCandidates( count, limit )
    {
        let kept = 0;
        for (let i = 0; i < count; i++)
        {
            const index = _candidateIndices[i];
            const d     = _candidateDistances[i];

            if (( kept === limit ) && !isCloser( d, index, _nearestDistances[ kept - 1 ], _nearestIndices[ kept - 1 ] )) continue;

            let j = ( kept < limit ) ? kept : kept - 1;
            if ( kept < limit ) kept ++;

            while (j > 0 && isCloser( d, index, _nearestDistances[j - 1], _nearestIndices[j - 1] ))
            {
                _nearestIndices  [j] = _nearestIndices  [j - 1];
                _nearestDistances[j] = _nearestDistances[j - 1];
                j--;
            }
            _nearestIndices  [j] = index;
            _nearestDistances[j] = d;
        }
        return kept;
    }

    //------------------------------------------------------------------
    // copy a swimbot's current state into the fast arrays.
    // Positions change every step (after update); the other values only
    // when a swimbot is born or edited between steps.
    //------------------------------------------------------------------
    function syncSwimbotPosition( s )
    {
        // (the swimbot keeps these in its row of the shared state)
        const k = s * SS.BOT_STRIDE, B = _st.bots;
        _botX    [s] = B[ k + SS.B_POS_X     ];
        _botY    [s] = B[ k + SS.B_POS_Y     ];
        _genitalX[s] = B[ k + SS.B_GENITAL_X ];
        _genitalY[s] = B[ k + SS.B_GENITAL_Y ];
    }

    function syncSwimbot( s )
    {
        const swimbot = _swimbots[s];
        syncSwimbotPosition( s );
        _botAlive   [s] = swimbot.getAlive() ? 1 : 0;
        _botEternal [s] = swimbot.isEternal() ? 1 : 0;
        _botPredator[s] = swimbot.getPredatorLevel();
        _botBrightness[s] = swimbot.getBrightness();
        _botMass    [s] = swimbot.getPhenotypeMass();
    }

    function rebuildAliveIndexCaches()
    {
        _aliveSwimbotIndices.length = 0;
        _aliveFoodBitIndices.length = 0;

        // (the alive flags are bytes in the shared state: fast to scan)
        const liveSwimbot = _st.liveSwimbot, liveFood = _st.liveFood;
        for (let s = 0; s < MAX_SWIMBOTS; s++) { if ( liveSwimbot[s] === 1 ) _aliveSwimbotIndices.push(s); }
        for (let f = 0; f < MAX_FOODBITS; f++) { if ( liveFood[f]    === 1 ) _aliveFoodBitIndices.push(f); }
        _aliveCachesDirty = false;
    }

	//---------------------------------------------------------
	// create fixed-sized perceived nearby swimbot array
	//---------------------------------------------------------
	for (let s=0; s<BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS; s++)
	{
		_nearbySwimbotsArray[s] = new Swimbot();
	}

	//-------------------------------------
	// create fixed-sized foodbit array
	//-------------------------------------
	for (let f=0; f<MAX_FOODBITS; f++)
	{
		_foodBits[f] = new FoodBit();
		_foodBits[f].bindShared( _st, f );
	}

	//-------------------------------------
	// create trail array
	//-------------------------------------
	for (let t=0; t<TRAIL_LENGTH; t++)
	{
		_debugTrail[t] = new Vector2D();
	}

	//-------------------------------
	// This is an important call!
	//-------------------------------
	this.setCanvas = function(c)
    {
        _canvas = c;
        //console.log( canvas );
    }

	//-------------------------------------------
	this.setCanvasDimensions = function( w, h )
    {
        //console.log( "setCanvasDimensions: " + w + ", " + h );

        _canvasWidth  = w;
        _canvasHeight = h;

        _camera.setAspectRatio( _canvasWidth / _canvasHeight );
    }


	//---------------------------
	this.initialize = function()
	{
		//----------------------------------
		// get pool center
		//----------------------------------
        _poolCenter.copyFrom( _pool.getCenter() );

		//------------------------------------
		// start with a random simulation
		//------------------------------------
        this.startSimulation( SimulationStartMode.RANDOM );

        _millisecondsPerUpdate = DEFAULT_MILLISECONDS_PER_UPDATE;

		//------------------------------------------
		// configure view tracking
		//------------------------------------------
//_viewTracking.setPoolCenter( _poolCenter );
        _viewTracking.setSwimbots( _swimbots );
        _viewTracking.setMode( ViewTrackingMode.AUTOTRACK, _camera.getPosition(), _camera.getScale(), 0 );

		//------------------------------------------------------------
		// start up the timer
		//------------------------------------------------------------
        if ( typeof requestAnimationFrame === "function" )
        {
            _useAnimationFrames = true;
            requestAnimationFrame( animationFrame );
        }
        else
        {
            scheduleNextUpdate();   // no screen (e.g. the headless test tools)
        }
	}


	//------------------------------------------
	this.onSwimbotDied = null;
	this.startMode = -1;
	// Live views for the extracted modules. Getters read the closure variables
	// on every access, so no state is copied and the worker layout is unchanged.
	const _foodContext: any =
	{
	    get st()                     { return _st; },
	    get foodBits()               { return _foodBits; },
	    get aliveFoodBitIndices()    { return _aliveFoodBitIndices; },
	    get plantShade()             { return _plantShade; },
	    get foodBitGrid()            { return _foodBitGrid; },
	    get foodGridResult()         { return _foodGridResult; },
	    get vectorUtility()          { return _vectorUtility; },
	    get seedSource()             { return _seedSource; },
	    get obstacle()               { return _obstacle; },
	    get environment()            { return environment; },
	    get ambientEnergy()          { return 0; },
	    get mapMeatRate()            { return _mapMeatRate; },
	    get clock()                  { return _clock; },
	    get currentSpeed()           { return _currentSpeed; },
	    get classicSeedDebt()        { return _classicSeedDebt; }, set classicSeedDebt(v) { _classicSeedDebt = v; },
	    api:
	    {
	        buildCanopyShade:        () => buildCanopyShade(),
	        killPlant:               (f) => killPlant( f ),
	        findLowestDeadFoodBitInArray: (meat) => this.findLowestDeadFoodBitInArray( meat ),
	        randomPointInPool:       (v) => this.randomPointInPool( v ),
	        choosePlantTypeAt:       (x, y) => this.choosePlantTypeAt( x, y ),
	        plantCanGrowAt:          (x, y, type) => this.plantCanGrowAt( x, y, type ),
	        findRandomLivingPlant:   () => this.findRandomLivingPlant(),
	        findRandomLivingFoodBit: (type) => this.findRandomLivingFoodBit( type ),
	        findSeedParent:          (type) => this.findSeedParent( type ),
	        placeSeed:               (child, parent, distance) => this.placeSeed( child, parent, distance ),
	        rainMapMeat:             () => this.rainMapMeat(),
	        regrowFoodOriginal:      (plants) => this.regrowFoodOriginal( plants ),
	        regrowFoodEnvironment:   (t0, t1) => this.regrowFoodEnvironment( t0, t1 )
	    }
	};
	const _presetFoodContext: any =
	{
	    get numFoodBits() { return _numFoodBits; }, set numFoodBits(v) { _numFoodBits = v; },
	    get foodBits() { return _foodBits; },
	    get poolCenter() { return _poolCenter; },
	    get aliveFoodBitIndices() { return _aliveFoodBitIndices; },
	    setFoodSpread:            (v) => this.setFoodSpread( v ),
	    setFoodGrowthDelay:       (v) => this.setFoodGrowthDelay( v )
	};
	function fundPlant( f, requested, donor: number = NULL_INDEX )
	{
	    return FoodEcology.fundPlant( _foodContext, f, requested, donor );
	}

	this.startSimulation = function( mode )
	{
	    this.startMode = mode;
	    _map = _pendingMap; _pendingMap = null;     // (only startSimulationWithMap starts with a map)
	    _meatZoneDebt = 0;
	    prepareMapZones();
//looks like numOffspring didn't get reset. fix this! (and any other related side effects

		//----------------------------
		// start time
		//----------------------------
		_startTime = (new Date).getTime();

		//----------------------------------
		// initialize pool
		//----------------------------------
		_seconds = ( (new Date).getTime() - _startTime ) / MILLISECONDS_PER_SECOND;
	    _pool.initialize( _seconds );

        //-------------------------
        // initialize camera
        //-------------------------
        _camera.setScale( INITIAL_VIEW_SCALE );
        _camera.setPosition( _poolCenter );

        //-------------------------
        // reset view control
        //-------------------------
        _viewTracking.reset();

        //-------------------------
        // reset family tree
        //-------------------------
        _familyTree.reset();

        //--------------------------------------
        // clear out all swimbots and food bits
        //--------------------------------------
        _numSwimbots = 0;
        _maxSwimbotSlot = 0;
        _deadBotHint = 0;
        _deadPlantHint = 0;
        _deadMeatHint = 0;
        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            _swimbots[s].die();
        }

        _numFoodBits = 0
        for (let f=0; f<MAX_FOODBITS; f++)
        {
            _foodBits[f].kill();
        }

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            _swimbotWasAlive[s] = false;
        }

        //-------------------------------------------------------------------
        // Here I set ecosystem tweak values to their defaults. Some of
        // them may be changed afterwards depending on the simulation mode.
        //-------------------------------------------------------------------
        this.setFoodGrowthDelay     ( DEFAULT_FOOD_REGENERATION_PERIOD  );
        this.setFoodSpread          ( DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS );
        this.setFoodBitEnergy       ( DEFAULT_FOOD_BIT_ENERGY           );
        this.setHungerThreshold     ( DEFAULT_SWIMBOT_HUNGER_THRESHOLD  );
        this.setAttraction          ( RANDOM_MATING_CONTROL ? ATTRACTION_RANDOM : ATTRACTION_SIMILAR_COLOR );
        this.setGardenOfEdenRadius  ( DEFAULT_GARDEN_OF_EDEN_RADIUS     );
        this.setOffspringEnergyRatio( DEFAULT_CHILD_ENERGY_RATIO        );
        this.setMaximumSwimbotAge   ( DEFAULT_MAXIMUM_AGE               );
        this.setPopulationLimitEnabled( true );
        this.setMaximumSwimbotParts ( 16 );

        // Closed energy cycle, driven by the "world energy" field in the UI.
        // worldEnergy = 5 is the reference world; 10 doubles the whole endowment.
        // Founders keep their starting energy outside the atmosphere; the
        // atmosphere funds only the soil, the first plants and a small reserve.
        // Clamping keeps a typo in the input from ruining the world.
        const worldEnergy = START_ENERGY_FACTOR;
        const energyMult = Math.max( 0.4, Math.min( 10, worldEnergy / 5 ));
        const START_FOOD_ENERGY        = INITIAL_NUM_FOODBITS * PLANT_SPROUT_ENERGY * energyMult;
        // The world runs without a water reservoir: all energy is in soilField
        // and bot/plant/meat bodies from the start (see ℙ62-bis). Atmosphere
        // stays at 0; it is only a transient between debits and credits.
        resetAtmosphere( SOIL_START_ENERGY * energyMult + START_FOOD_ENERGY );

        // the living soil starts each run with 24 dense oases, paid for out of
        // the same endowment (nothing is created from nothing)
        _st.soilField.fill( 0 );
        _st.foodSucking.fill( 0 );
        seedSoilField( _st, energyMult );
        _colonyCenters = oasisCentersWorld().slice( 0, COLONY_COUNT );
        _colonySites = [];
        for ( let c = 0; c < COLONY_COUNT; c++ ) { _colonySites.push([]); }

        //-------------------------------------------------------------------
        // The "random" pool lives in the new environment (temperature map,
        // warm and cold plants, several gardens) and fills the big world.
        // The classic presets keep the original rules and numbers.
        //-------------------------------------------------------------------
        const petri = ( mode === SimulationStartMode.PETRI );
        environment.active = ( mode === SimulationStartMode.RANDOM ) || petri;
        environment.setTime(0);
        _seedDebt = 0;
        _environmentImage = null;
        _matingCount = 0;

        if ( environment.active )
        {
            if ( _map && _map.environment )
            {
                // the map it was drawn on, then the painted temperatures
                environment.setState({ ..._map.environment, active: true, petri: null,
                                       paint: { blank: _map.base === "blank", zones: _map.zones.filter( z => z.kind === "warm" || z.kind === "cold" || z.kind === "mild" ) } });
            }
            else { environment.generate( petri ); }
            environment.resetSoilNutrients( NUTRIENT_CYCLE_ENABLED ? INITIAL_SOIL_NUTRIENT_PER_CELL : 0 );
            environment.copyBackgroundTo( _st.background );
            _gardens = petri ? [ _poolCenter ] : environment.gardenCenters();
            this.setGardenOfEdenRadius( GARDEN_RADIUS );
            _camera.setScale( POOL_WIDTH );   // show the whole world with all its gardens

            // Never create more founders than the simulation has slots for.
            _numSwimbots = Math.min( MAX_SWIMBOTS, Math.max( 0, Math.floor( INITIAL_NUM_SWIMBOTS )));
            _numFoodBits = INITIAL_NUM_FOODBITS;
            globalTweakers.numFoodTypes = TWO_PLANT_TYPES ? 2 : 1;
            if ( _map && (( _map.base === "blank" ) || ( _mapPlantZones.length > 0 ))) { environment.clearPlantCounts(); _numFoodBits = 0; }
            else { this.setFoodToEnvironment(); }
            if ( _map ) { this.fillMapZones(); }
            if ( _map ) { _numSwimbots = Math.min( MAX_SWIMBOTS, Math.floor( _map.seeds.length / 3 )); }
        }
        else
        {
            _numSwimbots = CLASSIC_NUM_SWIMBOTS;
            _numFoodBits = CLASSIC_NUM_FOODBITS;
            globalTweakers.numFoodTypes = 1;
            this.randomizeFood();
        }

        _environmentImage = environment.active ? environment.makeImage() : null;
        _pool.setBackgroundImage( _environmentImage );

        //console.log( "startSimulation: setOffspringEnergyRatio to default: " + DEFAULT_CHILD_ENERGY_RATIO );

        //---------------------------------------------------------------------
        // initialize various parameters according to simulation start mode
        //---------------------------------------------------------------------
        if ( mode === SimulationStartMode.RANDOM )
        {
            //this uses all default values
        }
        else if ( mode === SimulationStartMode.SPECIES )
        {
            globalTweakers.numFoodTypes = 2;
            this.randomizeFood(); // Important: do this after setting numFoodTypes!

//this.setGardenOfEdenRadius( 1500 ); /* again... */ this.randomizeFood();
this.setFoodGrowthDelay( 15 );
//this.setMaximumSwimbotAge( 15000 );
this.setMaximumSwimbotAge( 20000 );
_numSwimbots = 1000;
_numFoodBits = 2000;
this.setFoodToSpeciesConfiguration();
_camera.setScale( POOL_WIDTH );
        }
        else if ( mode === SimulationStartMode.FROGGIES )
        {
            //this.randomizeFood();
        }
        else if ( mode === SimulationStartMode.TANGO )
        {
            _numSwimbots = 2;
            //this.randomizeFood();
        }
        else if ( mode === SimulationStartMode.RACE )
        {
            _numSwimbots = 4;
            this.setFoodToRaceConfiguration();
            _camera.setScale( RACE_VIEW_SCALE );
        }
        else if ( mode === SimulationStartMode.BIG_BANG )
        {
            _numSwimbots = 100;
            this.setFoodToBangConfiguration();
            _camera.setScale( BANG_VIEW_SCALE );
        }
        else if ( mode === SimulationStartMode.BAD_PARENTS )
        {
            _numSwimbots = 2;
            this.setFoodToBadParentsConfiguration();

            this.setFoodGrowthDelay     ( 200 );
            this.setFoodSpread          ( 20 );
	        this.setHungerThreshold     ( 150 );
            this.setFoodBitEnergy       ( 6 );
            this.setOffspringEnergyRatio( 0.0001 );

            //console.log( "if ( mode === SimulationStartMode.BAD_PARENTS ): setOffspringEnergyRatio to 0.001" );

            _camera.setScale( PARENT_VIEW_SCALE );
        }
        else if ( mode === SimulationStartMode.BARRIER )
        {
            // the obstacle is initialized below to be in the middle of the pool!

            //this.setFoodToBarrierConfiguration();
            //this.randomizeFood();

            //_camera.setScale( PARENT_VIEW_SCALE );
        }
        else if ( mode === SimulationStartMode.NEIGHBORHOOD )
        {
            _camera.setScale( NEIGHBORHOOD_VIEW_SCALE );
            _numSwimbots = NUM_NEIGHBORHOOD_SWIMBOTS;
            this.randomizeNeighborhood();
            this.setFoodToNeighborhood( _poolCenter, _gardenOfEdenRadius );
        }
        else if ( mode === SimulationStartMode.EMPTY )
        {
            _numSwimbots = 0;
            //this.randomizeFood();
        }
        else if ( mode === SimulationStartMode.TEST_MINI_POOL )
        {
            _numSwimbots = 4;
            this.setFoodToTestMiniPool();
            _camera.setScale( TEST_MINI_POOL_VIEW_SCALE );
        }

        //----------------------------------
        // initialize swimbots
        //----------------------------------
        // The founding rules live in WorldSpawner; GenePool keeps only the
        // clock, the map state and the pool-wide reset performed above.
        Spawner.spawnFounders({
            mode, numSwimbots: _numSwimbots, poolCenter: _poolCenter,
            gardenOfEdenRadius: _gardenOfEdenRadius, swimbots: _swimbots,
            genotype: _myGenotype, embryology: _embryology, familyTree: _familyTree,
            clock: _clock, map: _map, environment, petri, energyMult,
            colonyCenters: _colonyCenters, colonySites: _colonySites,
            neighborhoodAxis: _neighborhoodAxis, neighborhoodX: _neighborhoodX, neighborhoodY: _neighborhoodY,
            api: {
                randomPointInZone:        (v, zone) => this.randomPointInZone( v, zone ),
                setEcologyGenesForPlace:  (g, x, y) => this.setEcologyGenesForPlace( g, x, y ),
                growFounderForSeed:       (seed) => this.growFounderForSeed( seed ),
                narrowFounderTolerance:   (g, x, y) => this.narrowFounderTolerance( g, x, y ),
                getSwimbotGenes:          (i) => this.getSwimbotGenes( i ),
                getSwimbotEvolutionTraits:(i) => this.getSwimbotEvolutionTraits( i )
            }
        });

        //--------------------------------------
        // initilize obstacle
        //--------------------------------------
		let end1 = new Vector2D();
		let end2 = new Vector2D();

		end1.setXY( POOL_LEFT + POOL_WIDTH * 0.005, POOL_TOP + POOL_HEIGHT * 0.005 );
		end2.setXY( POOL_LEFT + POOL_WIDTH * 0.01,  POOL_TOP + POOL_HEIGHT * 0.005 );

        if (( mode === SimulationStartMode.BARRIER ) || BARRIER_EXPERIMENT )
        {
    		end1.setXY( POOL_LEFT + POOL_WIDTH * 0.2, POOL_TOP + POOL_HEIGHT * ONE_HALF );
	    	end2.setXY( POOL_LEFT + POOL_WIDTH * 0.8, POOL_TOP + POOL_HEIGHT * ONE_HALF );
        }


        /*
        if ( mode === SimulationStartMode.RANDOM )
        {
    		end1.setXY( POOL_LEFT + POOL_WIDTH * 0.5, POOL_TOP + POOL_HEIGHT * 0.5 );
	    	end2.setXY( POOL_LEFT + POOL_WIDTH * 0.5, POOL_TOP + POOL_HEIGHT * 0.8 );
        }
        */

		_obstacle.setEndpointPositions( end1, end2 );
		_obstacle.setEnabled( OBSTACLE_ENABLED );
		if ( _map && _map.barrier )
		{
		    // the wall (or walls: a T, a fence...) drawn on the map
		    _obstacle.setSegments( barrierFlat( _map.barrier ));
		    _obstacle.setEnabled( true );
		}

        for (let m=0; m<10; m++)
        {
            moveFoodBitsFromObstacle();
        }

		//---------------------------------
		// clear this!
		//---------------------------------
        setSelectedSwimbot( NULL_INDEX );

        // the test pool is small: follow one bot right away so the zoom is useful
        if ( mode === SimulationStartMode.TEST_MINI_POOL )
        {
            setSelectedSwimbot( 0 );
            this.setViewMode( ViewTrackingMode.SELECTED );
        }

		//---------------------------------
		// set _simulationRunning to true
		//---------------------------------
		_simulationRunning = true;

		//---------------------------------
		// set rendering to true
		//---------------------------------
		_rendering = true;

		//---------------------------------
		// set rendering goals to true
		//---------------------------------
		_renderingGoals = true;

		//---------------------------------
		// reset clock to 0
		//---------------------------------
		_clock = 0;
		_lastFoodGridCount = -1;
		simClock.step = 0;
	    _numSick = 0;
	    _stepsWithoutSick = 0;
	    resetSimulationCounters();
	    resetHistory();

	    // the reference total is taken only after the founders and the starting
	    // plants are in place (and the soil has been seeded), so that the
	    // conservation check measures the closed loop, not the initialization
	    _totalWorldEnergy = this.getTotalWorldEnergy();
	}



	//----------------------------------------
	this.setGardenOfEdenRadius = function(r)
	{
	    _gardenOfEdenRadius = r;
	}

	//------------------------------------------------------------------------
	// founders get a temperature preference near the local temperature,
	// a moderate tolerance, and digestion suited to the local plants
	//------------------------------------------------------------------------
	this.setEcologyGenesForPlace = function( genotype, x, y )
	{
	    const t     = environment.temperatureAt( x, y );
	    const warm  = environment.plantSuitability( PLANT_TYPE_WARM, t );
	    const cold  = environment.plantSuitability( PLANT_TYPE_COLD, t );
	    const theta = Math.min( 1, Math.max( 0, t + gaussian() * 0.1 ));
	    const width = 0.10 + gpRandom() * 0.15;
	    const digestion = Math.min( 1, Math.max( 0, warm / ( warm + cold + 1e-9 ) + gaussian() * 0.15 ));

	    setTrait( genotype, GENES_THERMAL_OPTIMUM, theta,                       0.02 );
	    setTrait( genotype, GENES_THERMAL_WIDTH,   thermalWidthToGene( width ), 0.02 );
	    setTrait( genotype, GENES_DIGESTION,       digestion,                   0.02 );

	    // brightness genes chosen so the body (genes + temperature part) roughly matches the bottom
	    const shown      = environment.backgroundAt( x, y ) + gaussian() * 0.1;
	    const brightness = Math.min( 1, Math.max( 0, ( shown - ( 1 - BRIGHTNESS_FROM_GENES ) * theta ) / BRIGHTNESS_FROM_GENES ));
	    setTrait( genotype, GENES_BRIGHTNESS,      brightness,                  0.02 );
	    setTrait( genotype, GENES_CHOOSINESS,      0.2 + 0.4 * gpRandom(),      0.02 );
	    // autotomy: a little of it here and there, selection decides the rest
	    setTrait( genotype, GENES_AUTOTOMY_BITE,   0.3 * gpRandom(),            0 );
	    setTrait( genotype, GENES_AUTOTOMY_THREAT, 0.3 * gpRandom(),            0 );
	    setTrait( genotype, GENES_AUTOTOMY_AMOUNT, gpRandom(),                  0 );
	    // founders differ in how firmly they keep a food target, how much they
	    // give a child and how much a mate's size counts (selection decides)
	    setTrait( genotype, GENES_PERSISTENCE,     gpRandom(),                  0 );
	    setTrait( genotype, GENES_INVESTMENT,      0.3 + 0.4 * gpRandom(),      0 );
	    setTrait( genotype, GENES_SIZE_PICKINESS,  gpRandom(),                  0 );
	    setTrait( genotype, GENES_DEFERENCE,       gpRandom(),                  0 );
	    setTrait( genotype, GENES_RUDDER,          gpRandom(),                  0 );
	    setTrait( genotype, GENES_WEAK_PREY,       gpRandom(),                  0 );
	    for (let k = 0; k < 4; k++) { setTrait( genotype, [ GENES_IMMUNE[k] ], gpRandom(), 0 ); }
	    setTrait( genotype, GENES_CANNIBAL,        gpRandom() * CANNIBAL_GENE_FOUNDER_MAX, 0 );
	    setTrait( genotype, GENES_AUTOTOMY_WHICH,  gpRandom(),                  0 );
	    setTrait( genotype, GENES_CURRENT,         gpRandom(),                  0 );   // (the feel for the current: selection decides)

	    // hunger threshold factor around 1 (gene 1/3), a little different for each founder
	    setTrait( genotype, GENES_HUNGER,          1 / 3 + gaussian() * 0.06,   0 );
	}

	//------------------------------------------------------------------------
	// the starting food in the environment: most of it in the gardens, the rest
	// anywhere; each plant type only where the temperature suits it
	//------------------------------------------------------------------------
	this.setFoodToEnvironment = function()
	{
	    environment.clearPlantCounts();

	    // ORIGINAL_FOOD_ENABLED: as in the original - the starting plants anywhere in the pool, evenly
	    if ( ORIGINAL_FOOD_ENABLED )
	    {
	        let placed = 0;
	        for (let attempt = 0; ( placed < INITIAL_NUM_FOODBITS ) && ( attempt < INITIAL_NUM_FOODBITS * 20 ); attempt++)
	        {
	            this.randomPointInPool( _vectorUtility );
	            if ( _obstacle.getObstruction( _vectorUtility, _vectorUtility ) ) continue;
	            _foodBits[ placed ].initialize( placed );
	            _foodBits[ placed ].setType( 0 );
	            if ( !fundPlant( placed, globalTweakers.foodBitEnergy )) continue;
	            _foodBits[ placed ].setPosition( _vectorUtility );
	            environment.plantCount[0][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	            placed ++;
	        }
	        _numFoodBits = placed;
	        return;
	    }

	    // the world starts full of food (START_FOOD_FILL of all places), in
	    // little clumps; inside the starting gardens NURSERY_START_FOOD_FACTOR
	    // times as dense as elsewhere (petri: evenly)
	    const total = Math.floor( MAX_FOODBITS * START_FOOD_FILL );
	    const gardenArea = environment.petri ? 0 : _gardens.length * Math.PI * _gardenOfEdenRadius * _gardenOfEdenRadius;
	    const poolArea   = POOL_WIDTH * POOL_HEIGHT;
	    const density    = NURSERY_ENABLED ? NURSERY_START_FOOD_FACTOR : 3;
	    const gardenShare = gardenArea * density / ( gardenArea * density + Math.max( 0, poolArea - gardenArea ));

	    let placed = 0;
	    for (let attempt = 0; ( placed < total ) && ( attempt < total * 20 ); attempt++)
	    {
	        // the middle of a clump
	        if (( gpRandom() < gardenShare ) && ( _gardens.length > 0 ))
	        {
	            _vectorUtility.setToRandomLocationInDisk( _gardens[ Math.floor( gpRandom() * _gardens.length ) ], _gardenOfEdenRadius );
	        }
	        else
	        {
	            this.randomPointInPool( _vectorUtility );
	        }
	        const type = this.choosePlantTypeAt( _vectorUtility.x, _vectorUtility.y );
	        if ( !this.plantCanGrowAt( _vectorUtility.x, _vectorUtility.y, type )) continue;
	        const cx = _vectorUtility.x, cy = _vectorUtility.y;

	        // the clump
	        for (let k = 0; ( k < START_FOOD_CLUMP ) && ( placed < total ); k++)
	        {
	            const angle = gpRandom() * PI2, r = START_FOOD_CLUMP_RADIUS * Math.sqrt( gpRandom() );
	            _vectorUtility.x = cx + r * Math.cos( angle );
	            _vectorUtility.y = cy + r * Math.sin( angle );
	            _foodBits[ placed ].initialize( placed );
	            _foodBits[ placed ].setType( type );
            if ( !fundPlant( placed, globalTweakers.foodBitEnergy )) continue;
	            _foodBits[ placed ].setPosition( _vectorUtility );
	            if ( PLANT_SIZE_ENABLED ) { startPlantAge( placed ); }
	            environment.plantCount[ type ][ environment.plantCellIndex( _foodBits[ placed ].getPosition().x, _foodBits[ placed ].getPosition().y ) ] ++;
	            placed ++;
	        }
	    }

	    _numFoodBits = placed;
	}

	//------------------------------------------------------------------------
	// A drawn map (the map editor, src/ui/mapEditor.ts; the map is described
	// in MapZones.ts). Green zones: plants grow only there (and nowhere on a
	// blank map without them); red zones: no plants, meat at the start and
	// falling there as fast as it rots; temperature zones are painted into
	// the environment; each seed is one founder.
	//------------------------------------------------------------------------
	this.startSimulationWithMap = function( map )
	{
	    _pendingMap = map;
	    this.startSimulation( SimulationStartMode.RANDOM );
	}
	this.getMap = function() { return _map; }

	function prepareMapZones()
	{
	    _mapPlantZones = _map ? prepareZones( _map.zones, "plants" ) : [];
	    _mapMeatZones  = _map ? prepareZones( _map.zones, "meat"   ) : [];
	    const meatArea = _mapMeatZones.reduce( ( a, z ) => a + z.area, 0 );
	    _mapMeatRate = ( meatArea > 0 ) ? meatArea * standardFoodDensity() / MEAT_DECAY_TIME : 0;
	}

	// food per unit of area at the start of a normal world
	function standardFoodDensity() { return MAX_FOODBITS * START_FOOD_FILL / ( POOL_WIDTH * POOL_HEIGHT ); }

	function mapAllowsPlantsAt( x, y )
	{
	    if ( insideAny( _mapMeatZones, x, y )) return false;
	    if (( _map.base === "blank" ) || ( _mapPlantZones.length > 0 )) return insideAny( _mapPlantZones, x, y );
	    return true;
	}

	// a zone, chosen by area
	function pickZone( zones )
	{
	    const total = zones.reduce( ( a, z ) => a + z.area, 0 );
	    let r = gpRandom() * total;
	    for ( const z of zones ) { r -= z.area; if ( r <= 0 ) return z; }
	    return zones[ zones.length - 1 ];
	}

	this.fillMapZones = function()
	{
	    const density = standardFoodDensity();
	    // plants in the green zones, as dense as a normal world
	    for ( const zone of _mapPlantZones )
	    {
	        const target = Math.round( zone.area * density );
	        for (let k = 0, tries = 0; ( k < target ) && ( tries < target * 10 ); tries++)
	        {
	            if ( !randomPointInZone( zone, gpRandom, _vectorUtility )) break;
	            const type = this.choosePlantTypeAt( _vectorUtility.x, _vectorUtility.y );
	            if ( !this.plantCanGrowAt( _vectorUtility.x, _vectorUtility.y, type )) continue;
	            const f = this.findLowestDeadFoodBitInArray();
	            if ( f === NULL_INDEX ) return;
	            _foodBits[f].initialize( f );
	            _foodBits[f].setType( type );
	            if ( !fundPlant( f, globalTweakers.foodBitEnergy )) return;
	            _foodBits[f].setPosition( _vectorUtility );
	            if ( PLANT_SIZE_ENABLED ) { startPlantAge( f ); }
	            environment.plantCount[ type ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	            _numFoodBits ++;
	            k ++;
	        }
	    }
	    // meat in the red zones
	    for ( const zone of _mapMeatZones )
	    {
	        const target = Math.round( zone.area * density );
	        for (let k = 0; k < target; k++) { if ( !this.placeMapMeat( zone )) break; }
	    }
	}

	this.placeMapMeat = function( zone )
	{
	    return MapOps.placeMapMeat( this, zone );
	}

	// meat keeps falling in the red zones as fast as meat rots there
	this.rainMapMeat = function()
	{
	    _meatZoneDebt += _mapMeatRate;
	    while ( _meatZoneDebt >= 1 )
	    {
	        _meatZoneDebt -= 1;
	        if ( !this.placeMapMeat( pickZone( _mapMeatZones ))) { _meatZoneDebt = 0; break; }
	    }
	}

	// a founder for a seed: random genes, drawn again until the body has the
	// number of parts the seed asks for (the vanilla piles: within the pile's
	// range; the editor's range of parts limits both)
	this.growFounderForSeed = function( code )
	{
	    let lo = _map.partsMin || 3, hi = _map.partsMax || 16;
	    if ( code > 0 ) { lo = hi = code; }
	    else if ( code < 0 )
	    {
	        const pile = PILE_PARTS[ Math.min( 2, -code - 1 ) ];
	        const a = Math.max( lo, pile[0] ), b = Math.min( hi, pile[1] );
	        if ( a <= b ) { lo = a; hi = b; }
	    }
	    for (let attempt = 0; attempt < 300; attempt++)
	    {
	        const parts = _embryology.generatePhenotypeFromGenotype( _myGenotype ).numParts;
	        if ( parts >= lo && parts <= hi ) return;
	        _myGenotype.randomize();
	        for (let g = NUM_GENES_USED; g < NUM_GENES; g++) { if ( !isExperimentalEmbryologyGene( g )) { _myGenotype.setGeneValue( g, 0 ); } }
	        _myGenotype.setGeneValue( GENES_ASYMMETRY[0], Math.floor( gpRandom() * BYTE_SIZE ));
	    }
	}

	// what the map editor draws first: a newly generated map (as a new world
	// would get it), its gardens and sizes. Its random numbers do not touch
	// the running world (the state is put back).
		this.getMapPreview = function()
	{
	    return MapOps.getMapPreview( this );
	}

	function startPlantAge( f )
	{
	    const age = Math.floor( gpRandom() * PLANT_LIFESPAN * 0.25 );
	    _st.foodBorn[f] = _clock - age;
	    _st.foodWood[f] = Math.max( _st.foodWood[f], _st.foodEnergy[f] );
	}

	// petri: a random point inside zone z (the whole zone, not just a garden)
	this.randomPointInZone = function( v, z )
	{
	    for (let attempt = 0; attempt < 200; attempt++)
	    {
	        this.randomPointInPool( v );
	        if ( environment.zoneAt( v.x, v.y ) === z ) return;
	    }
	    v.setXY( _poolCenter.x, _poolCenter.y );
	}

	// petri: founders know only their own zone (exact temperature, narrow tolerance)
	this.narrowFounderTolerance = function( genotype, x, y )
	{
	    const t = environment.temperatureAt( x, y );
	    setTrait( genotype, GENES_THERMAL_OPTIMUM, Math.min( 1, Math.max( 0, t + gaussian() * 0.02 )), 0.01 );
	    setTrait( genotype, GENES_THERMAL_WIDTH,   thermalWidthToGene( 0.05 + gpRandom() * 0.05 ),    0.01 );
	}

	this.randomPointInPool = function( v )
	{
	    v.x = POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN + gpRandom() * ( POOL_WIDTH  - FOOD_BIT_BOUNDARY_MARGIN * 2 );
	    v.y = POOL_TOP  + FOOD_BIT_BOUNDARY_MARGIN + gpRandom() * ( POOL_HEIGHT - FOOD_BIT_BOUNDARY_MARGIN * 2 );
	}

	// Kept as a public method for older callers; the rule now lives in WorldSpawner.
	this.randomFounderPoint = function( v, founderIndex: number )
	{
	    Spawner.randomFounderPoint( { numSwimbots: _numSwimbots, colonyCenters: _colonyCenters, colonySites: _colonySites } as any, v, founderIndex );
	}

	// the plant type that suits a place better is chosen more often
	this.choosePlantTypeAt = function( x, y )
	{
	    if ( !TWO_PLANT_TYPES ) return PLANT_TYPE_WARM;     // one food for everybody (green)
	    const t    = environment.temperatureAt( x, y );
	    const warm = environment.plantSuitability( PLANT_TYPE_WARM, t );
	    const cold = environment.plantSuitability( PLANT_TYPE_COLD, t );
	    return ( gpRandom() * ( warm + cold ) < warm ) ? PLANT_TYPE_WARM : PLANT_TYPE_COLD;
	}

	// a seed takes root with a chance = how well its type suits the temperature,
	// and only where the place is not already crowded
	this.plantCanGrowAt = function( x, y, type )
	{
	    if (( x < POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN ) || ( x > POOL_RIGHT  - FOOD_BIT_BOUNDARY_MARGIN )) return false;
	    if (( y < POOL_TOP  + FOOD_BIT_BOUNDARY_MARGIN ) || ( y > POOL_BOTTOM - FOOD_BIT_BOUNDARY_MARGIN )) return false;

	    if ( _map && !mapAllowsPlantsAt( x, y )) return false;
	    const cell = environment.plantCellIndex( x, y );
	    if ( environment.plantCount[0][ cell ] + environment.plantCount[1][ cell ] >= PLANT_CELL_CAPACITY ) return false;

	    if ( !TWO_PLANT_TYPES ) return true;                // one food: grows anywhere there is room
	    return gpRandom() < environment.plantSuitability( type, environment.temperatureAt( x, y ));
	}

	//------------------------------------------------------------------------
	// plants in the environment: a steady number of seeds per step (like the
	// classic pool, scaled with the world). Most seeds fall 300-600 units from
	// a parent plant of the same type; the rest are "seed rain" anywhere, so
	// that no region stays empty for good.
	//------------------------------------------------------------------------
	this.regrowFoodEnvironment = function( numType0FoodBits, numType1FoodBits )
	{
	    const seasonalPlantGrowth = SEASONAL_PLANT_GROWTH_ENABLED
	        && environment.active && !isFlatEnvironment() && !environment.petri
	        ? Math.max( 0, 1 + SEASONAL_PLANT_GROWTH_AMPLITUDE * environment.seasonPhase() )
	        : 1;
	    let parentSeedChance = PLANT_PARENT_SEED_FRACTION;
	    if ( LOCAL_ENVIRONMENT_PLANT_GROWTH )
	    {
	        const numPlants = numType0FoodBits + numType1FoodBits;
	        const rainRate = ENVIRONMENT_SEEDS_PER_PERIOD * ( 1 - PLANT_PARENT_SEED_FRACTION );
	        const localRate = numPlants * ENVIRONMENT_PLANT_SPREAD_RATE;
	        const totalRate = rainRate + localRate;
	        _seedDebt += totalRate * seasonalPlantGrowth / globalTweakers.foodRegenerationPeriod;
	        parentSeedChance = totalRate > 0 ? localRate / totalRate : 0;
	    }
	    else { _seedDebt += ENVIRONMENT_SEEDS_PER_PERIOD * seasonalPlantGrowth / globalTweakers.foodRegenerationPeriod; }

	    // NURSERY_ENABLED: at first extra seeds, all in the gardens (fading out)
	    const nursery = ( NURSERY_ENABLED && !environment.petri && ( _gardens.length > 0 )) ? Math.max( 0, 1 - _clock / NURSERY_STEPS ) : 0;
	    if ( nursery > 0 ) { _nurseryDebt += nursery * NURSERY_EXTRA_SEEDS * ENVIRONMENT_SEEDS_PER_PERIOD / globalTweakers.foodRegenerationPeriod; }
	    while ( _nurseryDebt >= 1 )
	    {
	        _nurseryDebt -= 1;
	        for (let attempt = 0; attempt < 12; attempt++)
	        {
	            _vectorUtility.setToRandomLocationInDisk( _gardens[ Math.floor( gpRandom() * _gardens.length ) ], _gardenOfEdenRadius );
	            const type = this.choosePlantTypeAt( _vectorUtility.x, _vectorUtility.y );
	            if ( !this.plantCanGrowAt( _vectorUtility.x, _vectorUtility.y, type )) continue;
	            const child = this.findLowestDeadFoodBitInArray();
	            if ( child === NULL_INDEX ) break;
	            _foodBits[ child ].initialize( child );
	            _foodBits[ child ].setType( type );
	            if ( !fundPlant( child, globalTweakers.foodBitEnergy )) return;
	            _foodBits[ child ].setPosition( _vectorUtility );
	            environment.plantCount[ type ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	            simCounters.nurserySprouts ++;
	            break;
	        }
	    }

	    while ( _seedDebt >= 1 )
	    {
	        _seedDebt -= 1;

	        for (let attempt = 0; attempt < 12; attempt++)
	        {
	            let type;
	            let parent = ( gpRandom() < parentSeedChance ) ? this.findRandomLivingPlant() : null;
	            if ( PLANT_EVOLUTION_ENABLED && ( parent !== null ))
	            {
	                // (a grown-up one, if one is found in a few tries)
	                for (let k = 0; ( k < PLANT_SEED_PARENT_TRIES ) && ( parent.getAge() < plantMatureAge( parent.getIndex() )); k++)
	                {
	                    const other = this.findRandomLivingPlant();
	                    if ( other !== null ) { parent = other; }
	                }
	            }

	            if ( PLANT_SIZE_ENABLED && PLANT_SEEDS_BY_SIZE && ( parent !== null ))
	            {
	                // a plant makes seeds as it is grown: a sprout hardly, a tree surely
	                let grown = gpRandom() < plantSize( parent.getWood() );
	                for (let k = 0; ( k < PLANT_SEED_PARENT_TRIES ) && !grown; k++)
	                {
	                    const other = this.findRandomLivingPlant();
	                    if ( other !== null ) { parent = other; grown = gpRandom() < plantSize( other.getWood() ); }
	                }
	                if ( !grown ) break;         // (no grown plant found: no seed this time)
	            }

	            if ( parent !== null )
	            {
	                type = parent.getType();
	                const distance = PLANT_EVOLUTION_ENABLED ? plantSeedDistance( parent.getIndex() ) * ( 0.5 + gpRandom() )
	                               : PLANT_SEED_MIN_DISTANCE + gpRandom() * ( PLANT_SEED_MAX_DISTANCE - PLANT_SEED_MIN_DISTANCE );
	                const angle    = gpRandom() * PI2;
	                _vectorUtility.x = parent.getPosition().x + distance * Math.cos( angle );
	                _vectorUtility.y = parent.getPosition().y + distance * Math.sin( angle );
	            }
	            else
	            {
	                this.randomPointInPool( _vectorUtility );
	                type = this.choosePlantTypeAt( _vectorUtility.x, _vectorUtility.y );
	            }

	            // (with one food for everybody, it may fill the whole food store)
	            if (( type === PLANT_TYPE_WARM ) && ( numType0FoodBits >= ( TWO_PLANT_TYPES ? MAX_FOODBITS_PER_TYPE : MAX_FOODBITS ))) continue;
	            if (( type === PLANT_TYPE_COLD ) && ( numType1FoodBits >= MAX_FOODBITS_PER_TYPE )) continue;
	            if ( !this.plantCanGrowAt( _vectorUtility.x, _vectorUtility.y, type )) continue;
	            if (( parent !== null ) && _obstacle.getObstruction( parent.getPosition(), _vectorUtility )) continue;

	            const child = this.findLowestDeadFoodBitInArray();
	            if ( child === NULL_INDEX ) return;

	            _foodBits[ child ].initialize( child );
	            if ( PLANT_EVOLUTION_ENABLED && ( parent !== null )) { inheritPlantGenes( child, parent.getIndex() ); }
	            _foodBits[ child ].setType( type );
	            if ( !fundPlant( child, globalTweakers.foodBitEnergy, parent !== null ? parent.getIndex() : NULL_INDEX )) return;
	            _foodBits[ child ].setPosition( _vectorUtility );
	            environment.plantCount[ type ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	            if ( type === PLANT_TYPE_WARM ) { numType0FoodBits ++; } else { numType1FoodBits ++; }
	            if ( parent !== null ) { simCounters.localPlantSprouts ++; }
	            else { simCounters.seedRainPlantSprouts ++; }
	            break;
	        }
	    }
	}

	//------------------------------------------------------------------------
	// ORIGINAL_FOOD_ENABLED: plants grow as in the original Gene Pool. Every
	// "food growth delay" steps, one new plant per 8000 x 8000 of pool, next to
	// a random living plant: along x and y it lands (random x random) x spread
	// away, either way (most near the parent, a few far), bouncing off the pool's
	// edge; not behind the obstacle (10 tries, as the original). No living plant,
	// no new one.
	//------------------------------------------------------------------------
	this.regrowFoodOriginal = function( numPlants )
	{
	    if ( _clock % globalTweakers.foodRegenerationPeriod !== 0 ) return;
	    const spread = globalTweakers.foodSpread * WORLD_SCALE;
	    const left = POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN, right  = POOL_RIGHT  - FOOD_BIT_BOUNDARY_MARGIN;
	    const top  = POOL_TOP  + FOOD_BIT_BOUNDARY_MARGIN, bottom = POOL_BOTTOM - FOOD_BIT_BOUNDARY_MARGIN;
	    for (let n = 0; n < WORLD_AREA_FACTOR; n++)
	    {
	        if ( numPlants >= 2 * MAX_FOODBITS_PER_TYPE ) return;
	        const child = this.findLowestDeadFoodBitInArray();
	        if ( child === NULL_INDEX ) return;
	        const parent = this.findRandomLivingPlant();
	        if ( parent === null ) return;
	        const from = parent.getPosition();
	        for (let attempt = 0; attempt < 10; attempt++)
	        {
	            let xx = gpRandom() * gpRandom(), yy = gpRandom() * gpRandom();
	            if ( gpRandom() < ONE_HALF ) { xx = -xx; }
	            if ( gpRandom() < ONE_HALF ) { yy = -yy; }
	            let x = from.x + xx * spread, y = from.y + yy * spread;
	            if ( y < top ) { y += ( top - y ) * 2; } else if ( y > bottom ) { y += ( bottom - y ) * 2; }
	            if ( x > right ) { x += ( right - x ) * 2; } else if ( x < left ) { x += ( left - x ) * 2; }
	            _vectorUtility.x = Math.min( right, Math.max( left, x ));
	            _vectorUtility.y = Math.min( bottom, Math.max( top, y ));
	            if ( !_obstacle.getObstruction( from, _vectorUtility ) ) break;
	        }
	        _foodBits[ child ].initialize( child );
	        _foodBits[ child ].setType( parent.getType() );
	        // Background plankton photosynthesis: this is world regrowth, not a
	        // biological seed. The parent only supplies a place to scatter, so
	        // the energy comes from the atmosphere (true seeds pay their parent).
	        if ( !fundPlant( child, globalTweakers.foodBitEnergy )) return;
	        _foodBits[ child ].setPosition( _vectorUtility );
	        environment.plantCount[ parent.getType() ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	        numPlants ++;
	    }
	}

	this.getEnvironment = function() { return environment; }
	this.getCameraView = function() { return { x: _camera.getPosition().x, y: _camera.getPosition().y, scale: _camera.getScale() }; }

	//------------------------------------------------------------------------
	// Dominant species (the species window, src/ui/species.ts). A species is a
	// group of swimbots with alike genes (the same measure as the genetic
	// clusters of the statistics: mean difference of the used genes under 12%).
	// The groups keep their numbers from one count to the next: a swimbot goes
	// to the nearest known group within the limit, a swimbot that fits none
	// starts a new group, and the groups move to the mean of their members.
	// Uses no random numbers, so it never changes the simulation.
	//------------------------------------------------------------------------
	const SPECIES_LIMIT        = 0.12 * NUM_GENES_USED * 255;
	const SPECIES_MIN_SHARE    = 0.005;    // a smaller group is not drawn (counted as "small ones")
	const SPECIES_MAX_SHOWN    = 14;
	const SPECIES_EVERY_MS     = 1500;     // how often the groups are counted again
	const _speciesCenters: { id: number, genes: Float64Array }[] = [];
	let _speciesNextId   = 1;
	let _speciesCounted  = 0;
	let _speciesMembers: Map<number, number[]> = new Map();
	let _speciesInfo: any[] = [];
	let _speciesOther = 0, _speciesTotal = 0;

	function countSpecies()
	{
	    const alive: number[] = [];
	    for (let s = 0; s < MAX_SWIMBOTS; s++) { if ( _st.liveSwimbot[s] === 1 ) alive.push(s); }

	    // each swimbot to the nearest group within the limit, or a new group
	    const members = new Map<number, number[]>();
	    for ( const c of _speciesCenters ) { members.set( c.id, [] ); }
	    for ( const s of alive )
	    {
	        const genes = _swimbots[s].getGenotype().getGenes();
	        let best = null, bestDistance = SPECIES_LIMIT;
	        for ( const c of _speciesCenters )
	        {
	            let sum = 0;
	            for (let g = 0; g < NUM_GENES_USED && sum < bestDistance; g++) { sum += Math.abs( c.genes[g] - genes[g] ); }
	            if ( sum < bestDistance ) { bestDistance = sum; best = c; }
	        }
	        if ( best === null )
	        {
	            best = { id: _speciesNextId ++, genes: Float64Array.from( genes.slice( 0, NUM_GENES_USED )) };
	            _speciesCenters.push( best );
	            members.set( best.id, [] );
	        }
	        members.get( best.id )!.push( s );
	    }

	    // the groups: drop the empty ones, move the centers to the mean of the members
	    for (let i = _speciesCenters.length - 1; i >= 0; i--)
	    {
	        const c = _speciesCenters[i], list = members.get( c.id )!;
	        if ( list.length === 0 ) { _speciesCenters.splice( i, 1 ); members.delete( c.id ); continue; }
	        for (let g = 0; g < NUM_GENES_USED; g++)
	        {
	            let sum = 0;
	            for ( const s of list ) { sum += _swimbots[s].getGenotype().getGenes()[g]; }
	            c.genes[g] = sum / list.length;
	        }
	    }

	    // numbers for each group, the big ones only
	    const total = alive.length;
	    const info: any[] = [];
	    let other = 0;
	    const order = _speciesCenters.slice().sort( ( a, b ) => members.get( b.id )!.length - members.get( a.id )!.length );
	    for ( const c of order )
	    {
	        const list = members.get( c.id )!;
	        if ( info.length >= SPECIES_MAX_SHOWN || list.length < total * SPECIES_MIN_SHARE ) { other += list.length; continue; }
	        let mass = 0, parts = 0, predators = 0, energy = 0, r = 0, g = 0, b = 0;
	        for ( const s of list )
	        {
	            const bot = _swimbots[s], color = bot.getAverageColor();
	            mass += bot.getPhenotypeMass(); parts += bot.getNumParts(); energy += bot.getEnergy();
	            if ( bot.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD ) predators ++;
	            r += color.red; g += color.green; b += color.blue;
	        }
	        const n = list.length;
	        info.push({ id: c.id, count: n, share: n / total, meanMass: mass / n, meanParts: parts / n, predatorShare: predators / n, meanEnergy: energy / n, color: [ r / n, g / n, b / n ] });
	    }
	    _speciesMembers = members;
	    _speciesInfo = info;
	    _speciesOther = other;
	    _speciesTotal = total;
	}

	// a swimbot of the species as it is now: for each part its two ends, width and
	// color, turned so that the mouth points to the right, around the middle of the body
	function speciesPose( list: number[] ): number[]
	{
	    let s = -1;
	    for ( const q of list ) { if ( _st.liveSwimbot[q] === 1 ) { s = q; break; } }
	    if ( s < 0 ) return [];
	    const B = _st.bots, b = s * SS.BOT_STRIDE;
	    const n = B[ b + SS.B_NUM_PARTS ];
	    const cx = B[ b + SS.B_COM_X ], cy = B[ b + SS.B_COM_Y ];
	    const heading = Math.atan2( B[ b + SS.B_MOUTH_Y ] - cy, B[ b + SS.B_MOUTH_X ] - cx );
	    const cos = Math.cos( -heading ), sin = Math.sin( -heading );
	    const out: number[] = [];
	    const end = ( p: number ) => [ _st.parts[ s * SS.PART_STRIDE + p * SS.PS + SS.P_X ] - cx, _st.parts[ s * SS.PART_STRIDE + p * SS.PS + SS.P_Y ] - cy ];
	    for (let p = 1; p < n; p++)
	    {
	        const parent = _st.partParent[ s * MAX_PARTS + p ];
	        const a = end( parent >= 0 ? parent : 0 ), e = end( p );
	        const k = s * MAX_PARTS + p;
	        out.push( a[0] * cos - a[1] * sin, a[0] * sin + a[1] * cos, e[0] * cos - e[1] * sin, e[0] * sin + e[1] * cos,
	                  _st.partWidth[ k ], _st.partRGB[ k * 3 ], _st.partRGB[ k * 3 + 1 ], _st.partRGB[ k * 3 + 2 ] );
	    }
	    return out;
	}

	// what the window shows (counted again every SPECIES_EVERY_MS; the poses are always current)
	this.getSpeciesView = function()
	{
	    const nowMs = ( typeof performance !== "undefined" ) ? performance.now() : 0;
	    if (( _speciesInfo.length === 0 ) || ( nowMs - _speciesCounted > SPECIES_EVERY_MS ) || ( nowMs < _speciesCounted )) { countSpecies(); _speciesCounted = nowMs; }
	    return { total: _speciesTotal, other: _speciesOther, species: _speciesInfo.map( s => ({ ...s, pose: speciesPose( _speciesMembers.get( s.id ) || [] ) })) };
	}

	// the average genes of a species, whole numbers (a file the "load genes" button takes)
	this.getSpeciesGenes = function( id )
	{
	    const list = _speciesMembers.get( id );
	    if ( !list || list.length === 0 ) return null;
	    const genes = new Array( NUM_GENES ).fill( 0 );
	    for ( const s of list ) { const g = _swimbots[s].getGenotype().getGenes(); for (let i = 0; i < NUM_GENES; i++) { genes[i] += g[i]; } }
	    return genes.map( x => Math.max( 0, Math.min( 255, Math.round( x / list.length ))) );
	}

	// destroy a species: every swimbot of it dies
	this.killSpecies = function( id )
	{
	    countSpecies();     // (who is in it right now, not 1.5 seconds ago)
	    const list = _speciesMembers.get( id );
	    if ( !list ) return;
	    for ( const s of list )
	    {
	        if ( _st.liveSwimbot[s] === 1 ) { this.killSwimbot( s ); }
	    }
	    _speciesCounted = 0;
	}


	//------------------------------------------------------------------------
	// Estimate genetic clusters from used genes for the statistics panel.
	// This is not a species estimate and is distinct from morphology bins.
	// Uses an even sample of at most `sampleSize` swimbots and no random numbers;
	// clusters below 3% of that sample are omitted from the displayed count.
	//------------------------------------------------------------------------
	this.estimateGeneticClusters = function( sampleSize = 400 )
	{
	    return Telemetry.estimateGeneticClusters( _swimbots, sampleSize );
	}

	//------------------------------------------------------------------------
	// stage 7: fill the shared arrays that perception reads, from the objects
	//------------------------------------------------------------------------
	// the wall distance grid is expensive (128² x segments), so rebuild it only
	// when the wall geometry actually changes
	let _sdfWallSignature = "";
	this.writePerceptionParams = function()
	{
	    const P = _st.params;
	    P[ SS.PARAM_MAX_LIFESPAN ] = globalTweakers.maximumLifeSpan;
	    P[ SS.PARAM_CURRENT      ] = _currentSpeed;
	    P[ SS.PARAM_STEP         ] = _clock;
	    P[ SS.PARAM_ENV_ACTIVE   ] = environment.active ? 1 : 0;
	    P[ SS.PARAM_ENV_FIELDS   ] = ( environment.active && !isFlatEnvironment() ) ? 1 : 0;
	    P[ SS.PARAM_FOOD_TYPES   ] = globalTweakers.numFoodTypes;
	    P[ SS.PARAM_SHOW_SOIL    ] = _showSoil ? 1 : 0;
	    P[ SS.PARAM_OBSTACLE_X1  ] = _obstacle.getEnd1Position().x;
	    P[ SS.PARAM_OBSTACLE_Y1  ] = _obstacle.getEnd1Position().y;
	    P[ SS.PARAM_OBSTACLE_X2  ] = _obstacle.getEnd2Position().x;
	    P[ SS.PARAM_OBSTACLE_Y2  ] = _obstacle.getEnd2Position().y;
	    _obstacle.writeGeometry( P, SS.PARAM_OB_MID_X, SS.PARAM_OB_MID_Y, SS.PARAM_OB_LENGTH, SS.PARAM_OB_PERP_X, SS.PARAM_OB_PERP_Y, SS.PARAM_OB_END_RADIUS );
	    _obstacle.writeWalls( P, SS.PARAM_WALL_COUNT, SS.PARAM_WALL_BASE, SS.MAX_WALL_SEGMENTS );

	    // the bounding box of the walls: a sight line that misses it is free
	    const wallCount = P[ SS.PARAM_WALL_COUNT ];
	    if ( wallCount > 0 )
	    {
	        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	        for ( let w = 0; w < wallCount; w++ )
	        {
	            const p = SS.PARAM_WALL_BASE + w * 4;
	            const x1 = P[ p ], y1 = P[ p + 1 ], x2 = P[ p + 2 ], y2 = P[ p + 3 ];
	            if ( x1 < minX ) { minX = x1; }
	            if ( x1 > maxX ) { maxX = x1; }
	            if ( x2 < minX ) { minX = x2; }
	            if ( x2 > maxX ) { maxX = x2; }
	            if ( y1 < minY ) { minY = y1; }
	            if ( y1 > maxY ) { maxY = y1; }
	            if ( y2 < minY ) { minY = y2; }
	            if ( y2 > maxY ) { maxY = y2; }
	        }
	        P[ SS.PARAM_WALL_MIN_X ] = minX;
	        P[ SS.PARAM_WALL_MAX_X ] = maxX;
	        P[ SS.PARAM_WALL_MIN_Y ] = minY;
	        P[ SS.PARAM_WALL_MAX_Y ] = maxY;
	    }

	    // the distance field: each cell center stores its distance to the closest
	    // wall segment. Perception uses it to skip segment tests with the triangle
	    // inequality, so the exact segment loop stays the final authority.
	    let wallSignature = String( wallCount );
	    for ( let w = 0; w < wallCount; w++ )
	    {
	        const p = SS.PARAM_WALL_BASE + w * 4;
	        wallSignature += "," + P[ p ] + "," + P[ p + 1 ] + "," + P[ p + 2 ] + "," + P[ p + 3 ];
	    }
	    if ( wallSignature !== _sdfWallSignature )
	    {
	        _sdfWallSignature = wallSignature;
	        P[ SS.PARAM_SDF_READY ] = 0;
	        if ( wallCount > 0 )
	        {
	            const sdf = _st.wallSdf;
	            const cellW = POOL_WIDTH  / SS.SDF_SIZE;
	            const cellH = POOL_HEIGHT / SS.SDF_SIZE;
	            for ( let j = 0; j < SS.SDF_SIZE; j++ )
	            {
	                const cy = POOL_TOP + ( j + 0.5 ) * cellH;
	                for ( let i = 0; i < SS.SDF_SIZE; i++ )
	                {
	                    const cx = POOL_LEFT + ( i + 0.5 ) * cellW;
	                    let best = Infinity;
	                    for ( let w = 0; w < wallCount; w++ )
	                    {
	                        const p = SS.PARAM_WALL_BASE + w * 4;
	                        const ax = P[ p ], ay = P[ p + 1 ];
	                        const vx = P[ p + 2 ] - ax, vy = P[ p + 3 ] - ay;
	                        const len2 = vx * vx + vy * vy;
	                        let t = len2 > 0 ? (( cx - ax ) * vx + ( cy - ay ) * vy ) / len2 : 0;
	                        t = t < 0 ? 0 : ( t > 1 ? 1 : t );
	                        const dx = cx - ( ax + t * vx ), dy = cy - ( ay + t * vy );
	                        const d2 = dx * dx + dy * dy;
	                        if ( d2 < best ) { best = d2; }
	                    }
	                    sdf[ j * SS.SDF_SIZE + i ] = Math.sqrt( best );
	                }
	            }
	            P[ SS.PARAM_SDF_READY ] = 1;
	        }
	    }

	    // the environment, for the decision kernel (DecisionKernel.temperatureAt...)
	    P[ SS.PARAM_TIME  ] = environment.getTime();
	    P[ SS.PARAM_PETRI ] = environment.petri ? 1 : 0;
	    if ( P[ SS.PARAM_ENV_FIELDS ] === 1 ) { environment.copyTemperatureTo( _st.temperature ); }
	    _st.plantWarm.set( environment.plantCount[0] );
	    _st.plantCold.set( environment.plantCount[1] );
	}

	this.writePerceptionInputs = function( s )
	{
	    const b = _swimbots[s];
	    const mouth = b.getMouthPosition();
	    _st.mouthX    [s] = mouth.x;
	    _st.mouthY    [s] = mouth.y;
	    _st.energy    [s] = b.getEnergy();
	    _st.scanRadius[s] = b.getDynamicScanRadius();
	    _st.brainState[s] = b.getBrainState();
	    _st.age       [s] = b.getAge();
	    // (digestion, colors, choosiness... change only with a new phenotype:
	    //  the swimbot writes them itself, see Swimbot.writeStaticPerception)
	}



	this.getPerceptionMismatches = function() { return { checks: _perceptionChecks, mismatches: _perceptionMismatches }; }

	// inherited traits of the parents of the latest births
	this.getRecentMatings = function()
	{
	    const n = Math.min( _matingCount, MATING_RECORD_SIZE );
	    return {
	        count: _matingCount,
	        a: _matingRecord.slice( 0, n ),
	        b: _matingRecord.slice( MATING_RECORD_SIZE, MATING_RECORD_SIZE + n ),
	        brightnessDifference: _matingBrightnessDifference.slice( 0, n ),
	        choosinessMean: _matingChoosinessMean.slice( 0, n ),
	    };
	}

	//-------------------------------------
	this.randomizeNeighborhood = function()
	{
        for (let g=0; g<NUM_GENES; g++)
        {
            _neighborhoodX[g] = -ONE + gpRandom() * 2.0;
            _neighborhoodY[g] = -ONE + gpRandom() * 2.0;

            if ( gpRandom() < ONE_HALF )
            {
                _neighborhoodAxis[g] = false;
            }
            else
            {
                _neighborhoodAxis[g] = true;
            }
	    }
	}

	//------------------------------
	this.randomizeFood = function()
	{
        for (let f=0; f<_numFoodBits; f++)
        {
            _foodBits[f].initialize(f);

            //-------------------------------------------------------------------
            // set food type...
            //-------------------------------------------------------------------
            let n = 0;

            if ( globalTweakers.numFoodTypes === 2 )
            {
                n = Math.floor( gpRandom() * 2 );

                /*
                //first half is one type, the other half is the other type...
                if ( f < _numFoodBits * ONE_HALF  )
                {
                    n = 0;
                }
                else
                {
                    n = 1;
                }
                */
            }

            _foodBits[f].setType(n);
            fundPlant( f, globalTweakers.foodBitEnergy );

            //-------------------------------------------------------------------
            // place food bit randomly in a disk in the middle of the pool
            //-------------------------------------------------------------------
            let poolCenter = new Vector2D();
            poolCenter.x = POOL_LEFT + POOL_WIDTH  * ONE_HALF;
            poolCenter.y = POOL_TOP  + POOL_HEIGHT * ONE_HALF;

            let foodBitPosition = new Vector2D();
            foodBitPosition.setToRandomLocationInDisk( poolCenter, _gardenOfEdenRadius );

/*
if ( mode === SimulationStartMode.SPECIES )
{
    lfoodBitPosition.x = gpRandom() * POOL_WIDTH * 0.24;
    foodBitPosition.y = gpRandom() * POOL_HEIGHT;

    if ( gpRandom() < ONE_HALF )
    {
        foodBitPosition.x = POOL_WIDTH - foodBitPosition.x;
    }
}
            */

            _foodBits[f].setPosition( foodBitPosition );
        }
	}


	//----------------------------------------------------------
	this.setFoodToNeighborhood = function( position, size )
	{
        _numFoodBits = NUM_NEIGHBORHOOD_FOODBITS;

        for (let f=0; f<_numFoodBits; f++)
        {
            let sqrt = Math.floor( Math.sqrt( _numFoodBits ) );
            let xMod = f % sqrt;
            let yMod = Math.floor( ( f / _numFoodBits ) * sqrt );

            let xFraction = xMod / sqrt;
            let yFraction = yMod / sqrt;

            let foodBitPosition = new Vector2D();

            foodBitPosition.setXY
            (
                position.x - size + xFraction * size * 2,
                position.y - size + yFraction * size * 2
            );

            _foodBits[f].initialize(f);
            _foodBits[f].setPosition( foodBitPosition );
        }
	}



	// The classic food layouts are defined next to their founders in WorldSpawner.
	this.setFoodToBarrierConfiguration = function() { Spawner.setFoodToBarrierConfiguration( _presetFoodContext ); }
	this.setFoodToBadParentsConfiguration = function() { Spawner.setFoodToBadParentsConfiguration( _presetFoodContext ); }
	this.setFoodToBangConfiguration = function() { Spawner.setFoodToBangConfiguration( _presetFoodContext ); }
	this.setFoodToSpeciesConfiguration = function() { Spawner.setFoodToSpeciesConfiguration( _presetFoodContext ); }
	this.setFoodToRaceConfiguration = function() { Spawner.setFoodToRaceConfiguration( _presetFoodContext ); }
	this.setFoodToTestMiniPool = function() { Spawner.setFoodToTestMiniPool( _presetFoodContext ); }


	//--------------------------------
    this.setAttraction = function(a)
	{
	    //console.log( "GenePool.js: setAttraction: " + a );

	    globalTweakers.attractionCriterion = a;

        assert( globalTweakers.attractionCriterion >= 0,                 "genepool: setAttraction: globalTweakers.attractionCriterion >= 0" )
        assert( globalTweakers.attractionCriterion < NUM_ATTRACTIONS,    "genepool: setAttraction: globalTweakers.attractionCriterion < NUM_ATTRACTIONS" )

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            _swimbots[s].setAttraction( globalTweakers.attractionCriterion );
        }
	}



	//--------------------------------------------------------------
this.notifySwimbotDeathTime = function( deceasedSwimbotIndex )
{
    assert( deceasedSwimbotIndex != NULL_INDEX, "GenePool.js: this.notifySwimbotDeathTime: deceasedSwimbotIndex != NULL_INDEX" )
    //console.log( deceasedSwimbotIndex + " just died" );
    _familyTree.setDeathTime( deceasedSwimbotIndex, _clock );
    _botAlive[ deceasedSwimbotIndex ] = 0;
}

    // -------------------------------------------------------------
    // Predation overflow support: spawn extra red meat foodbits
    // -------------------------------------------------------------
    //--------------------------------------------------------------------
    // meat holding a given energy (a dropped body part): in bits of <= 50
    //--------------------------------------------------------------------
    this.spawnMeatWithEnergy = function( x, y, energy )
    {
        if ( !( energy > 0 )) return;
        const count = Math.max( 1, Math.ceil( energy / DEFAULT_FOOD_BIT_ENERGY ));
        const position = new Vector2D();
        position.setXY( x, y );
        for (let i = 0; i < count; i++)
        {
            const f = this.findLowestDeadFoodBitInArray( true );
            if ( f === NULL_INDEX ) { transferToAtmosphere( energy * ( 1 - i / count )); return; }   // no slots: the rest returns to the pool
            _foodBits[f].initialize( f );
            _foodBits[f].setType( 2 );
            _foodBits[f].setAutotomyDecoy( true );
            _foodBits[f].setPosition( position );
            if ( i > 0 ) { _foodBits[f].randomizeSpawnPosition({ getPosition: function() { return position; } }); }
            _foodBits[f].setEnergy( energy / count );
            _foodX[f] = _foodBits[f].getPosition().x;
            _foodY[f] = _foodBits[f].getPosition().y;
            _foodType[f] = 2;
        }
    }

    //------------------------------------------------------------------------
    // a body that was not eaten whole: pieces of MEAT_PIECE_ENERGY each (the
    // last one smaller), lying within MEAT_PIECE_SCATTER of the place
    //------------------------------------------------------------------------
    this.spawnCarcass = function( x, y, energy )
    {
        let rest = energy;
        while ( rest > 0.5 )
        {
            const f = this.findLowestDeadFoodBitInArray( true );
            if ( f === NULL_INDEX ) { transferToAtmosphere( rest ); return; }   // no slots: the rest returns to the pool
            const piece = Math.min( MEAT_PIECE_ENERGY, rest );
            rest -= piece;
            const angle = gpRandom() * PI2, distance = gpRandom() * MEAT_PIECE_SCATTER;
            _vectorUtility.setXY( x + Math.cos( angle ) * distance, y + Math.sin( angle ) * distance );
            _foodBits[f].initialize( f );
            _foodBits[f].setType( 2 );
            _foodBits[f].setPosition( _vectorUtility );
            _foodBits[f].setEnergy( piece );
        }
        // pieces are at least 0.5: a smaller remainder cannot be placed, but
        // it must not disappear from the closed world either
        if ( rest > 0 ) { depositSoilEnergy( _st, x, y, rest ); }
    }

    this.spawnMeatFoodBits = function(position, count)
    {
        // type = 2 => red meat, edible by predators
        if ((count === undefined) || (count <= 0)) return;
        if (!position) return;

        for (let i = 0; i < count; i++)
        {
            let foodIndex = this.findLowestDeadFoodBitInArray( true );
            if (foodIndex === NULL_INDEX) return;

            _foodBits[foodIndex].initialize(foodIndex);
            _foodBits[foodIndex].setType(2);
            const fundedMeatBit = drawFromAtmosphere( DEFAULT_FOOD_BIT_ENERGY );
            if ( fundedMeatBit <= 0 ) { _foodBits[foodIndex].setEnergy( 0 ); _foodBits[foodIndex].kill(); return; }
            _foodBits[foodIndex].setEnergy( fundedMeatBit );
            _foodBits[foodIndex].setPosition(position);

            // ensure not spawned inside obstacle
            if (_obstacle.getObstruction(position, _foodBits[foodIndex].getPosition()))
            {
                // attempt a couple of shifts/spawn attempts
                _foodBits[foodIndex].setPosition(position);
                _foodBits[foodIndex].randomizeSpawnPosition({ getPosition: function(){ return position; } });
            }

            _foodX[foodIndex] = _foodBits[foodIndex].getPosition().x;
            _foodY[foodIndex] = _foodBits[foodIndex].getPosition().y;
            _foodType[foodIndex] = 2;
        }
    }

	//------------------------------------------------------------------------
	// population history for the graph. It is sampled by simulation steps,
	// not by wall-clock time, so the curves look the same whether the pool
	// is drawn or not and whatever the speed. When full, every second sample
	// is dropped and the interval doubles: the whole run stays in view.
	//------------------------------------------------------------------------
	const HISTORY_MAX_SAMPLES   = 600;
	const HISTORY_FIRST_INTERVAL = 50;
	const _history = { interval: HISTORY_FIRST_INTERVAL, step: [], herbivores: [], predators: [], plants: [], meat: [] };

	function resetHistory()
	{
	    _history.interval = HISTORY_FIRST_INTERVAL;
	    _history.step.length = 0;
	    _history.herbivores.length = 0;
	    _history.predators.length = 0;
	    _history.plants.length = 0;
	    _history.meat.length = 0;
	}

	function recordHistory()
	{
	    const n = _history.step.length;
	    if ( n > 0 && _history.step[ n - 1 ] >= _clock ) { resetHistory(); }   // a new or loaded pool

	    let herbivores = 0, predators = 0;
	    for (let s = 0; s < MAX_SWIMBOTS; s++)
	    {
	        if ( _st.liveSwimbot[s] !== 1 ) continue;
	        if ( _swimbots[s].getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD ) { predators ++; } else { herbivores ++; }
	    }
	    let plants = 0, meat = 0;
	    for (let f = 0; f < MAX_FOODBITS; f++)
	    {
	        if ( _st.liveFood[f] !== 1 ) continue;
	        if ( _st.foodType[f] === 2 ) { meat ++; } else { plants ++; }
	    }

	    _history.step.push( _clock );
	    _history.herbivores.push( herbivores );
	    _history.predators.push( predators );
	    _history.plants.push( plants );
	    _history.meat.push( meat );

	    if ( _history.step.length >= HISTORY_MAX_SAMPLES )
	    {
	        for ( const key of [ "step", "herbivores", "predators", "plants", "meat" ] )
	        {
	            const a = _history[ key ];
	            let w = 0;
	            for (let i = 1; i < a.length; i += 2) { a[ w ++ ] = a[i]; }
	            a.length = w;
	        }
	        _history.interval *= 2;
	    }
	}

	this.getPopulationHistory = function() { return _history; }

	//------------------------
	this.update = function()
	{
		//-------------------------------------
		// get seconds since started...
		//-------------------------------------
		_seconds = ( (new Date).getTime() - _startTime ) / MILLISECONDS_PER_SECOND;

		//-------------------------------------
		// calculate frame rate...
		//-------------------------------------
        //_frameRate = _seconds - _previousTime;
		//_previousTime = _seconds;

        if ( _simulationRunning )
        {
            let simulationStepsPerTick = _fastMode ? 4 : 1;
            for (let step = 0; step < simulationStepsPerTick; step++)
            {
                this.simulateStep();
            }
        }

        if ( _rendering )
        {
            rebuildAliveIndexCaches();

            if ( _fastMode )
            {
                _fastRenderCounter++;
                if ( _fastRenderCounter < _fastRenderInterval )
                {
                    _touch.update();
                    scheduleNextUpdate();
                    return;
                }
                _fastRenderCounter = 0;
            }

            this.renderFrame();
        }

        //-------------------------------------------------------------
        // update touch state
        // (important for generating state for touch velocity, etc.)
        // also, important to call this after updateCameraNavigation
        //-------------------------------------------------------------
        _touch.update();

		//---------------------------
		// trigger next update...
		//---------------------------
        scheduleNextUpdate();
	}



	//--------------------------------------------------------------
	// one step of the simulation
	//--------------------------------------------------------------
	// The mating recharge is only a counter in the mind row: decrement it
	// once per step for the live bots before decisions are made.
	function stepMatingCooldowns()
	{
	    const M = _st.mind, stride = SS.MIND_STRIDE, field = SS.M_REPRO_CD;
	    const list = _aliveSwimbotIndices;
	    for ( let i = 0; i < list.length; i++ )
	    {
	        const k = list[i] * stride + field;
	        if ( M[k] > 0 ) { M[k] --; }
	    }
	}

	this.simulateStep = function()
	{
        //--------------------
        // advance clock...
        //--------------------
        _clock ++;
        simClock.step = _clock;
        stepMatingCooldowns();
        Telemetry.updateMorphShares( _st );
        const stepStart = now();

        if ( environment.active )
        {
            environment.setTime( _clock );
        }

        //----------------------
        // update swimbots...
        //----------------------
        this.updateSwimbots();

        // Every fourth step the SAT is rebuilt; every sixteenth the ambient
        // reservoir feeds the soil and only the rich cells diffuse. The amount
        // drawn is removed from the reservoir here, so the world total is unchanged.
        stepSoilEcology( _st, _clock );

        //------------------
        // update food
        //------------------
        this.updateFood();
        _phaseTimes[5] += now() - stepStart;
        _phaseTimes[6] += 1;

        if ( _clock % _history.interval === 0 ) { recordHistory(); }

        _stepsThisSecond ++;

        //--------------------------------------------------
        // the "P" key: measure the next N steps and keep the table
        //--------------------------------------------------
        if ( _profileStepsLeft > 0 )
        {
            _profileStepsLeft --;
            if ( _profileStepsLeft === 0 )
            {
                _profilerText = profReportText( _profileWindowSteps );
                setProfilerEnabled( false );
                if ( _profileAutoPrint && ( typeof console !== "undefined" )) { console.log( _profilerText ); }
            }
        }
	}

	//--------------------------------------------------------------
	// the "P" key (browser) and tools/profile-deep.cjs (Node):
	// turn the profiler on, measure the next N steps, then keep the
	// text until somebody takes it
	//--------------------------------------------------------------
	this.profileSteps = function( steps, autoPrint = true )
	{
	    const n = Math.max( 1, Math.floor( steps || 200 ));
	    profReset();
	    setProfilerEnabled( true );
	    _profileWindowSteps = n;
	    _profileStepsLeft   = n;
	    _profilerText       = "";
	    _profileAutoPrint   = autoPrint !== false;
	}

	this.takeProfilerReport = function()
	{
	    const text = _profilerText;
	    _profilerText = "";
	    return text;
	}

	//--------------------------------------------------------------
	// camera, tracking and drawing for one frame
	//--------------------------------------------------------------
	this.renderFrame = function()
	{
            //---------------------------
            // update camera...
            //---------------------------
            _camera.update( _seconds );

            const viewHeight = _camera.getYDimension();
            _viewScale = ( viewHeight > 0 && _canvasHeight > 0 ) ? _canvasHeight / viewHeight : 1;

            if ( RENDER_SWIMBOT_AS_DOT )
            {
                _levelOfDetail = SWIMBOT_LEVEL_OF_DETAIL_DOT;
            }
            else
            {
                // The camera-height LOD gates live in Parameters.ts: mouths and
                // arrows stop at LOD_MOUTH_MIN_SCALE, segments a little closer.
                _levelOfDetail = ( _viewScale >= LOD_MOUTH_MIN_SCALE )
                               ? SWIMBOT_LEVEL_OF_DETAIL_HIGH
                               : SWIMBOT_LEVEL_OF_DETAIL_LOW;
            }

            //---------------------------
            // update camera tracking...
            //---------------------------
            if ( _viewTracking.getIsTracking() )
            {
                //if ( _clock % CAMERA_TRACKING_UPDATE_PERIOD === 0 )
                {
                    _viewTracking.updateTracking( _camera.getPosition(), _camera.getScale(), _selectedSwimbot );

                    _camera.addForce( _viewTracking.getCameraForce(), _viewTracking.getCameraScaleForce() );
                }
            }

            //------------------------------
            // update camera navigation
            //------------------------------
            this.updateCameraNavigation();

            //---------------------------
            // render everything...
            //---------------------------
            this.render();
	}

	//--------------------------------------------------------------
	// one browser frame: simulate (within the time budget), then draw
	//--------------------------------------------------------------
	this.runFrame = function( now, draw = true )
	{
		_seconds = ( (new Date).getTime() - _startTime ) / MILLISECONDS_PER_SECOND;

        let elapsedSeconds = ( _lastFrameTime === 0 ) ? 0 : ( now - _lastFrameTime ) / 1000;
        _lastFrameTime = now;
        if ( elapsedSeconds > 0.25 ) { elapsedSeconds = 0.25; }   // after a pause, don't race to catch up

        if ( _simulationRunning )
        {
            if ( _speedLevel === 3 )
            {
                // as many steps as fit into the frame
                const drawing  = _rendering && draw && !(( typeof document !== "undefined" ) && document.hidden );
                const deadline = performance.now() + ( drawing ? MAX_FRAME_BUDGET_DRAWN_MS : MAX_FRAME_BUDGET_MS );
                do { this.simulateStep(); } while ( performance.now() < deadline );
                _stepDebt = 0;
            }
            else
            {
                const fast          = ( _speedLevel === 2 );
                const deadline      = performance.now() + ( fast ? FAST_FRAME_BUDGET_MS : NORMAL_FRAME_BUDGET_MS );
                const stepsPerSecond = fast ? FAST_STEPS_PER_SECOND : NORMAL_STEPS_PER_SECOND;

                _stepDebt += elapsedSeconds * stepsPerSecond;
                const maximumDebt = stepsPerSecond * 0.06;
                if ( _stepDebt > maximumDebt ) { _stepDebt = maximumDebt; }

                while (( _stepDebt >= 1 ) && ( performance.now() < deadline ))
                {
                    this.simulateStep();
                    _stepDebt -= 1;
                }
            }
        }

        // measured simulation speed (steps per second)
        if ( now - _stepsSecondStart >= 1000 )
        {
            _stepsPerSecond   = _stepsThisSecond * 1000 / ( now - _stepsSecondStart );
            _stepsThisSecond  = 0;
            _stepsSecondStart = now;
        }

        // nothing to draw while the page is hidden
        const pageHidden = ( typeof document !== "undefined" ) && document.hidden;

        if ( _rendering && !pageHidden && draw )
        {
            const renderStart = performance.now();
            if ( _aliveCachesDirty ) { rebuildAliveIndexCaches(); }
            this.renderFrame();
            _renderMs += ( performance.now() - renderStart - _renderMs ) * 0.05;   // smoothed, for finding what is slow
        }

        _touch.update();
	}

	this.getStepsPerSecond = function() { return _stepsPerSecond; }
	this.getRenderMs       = function() { return _renderMs; }

	//------------------------------------------------------------------------
	// PLANT_REGROW_CHANCE: an eaten plant may leave roots that sprout again in
	// the same place after PLANT_REGROW_DELAY steps
	//------------------------------------------------------------------------
	const _roots = [];      // { x, y, type, due }
	this.plantEaten = function( plant )
	{
	    if (( PLANT_REGROW_CHANCE <= 0 ) || ( plant.getType() === 2 )) return;
	    if ( gpRandom() < PLANT_REGROW_CHANCE )
	    {
	        _roots.push({ x: plant.getPosition().x, y: plant.getPosition().y, type: plant.getType(), due: _clock + PLANT_REGROW_DELAY });
	    }
	}
	this.sproutRoots = function()
	{
	    while (( _roots.length > 0 ) && ( _roots[0].due <= _clock ))
	    {
	        const root = _roots.shift();
	        const f = this.findLowestDeadFoodBitInArray();
	        if ( f === NULL_INDEX ) continue;
	        _vectorUtility.setXY( root.x, root.y );
	        _foodBits[f].initialize( f );
	        _foodBits[f].setType( root.type );
	        if ( !fundPlant( f, globalTweakers.foodBitEnergy )) continue;
	        _foodBits[f].setPosition( _vectorUtility );
	    }
	}
	let _numSick = 0;
	let _stepsWithoutSick = 0;   // 4000 silent steps re-seed a fresh strain in a crowd
	this.getNumSick        = function() { return _numSick; }

	//------------------------------------------------------------------------
	// currents: on / off while it runs (the C key); shown as faint arrows
	//------------------------------------------------------------------------
	let _currentSpeed = CURRENTS_ENABLED ? CURRENT_SPEED : 0;
	this.toggleCurrents  = function() { _currentSpeed = ( _currentSpeed > 0 ) ? 0 : CURRENT_SPEED; this.writePerceptionParams(); }
	this.getCurrentsOn   = function() { return _currentSpeed > 0; }

	// the living soil overlay (and its root tendrils) can be hidden at any time
	this.toggleSoil      = function() { _showSoil = !_showSoil; this.writePerceptionParams(); }
	this.getShowSoil     = function() { return _showSoil; }

	// drawing time by part (milliseconds, smoothed): kept by GenePoolRenderer.ts
	this.getRenderPhaseMs = function() { return _renderer.getRenderPhaseMs(); }

	// no screen refresh for a while (hidden or covered window, embedded view)?
	this.screenRefreshStalled = function( now ) { return ( now - _lastAnimationFrame ) > 100; }

	// the graphics-card renderer (set up by main.ts in the browser)
	this.setCapsuleRenderer = function( renderer ) { _capsuleRenderer = renderer; }

	// A parent's vitality may add a little energy to a child (or take a little
	// back), always within its own reserve. Defined once, outside the step, so
	// a birth does not allocate a closure.
	function adjustOffspringContribution( bot: any, amount: number, vitality: number ): number
	{
	    const target = amount * vitality;
	    let actual = amount;
	    const reserve = bot.getEnergy();
	    if ( target > actual )
	    {
	        const extra = Math.min( target - actual, reserve );
	        bot.setEnergy( reserve - extra );
	        actual += extra;
	    }
	    else if ( target < actual )
	    {
	        bot.setEnergy( reserve + ( actual - target ));
	        actual = target;
	    }
	    return actual;
	}

	//--------------------------------
	//------------------------------------------------------------------------
	// what a swimbot does with the world after it moved and looked around:
	// bump into the obstacle, eat, bite, mate
	//------------------------------------------------------------------------
	this.interact = function( s )
	{
	    const profT0 = PROFILER_ENABLED ? profEnter( PROF_INTERACT ) : 0;
	    try
	    {
		const m = s * SS.MIND_STRIDE;
		const M = _st.mind;
                if ( _swimbots[s].hasCarriedSeed() ) { _swimbots[s].updateCarriedSeed(); }
                //-------------------------------------
                // eating
                //-------------------------------------
                if ( M[ m + SS.M_TRY_EAT ] === 1 )
                {
                    // (in the phased step someone else may have eaten it first)
                    const food = _swimbots[s].getChosenFoodBit();
                    if (( food != null ) && food.getAlive()) { _swimbots[s].eatChosenFoodBit(); }
                    else                                     { _swimbots[s].cancelEating(); }
                }

                // FILTER_FEEDING_ENABLED: a limb brushed a sprout
                const sprout = _st.mind[ s * SS.MIND_STRIDE + SS.M_FILTER_FOOD ];
                if (( sprout >= 0 ) && _foodBits[ sprout ].getAlive() && ( _foodBits[ sprout ].getType() !== 2 ))
                {
                    _swimbots[s].filterFeed( _foodBits[ sprout ] );
                }

                //-------------------------------------
                // hunting (prey)
                //-------------------------------------
                if ( M[ m + SS.M_TRY_HUNT ] === 1 )
                {
                    _swimbots[s].huntEatChosenPrey();
                }

                //----------------------------------------
                // giving birth to a new swimbot
                //----------------------------------------

                if ( M[ m + SS.M_TRY_MATE ] === 1 )
                {
                    let newBornSwimbotIndex = this.findLowestDeadSwimbotInArray();

                    //---------------------------------------
                    // a few quick reality checks here...
                    //---------------------------------------
                    if (( newBornSwimbotIndex != NULL_INDEX )
                    &&  ( _swimbots[s].getChosenMateIndex() != NULL_INDEX ))
                    {
                        let chosenMateIndex = _swimbots[s].getChosenMateIndex();
                        //console.log( " chosenMateIndex = " + chosenMateIndex );

                        _potentialMate = _swimbots[ chosenMateIndex ];

                        assert( _potentialMate != null, "genepool: updateSwimbots: _potentialMate != null" );

                        if ( _potentialMate.getAlive() )
                        {
                            // A pair can produce one child at a time: both must
                            // be recovered, courting, and fed well above hunger.
                            const mb = chosenMateIndex * SS.MIND_STRIDE;
                            const myState  = _swimbots[s].getBrainState();
                            const mateState = _potentialMate.getBrainState();
                            const readyToMate =
                                   M[ m + SS.M_REPRO_CD ] === 0
                                && M[ mb + SS.M_REPRO_CD ] === 0
                                && ( myState === BRAIN_STATE_LOOKING_FOR_MATE || myState === BRAIN_STATE_PURSUING_MATE )
                                && ( mateState === BRAIN_STATE_LOOKING_FOR_MATE || mateState === BRAIN_STATE_PURSUING_MATE )
                                && ( _swimbots[s].getEnergy() > _swimbots[s].getHungerThreshold() * rStrategyReproductionEnergyFactor( _swimbots[s].getNumParts() ) )
                                && ( _potentialMate.getEnergy() > _potentialMate.getHungerThreshold() * rStrategyReproductionEnergyFactor( _potentialMate.getNumParts() ) );
                            if ( !readyToMate )
                            {
                                // They are not a real pair: separate them now so
                                // they cannot hammer the birth path every tick.
                                _swimbots[s].abortMating();
                                _potentialMate.abortMating();
                            }
                            else
                            {
                            simCounters.reproductivePairAttempts ++;
                            // Predators and herbivores never have children together.
                            if ( !_potentialMate.sameDiet( _swimbots[s] ))
                            {
                                simCounters.reproductiveDietMismatches ++;
                            }
                            else
                            {
                                assert( _myGenotype    != null, "genepool: updateSwimbots: _myGenotype    != null" );
                                assert( _mateGenotype  != null, "genepool: updateSwimbots: _mateGenotype  != null" );

                                //------------------------------------------------------------------------------
                                // collect genes from me and my chosen mate and recombine them for the child
                                //------------------------------------------------------------------------------
                                _myGenotype = _swimbots[s].getGenotype();
                                _mateGenotype = _potentialMate.getGenotype();

                                //------------------------------------------------------------------------------
                                // Junk DNA similarity is a direct reproductive barrier in this model.
                                // Record the distribution and blocked share for later ecological analysis.
                                //------------------------------------------------------------------------------
                                const junkSimilarity = this.getJunkDnaSimilarity( _myGenotype, _mateGenotype );
                                simCounters.reproductiveJunkChecks ++;
                                simCounters.reproductiveJunkSimilaritySum += junkSimilarity;
                                const similarityBin = Math.min( 9, Math.floor( junkSimilarity * 10 ));
                                simCounters.reproductiveJunkSimilarityBins[ similarityBin ] ++;

                                // Continuous divergence instead of a hard
                                // step: junk DNA, body plan and mass each count.
                                const dJunk  = 1 - junkSimilarity;
                                const dParts = Math.abs( _swimbots[s].getNumParts() - _potentialMate.getNumParts() ) / 12;
                                const dMass  = Math.min( 1, Math.abs( Math.log( Math.max( 1, _swimbots[s].getPhenotypeMass() ) / Math.max( 1, _potentialMate.getPhenotypeMass() ))) / 1.5 );
                                const dTotal = 0.65 * dJunk + 0.20 * dParts + 0.15 * dMass;
                                let compatProb = Math.exp( -( dTotal * dTotal ) / ( 2 * 0.42 * 0.42 ));
                                // Assortative mating: two rare swimbots with the
                                // same body plan reproduce it reliably, while a
                                // cross with a different plan is less likely to
                                // dilute it into the dominant morph.
                                const myMorph = _swimbots[s].getMorphologySummary();
                                const myBucket = SS.getMorphBucket( myMorph.numParts, myMorph.branchFraction > 0, myMorph.meanWidth );
                                const mateMorph = _potentialMate.getMorphologySummary();
                                const mateBucket = SS.getMorphBucket( mateMorph.numParts, mateMorph.branchFraction > 0, mateMorph.meanWidth );
                                const mateShare = _st.morphBucketShare[ mateBucket ];
                                if ( myBucket === mateBucket )
                                {
                                    if ( mateShare < 0.12 ) compatProb = Math.min( 1, compatProb * 1.35 );
                                }
                                else compatProb *= 0.75;

                                // Parents under stress explore new forms faster.
                                const avgEnergyRatio = 0.5 * ( _swimbots[s].getEnergy() / Math.max( 1, _swimbots[s].getMaxEnergy() )
                                                            + _potentialMate.getEnergy() / Math.max( 1, _potentialMate.getMaxEnergy() ));
                                const mutScale = avgEnergyRatio < 0.35 ? 1.45 : ( avgEnergyRatio > 0.75 ? 0.8 : 1.0 );

                                if ( gpRandom() < compatProb )
                                {
                                    simCounters.reproductiveJunkPasses ++;

                                //-----------------------------------
                                // recombine genes for the child
                                //-----------------------------------
                                assert( _childGenotype != null, "_childGenotype != null" );

                                _childGenotype.setAsOffspring( _myGenotype, _mateGenotype, mutScale );

                                // rarely, the child switches diet (see DIET_SWITCH_RATE)
                                if ( environment.active && ( gpRandom() < DIET_SWITCH_RATE ))
                                {
                                    const wasPredator = geneAverage( _childGenotype, GENES_PREDATOR ) > PREDATOR_LEVEL_THRESHOLD;
                                    setTrait( _childGenotype, GENES_PREDATOR, wasPredator ? 0.3 * gpRandom() : 0.75 + 0.25 * gpRandom() );
                                }

                                //------------------------------------------------
                                // collect energy from parents for child energy
                                //------------------------------------------------
                                let myEnergyContribution    = _swimbots[s].contributeToOffspring();
                                let mateEnergyContribution  = _potentialMate.contributeToOffspring();
                                // Microclimate vitality: parents well fitted to their
                                // current place can afford a slightly stronger start
                                // for the child. The adjustment comes out of (or goes
                                // back to) their own reserves, never beyond them.
                                if ( environment.active )
                                {
                                    const mateOffset = chosenMateIndex * SS.MIND_STRIDE;
                                    const avgFit = 0.5 * ( M[ m + SS.M_THERMAL_FIT ] + M[ mateOffset + SS.M_THERMAL_FIT ] );
                                    const vitality = Math.max( 0.85, Math.min( 1.12, 0.85 + avgFit * 0.32 ));
                                    myEnergyContribution   = adjustOffspringContribution( _swimbots[s], myEnergyContribution, vitality );
                                    mateEnergyContribution = adjustOffspringContribution( _potentialMate, mateEnergyContribution, vitality );
                                }
                                let energyToOffspring       = myEnergyContribution + mateEnergyContribution;

                                //console.log( "energyToOffspring = " + energyToOffspring );
                                //assert( energyToOffspring <= DEFAULT_SWIMBOT_HUNGER_THRESHOLD, "energyToOffspring <= DEFAULT_SWIMBOT_HUNGER_THRESHOLD" );

                                //----------------------------------------------------------------------------------------
                                // set birth position
                                //----------------------------------------------------------------------------------------
                                let diffX = _potentialMate.getGenitalPosition().x - _swimbots[s].getGenitalPosition().x;
                                let diffY = _potentialMate.getGenitalPosition().y - _swimbots[s].getGenitalPosition().y;

                                _vectorUtility.x = _swimbots[s].getGenitalPosition().x + diffX * ONE_HALF;
                                _vectorUtility.y = _swimbots[s].getGenitalPosition().y + diffY * ONE_HALF;

                                //---------------------------------------------
                                // pool effect
                                //---------------------------------------------
                                _pool.endTouch( _vectorUtility, _seconds );

                                //--------------------------------------------
                                // create the child swimbot
                                //--------------------------------------------
                                let initialAngle = getRandomAngleInDegrees();
                                _swimbots[ newBornSwimbotIndex ].create( newBornSwimbotIndex, 0, _vectorUtility, initialAngle, energyToOffspring, _childGenotype, _embryology )
                                syncSwimbot( newBornSwimbotIndex );
                                // The child and both parents sit out the next
                                // mating season; neither parent keeps courting
                                // the partner that just produced the child.
                                const parts = _swimbots[s].getNumParts(), mateParts = _potentialMate.getNumParts();
                                const crownPressure = killWinnerPressure( _st.params[ SS.PARAM_PART_SHARE_BASE + Math.max( 0, Math.min( 15, parts - 1 )) ]);
                                const matePressure = killWinnerPressure( _st.params[ SS.PARAM_PART_SHARE_BASE + Math.max( 0, Math.min( 15, mateParts - 1 )) ]);
                                const cooldownFactor = rStrategyCooldownFactor( parts ) * ( 1 + KILL_WINNER_REPRO_MULT * crownPressure );
                                const mateCooldownFactor = rStrategyCooldownFactor( mateParts ) * ( 1 + KILL_WINNER_REPRO_MULT * matePressure );
                                _swimbots[ newBornSwimbotIndex ].setMatingCooldown( Math.round( MATING_COOLDOWN_STEPS * cooldownFactor ));
                                _swimbots[s].setMatingCooldown( Math.round( MATING_COOLDOWN_STEPS * cooldownFactor ));
                                _potentialMate.setMatingCooldown( Math.round( MATING_COOLDOWN_STEPS * mateCooldownFactor ));
                                _swimbots[s].abortMating();
                                _potentialMate.abortMating();
                                // (who its family is: KIN_NOT_EATEN_ENABLED; a founder gets its number now)
                                if ( _swimbots[s].getSerial() <= 0 ) { _swimbots[s].setFamily( ++ _serial, 0, 0 ); }
                                if ( _swimbots[ chosenMateIndex ].getSerial() <= 0 ) { _swimbots[ chosenMateIndex ].setFamily( ++ _serial, 0, 0 ); }
                                _swimbots[ newBornSwimbotIndex ].setFamily( ++ _serial, _swimbots[s].getSerial(), _swimbots[ chosenMateIndex ].getSerial() );
                                simCounters.births ++;

                                // record successful parents for assortativity metrics
                                const matingIndex = _matingCount % MATING_RECORD_SIZE;
                                _matingRecord[ matingIndex ] = _swimbots[s].getThermalOptimum();
                                _matingRecord[ matingIndex + MATING_RECORD_SIZE ] = _potentialMate.getThermalOptimum();
                                _matingBrightnessDifference[matingIndex] = Math.abs( _swimbots[s].getBrightness() - _potentialMate.getBrightness() );
                                _matingChoosinessMean[matingIndex] = ( _swimbots[s].getChoosiness() + _potentialMate.getChoosiness() ) * 0.5;
                                _matingCount ++;

                                //--------------------------------------------------
                                // add the new swimbot to the family tree
                                //--------------------------------------------------
                                _familyTree.addNode( newBornSwimbotIndex, s, chosenMateIndex, _clock, this.getSwimbotGenes( newBornSwimbotIndex ), this.getSwimbotEvolutionTraits( newBornSwimbotIndex ) );

                                }
                                else
                                {
                                    simCounters.reproductiveJunkBlocks ++;
                                }
                            }
                            }   // readyToMate else
                        }   // mate alive
                    }      //   if (( newBornSwimbotIndex != -1 ) &&  ( swimbot[s].getChosenMateIndex() != -1 ))

                    //------------------------------------------------------------------
                    // still trying = the mating did not happen (incompatible mate,
                    // pool full, mate died). Give up, otherwise the swimbot keeps
                    // courting the same mate forever.
                    //------------------------------------------------------------------
                    if ( _swimbots[s].getIsTryingToMate() )
                    {
                        _swimbots[s].abortMating();
                    }
                }         //    if ( swimbot[s].isTryingToMate() )
	    }
	    finally { if ( PROFILER_ENABLED ) { profExit( PROF_INTERACT, profT0 ); } }
	}


	//------------------------------------------------------------------------
	// Smell fields: decay, deposit and a light 4-neighbour blur once a step.
	// Their gradients only tilt a search direction; they add no new rules.
	//------------------------------------------------------------------------
	function updateScentFields(): void
	{
	    const N = SS.SCENT_GRID_N, cells = N * N;
	    const food = _st.foodField, prey = _st.preyField, pred = _st.predField;
	    // Deposits happen every step; the grid-wide decay and blur only on
	    // even steps, with the equivalent two-step decay and stronger blur.
	    if (( _clock & 1 ) === 0 )
	    {
	        for (let i = 0; i < cells; i++)
	        {
	            food[i] *= 0.74;
	            prey[i] *= 0.74;
	            pred[i] *= 0.74;
	        }
	    }

	    // plants: their energy is the food smell
	    for (let k = 0; k < _aliveFoodBitIndices.length; k++)
	    {
	        const f = _aliveFoodBitIndices[k];
	        const ix = Math.max( 0, Math.min( N - 1, Math.floor( _foodX[f] / _scentCellW )));
	        const iy = Math.max( 0, Math.min( N - 1, Math.floor( _foodY[f] / _scentCellH )));
	        food[ iy * N + ix ] += _st.foodEnergy[f] * 0.02;
	    }

	    // swimbots: herbivore biomass or a predator trace
	    for (let k = 0; k < _aliveSwimbotIndices.length; k++)
	    {
	        const s = _aliveSwimbotIndices[k];
	        const ix = Math.max( 0, Math.min( N - 1, Math.floor( _botX[s] / _scentCellW )));
	        const iy = Math.max( 0, Math.min( N - 1, Math.floor( _botY[s] / _scentCellH )));
	        const idx = iy * N + ix;
	        if ( _botPredator[s] > PREDATOR_LEVEL_THRESHOLD ) { pred[idx] += 1.0; }
	        else                                              { prey[idx] += _botMass[s] * 0.003; }
	    }

	    // one light diffusion pass on even steps; read from a snapshot so the
	    // result does not depend on the order in which cells are visited
	    if (( _clock & 1 ) === 0 )
	    {
	        const tmp = _scentTmp;
	        for (let f = 0; f < 3; f++)
	        {
	            const a = f === 0 ? food : ( f === 1 ? prey : pred );
	            tmp.set( a );
	            for (let y = 0; y < N; y++)
	            {
	                const row = y * N;
	                const up = y > 0 ? row - N : row;
	                const down = y < N - 1 ? row + N : row;
	                for (let x = 0; x < N; x++)
	                {
	                    const i = row + x;
	                    const l = x > 0 ? i - 1 : i;
	                    const r = x < N - 1 ? i + 1 : i;
	                    const avg = 0.25 * ( tmp[l] + tmp[r] + tmp[up + x] + tmp[down + x] );
	                    a[i] = tmp[i] + 0.11 * ( avg - tmp[i] );
	                }
	            }
	        }
	    }
	}

	// 16-bit Peano-Morton key from the coordinates
	function mortonBits( v: number ): number
	{
	    v &= 0xff;
	    v = ( v | ( v << 4 )) & 0x0f0f;
	    v = ( v | ( v << 2 )) & 0x3333;
	    v = ( v | ( v << 1 )) & 0x5555;
	    return v;
	}
	// Put neighbours in the pool next to each other in the work list. Insertion
	// sort is effectively linear here: the order barely changes in 8 steps,
	// and it needs no allocation.
	function sortAliveByMorton(): void
	{
	    const cols = SS.SCENT_GRID_N - 1;
	    const list = _aliveSwimbotIndices, n = list.length;
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        const ix = Math.max( 0, Math.min( cols, Math.floor( _botX[s] / POOL_WIDTH  * cols )));
	        const iy = Math.max( 0, Math.min( cols, Math.floor( _botY[s] / POOL_HEIGHT * cols )));
	        _mortonCodes[i] = mortonBits( ix ) | ( mortonBits( iy ) << 1 );
	    }
	    for (let i = 1; i < n; i++)
	    {
	        const code = _mortonCodes[i], s = list[i];
	        let j = i - 1;
	        while ( j >= 0 && _mortonCodes[j] > code )
	        {
	            _mortonCodes[j + 1] = _mortonCodes[j];
	            list[j + 1] = list[j];
	            j --;
	        }
	        _mortonCodes[j + 1] = code;
	        list[j + 1] = s;
	    }
	}

	// How common is each herbivore shape right now? Predators read these shares
	// to form (or break) a search image: a morph that monopolises the pool is
	// easier to find, a rare one is overlooked.
	function updateMorphBucketShares(): void
	{
	    const share = _st.morphBucketShare;
	    share.fill( 0 );
	    let total = 0;
	    for (let i = 0; i < _aliveSwimbotIndices.length; i++)
	    {
	        const s = _aliveSwimbotIndices[i];
	        if ( _botPredator[s] > PREDATOR_LEVEL_THRESHOLD ) continue;
	        const morph = _swimbots[s].getMorphologySummary();
	        share[ SS.getMorphBucket( morph.numParts, morph.branchFraction > 0, morph.meanWidth ) ] ++;
	        total ++;
	    }
	    if ( total > 0 ) { for (let b = 0; b < share.length; b++ ) share[b] /= total; }
	}

	// Same idea for the (much larger) food list: nearby plants and meat land
	// next to each other in the grid build, which keeps its counting sort's
	// memory access local. No allocation, and only every 16 steps.
	function sortAliveFoodByMorton(): void
	{
	    const cols = SS.SCENT_GRID_N - 1;
	    const list = _aliveFoodBitIndices, n = list.length;
	    for (let i = 0; i < n; i++)
	    {
	        const f = list[i];
	        const ix = Math.max( 0, Math.min( cols, Math.floor( _foodX[f] / POOL_WIDTH  * cols )));
	        const iy = Math.max( 0, Math.min( cols, Math.floor( _foodY[f] / POOL_HEIGHT * cols )));
	        _foodMortonCodes[i] = mortonBits( ix ) | ( mortonBits( iy ) << 1 );
	    }
	    for (let i = 1; i < n; i++)
	    {
	        const code = _foodMortonCodes[i], f = list[i];
	        let j = i - 1;
	        while ( j >= 0 && _foodMortonCodes[j] > code )
	        {
	            _foodMortonCodes[j + 1] = _foodMortonCodes[j];
	            list[j + 1] = list[j];
	            j --;
	        }
	        _foodMortonCodes[j + 1] = code;
	        list[j + 1] = f;
	    }
	}

	//------------------------------------------------------------------------
	// stage 7: the step in phases. Deciding, moving and looking around touch
	// only the shared arrays and run in several threads (_runner, see
	// ParallelWork.ts); what changes other objects (eating, biting, mating,
	// dropping parts) stays in this thread, in order.
	//------------------------------------------------------------------------
	this.updateSwimbotsInPhases = function()
	{
	    if (( _clock & 1 ) === 0 ) { updateScentFields(); }
	    if ( _clock % 8 === 0 ) { sortAliveByMorton(); updateMorphBucketShares(); }
	    const list = _aliveSwimbotIndices;
	    const n    = list.length;
	    // pack the four hot coordinates of every live bot into one small buffer,
	    // so a dense school of neighbours is read from a few L1 cache lines
	    const hot = _st.botHot;
	    for ( let i = 0; i < n; i++ )
	    {
	        const s = list[i], h = s * 4;
	        hot[h]     = _botX[s];
	        hot[h + 1] = _botY[s];
	        hot[h + 2] = _genitalX[s];
	        hot[h + 3] = _genitalY[s];
	    }
	    const M    = _st.mind;
	    this.writePerceptionParams();

	    let t = now();

	    // 1. decide and move in one worker pass: one barrier instead of two
        const B = _st.bots;
        if ( _energyBeforePhysics !== null && ( environment.active || CLOSED_ENERGY_CYCLE_ENABLED ))
        {
            for ( let i = 0; i < n; i++ )
            {
                const s = list[i];
                _energyBeforePhysics[s] = B[ s * SS.BOT_STRIDE + SS.B_ENERGY ];
            }
        }
	    if ( WAKE_GRID_ENABLED ) { stepWakeGrid( _st ); }
	    _runner.task( TASK_DECIDE_PHYSICS, list, n );
        if ( _energyBeforePhysics !== null && ( environment.active || CLOSED_ENERGY_CYCLE_ENABLED ))
        {
            for ( let i = 0; i < n; i++ )
            {
                const s = list[i], b = s * SS.BOT_STRIDE;
                const spent = Math.max( 0, _energyBeforePhysics[s] - Math.max( 0, B[ b + SS.B_ENERGY ] ));
                // 70% of what a swimmer burns feeds the living soil under it;
                // the other 30% goes to the ambient reservoir, which trickles
                // 3% back into the soil every eighth step.
                depositSoilEnergy( _st, B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ], spent * 0.70 );
                depositSoilEnergy( _st, B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ], spent * 0.30 );
                energyCycleCounters.nutrientsFromSwimming += environment.returnSwimmingEnergyAt( B[ b + SS.B_POS_X ], B[ b + SS.B_POS_Y ], spent );
            }
        }
	    t = phaseTime( 0, t );

	    // 2. what only this thread can do, then deaths while moving
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        if (( M[ s * SS.MIND_STRIDE + SS.M_EVENTS ] & ( SS.EVENT_REGROW | SS.EVENT_SELF_FEED )) && _swimbots[s].getAlive() )
	        {
	            _swimbots[s].handleEventsBeforeMoving();
	        }
	    }
	    t = phaseTime( 1, t );
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        if ( B[ s * SS.BOT_STRIDE + SS.B_DEATHS ] > 0 ) { _swimbots[s].applyPhysicsDeaths(); }
	    }
	    for (let i = 0; i < n; i++) { doTask( TASK_PREPARE_LOOK, _st, _perceptionScratch, list[i], 0 ); }
	    t = phaseTime( 2, t );

	    // 4. look around and take it in (many threads)
	    _runner.task( TASK_LOOK, list, n );
	    this.collectKernelCounters();
	    t = phaseTime( 3, t );

	    // 5. act, one after the other
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        if ( !_swimbots[s].getAlive() )
	        {
	            if ( _selectedSwimbot === s ) { setSelectedSwimbot( NULL_INDEX ); }
	            continue;
	        }
	        if ( M[ s * SS.MIND_STRIDE + SS.M_EVENTS ] & ( SS.EVENT_DECOY | SS.EVENT_CHOOSE_MATE )) { _swimbots[s].handleEventsAfterLooking(); }
	        this.interact(s);
	    }
	    // PLANT_REGROW_CHANCE: grazed plants sprout again from their roots
	    if ( PLANT_REGROW_CHANCE > 0 ) { this.sproutRoots(); }
	    // DISEASE_ENABLED: the sick pay, pass it on, get well. If the whole
	    // world has been healthy for 4000 steps, a crowd gets a fresh strain.
	    if ( DISEASE_ENABLED )
	    {
	        _numSick = updateDiseases( _st, _aliveSwimbotIndices, _aliveSwimbotIndices.length, _clock );
	        if (( _numSick === 0 ) && ( _aliveSwimbotIndices.length > 150 ))
	        {
	            if ( ++ _stepsWithoutSick >= 4000 )
	            {
	                const s = _aliveSwimbotIndices[ Math.floor( gpRandom() * _aliveSwimbotIndices.length )];
	                seedDisease( _st, s );
	                _numSick = 1;
	                _stepsWithoutSick = 0;
	            }
	        }
	        else { _stepsWithoutSick = 0; }
	    }
	    phaseTime( 4, t );
	}

	//------------------------------------------------------------------------
	// the kernels count into rows of _st.counters (one per thread): add them up
	//------------------------------------------------------------------------
	const _counterAcc = new Float64Array( SS.NUM_COUNTERS );
	this.collectKernelCounters = function()
	{
	    const K = _st.counters;
	    const a = _counterAcc;
	    a.fill( 0 );
	    for (let row = 0; row < SS.MAX_THREADS; row++)
	    {
	        const base = row * SS.NUM_COUNTERS;
	        for (let c = 0; c < SS.NUM_COUNTERS; c++) { a[c] += K[ base + c ]; K[ base + c ] = 0; }
	    }
	    simCounters.meatTargetsWhilePursuing  += a[ SS.K_MEAT_TARGETS_PURSUING ];
	    simCounters.preyTargetChoices         += a[ SS.K_PREY_CHOICES ];
	    simCounters.preyTargetMeatChoices     += a[ SS.K_PREY_MEAT_CHOICES ];
	    simCounters.preyTargetMeatDistanceSum += a[ SS.K_PREY_MEAT_DISTANCE ];
	    simCounters.preyTargetMeatRewardSum   += a[ SS.K_PREY_MEAT_REWARD ];
	    simCounters.preyTargetLiveChoices     += a[ SS.K_PREY_LIVE_CHOICES ];
	    simCounters.preyTargetLiveDistanceSum += a[ SS.K_PREY_LIVE_DISTANCE ];
	    simCounters.preyTargetLiveRewardSum   += a[ SS.K_PREY_LIVE_REWARD ];
	    simCounters.preyTargetDistanceSum     += a[ SS.K_PREY_DISTANCE ];
	    simCounters.preyTargetRewardSum       += a[ SS.K_PREY_REWARD ];
	}

	//------------------------------------------------------------------------
	// panel texts that need the swimbot objects (built here, so the page can
	// show them also when the simulation runs in its own thread)
	//------------------------------------------------------------------------
	this.getSwimbotPanelHTML     = function() { return buildSwimbotPanelHTML( this ); }
	this.getGeneticClustersText  = function() { return geneticClustersText( this ); }
	this.getFamilyTreeText       = function() { return buildFamilyTreeText( this ); }
	this.getPetriSettings        = function() { return { zones: petriSettings.zones, layout: petriSettings.layout, softness: petriSettings.softness }; }
	this.createSwimbotFromPreset = function( p ) { this.createNewSwimbotWithGenes( this.getPresetGenotype( p ).slice() ); }

	// ask for something that may take a while or come from another thread:
	// always a promise (see RemotePool.ts for the other side)
	this.request = function( name, ...args ) { return Promise.resolve( this[ name ]( ...args )); }

	// the objects behind the numbers in the shared arrays (for the swimbots)
	this.getSwimbotAt = function( i ) { return _swimbots[i]; }
	this.getFoodBitAt = function( i ) { return _foodBits[i]; }

	//------------------------------------------------------------------------
	// how long the phases take (milliseconds, summed; for finding what is slow)
	//------------------------------------------------------------------------
	const _phaseTimes = new Float64Array( 8 );
	function now() { return ( typeof performance !== "undefined" ) ? performance.now() : 0; }
	function phaseTime( phase, since ) { const t = now(); _phaseTimes[ phase ] += t - since; return t; }
	// Everything the read-only telemetry module needs is passed through one
	// small live view, the same pattern the world serializer uses.
	const _telemetryContext: any =
	{
	    get st()                 { return _st; },
	    get swimbots()           { return _swimbots; },
	    get foodBits()           { return _foodBits; },
	    get maxSwimbotSlot()     { return _maxSwimbotSlot; },
	    get ambientEnergy()      { return 0; },
	    get initialEnergy()      { return _totalWorldEnergy; },
	    get phyloTree()          { return _phyloTree; },
	    get environment()        { return environment; },
	    soilNutrient:            () => environment.getTotalSoilNutrient()
	};
	this.getTotalWorldEnergy = function() { return Telemetry.totalWorldEnergy( _telemetryContext ); }
	this.getInitialWorldEnergy = function() { return _totalWorldEnergy; }
	this.getAmbientEnergy = function() { return 0; }
	this.getEcologyStats = function() { return Telemetry.ecologyStats( _telemetryContext ); }
	const _telemetry =
	{
	    eTotal: 0, eInitial: 0, eDelta: 0,
	    eBots: 0, ePlants: 0, eMeat: 0, eSoil: 0, eAmbient: 0, eAtmosphere: 0,
	    sprouts: 0, young: 0, grown: 0, trees: 0,
	    herbSmall: 0, herbMed: 0, herbLarge: 0, predators: 0, soilTotal: 0
	};
	let _telemetryAt = -1;
	this.getTelemetry = function()
	{
	    if ( _telemetryAt >= 0 && ( _clock - _telemetryAt ) < 8 ) return _telemetry;
	    _telemetryAt = _clock;
	    return Telemetry.fillTelemetry( _telemetry, _telemetryContext );
	}
	this.getPhaseTimes = function() { return _phaseTimes; }


	this.updateSwimbots = function()
	{
	    // Swimbots that died last step: leave the grid, maybe leave meat
	    for (let s = 0; s < _maxSwimbotSlot; s++)
	    {
            if (_swimbotWasAlive[s] && ( _st.liveSwimbot[s] === 0 ))
            {
                // Запомнить позицию трупа ДО удаления из грида
                let deadPosition = _swimbots[s].getPosition();

                _swimbotWasAlive[s] = false;
                if ( this.onSwimbotDied ) { this.onSwimbotDied( _swimbots[s] ); }     // (src/RunRecorder.ts)

                // whatever was still inside the body when it died soaks into
                // the soil cell under the corpse (nothing is lost from the world)
                const residual = Math.max( 0, _swimbots[s].getEnergy() );
                if ( residual > 0 )
                {
                    depositSoilEnergy( _st, deadPosition.x, deadPosition.y, residual );
                    _swimbots[s].setEnergy( 0 );
                }


                // CARCASS_ENABLED: a body that died not eaten leaves its body as
                // meat - the energy its mass holds (what growing it cost)
                if ( CARCASS_ENABLED )
                {
                    if ( _swimbots[s].getDeathCause() !== "predation" )
                    {
                        const body = _swimbots[s].getPhenotypeMass() * Math.min( 1, _swimbots[s].getGrowthScale() ) * PREY_BODY_ENERGY;
                        this.spawnCarcass( deadPosition.x, deadPosition.y, drawFromAtmosphere( body ));
                    }
                }
                else if ( _swimbots[s].getPredatorLevel() <= PREDATOR_LEVEL_THRESHOLD
                && ( _swimbots[s].getAge() >= _swimbots[s].getMaxAge() ) )
                {
                    let meatIndex = this.findLowestDeadFoodBitInArray( true );
                    if ( meatIndex !== NULL_INDEX )
                    {
                        _foodBits[meatIndex].initialize(meatIndex);
                        _foodBits[meatIndex].setType(2);
                        _foodBits[meatIndex].setEnergy( drawFromAtmosphere( DEFAULT_FOOD_BIT_ENERGY ));
                        _foodBits[meatIndex].setPosition(deadPosition);
                    }
                }

            }
	    }

	    // who is alive now (after the meat above appeared)
        rebuildAliveIndexCaches();

	    // rebuild the swimbot grid from the living swimbots
	    // (what does not move - predator level, brightness, mass... - the
	    //  swimbot writes itself when it changes: Swimbot.writeStaticPerception)
	    for (let i = 0; i < _aliveSwimbotIndices.length; i++)
	    {
            let s = _aliveSwimbotIndices[i];
            syncSwimbotPosition(s);
            _botAlive[s] = 1;
            _swimbotWasAlive[s] = true;
	    }
        _swimbotGrid.build( _aliveSwimbotIndices, _aliveSwimbotIndices.length, _botX, _botY );

	    // rebuild the food grid from the living food bits (their position, type
	    // and energy are already in the shared state: FoodBit.bindShared)
	    _st.foodAlive.set( _st.liveFood );
        const foodGridCount = _aliveFoodBitIndices.length;
        if ((( _clock & 3 ) === 0 ) || ( foodGridCount !== _lastFoodGridCount ))
        {
            if (( _clock & 15 ) === 0 ) { sortAliveFoodByMorton(); }
            _foodBitGrid.build( _aliveFoodBitIndices, foodGridCount, _foodX, _foodY );
            _lastFoodGridCount = foodGridCount;
        }

        this.updateSwimbotsInPhases();

        //-------------------------------------------------
        // if showing mutual love....
        //-------------------------------------------------
        if ( _viewTracking.getMode() === ViewTrackingMode.MUTUAL )
        {
            let lover1 = _viewTracking.getLover1Index();
            let lover2 = _viewTracking.getLover2Index();

            if (( lover1 != NULL_INDEX )
            &&  ( lover2 != NULL_INDEX ))
            {
                //---------------------------------------------
                // show the mouths and genitals
                //---------------------------------------------
                _swimbots[ lover1 ].setRenderingGoals( true );
                _swimbots[ lover2 ].setRenderingGoals( true );

                //-----------------------------------------------------------------------------------
                // if either of the lovers stop pursuing the other then cancel mutual view mode
                //-----------------------------------------------------------------------------------
                if (( _swimbots[ lover1 ].getChosenMateIndex() != lover2 )
                ||  ( _swimbots[ lover2 ].getChosenMateIndex() != lover1 ))
                {
                    //_viewTracking.setMode( ViewTrackingMode.NULL, 0 );
                    //this.clearViewMode();
                    _viewTracking.stopTracking();
                }
            }
            else
            {
                _viewTracking.stopTracking();
            }
        }


        //console.log( "num living swimbots = " + testNumLiving.toString() );

    }




    //--------------------------------------------------------
	this.getJunkDnaSimilarity = function( genotype1, genotype2 )
	{
	    return Telemetry.junkDnaSimilarity( genotype1, genotype2 );
	}


    //-----------------------------------
	this.generatePhyloTree = function()
	{
	    Telemetry.generatePhyloTree( _swimbots, _phyloTree );
    }


    //---------------------------------------------
	this.findLowestDeadSwimbotInArray = function()
	{
        const limit = globalTweakers.populationLimitEnabled ? POPULATION_LIMIT : MAX_SWIMBOTS;
        const start = ( _deadBotHint < limit ) ? _deadBotHint : 0;
        // below the hint first (see findLowestDeadFoodBitInArray)
        for ( let s = 0; s < start; s++ )
        {
            if (( _botAlive[s] === 0 ) && !_swimbots[s].getAlive() )
            {
                _deadBotHint = s;
                return s;
            }
        }
        for ( let s = start; s < limit; s++ )
        {
            // (_botAlive is fast to scan; it can lag behind right after a new
            //  pool is made, so the swimbot itself confirms)
            if (( _botAlive[s] === 0 ) && !_swimbots[s].getAlive() )
            {
                _deadBotHint = s;
                if ( s + 1 > _maxSwimbotSlot ) { _maxSwimbotSlot = s + 1; }
                return s;
            }
        }
        return NULL_INDEX;
    }





    function killPlant( f: number ): void
    {
        if ( environment.active && NUTRIENT_CYCLE_ENABLED )
        {
            environment.returnMeatDetritusAt( _st.foodX[f], _st.foodY[f], _st.foodEnergy[f] );
        }
        // FoodBit.kill() returns the remaining crown energy to the atmosphere,
        // which funds the next sprouts; do not double-count a soil deposit.
        _foodBits[f].kill();
    }

    let _lastShadeClock = -999;
    function buildCanopyShade(): void
    {
        if ( !PLANT_SIZE_ENABLED || !environment.active ) { _plantShade.fill( 0 ); return; }
        if ( _clock > 1 && ( _clock - _lastShadeClock ) < 8 ) return;
        _lastShadeClock = _clock;
        _plantShade.fill( 0 );
        for ( let i = 0; i < _aliveFoodBitIndices.length; i++ )
        {
            const f = _aliveFoodBitIndices[i];
            if (( _st.liveFood[f] !== 1 ) || ( _st.foodType[f] === 2 )) continue;
            const crown = plantCrown( _st.foodEnergy[f] );
            if ( crown <= 0 ) continue;
            const x = _st.foodX[f], y = _st.foodY[f];
            const radius = PLANT_CANOPY_RADIUS * ( 0.25 + 0.75 * crown );
            const c0 = Math.max( 0, Math.floor(( x - radius - POOL_LEFT ) / PLANT_CELL_SIZE ));
            const c1 = Math.min( environment.plantColumns - 1, Math.floor(( x + radius - POOL_LEFT ) / PLANT_CELL_SIZE ));
            const r0 = Math.max( 0, Math.floor(( y - radius - POOL_TOP ) / PLANT_CELL_SIZE ));
            const r1 = Math.min( environment.plantRows - 1, Math.floor(( y + radius - POOL_TOP ) / PLANT_CELL_SIZE ));
            for ( let r = r0; r <= r1; r++ )
            {
                for ( let c = c0; c <= c1; c++ )
                {
                    const dx = POOL_LEFT + ( c + 0.5 ) * PLANT_CELL_SIZE - x;
                    const dy = POOL_TOP + ( r + 0.5 ) * PLANT_CELL_SIZE - y;
                    const distance = Math.hypot( dx, dy );
                    if ( distance >= radius ) continue;
                    const k = r * environment.plantColumns + c;
                    _plantShade[k] = Math.min( 1, _plantShade[k] + crown * ( 1 - distance / radius ));
                }
            }
        }
    }

	// Plant growth, fruiting, seeding and carrion decay all live in FoodEcology
	// now. GenePool keeps the step clock and the grid caches they operate on.
	this.updateFood = function() { FoodEcology.updateFood( _foodContext ); }
	this.spawnPlant = function( position, type, numType0, numType1, scatter, donor: number = NULL_INDEX )
	{
	    return FoodEcology.spawnPlant( _foodContext, position, type, numType0, numType1, scatter, donor );
	}
	this.regrowFoodClassic = function( numType0FoodBits, numType1FoodBits )
	{
	    FoodEcology.regrowFoodClassic( _foodContext, numType0FoodBits, numType1FoodBits );
	}
	this.regrowOneClassic = function( numType0FoodBits, numType1FoodBits )
	{
	    FoodEcology.regrowOneClassic( _foodContext, numType0FoodBits, numType1FoodBits );
	}

    //------------------------------------------------------------------------------
    // PLANT_EVOLUTION_ENABLED: a grown-up plant to make the next seed (a few
    // tries; at the very start, when none is grown up yet, any plant)
    //------------------------------------------------------------------------------
    this.findSeedParent = function( foodType )
    {
        const count = _aliveFoodBitIndices.length;
        for (let attempt = 0; ( attempt < PLANT_SEED_PARENT_TRIES ) && ( count > 0 ); attempt++)
        {
            const f = _aliveFoodBitIndices[ Math.floor( gpRandom() * count ) ];
            if ( _foodBits[f].getAlive() && ( _foodBits[f].getType() === foodType ) && ( _foodBits[f].getAge() >= plantMatureAge( f ))) return f;
        }
        return this.findRandomLivingFoodBit( foodType );
    }

    // a seed lands at about this distance from the parent (not behind the obstacle)
    this.placeSeed = function( seed, parent, distance )
    {
        for (let attempt = 0; attempt < 10; attempt++)
        {
            const angle = gpRandom() * PI2, d = distance * ( 0.5 + gpRandom() );
            _vectorUtility.x = parent.getPosition().x + d * Math.cos( angle );
            _vectorUtility.y = parent.getPosition().y + d * Math.sin( angle );
            seed.setPosition( _vectorUtility );
            if ( !_obstacle.getObstruction( parent.getPosition(), seed.getPosition() )) return;
        }
        seed.setPosition( parent.getPosition() );
    }


    //------------------------------------------------------------------------------
    // a random living plant (not meat), or null if there are none
    //------------------------------------------------------------------------------
    this.findRandomLivingPlant = function()
    {
        let count = _aliveFoodBitIndices.length;
        if ( count === 0 ) return null;

        for (let attempt = 0; attempt < 20; attempt++)
        {
            let f = _aliveFoodBitIndices[ Math.floor( gpRandom() * count ) ];
            if ( _foodBits[f].getAlive() && ( _foodBits[f].getType() !== 2 ))
            {
                return _foodBits[f];
            }
        }

        return null;
    }


	//--------------------------------
	this.setFoodSpread = function(s)
	{
	    //console.log( "setFoodSpread: " + s );

        assert( s >= MIN_FOOD_BIT_MAX_SPAWN_RADIUS, "GenePool: setFoodSpread: s >= MIN_FOOD_BIT_MAX_SPAWN_RADIUS" )
        assert( s <= MAX_FOOD_BIT_MAX_SPAWN_RADIUS, "GenePool: setFoodSpread: s <= MAX_FOOD_BIT_MAX_SPAWN_RADIUS" )

        globalTweakers.foodSpread = s;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            _foodBits[f].setMaxSpawnRadius( globalTweakers.foodSpread );
        }
    }

	//--------------------------------
	this.setFoodBitEnergy = function(e)
	{
	    //console.log( "setFoodBitEnergy: " + e );

        assert( e >= MIN_FOOD_BIT_ENERGY, "GenePool: setFoodBitEnergy: e >= MIN_FOOD_BIT_ENERGY" );
        assert( e <= MAX_FOOD_BIT_ENERGY, "GenePool: setFoodBitEnergy: e <= MAX_FOOD_BIT_ENERGY" );

        globalTweakers.foodBitEnergy = e;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            const oldEnergy = _foodBits[f].getEnergy();
            if ( _foodBits[f].getAlive() && CLOSED_ENERGY_CYCLE_ENABLED )
            {
                if ( globalTweakers.foodBitEnergy > oldEnergy ) { _foodBits[f].setEnergy( oldEnergy + drawFromAtmosphere( globalTweakers.foodBitEnergy - oldEnergy )); }
                else { transferToAtmosphere( oldEnergy - globalTweakers.foodBitEnergy ); _foodBits[f].setEnergy( globalTweakers.foodBitEnergy ); }
            }
            else { _foodBits[f].setEnergy( globalTweakers.foodBitEnergy ); }
        }
    }

	//--------------------------------
	this.setHungerThreshold = function(h)
	{
	    //console.log( "setHungerThreshold: " + h );

        assert( h >= MIN_SWIMBOT_HUNGER_THRESHOLD, "GenePool: setHungerThreshold: h >= MIN_SWIMBOT_HUNGER_THRESHOLD" );
        assert( h <= MAX_SWIMBOT_HUNGER_THRESHOLD, "GenePool: setHungerThreshold: h <= MAX_SWIMBOT_HUNGER_THRESHOLD" );

	    globalTweakers.hungerThreshold = h;

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
			_swimbots[s].setHungerThreshold( globalTweakers.hungerThreshold );
        }
    }

	//--------------------------------------
	this.setOffspringEnergyRatio = function(e)
	{
        //console.log( "setOffspringEnergyRatio: " + e );

        assert( e >= MIN_CHILD_ENERGY_RATIO, "GenePool: setOffspringEnergyRatio: e >= MIN_CHILD_ENERGY_RATIO" );
        assert( e <= MAX_CHILD_ENERGY_RATIO, "GenePool: setOffspringEnergyRatio: e <= MAX_CHILD_ENERGY_RATIO" );

        globalTweakers.childEnergyRatio = e;
    }


	//----------------------------------
	this.setFoodGrowthDelay = function(d)
	{
	    //console.log( "setFoodGrowthDelay: " + d );

        assert( d >= MIN_FOOD_REGENERATION_PERIOD, "setFoodGrowthDelay: d >= MIN_FOOD_REGENERATION_PERIOD" )
        assert( d <= MAX_FOOD_REGENERATION_PERIOD, "setFoodGrowthDelay: d <= MAX_FOOD_REGENERATION_PERIOD" )

	    globalTweakers.foodRegenerationPeriod = d;
    }


	//--------------------------------------
	this.setMaximumSwimbotAge = function(m)
	{
        assert( m >= MIN_MAXIMUM_AGE, "GenePool: setMaximumSwimbotAge: m >= MIN_MAXIMUM_AGE" );
        assert( m <= MAX_MAXIMUM_AGE, "GenePool: setMaximumSwimbotAge: m <= MAX_MAXIMUM_AGE" );

        globalTweakers.maximumLifeSpan = m;
    }

    this.setPopulationLimitEnabled = function( value )
    {
        globalTweakers.populationLimitEnabled = Boolean( value );
    }

    this.setMaximumSwimbotParts = function( value )
    {
        const parsed = Number( value );
        if ( !Number.isFinite( parsed )) return;
        globalTweakers.maximumParts = Math.max( MIN_PARTS, Math.min( MAX_PARTS, Math.round( parsed )));
    }


	//-------------------------------------------------------------
	this.findRandomLivingFoodBit = function( foodType )
	{
        /*
	    let randomShift = Math.floor( gpRandom() * MAX_FOODBITS );

        for (let i=0; i<MAX_FOODBITS; i++)
        {
            let f = ( i + randomShift ) % MAX_FOODBITS;

            assert( f < MAX_FOODBITS, "Genepool.js: f < MAX_FOODBITS" );
            assert( f >= -1, "Genepool.js:findRandomLivingFoodBit: assert( f >= -1)" );

            if ( _foodBits[f].getAlive() )
            {
                if ( _foodBits[f].getType() === foodType )
                {
                    return f;
                }
            }
        }

        return NULL_INDEX;
	    */





	    // original version
        let f = NULL_INDEX;
        let numTimesLooking = 200;
        let i = 0;
        let looking = true;

        while ( looking )
        {
            let testIndex = Math.floor( gpRandom() * ( MAX_FOODBITS - 1 ) );

            //assert( testIndex < MAX_FOODBITS, "Genepool.js: testIndex < MAX_FOODBITS" );

            if ( _foodBits[ testIndex ].getAlive() )
            {
                if ( _foodBits[ testIndex ].getType() === foodType )
                {
                    f = testIndex;
                    looking = false;
                }
            }

            i ++;
            if ( i > numTimesLooking )
            {
                looking = false;
                //console.log( "failed to findRandomLivingFoodBit" );
            }
        }

        assert( f < MAX_FOODBITS, "Genepool.js: f < MAX_FOODBITS" );

        return f;
    }



	//----------------------------------------
	// The food slots are in two parts: plants in the first, meat in the last
	// (MEAT_SLOT_SHARE of all), so that a mass die-off, with its carcasses,
	// cannot take the places the plants grow in.
	this.findLowestDeadFoodBitInArray = function( meat = false )
	{
        // the lowest free slot (the alive flags are bytes in the shared state).
        // The hint remembers where the last search found one, so a pool full of
        // living plants is not scanned from the start on every birth.
        const live = _st.liveFood;
        const split = Math.floor( MAX_FOODBITS * ( 1 - MEAT_SLOT_SHARE ));
        const from = meat ? split : 0, to = meat ? MAX_FOODBITS : split;
        let hint = meat ? _deadMeatHint : _deadPlantHint;
        if (( hint < from ) || ( hint >= to )) { hint = from; }
        // below the hint first: that keeps the result exactly "the lowest free
        // slot", so the world behaves as it always did
        for (let f = from; f < hint; f++) { if ( live[f] !== 1 ) { if ( meat ) { _deadMeatHint = f; } else { _deadPlantHint = f; } return f; } }
        for (let f = hint; f < to; f++) { if ( live[f] !== 1 ) { if ( meat ) { _deadMeatHint = f; } else { _deadPlantHint = f; } return f; } }
        return NULL_INDEX;
    }


	//-------------------------------------------------
    this.createNewSwimbotWithGenes = function( genes )
    {
        let index = this.findLowestDeadSwimbotInArray();

        assert( index != NULL_INDEX, "GenePool.createNewSwimbotWithGenes: index != NULL_INDEX" );

        _myGenotype.setGenes( genes );

        let initialAge      = YOUNG_AGE_DURATION;
        let initialAngle    = ZERO;
        let initialEnergy   = drawFromAtmosphere( DEFAULT_SWIMBOT_HUNGER_THRESHOLD );

        _swimbots[ index ].create( index, initialAge, _camera.getPosition(), initialAngle, initialEnergy, _myGenotype, _embryology );

        //-------------------------------------------------------
        // add the new swimbot to the family tree
        //-------------------------------------------------------
        _familyTree.addNode( index, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes( index ) );


        setSelectedSwimbot( index );
    }


    // Gallery action: give the selected body the genes of a saved creature,
    // keeping its place, age and energy so the world around it is undisturbed.
    this.replaceSelectedWithGenes = function( genes )
    {
        const ID = this.getSelectedSwimbotID();
        if ( ID === NULL_INDEX ) { this.createNewSwimbotWithGenes( genes ); return; }

        _myGenotype.setGenes( genes );
        const initialAge    = _swimbots[ ID ].getAge();
        const initialAngle  = _swimbots[ ID ].getAngle();
        const initialEnergy = Math.max( 1, _swimbots[ ID ].getEnergy() * ONE_HALF );
        const at = new Vector2D();
        at.copyFrom( _swimbots[ ID ].getPosition() );

        _swimbots[ ID ].create( ID, initialAge, at, initialAngle, initialEnergy, _myGenotype, _embryology );
        _familyTree.addNode( ID, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes( ID ));
        setSelectedSwimbot( ID );
    }


    // Gallery action: place a small herd of the saved creature around the
    // middle of the view. They are ordinary swimbots: no special flags.
    this.spawnHerdFromGenes = function( genes, count = 10 )
    {
        const center = _camera.getPosition();
        const total = Math.max( 1, Math.floor( count ));
        const radius = 70;
        for (let i = 0; i < total; i++)
        {
            this.createNewSwimbotWithGenes( genes );
            const ID = this.getSelectedSwimbotID();
            if ( ID === NULL_INDEX ) return;
            const a = ( i / total ) * Math.PI * 2;
            const at = new Vector2D();
            at.x = Math.max( POOL_LEFT + 2, Math.min( POOL_RIGHT - 2, center.x + Math.cos( a ) * radius ));
            at.y = Math.max( POOL_TOP  + 2, Math.min( POOL_BOTTOM - 2, center.y + Math.sin( a ) * radius ));
            _swimbots[ ID ].setPosition( at );
        }
    }


	//--------------------------------
    this.setPoolData = function( data )
    {
        //------------------------------------------------------------
        // the environment first (swimbots check the temperature when
        // they are created); pools saved before stage 5 have none
        //------------------------------------------------------------
        environment.setState( data.environment );
        if ( environment.active ) { environment.copyBackgroundTo( _st.background ); }
        _clock = ( typeof data.clock === "number" ) ? data.clock : 0;
        environment.setTime( _clock );
        _seedDebt = 0;
        globalTweakers.numFoodTypes = environment.active ? ( TWO_PLANT_TYPES ? 2 : 1 ) : globalTweakers.numFoodTypes;
        _environmentImage = environment.active ? environment.makeImage() : null;
        _pool.setBackgroundImage( _environmentImage );
        this.setPopulationLimitEnabled( data.populationLimitEnabled !== false );
        this.setMaximumSwimbotParts( typeof data.maximumSwimbotParts === "number" ? data.maximumSwimbotParts : 16 );

        //console.log( "loading pool file:" );
        //console.log( data );

        //-------------------------------------------
        // frozen or running?
        //-------------------------------------------
        _simulationRunning = data.simulationRunning;

        //-------------------------------
        // load food
        //-------------------------------
        _numFoodBits = data.numFoodBits;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            _foodBits[f].kill();
        }

        for (let f=0; f<data.numFoodBits; f++)
        {
            let id = data.foodBitArray[f].id;

            _foodBits[ id ].initialize( id );

            // its age and plant genes (older save files have none)
            const saved = data.foodBitArray[f];
            if ( typeof saved.age    === "number" ) { _st.foodBorn[ id ] = _clock - saved.age; }
            if ( typeof saved.growth === "number" ) { _st.plantGrowth[ id ] = saved.growth; _st.plantSpread[ id ] = saved.spread; }
            if ( typeof saved.energy === "number" && Number.isFinite( saved.energy )) { _st.foodEnergy[ id ] = saved.energy; }
            if ( typeof saved.wood === "number" && Number.isFinite( saved.wood )) { _st.foodWood[ id ] = saved.wood; }
            else { _st.foodWood[ id ] = Math.max( 0, _st.foodEnergy[ id ] ); }
            if ( typeof saved.fruit === "number" && Number.isFinite( saved.fruit )) { _st.foodFruit[ id ] = saved.fruit ? 1 : 0; }
            if ( typeof saved.nextFruitAt === "number" && Number.isFinite( saved.nextFruitAt )) { _st.foodFruitAt[ id ] = saved.nextFruitAt; }

            // older save files have no food type - those are plants
            let type = data.foodBitArray[f].type;
            _foodBits[ id ].setType( ( type === 1 || type === 2 ) ? type : 0 );

            let foodBitPosition = new Vector2D();
            foodBitPosition.setXY( data.foodBitArray[f].x, data.foodBitArray[f].y );
            _foodBits[ id ].setPosition( foodBitPosition );
        }

        //---------------------------------
        // load swimbots
        //---------------------------------
        _numSwimbots = data.numSwimbots;

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            _swimbots[s].die();
        }

        //----------------------------------------
        // reset family tree array
        //----------------------------------------
        _familyTree.reset();

        //----------------------------------------
        // create the swimbots
        //----------------------------------------
        for (let s=0; s<data.numSwimbots; s++)
        {
            let id = data.swimbotArray[s].id;

            let swimbotPosition = new Vector2D();
            swimbotPosition.setXY( data.swimbotArray[s].x, data.swimbotArray[s].y );

            let loadedGenotype = new Genotype();
            let genes = data.swimbotArray[s].genes.slice();
            if ( !data.geneLayout ) { convertOldGenes( genes ); }
            loadedGenotype.setGenes( genes );
            loadedGenotype.setBrain( data.swimbotArray[s].brain );   // (older files: the innate brain)

            //this seems to be glitched - I must explore why
            //console.log( "s = " + s + "; id = " + id );
            //assert( id === s, "GenePool.js: this.setPoolData: assert: id === s" );

            _swimbots[ id ].create
            (
                id,
                //id, //this seems to be glitched - I must explore why
                data.swimbotArray[s].age,
                swimbotPosition,
                data.swimbotArray[s].angle,
                data.swimbotArray[s].energy,
                loadedGenotype,
                _embryology
            );
            if ( Array.isArray( data.swimbotArray[s].privateState ) )
            {
                _swimbots[id].setPrivateState( data.swimbotArray[s].privateState, 0 );
            }

            //------------------------------------------------------------------------------------
            // add the new swimbot to the family tree
            //------------------------------------------------------------------------------------
            _familyTree.addNode( id, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes( id ) );
        }

        //----------------------------------------
        // camera
        //----------------------------------------
        let cameraPosition = new Vector2D();
        cameraPosition.setXY( data.cameraX, data.cameraY );
        _camera.setPosition( cameraPosition );
        _camera.setScale( data.cameraScale );

        //------------------------
        // set view control
        //------------------------
        _viewTracking.reset();

        //--------------------------------------------------------------
        // set tweakers
        //--------------------------------------------------------------
        this.setFoodGrowthDelay     ( data.foodRegenerationPeriod   );
        this.setFoodSpread          ( data.foodSpread               );
        this.setFoodBitEnergy       ( data.foodBitEnergy            );
        // setFoodBitEnergy applies the pool default to every loaded slot;
        // restore per-item values afterwards when present in newer legacy saves.
        for ( let f = 0; f < data.numFoodBits; f++ )
        {
            const saved = data.foodBitArray[f], id = saved.id;
            if ( typeof saved.energy === "number" && Number.isFinite( saved.energy )) { _st.foodEnergy[id] = saved.energy; }
            if ( typeof saved.wood === "number" && Number.isFinite( saved.wood )) { _st.foodWood[id] = saved.wood; }
            else { _st.foodWood[id] = Math.max( 0, _st.foodEnergy[id] ); }
            _st.foodFruit[id] = ( typeof saved.fruit === "number" && Number.isFinite( saved.fruit ) && saved.fruit !== 0 ) ? 1 : 0;
            if ( typeof saved.nextFruitAt === "number" && Number.isFinite( saved.nextFruitAt )) { _st.foodFruitAt[id] = saved.nextFruitAt; }
        }
        this.setHungerThreshold     ( data.hungerThreshold          );
        this.setAttraction          ( data.attractionCriterion      );
        this.setOffspringEnergyRatio( data.childEnergyRatio         );

        _renderingGoals = data.renderingGoals;


        //--------------------------------------------------------------
        // set obstacle
        //--------------------------------------------------------------
        //to do
		let end1 = new Vector2D();
		let end2 = new Vector2D();

        /*
		if ( data.obstacleEnd1X === undefined ) { console.log( data.obstacleEnd1X ); }
		if ( data.obstacleEnd1Y === undefined ) { console.log( data.obstacleEnd1Y ); }
		if ( data.obstacleEnd2X === undefined ) { console.log( data.obstacleEnd2X ); }
		if ( data.obstacleEnd2Y === undefined ) { console.log( data.obstacleEnd2Y ); }
		*/

		if (( data.obstacleEnd1X != undefined )
		&&  ( data.obstacleEnd1Y != undefined )
		&&  ( data.obstacleEnd2X != undefined )
		&&  ( data.obstacleEnd2Y != undefined ))
		{
    		end1.setXY( data.obstacleEnd1X, data.obstacleEnd1Y );
    		end2.setXY( data.obstacleEnd2X, data.obstacleEnd2Y );
        }
        else
        {
            //console.log( data.obstacleEnd1X + ", " + data.obstacleEnd1Y );
            //console.log( data.obstacleEnd2X + ", " + data.obstacleEnd2Y );

    		end1.setXY( 100, 100 );
    		end2.setXY( 200, 100 );
        }


        _obstacle.setEndpointPositions( end1, end2 );
		if ( data.obstacleSegments && ( data.obstacleSegments.length > 0 ))
		{
			_obstacle.setSegments( data.obstacleSegments );
		}

		//---------------------------------
		// start time
		//---------------------------------
		_startTime = (new Date).getTime();

		//----------------------------------
		// get seconds
		//----------------------------------
		_seconds = ( (new Date).getTime() - _startTime ) / MILLISECONDS_PER_SECOND;

		//----------------------------------
		// initialize pool
		//----------------------------------
	    _pool.initialize( _seconds );

		//---------------------------------
		// clear this!
		//---------------------------------
        setSelectedSwimbot( NULL_INDEX );

		// (the clock was restored at the top: the seasons go on where they were)
    }

    //--------------------------------------
    // set selected swimbot
    //--------------------------------------
    function setSelectedSwimbot( index )
    {
        _selectedSwimbot = index;

// hey...maybe I need to turn off any other things that assume there is a selected swimbot...here

    }



	//-------------------------------------
	this.makeNewRandomSwimbot = function()
	{
	    let index = this.findLowestDeadSwimbotInArray();

	    if ( index != NULL_INDEX )
	    {
            let initialAge      = YOUNG_AGE_DURATION;
            let initialAngle    = getRandomAngleInDegrees(); //-180.0 + gpRandom() * 360.0;
            let initialEnergy   = drawFromAtmosphere( DEFAULT_SWIMBOT_HUNGER_THRESHOLD );

            _myGenotype.randomize();

            _swimbots[ index ].create( index, initialAge, _camera.getPosition(), initialAngle, initialEnergy, _myGenotype, _embryology );

            //--------------------------------------------------
            // add the new swimbot to the family tree
            //--------------------------------------------------
            _familyTree.addNode( index, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes( index ) );

            setSelectedSwimbot( index )
        }
        else
        {
            console.log( "cannot make random swimbot" );
        }
    }

	//---------------------------------------
	this.zapSwimbot = function( ID, amount )
	{
        assert( ID != NULL_INDEX, "genepool: zapSwimbot: ID != NULL_INDEX" );
        _swimbots[ ID ].zap( _embryology, amount );
        _pool.endTouch( _swimbots[ ID ].getPosition(), _seconds );
    }

	//------------------------------------
	this.randomizeSwimbot = function( ID )
	{
        assert( ID != NULL_INDEX, "genepool: randomizeSwimbot: ID != NULL_INDEX" );
	    this.zapSwimbot( ID, ONE );
	    _pool.endTouch( _swimbots[ ID ].getPosition(), _seconds );
	}


	//----------------------------------
	this.cloneSwimbot = function( ID )
	{
        assert( ID != NULL_INDEX, "genepool: cloneSwimbot: ID != NULL_INDEX" );

        let index = this.findLowestDeadSwimbotInArray();

        if ( index != NULL_INDEX )
        {
            //let initialAge      = YOUNG_AGE_DURATION;
            let initialAge      = _swimbots[ ID ].getAge();
            let initialAngle    = _swimbots[ ID ].getAngle();
            let initialEnergy   = _swimbots[ ID ].getEnergy() * ONE_HALF;
            let genotype        = _swimbots[ ID ].getGenotype();

            let initialPosition = new Vector2D();
            let p = new Vector2D();
            initialPosition.copyFrom( _swimbots[ ID ].getPosition() );
            p.copyFrom( initialPosition );

            initialPosition.x += CLONE_SEPARATION;
            p.x -= CLONE_SEPARATION;

            _swimbots[ ID ].setPosition(p);
            _swimbots[ ID ].setEnergy( initialEnergy ); // the clonee gets its energy halved as well as the cloned
            _swimbots[ index ].create( index, initialAge, initialPosition, initialAngle, initialEnergy, genotype, _embryology );

            //--------------------------------------------------
            // add the new swimbot to the family tree
            //--------------------------------------------------
            _familyTree.addNode( index, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes( index ) );

            setSelectedSwimbot( index )
        }
    }


	//------------------------------------------------------------------
	// toggleSwimbotPredator — переключить хищник/травоядный у бота
	//------------------------------------------------------------------
	this.toggleSwimbotPredator = function( swimbotID )
	{
	    if ( swimbotID === NULL_INDEX ) return;

	    let swimbot = _swimbots[ swimbotID ];
	    if ( !swimbot || !swimbot.getAlive() ) return;

	    let current = swimbot.getPredatorLevel();

	    // Три состояния по кругу: травоядный (0.1) → слабый хищник (0.65) → сильный хищник (0.9)
	    let next;
	    if      ( current < 0.4 )  next = 0.65;  // был травоядный → средний хищник
	    else if ( current < 0.75 ) next = 0.9;   // был средний → сильный хищник
	    else                       next = 0.1;   // был сильный → обратно травоядный

	    swimbot.applyPredatorLevel( next );
	}

	//------------------------------------------------------------
	// feed: give the swimbot a good meal (up to its maximum energy)
	//------------------------------------------------------------
	this.feedSwimbot = function( ID )
	{
	    if (( ID === NULL_INDEX ) || !_swimbots[ ID ].getAlive() ) return;
	    const swimbot = _swimbots[ ID ];
const feedRoom = Math.min( 100, swimbot.getMaxEnergy() - swimbot.getEnergy() );
    swimbot.setEnergy( swimbot.getEnergy() + drawFromAtmosphere( feedRoom ));
	}

	//------------------------------------
	this.killSwimbot = function( ID )
	{
	    assert( ID != NULL_INDEX, "genepool: killSwimbot: ID != NULL_INDEX" );


	    //---------------------------------------------------------------------------
	    // if this swimbot is one of the mutal lovers, then turn off mutal mode....
	    //---------------------------------------------------------------------------
	    if ( _viewTracking.getMode() === ViewTrackingMode.MUTUAL )
	    {
	        //console.log( "yea" );
	        if (( _viewTracking.getLover1Index() === ID )
	        ||  ( _viewTracking.getLover2Index() === ID ))
	        {
	            //_viewTracking.setMode( ViewTrackingMode.NULL );
	            this.clearViewMode();
	         }
	    }

	    //------------------------------
	    // deselect, if selected....
	    //------------------------------
	    if ( _selectedSwimbot === ID )
	    {
	        setSelectedSwimbot( NULL_INDEX );
	    }

	    //------------------------------
	    // kill that mofo....
	    //------------------------------
	    _swimbots[ ID ].die();

	    //------------------------------
	    // add a pool effect....
	    //------------------------------
	    _pool.endTouch( _swimbots[ ID ].getPosition(), _seconds );
	}

	//------------------------------------
	this.toggleEternalSwimbot = function( ID )
	{
	    assert( ID != NULL_INDEX, "genepool: toggleEternalSwimbot: ID != NULL_INDEX" );

	    //------------------------------
	    // toggle eternal status
	    //------------------------------
	    _swimbots[ ID ].setEternal( !_swimbots[ ID ].getEternal() );

	}


	//----------------------------------------
	this.updateCameraNavigation = function()
	{
        //--------------------------------------------------------------
        // keys held down move / zoom the camera at a steady speed
        // (per second, so it does not depend on the frame rate)
        //--------------------------------------------------------------
        const now = performance.now();
        let seconds = ( _lastCameraNavigationTime === 0 ) ? 0 : ( now - _lastCameraNavigationTime ) / 1000;
        _lastCameraNavigationTime = now;
        if ( seconds > 0.1 ) { seconds = 0.1; }

        const pan = _camera.getScale() * CAMERA_PAN_SPEED * seconds;
        let dx = 0, dy = 0;
        if ( _panningLeft  ) { dx -= pan; }
        if ( _panningRight ) { dx += pan; }
        if ( _panningUp    ) { dy -= pan; }
        if ( _panningDown  ) { dy += pan; }
        if (( dx !== 0 ) || ( dy !== 0 )) { _camera.moveBy( dx, dy ); }

        let zoom = 0;
        if ( _zoomingIn  ) { zoom -= CAMERA_KEY_ZOOM_SPEED * seconds; }
        if ( _zoomingOut ) { zoom += CAMERA_KEY_ZOOM_SPEED * seconds; }
        if ( zoom !== 0 )
        {
            const center = _camera.getPosition();
            _camera.zoomAt( Math.exp( zoom ), center.x, center.y );
        }
	}

	//--------------------------------------------------------------
	// mouse wheel: zoom towards the point under the cursor
	//--------------------------------------------------------------
	this.zoomCameraAtScreenPoint = function( x, y, wheelDelta )
	{
        _viewTracking.stopTracking();
        const point = this.convertScreenCoordinatesToPoolPosition( x, y );
        const worldX = point.x, worldY = point.y;
        _camera.zoomAt( Math.exp( wheelDelta * CAMERA_WHEEL_ZOOM_SPEED ), worldX, worldY );
	}

	//--------------------------------------------------------------
	// middle-button drag: the pool follows the mouse
	//--------------------------------------------------------------
	this.panCameraByScreenPixels = function( dxPixels, dyPixels )
	{
        _viewTracking.stopTracking();
        const unitsPerPixel = _camera.getXDimension() / _canvasWidth;
        _camera.moveBy( -dxPixels * unitsPerPixel, -dyPixels * unitsPerPixel );
	}

	//-----------------------------------------
	this.setSimulationRunning = function(s)
	{
        _simulationRunning = s;
    }

	//-------------------------------
	this.setRendering = function(r)
	{
        _rendering = r;
    }

	//-------------------------------------------
	this.setMillisecondsPerUpdate = function(m)
	{
        _millisecondsPerUpdate = m;
    }

	//--------------------------------------------------
	this.setMillisecondsPerUpdateToDefault = function()
	{
        _millisecondsPerUpdate = DEFAULT_MILLISECONDS_PER_UPDATE;
    }

	//-----------------------------------
	this.setFastMode = function(f)
	{
        _fastMode = f;
        _fastRenderCounter = 0;
        _speedLevel = f ? 3 : 1;
        // (the original turned mouths and genitals off here to save drawing
        //  time; drawing is cheap now, so they stay visible)
    }

	//--------------------------------------------------------------
	// simulation speed: 1 = normal, 2 = fast, 3 = as fast as possible
	//--------------------------------------------------------------
	this.setSpeedLevel = function( level )
	{
        _speedLevel = Math.min( 3, Math.max( 1, level ));
        _fastMode   = ( _speedLevel === 3 );
        _fastRenderCounter = 0;
        _stepDebt = 0;
	}

	this.getSpeedLevel = function() { return _speedLevel; }

	//-----------------------------------
	this.toggleGoalOverlay = function()
	{
	       _renderingGoals = true;
	       for (let s=0; s<MAX_SWIMBOTS; s++)
	       {
	           _swimbots[s].setRenderingGoals( _renderingGoals );
	       }
	   }

	//-----------------------------------
	this.setRenderingGoals = function(r)
	{
	       _renderingGoals = r;
	       for (let s=0; s<MAX_SWIMBOTS; s++)
	       {
	           _swimbots[s].setRenderingGoals( _renderingGoals );
	       }
	   }

	//---------------------------------------------------------------------
	// shift any food bit that maye be overlapping with the obstacle...
	//---------------------------------------------------------------------
    function moveFoodBitsFromObstacle()
    {
        for (let f=0; f<MAX_FOODBITS; f++)
        {
            if ( _foodBits[f].getAlive() )
            {
                if ( _obstacle.getCollision( _foodBits[f].getPosition(), 30 ) )
                {
                    _vectorUtility = _obstacle.getCurrentCollisionForce();
                    _vectorUtility.scale( 5 );
                    _foodBits[f].shiftPosition( _vectorUtility );

                }
            }
        }
    }

	//---------------------------------------------
	this.setShowingViewTrackingMode = function(s)
	{
        _showViewTrackingMode = s;
	}

	//-------------------------
	// drawing lives in GenePoolRenderer.ts
	this.render                     = function()                 { _renderer.render(); }
	this.renderFoodBits             = function( g )             { _renderer.renderFoodBits( g ); }
	this.writeFoodDots              = function()                 { _renderer.writeFoodDots(); }
	this.renderSwimbotsWithBatching = function( g )             { _renderer.renderSwimbotsWithBatching( g ); }
	this.renderSwimbotOverlays      = function( g )             { _renderer.renderSwimbotOverlays( g ); }

	//---------------------------------------------------------------------
	// Filmstrip 3×3: nine close-ups of the chosen swimbot's gait. The
	// frames are 360×360 world units, three steps apart (step +0 … +24).
	// Everything runs inside one worker tick; only PNG encoding is awaited.
	//---------------------------------------------------------------------
	this.captureFilmstrip = async function()
	{
        const makeCanvas = ( w: number, h: number ): any =>
        {
            if ( typeof OffscreenCanvas !== "undefined" ) { return new OffscreenCanvas( w, h ); }
            const c = document.createElement( "canvas" );
            c.width = w; c.height = h;
            return c;
        };
        const toPNG = async ( canvas: any ): Promise<Uint8Array> =>
        {
            if ( typeof canvas.convertToBlob === "function" )
            {
                const blob = await canvas.convertToBlob({ type: "image/png" });
                return new Uint8Array( await blob.arrayBuffer() );
            }
            const base64 = canvas.toDataURL( "image/png" ).split( "," )[1];
            const binary = atob( base64 );
            const bytes  = new Uint8Array( binary.length );
            for ( let i = 0; i < binary.length; i++ ) { bytes[i] = binary.charCodeAt( i ); }
            return bytes;
        };

        if ( _selectedSwimbot === NULL_INDEX || !_swimbots[ _selectedSwimbot ].getAlive() )
        {
            if ( _aliveSwimbotIndices.length === 0 ) { return new Uint8Array( 0 ); }
            setSelectedSwimbot( _aliveSwimbotIndices[0] );
        }
        const id = _selectedSwimbot;
        const bot = _swimbots[ id ];
        const pos = bot.getPosition();
        let lastX = pos.x, lastY = pos.y, lastAngle = bot.getAngle(), lastSpeed = bot.getSpeed();

        const savedCanvas = _canvas, savedW = _canvasWidth, savedH = _canvasHeight;
        const savedCamera = _camera, savedCapsule = _capsuleRenderer;
        const savedTrackingLabel = _showViewTrackingMode;
        const sheet = makeCanvas( 900, 900 );
        const sheetCtx: any = sheet.getContext( "2d" );
        sheetCtx.fillStyle = "#101418";
        sheetCtx.fillRect( 0, 0, 900, 900 );
        _capsuleRenderer = null;
        _showViewTrackingMode = false;
        try
        {
            for ( let frame = 0; frame < 9; frame++ )
            {
                if ( frame > 0 ) { for ( let k = 0; k < 3; k++ ) { _this.simulateStep(); } }
                if ( bot.getAlive() )
                {
                    const p = bot.getPosition();
                    lastX = p.x; lastY = p.y;
                    lastAngle = bot.getAngle(); lastSpeed = bot.getSpeed();
                }
                const viewCanvas = makeCanvas( 300, 300 );
                const view = viewCanvas.getContext( "2d" );   // the renderer draws into a 2D context
                const cam  = new Camera();
                const centre = new Vector2D();
                centre.setXY( lastX, lastY );
                cam.setAspectRatio( 1 );
                cam.setScale( 360 );
                cam.setPosition( centre );
                _canvas = view; _canvasWidth = 300; _canvasHeight = 300; _camera = cam;
                _renderer.render();
                const col = frame % 3, row = Math.floor( frame / 3 );
                sheetCtx.drawImage( viewCanvas, col * 300, row * 300 );
                sheetCtx.fillStyle = "rgba( 0, 0, 0, 0.68 )";
                sheetCtx.fillRect( col * 300, row * 300 + 266, 300, 34 );
                sheetCtx.fillStyle = "#dfe8f0";
                sheetCtx.font = "14px Arial";
                sheetCtx.fillText( "step +" + ( frame * 3 ) + "  " + lastAngle.toFixed( 0 ) + "°  " + lastSpeed.toFixed( 2 ),
                                   col * 300 + 8, row * 300 + 289 );
            }
        }
        finally
        {
            _canvas = savedCanvas; _canvasWidth = savedW; _canvasHeight = savedH;
            _camera = savedCamera; _capsuleRenderer = savedCapsule;
            _showViewTrackingMode = savedTrackingLabel;
        }
        return await toPNG( sheet );
	}

	// the V key: up close, bodies on the graphics card too (faster, a little plainer)
	let _gpuUpClose = false;
	this.toggleGpuUpClose = function() { _gpuUpClose = !_gpuUpClose; }
	this.getGpuUpClose    = function() { return _gpuUpClose; }

    //-------------------------------------
    // Создание рендерера после инициализации всех переменных
    //-------------------------------------
    _renderer = createGenePoolRenderer( _rendererContext );

	//--------------------------------------
	this.initializeDebugTrail = function(s)
	{
        for (let t=0; t<TRAIL_LENGTH; t++)
        {
            _debugTrail[t].set( _swimbots[s].getPosition() );
        }
    }


	//-----------------------------------
	this.showSwimbotTrail = function(s)
	{
        //------------------------------------
        // update trail
        //------------------------------------
        if ( _clock % 20 == 0 )
        {
            for (let t=TRAIL_LENGTH-1; t>0; t--)
            {
                _debugTrail[t].set( _debugTrail[t-1] );
            }

           _debugTrail[0].set( _swimbots[s].getPosition() );
        }

        //------------------------------------
        // render trail
        //------------------------------------
        _canvas.lineWidth = 2;
        _canvas.strokeStyle = "rgb( 255, 255, 255 )";

        for (let t=1; t<TRAIL_LENGTH; t++)
        {
            _canvas.beginPath();
            _canvas.moveTo( _debugTrail[t-1].x, _debugTrail[t-1].y );
            _canvas.lineTo( _debugTrail[t].x, _debugTrail[t].y );
            _canvas.closePath();
            _canvas.stroke();
        }
	}


	//----------------------------------------------------
	this.setGeneTweakCategory = function( swimbotIndex )
	{
	    //console.log( "setGeneTweakCategory: swimbotIndex = " + swimbotIndex );
    }


	//--------------------------------------------------------------
	this.tweakGene = function( swimbotIndex, geneIndex, geneValue )
	{
	    assert( swimbotIndex != NULL_INDEX, "genepool.js: tweakGene: swimbotIndex != NULL_INDEX"    );
	    assert( geneIndex    >= 0,          "genepool.js: tweakGene: geneIndex >= 0"                );
	    assert( geneIndex    < NUM_GENES,   "genepool.js: tweakGene: geneIndex    < NUM_GENES"      );
	    assert( geneValue    >= 0,          "genepool.js: tweakGene: geneValue    >= 0"             );
	    assert( geneValue    < BYTE_SIZE,   "genepool.js: tweakGene: geneValue    < BYTE_SIZE"      );

	    //console.log( "uh, tweakGene: swimbotIndex = " + swimbotIndex + "; geneIndex = " + geneIndex  + "; geneValue = " + geneValue );

	    _swimbots[ swimbotIndex ].setGeneValue( geneIndex, geneValue, _embryology );

	    _vectorUtility.x = ZERO;
	    _vectorUtility.y = ZERO;
	    _swimbots[ swimbotIndex ].setVelocity( _vectorUtility );
    }


	//--------------------------------
	this.touchDown = function( x, y )
	{
        _touch.setToDown( x, y );
       this.handleNonUITouchDownActions( x, y );
	}

	//--------------------------------------------------------------
	this.convertScreenCoordinatesToPoolPosition = function( x, y )
	{
	    _vectorUtility.x = _camera.getPosition().x - _camera.getXDimension() * ONE_HALF + ( x / _canvasWidth  ) * _camera.getXDimension();
    	_vectorUtility.y = _camera.getPosition().y - _camera.getYDimension() * ONE_HALF + ( y / _canvasHeight ) * _camera.getYDimension();

	    return _vectorUtility;
    }


	//-------------------------------
	this.touchMove = function( x, y )
	{
        if (( x < _canvasWidth  )
        &&  ( y < _canvasHeight ))
    	{
            _touch.setToMove( x, y );

            _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );
            _pool.moveTouch( _vectorUtility, _seconds );

            if (( _touch.getState() === TouchState.JUST_DOWN )
            ||  ( _touch.getState() === TouchState.BEEN_DOWN ))
            {
                //-----------------------------
                // dragging a swimbot around
                //-----------------------------
                if (( _swimbotBeingDragged )
                &&  ( _selectedSwimbot != NULL_INDEX ))
                {
                    _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );
                    _swimbots[ _selectedSwimbot ].setPosition( _vectorUtility );

                    _vectorUtility.setXY( ZERO, ZERO );
                    _swimbots[ _selectedSwimbot ].setVelocity( _vectorUtility );
                }
                else if (( _foodBitBeingDragged )
                     &&  ( _selectedFoodBit != NULL_INDEX ))
                {
                    //-----------------------------
                    // dragging a fodbit around
                    //-----------------------------
                    _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );
                    _foodBits[ _selectedFoodBit ].setPosition( _vectorUtility );
                }
                else
                {
                    if ( _obstacle.getBeingMoved() )
                    {
                        //--------------------------------------
                        // set the new moved position
                        //--------------------------------------
                        _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );
                        _obstacle.setMovePosition( _vectorUtility );

                        //--------------------------------------
                        // keep food away from obstacle
                        //--------------------------------------
                        moveFoodBitsFromObstacle();
                    }
                    else
                    {
                        let x = _touch.getVelocityX();
                        let y = _touch.getVelocityY();
                        _camera.drag( x, y );
                    }
                }
            }
            else
            {
                //throttle
                //if ( _clock % 4 == 0 )

                _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );

                //------------------------------------------------------------------------
                // check to see if the mouse if hovering over a swimbot or food bit
                //------------------------------------------------------------------------
                _mousedOverSwimbot = this.indexOfClosestSwimbotToScreenPosition( x, y );
                _mousedOverFoodBit = this.indexOfClosestFoodBitToScreenPosition( x, y );

                //------------------------------------------------------------
                // check to see if the mouse if hovering over the obstacle
                //------------------------------------------------------------
                _obstacle.detectHover( _vectorUtility )
            }
        }
	}


	//-------------------------------
	this.touchUp = function( x, y )
	{
    	_touch.setToUp( x, y );

        _swimbotBeingDragged = false;
		_foodBitBeingDragged = false;

        //-----------------------------------------------------
        // if no button or swimbot or food bit was un-clicked
        //-----------------------------------------------------
		if (( _selectedSwimbot === NULL_INDEX )
        &&  ( _selectedFoodBit === NULL_INDEX ))
        {
            if ( _obstacle.getBeingMoved() )
            {
                _obstacle.stopMoving();
            }

            _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );
    		_pool.endTouch( _vectorUtility, _seconds );
	    }
    }


	//-------------------------------
	this.touchOut = function( x, y )
	{
        this.touchUp( x, y );
    }

	//------------------------------------
	this.touchTwoFingerMove = function(e)
	{
        if (( e.x < _canvasWidth  )
        &&  ( e.y < _canvasHeight ))
    	{
            _camera.drag( -e.deltaX, -e.deltaY );
            this.clearViewMode();
        }
    }

	//------------------------------------------------
	// start camera Navigation
	//------------------------------------------------
    this.startCameraNavigation = function( action )
    {
        _viewTracking.stopTracking();

             if ( action === CameraNavigationAction.LEFT  ) { _panningLeft  = true; }
        else if ( action === CameraNavigationAction.RIGHT ) { _panningRight = true; }
        else if ( action === CameraNavigationAction.DOWN  ) { _panningDown  = true; }
        else if ( action === CameraNavigationAction.UP    ) { _panningUp    = true; }
        else if ( action === CameraNavigationAction.IN    ) { _zoomingIn    = true; }
        else if ( action === CameraNavigationAction.OUT   ) { _zoomingOut   = true; }
	}

	//-----------------------------------------------
	// stop camera Navigation
	//-----------------------------------------------
    this.stopCameraNavigation = function( action )
    {
             if ( action === CameraNavigationAction.LEFT  ) { _panningLeft  = false; }
        else if ( action === CameraNavigationAction.RIGHT ) { _panningRight = false; }
        else if ( action === CameraNavigationAction.DOWN  ) { _panningDown  = false; }
        else if ( action === CameraNavigationAction.UP    ) { _panningUp    = false; }
        else if ( action === CameraNavigationAction.IN    ) { _zoomingIn    = false; }
        else if ( action === CameraNavigationAction.OUT   ) { _zoomingOut   = false; }
	}

    this.stopAllCameraNavigation = function()
    {
        _panningLeft    = false;
        _panningRight   = false;
        _panningUp      = false;
        _panningDown    = false;
        _zoomingIn      = false;
        _zoomingOut     = false;
	}

	//-------------------------------
	this.clearViewMode = function()
	{
        this.setViewMode( ViewTrackingMode.NULL );
	}

	//--------------------------------------
	this.setViewMode = function( viewMode )
	{
        //console.log( "setViewMode to " + viewMode );
        //console.log( "_selectedSwimbot = " + _selectedSwimbot );

	    //-----------------------------------------------------------------------------------------
	    // if the new mode is "selected" but there is no swimbot selected, then bail out...
	    //-----------------------------------------------------------------------------------------
	    if (( viewMode === ViewTrackingMode.SELECTED )
	    &&  ( _selectedSwimbot === NULL_INDEX ))
	    {
	        return;
        }

        let selectedSwimbot = _viewTracking.setMode( viewMode, _camera.getPosition(), _camera.getScale(), _selectedSwimbot );
        setSelectedSwimbot( selectedSwimbot );
	}

	//--------------------------------------------------
	this.handleNonUITouchDownActions = function( x, y )
	{
        if (( x < _canvasWidth  )
        &&  ( y < _canvasHeight ))
        {
            //-----------------------------------------------
            // in case view control is tracking, stop it...
            //-----------------------------------------------
            _viewTracking.stopTracking();

            //------------------------------------------
            // has a swimmer been clicked?
            //------------------------------------------
            setSelectedSwimbot( this.indexOfClosestSwimbotToScreenPosition( x, y ) );

            //------------------------------------------
            // a swimmer is clicked
            //------------------------------------------
            if ( _selectedSwimbot != NULL_INDEX )
            {
                _swimbotBeingDragged = true;
                this.initializeDebugTrail( _selectedSwimbot );
            }

            //--------------------------------------
            // find out if a foodbit was clicked
            //--------------------------------------
            if ( _selectedSwimbot === NULL_INDEX )
            {
                _selectedFoodBit = this.indexOfClosestFoodBitToScreenPosition( x, y );
                //console.log( _selectedFoodBit );

                if ( _selectedFoodBit != NULL_INDEX )
                {
                    _foodBitBeingDragged = true;

                    // the food jumps into the "hand" at once, fully visible
                    _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );
                    _foodBits[ _selectedFoodBit ].setPosition( _vectorUtility );
                    _foodBits[ _selectedFoodBit ].showFully();
                }
            }
            else
            {
                _mousedOverFoodBit = NULL_INDEX;
            }

            //----------------------------------------
            // if no swimbot or food bit was clicked
            //----------------------------------------
            if (( _selectedSwimbot == NULL_INDEX )
            &&  ( _selectedFoodBit == NULL_INDEX ))
            {
                _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );

                //--------------------------------------
                // did the obstacle get touched?
                //--------------------------------------
                if ( _obstacle.detectHover( _vectorUtility ) )
                {
                    _obstacle.startMoving( _vectorUtility );
                }
                else
                {
                    //--------------------------------------
                    // touch the pool!
                    //--------------------------------------
                    _pool.startTouch( _vectorUtility, _seconds );
                }
            }
        }
    }



	//----------------------------------------------
	this.indexOfClosestSwimbotToScreenPosition = function( x, y )
	{
        let indexOfClosest = NULL_INDEX;
        let closestDistance = 1000.0;

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            if ( _swimbots[s].getAlive() )
            {
                _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );

                let distanceSquared = _swimbots[s].getPosition().getDistanceSquaredTo( _vectorUtility );
                if ( distanceSquared < _swimbots[s].getSelectRadius() * _swimbots[s].getSelectRadius() )
                {
                    if ( distanceSquared < closestDistance )
                    {
                        indexOfClosest = s;
                        closestDistance = distanceSquared;
                    }
                }
             }
        }

        return indexOfClosest;
    }




	//------------------------------------------------------------
	this.indexOfClosestFoodBitToScreenPosition = function( x, y )
	{
        let indexOfClosest = NULL_INDEX;
        let closestDistance = 1000.0;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            if ( _foodBits[f].getAlive() )
            {
                _vectorUtility = this.convertScreenCoordinatesToPoolPosition( x, y );

                let distanceSquared = _foodBits[f].getPosition().getDistanceSquaredTo( _vectorUtility );
                if ( distanceSquared < FOOD_BIT_GRAB_RADIUS * FOOD_BIT_GRAB_RADIUS )
                {
                    if ( distanceSquared < closestDistance )
                    {
                        indexOfClosest = f;
                        closestDistance = distanceSquared;
                    }
                }
             }
        }

        return indexOfClosest;
    }



	//------------------------------------------------------------------------------------
	// get functions....
	//------------------------------------------------------------------------------------


	//----------------------------------------------------------------------------
	// various quickie getters...
	//----------------------------------------------------------------------------
	this.getFoodGrowthDelay     = function() { return globalTweakers.foodRegenerationPeriod; }
	this.getFoodSpread          = function() { return globalTweakers.foodSpread;        }
    this.getFoodBitEnergy       = function() { return globalTweakers.foodBitEnergy;     }
    this.getHungerThreshold     = function() { return globalTweakers.hungerThreshold;   }
    this.getEnergyToOffspring   = function() { return globalTweakers.childEnergyRatio;  }
    this.getMaximumSwimbotAge   = function() { return globalTweakers.maximumLifeSpan;   }
    this.getPopulationLimitEnabled = function() { return globalTweakers.populationLimitEnabled; }
    this.getMaximumSwimbotParts = function() { return globalTweakers.maximumParts; }
    this.getTimeStep            = function() { return _clock;                   }
	this.getRenderingGoals      = function() { return _renderingGoals;          }
	this.getSimulationRunning   = function() { return _simulationRunning;       }
	this.getRendering           = function() { return _rendering;               }
	this.getSelectedSwimbotID   = function() { return _selectedSwimbot;         }
	this.getViewMode            = function() { return _viewTracking.getMode();  }
    this.getNumDeadSwimbots     = function() { return simCounters.numDeadSwimbots;         }

	//--------------------------------------------------
	// check to see if the camera navigation is active
	//--------------------------------------------------
    this.getCameraNavigationActive = function( action )
	{
	    let result = false;

	    if ( ( action === CameraNavigationAction.LEFT  ) && ( _panningLeft  ) ) { result = true; }
	    if ( ( action === CameraNavigationAction.RIGHT ) && ( _panningRight ) ) { result = true; }
	    if ( ( action === CameraNavigationAction.DOWN  ) && ( _panningDown  ) ) { result = true; }
	    if ( ( action === CameraNavigationAction.UP    ) && ( _panningUp    ) ) { result = true; }
	    if ( ( action === CameraNavigationAction.IN    ) && ( _zoomingIn    ) ) { result = true; }
	    if ( ( action === CameraNavigationAction.OUT   ) && ( _zoomingOut   ) ) { result = true; }

        return result;
	}

	//----------------------------------------
	this.getASwimbotIsSelected = function()
	{
        if ( _selectedSwimbot != NULL_INDEX )
        {
            return true;
        }

	    return false;
    }

	//-----------------------------------
    this.getPresetGenotype = function(p)
    {
        _myGenotype.setToPreset(p);

        return _myGenotype.getGenes();
    }

	//------------------------------
	//--------------------------------------------------------------
	// number of living food bits of one type (0, 1 = plants, 2 = meat)
	//--------------------------------------------------------------
	this.getNumFoodBitsOfType = function( type )
	{
	    return Telemetry.countFoodBitsOfType( _st, type );
	}

	this.getNumFoodBits = function()
	{
	    return Telemetry.countFoodBits( _foodBits, globalTweakers.numFoodTypes );
	}

    /*
	//------------------------------
	this.getNumFoodBits0 = function()
	{
        let num = 0;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            if ( _foodBits[f].getAlive() )
            {
                if ( _foodBits[f].getType() === 0 )
                {
                    num ++;
                }
            }
        }

	    return num;
	}
    */

	//------------------------------
	this.getNumFoodBits1 = function()
	{
	    return Telemetry.countFoodBitsOfType( _st, 1 );
	}

	//------------------------------
	this.getNumSwimbots = function()
	{
	    return Telemetry.countSwimbots( _st, _maxSwimbotSlot );
	}


	//----------------------------
	//------------------------------------------------------------------------
	// Saving and loading the whole world, to continue exactly where it was
	// (docs/схема_сохранения_мира.md). saveWorld() returns the bytes of a
	// .gpworld file (not compressed); loadWorld( bytes ) puts them back.
	//------------------------------------------------------------------------
	// the serializer (GenePoolSerializer.ts) works through this view of the pool's variables
	const _serializerContext: any =
	{
	    get st()                         { return _st; },
	    get swimbots()                   { return _swimbots; },
	    get foodBits()                   { return _foodBits; },
	    get swimbotWasAlive()            { return _swimbotWasAlive; },
	    get clock()                      { return _clock; },               set clock( v )              { _clock = v; },
	    get seedDebt()                   { return _seedDebt; },            set seedDebt( v )           { _seedDebt = v; },
	    get nurseryDebt()                { return _nurseryDebt; },         set nurseryDebt( v )        { _nurseryDebt = v; },
	    get classicSeedDebt()            { return _classicSeedDebt; },     set classicSeedDebt( v )    { _classicSeedDebt = v; },
	    get serial()                     { return _serial; },              set serial( v )             { _serial = v; },
	    get gardenOfEdenRadius()         { return _gardenOfEdenRadius; },  set gardenOfEdenRadius( v ) { _gardenOfEdenRadius = v; },
	    get currentSpeed()               { return _currentSpeed; },        set currentSpeed( v )       { _currentSpeed = v; },
	    get numSick()                    { return _numSick; },             set numSick( v )            { _numSick = v; },
	    get matingCount()                { return _matingCount; },         set matingCount( v )        { _matingCount = v; },
	    get simulationRunning()          { return _simulationRunning; },   set simulationRunning( v )  { _simulationRunning = v; },
	    get startMode()                  { return _this.startMode; },      set startMode( v )          { _this.startMode = v; },
	    get meatZoneDebt()               { return _meatZoneDebt; },        set meatZoneDebt( v )       { _meatZoneDebt = v; },
	    get matingRecord()               { return _matingRecord; },
	    get matingBrightnessDifference() { return _matingBrightnessDifference; },
	    get matingChoosinessMean()       { return _matingChoosinessMean; },
	    get history()                    { return _history; },
	    get gardens()                    { return _gardens; },             set gardens( v )            { _gardens = v; },
	    get roots()                      { return _roots; },
	    get obstacle()                   { return _obstacle; },
	    get camera()                     { return _camera; },
	    get familyTree()                 { return _familyTree; },
	    get map()                        { return _map; },                 set map( v )                { _map = v; },
	    get embryology()                 { return _embryology; },
	    get pool()                       { return _pool; },
	    setFoodGrowthDelay:      ( v: number ) => _this.setFoodGrowthDelay( v ),
	    setFoodSpread:           ( v: number ) => _this.setFoodSpread( v ),
	    setFoodBitEnergy:        ( v: number ) => _this.setFoodBitEnergy( v ),
	    setHungerThreshold:      ( v: number ) => _this.setHungerThreshold( v ),
	    setAttraction:           ( v: number ) => _this.setAttraction( v ),
	    setOffspringEnergyRatio: ( v: number ) => _this.setOffspringEnergyRatio( v ),
	    setMaximumSwimbotAge:    ( v: number ) => _this.setMaximumSwimbotAge( v ),
	    writePerceptionParams:   () => _this.writePerceptionParams(),
	    prepareMapZones:         () => prepareMapZones(),
	    rebuildAliveIndexCaches: () => rebuildAliveIndexCaches(),
	    setSelectedSwimbot:      ( i: number ) => setSelectedSwimbot( i ),
	    resetFrameClock:         () => { _stepDebt = 0; _lastFrameTime = 0; },
	    setEnvironmentImage:     ( image: any ) => { _environmentImage = image; },
	    resetViewTracking:       () => _viewTracking.reset(),
	    refreshCounts:           () => { _numSwimbots = _aliveSwimbotIndices.length; _numFoodBits = _aliveFoodBitIndices.length; },
	};

	this.saveWorld   = function( withFamilyTree = true ) { return Serializer.saveWorld( _serializerContext, withFamilyTree ); }

	// the hashes of the parts of the world (to compare two worlds, and to check a load)
	this.worldHashes = function() { return Serializer.worldHashes( _serializerContext ); }

	this.loadWorld   = function( bytes ) { return Serializer.loadWorld( _serializerContext, bytes ); }

	this.getPoolData = function()
	{
	    //-----------------------------
	    // create foodbit array
	    //-----------------------------
        function FoodBitData()
        {
            this.id     = NULL_INDEX;
            this.x      = ZERO;
            this.y      = ZERO;
            this.type   = 0;    // 0, 1 = plants, 2 = meat
        }

	    let foodBitDataArray = new Array();

        let numFoodbits = 0;
        for (let f=0; f<MAX_FOODBITS; f++)
        {
            if ( _foodBits[f].getAlive() )
            {
                foodBitDataArray[ numFoodbits ] = new FoodBitData();
                foodBitDataArray[ numFoodbits ].id = f;
                foodBitDataArray[ numFoodbits ].x = _foodBits[f].getPosition().x;
                foodBitDataArray[ numFoodbits ].y = _foodBits[f].getPosition().y;
                foodBitDataArray[ numFoodbits ].type = _foodBits[f].getType();
                foodBitDataArray[ numFoodbits ].age    = _foodBits[f].getAge();
                foodBitDataArray[ numFoodbits ].growth = _st.plantGrowth[f];
                foodBitDataArray[ numFoodbits ].spread = _st.plantSpread[f];
                foodBitDataArray[ numFoodbits ].energy = _st.foodEnergy[f];
                foodBitDataArray[ numFoodbits ].wood = _st.foodWood[f];
                foodBitDataArray[ numFoodbits ].fruit = _st.foodFruit[f];
                foodBitDataArray[ numFoodbits ].nextFruitAt = _st.foodFruitAt[f];

                numFoodbits ++;
            }
        }

	    //-------------------------
	    // create swimbot array
	    //-------------------------
        function SwimbotData()
        {
            this.x      = ZERO;
            this.y      = ZERO;
            this.angle  = ZERO;
            this.energy = ZERO;
            this.age    = 0;
            this.id     = 0;
            this.genes  = new Array();
        }

	    let swimbotDataArray = new Array();

        let numSwimbots = 0;
        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            if ( _swimbots[s].getAlive() )
            {
                swimbotDataArray[ numSwimbots ] = new SwimbotData();
                swimbotDataArray[ numSwimbots ].id      = s;
                swimbotDataArray[ numSwimbots ].x       = _swimbots[s].getPosition().x;
                swimbotDataArray[ numSwimbots ].y       = _swimbots[s].getPosition().y;
                swimbotDataArray[ numSwimbots ].angle   = _swimbots[s].getAngle();
                swimbotDataArray[ numSwimbots ].age     = _swimbots[s].getAge();
                swimbotDataArray[ numSwimbots ].energy  = _swimbots[s].getEnergy();
                swimbotDataArray[ numSwimbots ].genes   = this.getSwimbotGenes(s);
                swimbotDataArray[ numSwimbots ].brain   = Array.from( _swimbots[s].getGenotype().getBrain() );
                const privateState = new Float64Array( _swimbots[s].PRIVATE_STATE_SIZE );
                _swimbots[s].getPrivateState( privateState, 0 );
                swimbotDataArray[ numSwimbots ].privateState = Array.from( privateState );



//_myGenotype.randomize();
//swimbotDataArray[ numSwimbots ].genes = _myGenotype;

/*
for (let g=0; g<NUM_GENES; g++)
{
    swimbotDataArray[ numSwimbots ].genes[g] = Math.floor( gpRandom() * 256.0 );
}
*/
//data.swimbotArray[s].genes = _myGenotype;

//console.log( swimbotDataArray[ numSwimbots ].genes );

//_myGenotype.randomize();
//_myGenotype.copyFromGenotype( data.swimbotArray[s].genes );


//swimbotDataArray[ numSwimbots ].genes = _swimbots[s].getGenotype();


//console.log( swimbotDataArray[ numSwimbots ].genes );

//_myGenotype.randomize();

//data.swimbotArray[s].genes = _myGenotype;

//console.log( data.swimbotArray[s].genes );

//swimbotDataArray[ numSwimbots ].genes = _myGenotype;

//_myGenotype.randomize();
//data.swimbotArray[ numSwimbots ].genes = _myGenotype;

//_myGenotype.randomize();  //this.getSwimbotGenes(s);
//swimbotDataArray[ numSwimbots ].genes   = _myGenotype;



                numSwimbots ++;
            }
        }

        let poolData =
        {
            "simulationRunning"         : _simulationRunning,
            "numFoodBits"               : numFoodbits,
            "numSwimbots"               : numSwimbots,
            "foodBitArray"              : foodBitDataArray,
            "swimbotArray"              : swimbotDataArray,
            "cameraX"                   : _camera.getPosition().x,
            "cameraY"                   : _camera.getPosition().y,
            "cameraScale"               : _camera.getScale(),
            "foodRegenerationPeriod"    : globalTweakers.foodRegenerationPeriod,
            "foodSpread"                : globalTweakers.foodSpread,
            "foodBitEnergy"             : globalTweakers.foodBitEnergy,
            "hungerThreshold"           : globalTweakers.hungerThreshold,
            "attractionCriterion"       : globalTweakers.attractionCriterion,
            "childEnergyRatio"          : globalTweakers.childEnergyRatio,
            "populationLimitEnabled"    : globalTweakers.populationLimitEnabled,
            "maximumSwimbotParts"       : globalTweakers.maximumParts,
            "renderingGoals"            : _renderingGoals,
            "obstacleEnd1X"             : _obstacle.getEnd1Position().x,
            "obstacleEnd1Y"             : _obstacle.getEnd1Position().y,
            "obstacleEnd2X"             : _obstacle.getEnd2Position().x,
            "obstacleEnd2Y"             : _obstacle.getEnd2Position().y,
            "obstacleSegments"          : _obstacle.getSegments(),
            "geneLayout"                : GENE_LAYOUT_VERSION,
            "environment"               : environment.getState(),
            "clock"                     : _clock
        }

        return poolData;
    }


	//------------------------------------
	this.getSwimbotGenes = function( ID )
	{
        let genotype = _swimbots[ ID ].getGenotype();
        return genotype.getGenes();
    }

	this.getSwimbotEvolutionTraits = function( ID )
	{
	    const swimbot = _swimbots[ ID ];
	    const position = swimbot.getPosition();
	    return Object.assign(
	        { birthTemperature: environment.active ? environment.temperatureAt( position.x, position.y ) : 0.5 },
	        swimbot.getEvolutionTraits()
	    );
	}

	//----------------------------------
	this.getFamilyTree = function()
	{
	    return _familyTree;
    }


	//------------------------------
	this.getAttraction = function()
	{
        return globalTweakers.attractionCriterion;
    }



	//------------------------------
	this.getGeneName = function(g)
	{
        //let genotype = _swimbots[0].getGenotype();
        //return genotype.getGeneName(g);

        return _embryology.getGeneName(g);
    }


	//--------------------------------------------------
	this.getGeneValue = function( swimbotID, geneIndex )
	{
	    let genotype = _swimbots[ swimbotID ].getGenotype();

        return genotype.getGeneValue( geneIndex );
    }

	//----------------------------------
	this.getNumGenesPerCategory = function()
	{
        return _embryology.getNumGenesPerCategory();
    }

	//----------------------------------
	this.getNumGeneCategories = function()
	{
        return _embryology.getNumGeneCategories();
    }





	//-----------------------------------------------------------------------------------------------------------------------------
	// swimbot getters...
	//-----------------------------------------------------------------------------------------------------------------------------
	this.getSwimbotIndex                    = function( ID ) {	return _swimbots[ ID ].getIndex                     (); }
    this.getSwimbotBrainState               = function( ID ) {	return _swimbots[ ID ].getBrainState                (); }
    this.getSwimbotChosenMate               = function( ID ) {	return _swimbots[ ID ].getChosenMateIndex           (); }
    this.getSwimbotAge                      = function( ID ) {	return _swimbots[ ID ].getAge                       (); }
    this.getSwimbotEnergy                   = function( ID ) {	return _swimbots[ ID ].getEnergy                    (); }
    this.getSwimbotNumFoodBitsEaten         = function( ID ) {	return _swimbots[ ID ].getNumFoodBitsEaten          (); }
    this.getSwimbotNumOffspring             = function( ID ) {	return _swimbots[ ID ].getNumOffspring              (); }
    this.getSwimbotAttractionDescription    = function( ID ) {	return _swimbots[ ID ].getAttractionDescription     (); }
    this.getSwimbotPreferredFoodType        = function( ID ) {	return _swimbots[ ID ].getPreferredFoodType         (); }
    this.getSwimbotDigestibleFoodType       = function( ID ) {	return _swimbots[ ID ].getDigestibleFoodType        (); }
    this.getSwimbotEternalStatus            = function( ID ) {	return _swimbots[ ID ].isEternal                     (); }

    // this is now being initialized from the index.html...
	//--------------------------------
	// start this puppy
	//--------------------------------
    //this.initialize();
    this.mutateAll = function(probability) {
    probability = probability || 1.0;
    for (let s = 0; s < MAX_SWIMBOTS; s++) {
        if (_swimbots[s].getAlive() && gpRandom() < probability) {
            _swimbots[s].zap(_embryology, 0.2);
        }
    }
};

this.mutateHalf = function() {
    this.mutateAll(0.5);
};

this.randomizeAll = function() {
    for (let s = 0; s < MAX_SWIMBOTS; s++) {
        if (_swimbots[s].getAlive()) {
            this.randomizeSwimbot(s);
        }
    }
};
this.randomizeHalf = function() {
    for (let s = 0; s < MAX_SWIMBOTS; s++) {
        if (_swimbots[s].getAlive() && gpRandom() < 0.5) {
            this.randomizeSwimbot(s);
        }
    }
};

this.getSwimbots = function() {
    return _swimbots;
};

this.testPredation = function()
{
    const self = this;

    // --- configuration ---
    const HERB_COUNT = 50;
    const PRED_COUNT = 5;
    const TOTAL_TICKS = 10000;
    const LOG_PERIOD = 1000;

    // --- reset ecosystem ---
    _fastMode = true;
    _millisecondsPerUpdate = 20;

    globalTweakers.numFoodTypes = 1;
    this.randomizeFood();

    // reset swimbots
    _numSwimbots = 0;
    for (let s = 0; s < MAX_SWIMBOTS; s++) {
        _swimbots[s].die();
    }

    // kill all food bits
    _numFoodBits = INITIAL_NUM_FOODBITS;
    for (let f = 0; f < MAX_FOODBITS; f++) {
        _foodBits[f].kill();
    }

    // ensure thresholds
    this.setHungerThreshold(DEFAULT_SWIMBOT_HUNGER_THRESHOLD);
    this.setAttraction(ATTRACTION_SIMILAR_COLOR);

    // --- pool center ---
    _poolCenter.copyFrom(_pool.getCenter());
    _gardenOfEdenRadius = DEFAULT_GARDEN_OF_EDEN_RADIUS;

    // reset family tree and clock
    _familyTree.reset();
    _clock = 0;
    simClock.step = 0;
    resetSimulationCounters();
    resetHistory();

    // --- helper to create swimbot with predator gene ---
    const setPredatorGene = function(genotype, value255) {
        setTrait(genotype, GENES_PREDATOR, Math.floor(value255) / 255);
    };

    const createSwimbotWithPredatorGene = function(index, predatorGeneValue255, posOffsetX) {
        _myGenotype.randomize();

        // clear junk dna
        for (let g = NUM_GENES_USED; g < NUM_GENES; g++) {
            if ( !isExperimentalEmbryologyGene( g )) { _myGenotype.setGeneValue(g, 0); }
        }
        _myGenotype.setGeneValue( GENES_ASYMMETRY[0], Math.floor( gpRandom() * BYTE_SIZE ));

        setPredatorGene(_myGenotype, predatorGeneValue255);

        let initialPosition = new Vector2D();
        initialPosition.setToRandomLocationInDisk(_poolCenter, _gardenOfEdenRadius);
        if (posOffsetX) {
            initialPosition.x += posOffsetX;
        }

        _swimbots[index].create(
            index,
            YOUNG_AGE_DURATION,
            initialPosition,
            getRandomAngleInDegrees(),
            DEFAULT_SWIMBOT_HUNGER_THRESHOLD,
            _myGenotype,
            _embryology
        );

        _familyTree.addNode(index, NULL_INDEX, NULL_INDEX, _clock, self.getSwimbotGenes(index));
        _numSwimbots++;
    };

    let nextIndex = 0;

    // herbivores: predatorLevel ~ 0..0.2 => gene51 roughly 0..55
    for (let i = 0; i < HERB_COUNT; i++) {
        createSwimbotWithPredatorGene(nextIndex, Math.random() * 55, -200);
        nextIndex++;
    }

    // predators: predatorLevel ~ 0.8..1 => gene51 roughly 200..255
    for (let i = 0; i < PRED_COUNT; i++) {
        createSwimbotWithPredatorGene(nextIndex, 200 + Math.random() * 55, 200);
        nextIndex++;
    }

    // --- run simulation ---
    _simulationRunning = false;

    const computeCountsAndAvgEnergy = function() {
        let aliveHerb = 0;
        let alivePred = 0;
        let sumEnergy = 0;
        let aliveTotal = 0;

        for (let s = 0; s < MAX_SWIMBOTS; s++) {
            if (_swimbots[s].getAlive()) {
                aliveTotal++;
                sumEnergy += _swimbots[s].getEnergy();

                let predatorLevel = _swimbots[s].getPredatorLevel();


                if (predatorLevel > 0.6) alivePred++;
                else aliveHerb++;
            }
        }

        let avgEnergy = aliveTotal > 0 ? (sumEnergy / aliveTotal) : 0;
        return { aliveHerb, alivePred, aliveTotal, avgEnergy };
    };

    for (let t = 1; t <= TOTAL_TICKS; t++) {
        _clock++;

        this.updateSwimbots();
        this.updateFood();

        if (t % LOG_PERIOD === 0) {
            const stats = computeCountsAndAvgEnergy();
            console.log(
                `[testPredation] tick=${t} predators=${stats.alivePred} herbivores=${stats.aliveHerb} avgEnergy=${stats.avgEnergy.toFixed(4)} attacks=${simCounters.attackCount}`
            );
        }
    }

    const finalStats = computeCountsAndAvgEnergy();
    const predatorsSurvived = finalStats.alivePred > 0;
    const herbivoresSurvived = finalStats.aliveHerb > 0;

    console.log(
        `[testPredation] FINAL predatorsAlive=${finalStats.alivePred} herbivoresAlive=${finalStats.aliveHerb} attacksTotal=${simCounters.attackCount}`
    );
    console.log(
        `[testPredation] survivalOK=${(predatorsSurvived && herbivoresSurvived) ? "YES" : "NO"}`
    );

    _simulationRunning = true;

    return {
        predatorsSurvived,
        herbivoresSurvived,
        predatorsAlive: finalStats.alivePred,
        herbivoresAlive: finalStats.aliveHerb,
        attacksTotal: simCounters.attackCount
    };
};




// } // ← конец GenePool()
}



