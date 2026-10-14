import { geneAverage, convertOldGenes, GENE_LAYOUT_VERSION, setTrait, gaussian, thermalWidthToGene, GENES_PREDATOR, GENES_THERMAL_OPTIMUM, GENES_THERMAL_WIDTH, GENES_DIGESTION, GENES_BRIGHTNESS, GENES_CHOOSINESS, GENES_HUNGER, GENES_AUTOTOMY_BITE, GENES_AUTOTOMY_THREAT, GENES_AUTOTOMY_AMOUNT, GENES_AUTOTOMY_WHICH } from "./EcologyGenes";
import { environment, PLANT_TYPE_WARM, PLANT_TYPE_COLD } from "./Environment";
import { petriStartZone } from "./Petri";
import { IGNORE_FOOD_EFFICIENCY, preyVisibility, TWO_PLANT_TYPES } from "./Ecology";
import { INTERLEAVED_STEP, PERCEPTION_CHECK, DIET_SWITCH_RATE, CLASSIC_NUM_SWIMBOTS, CLASSIC_NUM_FOODBITS, GARDEN_RADIUS, ENVIRONMENT_SEEDS_PER_PERIOD, PLANT_CELL_CAPACITY, PLANT_PARENT_SEED_FRACTION, PLANT_SEED_MIN_DISTANCE, PLANT_SEED_MAX_DISTANCE } from "./Parameters";

import { BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_PREY } from "./Brain";
import { Camera } from "./Camera";
import { BRIGHTNESS_FROM_GENES, Embryology } from "./Embryology";
import { FamilyTree } from "./FamilyTree";
import { DEFAULT_FOOD_BIT_ENERGY, DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS, FOOD_BIT_BOUNDARY_MARGIN, FOOD_BIT_GRAB_RADIUS, FoodBit, MAX_FOOD_BIT_ENERGY, MAX_FOOD_BIT_MAX_SPAWN_RADIUS, MIN_FOOD_BIT_ENERGY, MIN_FOOD_BIT_MAX_SPAWN_RADIUS } from "./FoodBit";
import { Genotype, NUM_GENES, PRESET_GENOTYPE_DARWIN, PRESET_GENOTYPE_DENNETT, PRESET_GENOTYPE_MENDEL, PRESET_GENOTYPE_TURING, PRESET_GENOTYPE_WILSON } from "./Genotype";
import { CameraNavigationAction, NUM_GENES_USED, SimulationStartMode, globalTweakers, gpRandom, resetSimulationCounters, simCounters } from "./Globals";
import { BYTE_SIZE, MILLISECONDS_PER_SECOND, NULL_INDEX, ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { Obstacle } from "./Obstacle";
import { BARRIER_EXPERIMENT, DEFAULT_CHILD_ENERGY_RATIO, DEFAULT_FOOD_REGENERATION_PERIOD, DEFAULT_GARDEN_OF_EDEN_RADIUS, DEFAULT_MAXIMUM_AGE, DEFAULT_SWIMBOT_HUNGER_THRESHOLD, FOOD_LOCAL_CAPACITY, FOOD_LOCAL_RADIUS, FOOD_RANDOM_SEED_CHANCE, FOOD_SPROUT_RATE, INITIAL_NUM_FOODBITS, INITIAL_NUM_SWIMBOTS, INITIAL_PREDATOR_FRACTION, LOCAL_PLANT_GROWTH, LOCAL_PLANT_SEED_RADIUS, MAX_CHILD_ENERGY_RATIO, MAX_FOODBITS, MAX_FOODBITS_PER_TYPE, MAX_FOOD_REGENERATION_PERIOD, MAX_MAXIMUM_AGE, MAX_SWIMBOTS, MAX_SWIMBOT_HUNGER_THRESHOLD, MEAT_DECAY_TIME, MIN_CHILD_ENERGY_RATIO, MIN_FOOD_REGENERATION_PERIOD, MIN_MAXIMUM_AGE, MIN_SWIMBOT_HUNGER_THRESHOLD, NON_REPRODUCING_JUNK_DNA_LIMIT, OBSTACLE_ENABLED, PREDATOR_LEVEL_THRESHOLD, PREY_MAX_MASS_RATIO, RANDOM_MATING_CONTROL, RENDER_SWIMBOT_AS_DOT, SWIMBOT_LEVEL_OF_DETAIL_DOT, SWIMBOT_LEVEL_OF_DETAIL_HIGH, SWIMBOT_LEVEL_OF_DETAIL_LOW, YOUNG_AGE_DURATION } from "./Parameters";
import { PhyloTree } from "./PhyloTree";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH, Pool } from "./Pool";
import { UniformGrid } from "./UniformGrid";
import * as SS from "./SharedState";
import { perceive, PerceptionScratch } from "./PerceptionKernel";
import { physicsStep } from "./PhysicsKernel";
import { FLAT_ENVIRONMENT } from "./Environment";
import { Swimbot } from "./Swimbot";
import { ATTRACTION_RANDOM, ATTRACTION_SIMILAR_COLOR, NUM_ATTRACTIONS, STARVING, SWIMBOT_VIEW_RADIUS } from "./SwimbotTypes";
import { Touch, TouchState } from "./Touch";
import { assert, getRandomAngleInDegrees } from "./Utility";
import { Vector2D } from "./Vector2D";
import { ViewTracking, ViewTrackingMode } from "./ViewTracking";

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
    let _speedLevel                 = 1;
    let _useAnimationFrames         = false;
    let _lastFrameTime              = 0;
    let _stepDebt                   = 0;    // simulation steps owed at normal speed
    let _stepsThisSecond            = 0;
    let _stepsPerSecond             = 0;    // measured, for display
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

//const LEVEL_OF_DETAIL_THRESHOLD         = 1000.0;
    const LEVEL_OF_DETAIL_THRESHOLD         = 1200.0;

    const INITIAL_VIEW_SCALE                = POOL_WIDTH * 0.1;
    const RACE_VIEW_SCALE                   = POOL_WIDTH * 0.3;
    const BANG_VIEW_SCALE                   = POOL_WIDTH * 0.2;
    const PARENT_VIEW_SCALE                 = POOL_WIDTH * 0.05;
    const NEIGHBORHOOD_VIEW_SCALE           = POOL_WIDTH * 0.4;
    const NEIGHBORHOOD_FREQ                 = 5.0;
    const DEBUG_SHOW_SWIMBOT_TRAIL          = false;
    //const SWIMBOT_DATA_UPDATE_PERIOD        = 30;
    const CAMERA_TRACKING_UPDATE_PERIOD     = 10;
    const CLONE_SEPARATION                  = 10.0;
    const FOOD_RACE_SIZE                    = 1000;
    const FOOD_BANG_SIZE                    = 1700;

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
    let _matingCount         = 0;
    let _gardens             = [];      // environment: one starting garden per biome type
    let _seedDebt            = 0;       // fractional seeds carried to the next step
    let _environmentImage    = null;    // picture of the temperature map (drawn behind the pool)
    const STARVING_FOOD_CHOICE = 15;   // below this energy a swimbot eats anything
	let _levelOfDetail	        = SWIMBOT_LEVEL_OF_DETAIL_LOW;
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
        physics( list, n )
        {
            for (let i = 0; i < n; i++) { const s = list[i]; if ( _st.alive[s] ) { physicsStep( s, _st ); } }
        },
        perception( list, n )
        {
            for (let i = 0; i < n; i++) { const s = list[i]; if ( _st.sensing[s] ) { perceive( s, _st, _perceptionScratch ); } }
        },
    };
    this.setParallelRunner = function( runner ) { _runner = runner; }
    this.getNumThreads     = function() { return _runner.getNumThreads(); }
    this.getParallelRunner = function() { return _runner; }
    let _perceptionMismatches = 0;          // PERCEPTION_CHECK: kernel and old code disagreed
    let _perceptionChecks     = 0;
    let _gridResult     = new Int32Array( MAX_SWIMBOTS * 2 );  // scratch for grid queries
    let _foodGridResult = new Int32Array( MAX_FOODBITS * 2 );
    let _nearbyIndices  = new Int32Array( MAX_SWIMBOTS );      // swimbots within search radius

    let _renderBatch = []; // Batch rendering array
    let _batchObjectPool = [];
    let _distanceCache = new Array(MAX_SWIMBOTS);
    let _lastSwimbotPositions = new Array(MAX_SWIMBOTS);
    let _aliveSwimbotIndices = [];
    let _aliveFoodBitIndices = [];
    let _swimbotWasAlive = new Array(MAX_SWIMBOTS);
    let _lastCameraPosition = new Vector2D();
    let _seedSource = new FoodBit(); // scratch: a stand-in parent position for seeding
    let _genitalPositionUtility = new Vector2D(); // scratch: another swimbot's genital position
    let _capsuleRenderer        = null;           // graphics-card renderer (browser only, may be absent)
    _lastCameraPosition.setXY(0, 0);

    let hhh = 0;

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

    function getBatchObject()
    {
        if (_batchObjectPool.length > 0)
        {
            return _batchObjectPool.pop();
        }
        return { swimbot: null, isSelected: false, isMousedOver: false, distance: 0 };
    }

    function releaseBatchObject(obj)
    {
        obj.swimbot = null;
        obj.isSelected = false;
        obj.isMousedOver = false;
        obj.distance = 0;
        _batchObjectPool.push(obj);
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
        const position = _swimbots[s].getPosition();
        const genital  = _swimbots[s].getGenitalPosition();
        _botX    [s] = position.x;
        _botY    [s] = position.y;
        _genitalX[s] = genital.x;
        _genitalY[s] = genital.y;
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

        for (let s = 0; s < MAX_SWIMBOTS; s++)
        {
            if (_swimbots[s].getAlive())
            {
                _aliveSwimbotIndices.push(s);
            }
        }

        for (let f = 0; f < MAX_FOODBITS; f++)
        {
            if (_foodBits[f].getAlive())
            {
                _aliveFoodBitIndices.push(f);
            }
        }
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
	this.startSimulation = function( mode )
	{
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
            environment.generate( petri );
            environment.copyBackgroundTo( _st.background );
            _gardens = petri ? [ _poolCenter ] : environment.gardenCenters();
            this.setGardenOfEdenRadius( GARDEN_RADIUS );
            _camera.setScale( POOL_WIDTH );   // show the whole world with all its gardens

            _numSwimbots = INITIAL_NUM_SWIMBOTS;
            _numFoodBits = INITIAL_NUM_FOODBITS;
            globalTweakers.numFoodTypes = TWO_PLANT_TYPES ? 2 : 1;
            this.setFoodToEnvironment();
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

        //----------------------------------
        // initialize swimbots
        //----------------------------------
        for (let i=0; i<_numSwimbots; i++)
        {
            let initialPosition = new Vector2D();

            initialPosition.setToRandomLocationInDisk( _poolCenter, _gardenOfEdenRadius );


if ( mode === SimulationStartMode.SPECIES )
{
    let s = POOL_WIDTH * 0.4;

    let x = gpRandom() * s;
    let y = POOL_HEIGHT * ONE_HALF - s * ONE_HALF + + gpRandom() * s;

    if ( gpRandom() < ONE_HALF )
    {
        x = POOL_WIDTH - x;
    }

    initialPosition.setXY( x, y )
}


            //-----------------------------------------
            // yo, initial age is distributed
            //-----------------------------------------
            let weightedRandomNormal = gpRandom();

            //I'm running various tests - to understand why there's a sharp die-off when maximumLifeSpan is 15000.
            //let weightedRandomNormal = gpRandom() * gpRandom();
            //let weightedRandomNormal = gpRandom() * gpRandom() * gpRandom();
            //let weightedRandomNormal = Math.sqrt( gpRandom() );


            let initialAge = YOUNG_AGE_DURATION + Math.floor( ( globalTweakers.maximumLifeSpan - YOUNG_AGE_DURATION ) * weightedRandomNormal );

            assert( ( initialAge >= YOUNG_AGE_DURATION ), "Genepool.js: startSimulation: ( initialAge >= YOUNG_AGE_DURATION )" );
            assert( ( initialAge <= globalTweakers.maximumLifeSpan ), "Genepool.js: startSimulation: ( initialAge <= globalTweakers.maximumLifeSpan )" );

            let initialAngle    = getRandomAngleInDegrees(); //-180.0 + gpRandom() * 360.0;
            let initialEnergy   = DEFAULT_SWIMBOT_HUNGER_THRESHOLD;

            //--------------------------------------------------
            // set values according to sim type
            //--------------------------------------------------

            //---------------------------------
            // neighborhood
            //---------------------------------
            if ( mode === SimulationStartMode.NEIGHBORHOOD )
            {
                let sqrt = Math.floor( Math.sqrt( _numSwimbots ) );
                let xMod = i % sqrt;
                let yMod = Math.floor( ( i / _numSwimbots ) * sqrt );

                let xFraction = xMod / sqrt;
                let yFraction = yMod / sqrt;

                let x = _poolCenter.x - _gardenOfEdenRadius + xFraction * _gardenOfEdenRadius * 2;
                let y = _poolCenter.y - _gardenOfEdenRadius + yFraction * _gardenOfEdenRadius * 2;

                initialPosition.setXY( x, y );

                for (let g=0; g<NUM_GENES; g++)
                {
                    let value = ZERO;

                    if ( _neighborhoodAxis[g] )
                    {
                        value = ONE_HALF + ONE_HALF * Math.sin( ( _neighborhoodX[g] + ( - ONE_HALF + xFraction ) ) * NEIGHBORHOOD_FREQ  );
                    }
                    else
                    {
                        value = ONE_HALF + ONE_HALF * Math.sin( ( _neighborhoodY[g] + ( - ONE_HALF + yFraction ) ) * NEIGHBORHOOD_FREQ  );
                    }

                    if ( value < ZERO ) { value = ZERO; }
                    if ( value > ONE  ) { value = ONE;  }

                    let geneValue = Math.floor( ( BYTE_SIZE - 1 ) * value );

                    _myGenotype.setGeneValue( g, geneValue );
                }
            }
            //---------------------------------
            // froggies
            //---------------------------------
            else if ( mode === SimulationStartMode.FROGGIES )
            {
                _myGenotype.setToFroggy();
            }
            //---------------------------------
            // tango
            //---------------------------------
            else if ( mode === SimulationStartMode.TANGO )
            {
                if ( i === 0 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_DARWIN ); }
                if ( i === 1 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_MENDEL ); }

                if ( i === 0 ) { initialPosition.setXY( _poolCenter.x - 100 * ONE_HALF, _poolCenter.y ); }
                if ( i === 1 ) { initialPosition.setXY( _poolCenter.x + 100 * ONE_HALF, _poolCenter.y ); }
            }
            //---------------------------------
            // race
            //---------------------------------
            else if ( mode === SimulationStartMode.RACE )
            {
                /*
                if ( i === 0 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_MARGULIS   ); }
                if ( i === 1 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_MARGULIS   ); }
                if ( i === 2 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_DAWKINS  ); }
                if ( i === 3 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_DAWKINS  ); }
                */

                if ( i === 0 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_WILSON   ); }
                if ( i === 1 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_WILSON   ); }
                if ( i === 2 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_DENNETT  ); }
                if ( i === 3 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_DENNETT  ); }

                if ( i === 0 ) { initialPosition.setXY( _poolCenter.x - FOOD_RACE_SIZE, _poolCenter.y + FOOD_RACE_SIZE      ); }
                if ( i === 1 ) { initialPosition.setXY( _poolCenter.x - FOOD_RACE_SIZE, _poolCenter.y + FOOD_RACE_SIZE - 60 ); }
                if ( i === 2 ) { initialPosition.setXY( _poolCenter.x + FOOD_RACE_SIZE, _poolCenter.y + FOOD_RACE_SIZE      ); }
                if ( i === 3 ) { initialPosition.setXY( _poolCenter.x + FOOD_RACE_SIZE, _poolCenter.y + FOOD_RACE_SIZE - 60 ); }
            }
            //-------------------------------------------------
            // big bang
            //-------------------------------------------------
            else if ( mode === SimulationStartMode.BIG_BANG )
            {
                initialPosition.setXY( _poolCenter.x, _poolCenter.y );
                _myGenotype.randomize();
            }
            //-------------------------------------------------
            // bad parents
            //-------------------------------------------------
            else if ( mode === SimulationStartMode.BAD_PARENTS )
            {
                if ( i === 0 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_TURING ); }
                if ( i === 1 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_TURING ); }

                if ( i === 0 ) { initialPosition.setXY( _poolCenter.x - 200 * ONE_HALF, _poolCenter.y ); }
                if ( i === 1 ) { initialPosition.setXY( _poolCenter.x + 200 * ONE_HALF, _poolCenter.y ); }
            }

            /*
            //-------------------------------------------------
            // barrier
            //-------------------------------------------------
            else if ( mode === SimulationStartMode.BARRIER )
            {
                if ( i === 0 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_DAWKINS   ); }
                if ( i === 1 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_WALLACE   ); }
                if ( i === 2 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_MENDEL    ); }
                if ( i === 3 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_WILSON    ); }
                if ( i === 4 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_TURING    ); }
                if ( i === 5 ) { _myGenotype.setToPreset( PRESET_GENOTYPE_MARGULIS  ); }

                let s = 150;

                if ( i === 0 ) { initialPosition.setXY( _poolCenter.x + s * -1,  _poolCenter.y + s * -1 ); }
                if ( i === 1 ) { initialPosition.setXY( _poolCenter.x + s *  0,  _poolCenter.y + s * -1 ); }
                if ( i === 2 ) { initialPosition.setXY( _poolCenter.x + s *  1,  _poolCenter.y + s * -1 ); }
                if ( i === 3 ) { initialPosition.setXY( _poolCenter.x + s * -1,  _poolCenter.y + s *  1 ); }
                if ( i === 4 ) { initialPosition.setXY( _poolCenter.x + s *  0,  _poolCenter.y + s *  1 ); }
                if ( i === 5 ) { initialPosition.setXY( _poolCenter.x + s *  1,  _poolCenter.y + s *  1 ); }
            }
            */
            //---------------------------------
            // normal
            //---------------------------------
            else
            {
                _myGenotype.randomize();
            }

            //--------------------------------------------------
            // This sets all junk DNA to a value of 0!!!
            //--------------------------------------------------
            for (let g=NUM_GENES_USED; g<NUM_GENES; g++)
            {
                _myGenotype.setGeneValue( g, 0 );
            }

            //-------------------------------------------------------------------
            // environment: each swimbot starts in one of the gardens (one per
            // biome type), roughly adapted to the local temperature and plants.
            // Predation is in the genes: about 10% of the founders are born
            // predators, the rest herbivores (as in the original random pool)
            //-------------------------------------------------------------------
            if ( environment.active )
            {
                if ( petri )
                {
                    // everybody starts in the middle (mildest) zone, adapted to it only
                    this.randomPointInZone( initialPosition, petriStartZone( environment.petri.zones ));
                    this.setEcologyGenesForPlace( _myGenotype, initialPosition.x, initialPosition.y );
                    this.narrowFounderTolerance( _myGenotype, initialPosition.x, initialPosition.y );
                }
                else
                {
                    const garden = _gardens[ i % _gardens.length ];
                    initialPosition.setToRandomLocationInDisk( garden, _gardenOfEdenRadius );
                    this.setEcologyGenesForPlace( _myGenotype, initialPosition.x, initialPosition.y );
                }
                const bornPredator = gpRandom() < INITIAL_PREDATOR_FRACTION;
                setTrait( _myGenotype, GENES_PREDATOR, bornPredator ? 0.7 + 0.3 * gpRandom() : gpRandom() * PREDATOR_LEVEL_THRESHOLD * 0.8 );
            }
            //-------------------------------------------------------------------
            // start with mostly herbivores: predators are a small minority
            //-------------------------------------------------------------------
            else if ( mode === SimulationStartMode.RANDOM )
            {
                let thresholdGeneValue = PREDATOR_LEVEL_THRESHOLD * 255;
                let predatorGeneValue = ( gpRandom() < INITIAL_PREDATOR_FRACTION )
                    ? thresholdGeneValue + 1 + gpRandom() * ( 254 - thresholdGeneValue )
                    : gpRandom() * thresholdGeneValue;
                setTrait( _myGenotype, GENES_PREDATOR, Math.floor( predatorGeneValue ) / 255 );
            }

            //-------------------------------------------------------------------------------
            // This is not the most elegant way to do this, but just to get it working.....
            // For any simulation mode (pool preset) other than Species, the swimbot genes
            // for food type preferrence and food type digestion are set to 0 (green).
            //-------------------------------------------------------------------------------
            if ( mode != SimulationStartMode.SPECIES )
            {
                //-------------------------------------------------------------------------------------------------
                // This sets the food type gene to be the same as the preferredFoodColor gene
                //-------------------------------------------------------------------------------------------------
                //let foodColorGene = _embryology.getFoodColorGene();
                //let foodTypeGene  = _embryology.getFoodNutritionGene();

                //console.log( "foodColorGene     = " + foodColorGene     );
                //console.log( "foodNutritionGene = " + foodNutritionGene );
                //let geneValue = _myGenotype.getGeneValue( foodColorGene );
                //console.log( "geneValue = " + geneValue );
                //_myGenotype.setGeneValue( foodNutritionGene, 0 );
                //_myGenotype.setGeneValue( foodNutritionGene, 0 );
            }

            //--------------------------------------------------
            // create the swimbot
            //--------------------------------------------------
            _swimbots[i].create( i, initialAge, initialPosition, initialAngle, initialEnergy, _myGenotype, _embryology );

            //------------------------------------------------------------------------------------
            // add the new swimbot to the family tree
            //------------------------------------------------------------------------------------
            _familyTree.addNode( i, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes(i), this.getSwimbotEvolutionTraits(i) );
        }

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

        for (let m=0; m<10; m++)
        {
            moveFoodBitsFromObstacle();
        }

		//---------------------------------
		// clear this!
		//---------------------------------
        setSelectedSwimbot( NULL_INDEX );

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
	    resetSimulationCounters();
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
	    setTrait( genotype, GENES_AUTOTOMY_WHICH,  gpRandom(),                  0 );

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
	    let placed = 0;

	    for (let attempt = 0; ( placed < _numFoodBits ) && ( attempt < _numFoodBits * 50 ); attempt++)
	    {
	        if (( placed < _numFoodBits * 0.6 ) && !environment.petri )
	        {
	            const garden = _gardens[ placed % _gardens.length ];
	            _vectorUtility.setToRandomLocationInDisk( garden, _gardenOfEdenRadius * 1.3 );
	        }
	        else
	        {
	            this.randomPointInPool( _vectorUtility );
	        }

	        const type = this.choosePlantTypeAt( _vectorUtility.x, _vectorUtility.y );
	        if ( !this.plantCanGrowAt( _vectorUtility.x, _vectorUtility.y, type )) continue;

	        _foodBits[ placed ].initialize( placed );
	        _foodBits[ placed ].setType( type );
	        _foodBits[ placed ].setPosition( _vectorUtility );
	        environment.plantCount[ type ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	        placed ++;
	    }

	    _numFoodBits = placed;
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
	    _seedDebt += ENVIRONMENT_SEEDS_PER_PERIOD / globalTweakers.foodRegenerationPeriod;

	    while ( _seedDebt >= 1 )
	    {
	        _seedDebt -= 1;

	        for (let attempt = 0; attempt < 12; attempt++)
	        {
	            let type;
	            const parent = ( gpRandom() < PLANT_PARENT_SEED_FRACTION ) ? this.findRandomLivingPlant() : null;

	            if ( parent !== null )
	            {
	                type = parent.getType();
	                const distance = PLANT_SEED_MIN_DISTANCE + gpRandom() * ( PLANT_SEED_MAX_DISTANCE - PLANT_SEED_MIN_DISTANCE );
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
	            _foodBits[ child ].setType( type );
	            _foodBits[ child ].setEnergy( globalTweakers.foodBitEnergy );
	            _foodBits[ child ].setPosition( _vectorUtility );
	            environment.plantCount[ type ][ environment.plantCellIndex( _vectorUtility.x, _vectorUtility.y ) ] ++;
	            if ( type === PLANT_TYPE_WARM ) { numType0FoodBits ++; } else { numType1FoodBits ++; }
	            break;
	        }
	    }
	}

	this.getEnvironment = function() { return environment; }

	//------------------------------------------------------------------------
	// How many "species" by body (for the statistics panel): swimbots whose
	// body genes differ on average by less than 12% go into one group (the
	// same rule as tools/headless.cjs). Uses an even sample of at most
	// `sampleSize` swimbots and no random numbers (does not disturb the run).
	// Groups smaller than 3% of the sample are not counted as species.
	//------------------------------------------------------------------------
	this.estimateSpecies = function( sampleSize = 400 )
	{
	    const alive = [];
	    for (let s = 0; s < MAX_SWIMBOTS; s++) { if ( _swimbots[s].getAlive() ) alive.push(s); }
	    const n = alive.length;
	    if ( n === 0 ) return { species: 0, largestShare: 0, sampled: 0 };

	    const stride = Math.max( 1, n / sampleSize );
	    const groups = [];   // { genes, count }
	    let sampled = 0;
	    for (let i = 0; i < n; i += stride)
	    {
	        const genotype = _swimbots[ alive[ Math.floor(i) ]].getGenotype();
	        const genes = genotype.getGenes();
	        const limit = 0.12 * NUM_GENES_USED * 255;
	        let found = null;
	        for ( const group of groups )
	        {
	            let sum = 0;
	            for (let g = 0; g < NUM_GENES_USED && sum < limit; g++) { sum += Math.abs( group.genes[g] - genes[g] ); }
	            if ( sum < limit ) { found = group; break; }
	        }
	        if ( found ) { found.count ++; }
	        else
	        {
	            groups.push({ genes: genes.slice( 0, NUM_GENES_USED ), count: 1 });
	        }
	        sampled ++;
	    }
	    const big = groups.filter( g => g.count >= sampled * 0.03 );
	    const largest = groups.reduce( ( m, g ) => Math.max( m, g.count ), 0 );
	    return { species: big.length, largestShare: largest / sampled, sampled };
	}

	//------------------------------------------------------------------------
	// stage 7: fill the shared arrays that perception reads, from the objects
	//------------------------------------------------------------------------
	this.writePerceptionParams = function()
	{
	    const P = _st.params;
	    P[ SS.PARAM_MAX_LIFESPAN ] = globalTweakers.maximumLifeSpan;
	    P[ SS.PARAM_ENV_ACTIVE   ] = environment.active ? 1 : 0;
	    P[ SS.PARAM_ENV_FIELDS   ] = ( environment.active && !FLAT_ENVIRONMENT ) ? 1 : 0;
	    P[ SS.PARAM_FOOD_TYPES   ] = globalTweakers.numFoodTypes;
	    P[ SS.PARAM_OBSTACLE_X1  ] = _obstacle.getEnd1Position().x;
	    P[ SS.PARAM_OBSTACLE_Y1  ] = _obstacle.getEnd1Position().y;
	    P[ SS.PARAM_OBSTACLE_X2  ] = _obstacle.getEnd2Position().x;
	    P[ SS.PARAM_OBSTACLE_Y2  ] = _obstacle.getEnd2Position().y;
	    _obstacle.writeGeometry( P, SS.PARAM_OB_MID_X, SS.PARAM_OB_MID_Y, SS.PARAM_OB_LENGTH, SS.PARAM_OB_PERP_X, SS.PARAM_OB_PERP_Y, SS.PARAM_OB_END_RADIUS );
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

	//------------------------------------------------------------------------
	// PERCEPTION_CHECK: run the kernel on exactly the state the old code just
	// saw, and count any difference
	//------------------------------------------------------------------------
	this.checkPerceptionKernel = function( s, food, prey, threat, socialX, socialY )
	{
	    this.writePerceptionParams();
	    for (let o = 0; o < MAX_SWIMBOTS; o++)
	    {
	        if ( _swimbots[o].getAlive() || _botAlive[o] ) { this.writePerceptionInputs(o); }
	    }
	    for (let f = 0; f < MAX_FOODBITS; f++) { _st.foodAlive[f] = _foodBits[f].getAlive() ? 1 : 0; }

	    perceive( s, _st, _perceptionScratch );
	    _perceptionChecks ++;

	    let same = ( _st.seenCount[s] === _numNearbySwimbots )
	            && ( _st.seenFood[s]   === food )
	            && ( _st.seenPrey[s]   === ( prey   ? prey.getIndex()   : -1 ))
	            && ( _st.seenThreat[s] === ( threat ? threat.getIndex() : -1 ))
	            && ( _st.socialX[s]    === socialX )
	            && ( _st.socialY[s]    === socialY );
	    for (let i = 0; same && i < _numNearbySwimbots; i++)
	    {
	        if ( _st.seen[ s * SS.MAX_SEEN + i ] !== _nearbySwimbotsArray[i].getIndex() ) { same = false; }
	    }
	    if ( !same ) { _perceptionMismatches ++; }
	}

	// PERCEPTION_CHECK: the mate the threads chose = the one the old code would choose?
	this.checkMateChoices = function( list, n )
	{
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        if ( !_st.sensing[s] || _st.seenMate[s] === -2 ) continue;
	        const me = _swimbots[s];
	        let best = -1, highest = -100.0;
	        for (let k = 0; k < _st.seenCount[s]; k++)
	        {
	            const other = _swimbots[ _st.seen[ s * SS.MAX_SEEN + k ] ];
	            const babe = other.getAttractiveness( me );
	            if (( babe > highest ) && ( babe > 0 ) && ( other.getAge() > YOUNG_AGE_DURATION ) && ( other.getEnergy() > STARVING ) && other.sameDiet( me ) && other.acceptsMate( me ))
	            {
	                highest = babe;
	                best = other.getIndex();
	            }
	        }
	        _perceptionChecks ++;
	        if ( best !== _st.seenMate[s] ) { _perceptionMismatches ++; }
	    }
	}

	this.getPerceptionMismatches = function() { return { checks: _perceptionChecks, mismatches: _perceptionMismatches }; }

	// the preferred temperatures of the parents of the latest births
	this.getRecentMatings = function()
	{
	    const n = Math.min( _matingCount, MATING_RECORD_SIZE );
	    return { count: _matingCount, a: _matingRecord.slice( 0, n ), b: _matingRecord.slice( MATING_RECORD_SIZE, MATING_RECORD_SIZE + n ) };
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



	//--------------------------------------------------
	this.setFoodToBarrierConfiguration = function()
	{
        _numFoodBits = 40;
        let spread = 500;
        let p = new Vector2D();

        for (let f=0; f<_numFoodBits; f++)
        {
            _foodBits[f].initialize(f);
            p.setXY
            (
                _poolCenter.x + ( -spread * ONE_HALF + gpRandom() * spread ),
                _poolCenter.y + ( -spread * ONE_HALF + gpRandom() * spread )
            );

            _foodBits[f].setPosition(p);
        }

        this.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS + ( MAX_FOOD_BIT_MAX_SPAWN_RADIUS - MIN_FOOD_BIT_MAX_SPAWN_RADIUS ) * 0.2 );
	}



	//-------------------------------------------
	this.setFoodToBadParentsConfiguration = function()
	{
        _numFoodBits = 5;

        let spread = 100;
        let p = new Vector2D();
        let f = -1;

        f++; _foodBits[f].initialize(f); p.setXY( _poolCenter.x, _poolCenter.y + spread * -1.0 ); _foodBits[f].setPosition(p);
        f++; _foodBits[f].initialize(f); p.setXY( _poolCenter.x, _poolCenter.y + spread * -0.5 ); _foodBits[f].setPosition(p);
        f++; _foodBits[f].initialize(f); p.setXY( _poolCenter.x, _poolCenter.y + spread *  0.0 ); _foodBits[f].setPosition(p);
        f++; _foodBits[f].initialize(f); p.setXY( _poolCenter.x, _poolCenter.y + spread *  0.5 ); _foodBits[f].setPosition(p);
        f++; _foodBits[f].initialize(f); p.setXY( _poolCenter.x, _poolCenter.y + spread *  1.0 ); _foodBits[f].setPosition(p);


        /*
        let range = 100;
        let spread = 40.0;

        for (let f=0; f<_numFoodBits; f++)
        {
            let side = -range;

            if ( gpRandom() > ONE_HALF ) { side = range; }
            let x = _poolCenter.x + side + gpRandom() * spread;
            let y = _poolCenter.y + gpRandom() * spread;
            foodBitPosition.setXY( x, y );

            _foodBits[f].initialize(f);
            _foodBits[f].setPosition( foodBitPosition );
    	}
    	*/


        this.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS );
	}


	//-------------------------------------------
	this.setFoodToBangConfiguration = function()
	{
        _numFoodBits = 500;
        let radius   = ONE;
        let fraction = ZERO;
        let thirdNum = _numFoodBits / 3.0;

        let foodBitPosition = new Vector2D();

        for (let f=0; f<_numFoodBits; f++)
        {
            if ( f > _numFoodBits * 0.66666 )
            {
                fraction = ( f - ( _numFoodBits * 0.66666 ) ) / thirdNum;
                radius = 600;
            }
            else if ( f > _numFoodBits * 0.333333 )
            {
                fraction = ( f - ( _numFoodBits * 0.333333 ) ) / thirdNum;
                radius = 900;
            }
            else
            {
                fraction = f / thirdNum;
                radius = 300;
            }

            let radian = fraction * Math.PI * 2.0;


            // spiral
            /*
            radius *= 1.016;
            let radian = f * 0.2;
            */


            let x = _poolCenter.x + radius * Math.sin( radian );
            let y = _poolCenter.y + radius * Math.cos( radian );

            foodBitPosition.setXY( x, y );

            _foodBits[f].initialize(f);
            _foodBits[f].setPosition( foodBitPosition );
        }

        this.setFoodGrowthDelay( DEFAULT_FOOD_REGENERATION_PERIOD );
        this.setFoodSpread( 20 );
	}


	//-------------------------------------------
	this.setFoodToSpeciesConfiguration = function()
	{
    	let p = new Vector2D();

        for (let f=0; f<_numFoodBits; f++)
        {
            let s = POOL_WIDTH * 0.4;
            p.x = gpRandom() * s;
            p.y = POOL_HEIGHT * ONE_HALF - s * ONE_HALF + + gpRandom() * s;

            _foodBits[f].setType( Math.floor( gpRandom() * 2 ) );

            if ( gpRandom() < ONE_HALF )
            {
                p.x = POOL_WIDTH - p.x;
            }

            _foodBits[f].setPosition(p);
    	}
	}

	//-------------------------------------------
	this.setFoodToRaceConfiguration = function()
	{
       	_numFoodBits = 0;

    	let p = new Vector2D();
    	let num = 200;
    	let xx = _poolCenter.x;
    	let yy = _poolCenter.y + FOOD_RACE_SIZE * 0.9;

    	for (let f=0; f<num; f++)
    	{
            let fraction = f / num;

            p.x = xx + FOOD_RACE_SIZE * Math.cos( fraction * Math.PI );
            p.y = yy - FOOD_RACE_SIZE * Math.sin( fraction * Math.PI );

            _foodBits[ _numFoodBits ].initialize(f);
            _foodBits[ _numFoodBits ].setPosition(p);
            _numFoodBits ++;
        }

        num = 140;
        let r = 0;
    	xx = _poolCenter.x;
    	yy = _poolCenter.y - FOOD_RACE_SIZE * 0.4;

    	for (let f=0; f<num; f++)
    	{
            let ff = f * 0.1;

            r += 2;

            p.x = xx + r * Math.cos( ff );
            p.y = yy + r * Math.sin( ff );

            _foodBits[ _numFoodBits ].initialize(f);
            _foodBits[ _numFoodBits ].setPosition(p);
            _numFoodBits ++;
        }

    	//set the delay of food growth
        this.setFoodGrowthDelay( MAX_FOOD_REGENERATION_PERIOD );
        this.setFoodSpread( MIN_FOOD_BIT_MAX_SPAWN_RADIUS );
	}


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
            const f = this.findLowestDeadFoodBitInArray();
            if ( f === NULL_INDEX ) return;
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

    this.spawnMeatFoodBits = function(position, count)
    {
        // type = 2 => red meat, edible by predators
        if ((count === undefined) || (count <= 0)) return;
        if (!position) return;

        for (let i = 0; i < count; i++)
        {
            let foodIndex = this.findLowestDeadFoodBitInArray();
            if (foodIndex === NULL_INDEX) return;

            _foodBits[foodIndex].initialize(foodIndex);
            _foodBits[foodIndex].setType(2);
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
	this.simulateStep = function()
	{
        //--------------------
        // advance clock...
        //--------------------
        _clock ++;
        const stepStart = now();

        if ( environment.active )
        {
            environment.setTime( _clock );
        }

        //----------------------
        // update swimbots...
        //----------------------
        this.updateSwimbots();

        //------------------
        // update food
        //------------------
        this.updateFood();
        _phaseTimes[5] += now() - stepStart;
        _phaseTimes[6] += 1;

        _stepsThisSecond ++;
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

            if ( RENDER_SWIMBOT_AS_DOT )
            {
                _levelOfDetail = SWIMBOT_LEVEL_OF_DETAIL_DOT;
            }
            else
            {
                if ( _camera.getScale() > LEVEL_OF_DETAIL_THRESHOLD )
                {
                    _levelOfDetail = SWIMBOT_LEVEL_OF_DETAIL_LOW;
                }
                else
                {
                    _levelOfDetail = SWIMBOT_LEVEL_OF_DETAIL_HIGH;
                }
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
                const deadline = performance.now() + MAX_FRAME_BUDGET_MS;
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
            rebuildAliveIndexCaches();
            this.renderFrame();
        }

        _touch.update();
	}

	this.getStepsPerSecond = function() { return _stepsPerSecond; }

	// no screen refresh for a while (hidden or covered window, embedded view)?
	this.screenRefreshStalled = function( now ) { return ( now - _lastAnimationFrame ) > 100; }

	// the graphics-card renderer (set up by main.ts in the browser)
	this.setCapsuleRenderer = function( renderer ) { _capsuleRenderer = renderer; }

	//--------------------------------
	//------------------------------------------------------------------------
	// what a swimbot does with the world after it moved and looked around:
	// bump into the obstacle, eat, bite, mate
	//------------------------------------------------------------------------
	this.interact = function( s )
	{
                //--------------------------------------------------------------------------------------------------------
                // check for obstacle collision....
                //--------------------------------------------------------------------------------------------------------
                // (in the phased step the physics threads do this, see PhysicsKernel.obstacleCollision)
                if ( INTERLEAVED_STEP && _obstacle.getCollision( _swimbots[s].getPosition(), _swimbots[s].getBoundingRadius() * ONE_HALF ) )
                {
                    // only call this IMMEDIATELY after calling "_obstacle.getCollision"...
                    _vectorUtility = _obstacle.getCurrentCollisionForce();
                    _vectorUtility.scale( 1.2 );
                    _swimbots[s].addForce( _vectorUtility );
                }

                //-------------------------------------
                // eating
                //-------------------------------------
                if ( _swimbots[s].getIsTryingToEat() )
                {
                    // (in the phased step someone else may have eaten it first)
                    const food = _swimbots[s].getChosenFoodBit();
                    if (( food != null ) && food.getAlive()) { _swimbots[s].eatChosenFoodBit(); }
                    else                                     { _swimbots[s].cancelEating(); }
                }

                //-------------------------------------
                // hunting (prey)
                //-------------------------------------
                if ( _swimbots[s].getIsTryingToHunt() )
                {
                    _swimbots[s].huntEatChosenPrey();
                }

                //----------------------------------------
                // giving birth to a new swimbot
                //----------------------------------------

                if ( _swimbots[s].getIsTryingToMate() )
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

                        // predators and herbivores never have children together
                        if ( _potentialMate.getAlive() && _potentialMate.sameDiet( _swimbots[s] ))
                        {
                            assert( _myGenotype    != null, "genepool: updateSwimbots: _myGenotype    != null" );
                            assert( _mateGenotype  != null, "genepool: updateSwimbots: _mateGenotype  != null" );

                            //------------------------------------------------------------------------------
                            // collect genes from me and my chosen mate and recombine them for the child
                            //------------------------------------------------------------------------------
                            _myGenotype = _swimbots[s].getGenotype();
                            _mateGenotype = _potentialMate.getGenotype();

                            //------------------------------------------------------------------------------
                            // if the junk dna of each swimbot are similar enough...
                            //------------------------------------------------------------------------------
if ( this.getJunkDnaSimilarity( _myGenotype, _mateGenotype ) > NON_REPRODUCING_JUNK_DNA_LIMIT )
                            {

                                //-----------------------------------
                                // recombine genes for the child
                                //-----------------------------------
                                assert( _childGenotype != null, "_childGenotype != null" );

                                _childGenotype.setAsOffspring( _myGenotype, _mateGenotype );

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
                                simCounters.births ++;

                                // remember who mated with whom (for measuring how species separate)
                                _matingRecord[ _matingCount % MATING_RECORD_SIZE ] = _swimbots[s].getThermalOptimum();
                                _matingRecord[ _matingCount % MATING_RECORD_SIZE + MATING_RECORD_SIZE ] = _potentialMate.getThermalOptimum();
                                _matingCount ++;

                                //--------------------------------------------------
                                // add the new swimbot to the family tree
                                //--------------------------------------------------
                                _familyTree.addNode( newBornSwimbotIndex, s, chosenMateIndex, _clock, this.getSwimbotGenes( newBornSwimbotIndex ), this.getSwimbotEvolutionTraits( newBornSwimbotIndex ) );

                            }// if ( getJunkDnaDistance( _myGenotype, _mateGenotype ) > NON_REPRODUCING_JUNK_DNA_LIMIT )
                            else
                            {
                                //console.log( "reproduction not possible because junk dna is too dissimilar!" );
                            }
                        }   //  if ( _potentialMate.getAlive() )
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

	//------------------------------------------------------------------------
	// stage 7: the step in phases. The heavy phases (moving the bodies,
	// looking around) touch only the shared arrays and can run in several
	// threads (_runner); deciding and acting stay in this thread, in order.
	//------------------------------------------------------------------------
	this.updateSwimbotsInPhases = function()
	{
	    const list = _aliveSwimbotIndices;
	    const n    = list.length;
	    this.writePerceptionParams();

	    let t = now();

	    // 1. decide
	    for (let i = 0; i < n; i++)
	    {
	        const b = _swimbots[ list[i] ];
	        if ( b.getAlive() ) { b.prepareStep(); }
	    }

	    t = phaseTime( 0, t );

	    // 2. move (many threads)
	    _runner.physics( list, n );
	    t = phaseTime( 1, t );

	    // 3. take the results back; get ready to look around
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        const b = _swimbots[s];
	        _st.sensing[s] = 0;
	        if ( !b.getAlive() ) continue;

	        b.finishStep();

	        // positions straight from the physics numbers (= the swimbot's own, just copied)
	        const k = s * SS.BOT_STRIDE, B = _st.bots;
	        _botX    [s] = B[ k + SS.B_POS_X     ];
	        _botY    [s] = B[ k + SS.B_POS_Y     ];
	        _genitalX[s] = B[ k + SS.B_GENITAL_X ];
	        _genitalY[s] = B[ k + SS.B_GENITAL_Y ];
	        if ( _botAlive[s] === 0 ) continue;         // died of old age or hunger just now

	        if ( b.getIsLookingForSensoryInput() )
	        {
	            b.updateScanRadius();
	            _st.sensing[s] = 1;
	        }
	        _st.mouthX    [s] = B[ k + SS.B_MOUTH_X ];
	        _st.mouthY    [s] = B[ k + SS.B_MOUTH_Y ];
	        _st.energy    [s] = B[ k + SS.B_ENERGY  ];
	        _st.scanRadius[s] = b.getDynamicScanRadius();
	        _st.brainState[s] = b.getBrainState();
	        _st.age       [s] = b.getAge();
	    }

	    t = phaseTime( 2, t );

	    // 4. look around (many threads)
	    _runner.perception( list, n );
	    t = phaseTime( 3, t );

	    if ( PERCEPTION_CHECK ) { this.checkMateChoices( list, n ); }

	    // 5. act, one after the other
	    for (let i = 0; i < n; i++)
	    {
	        const s = list[i];
	        if ( !_swimbots[s].getAlive() )
	        {
	            if ( _selectedSwimbot === s ) { setSelectedSwimbot( NULL_INDEX ); }
	            continue;
	        }
	        if ( _st.sensing[s] ) { this.applyPerception(s); }
	        this.interact(s);
	    }
	    phaseTime( 4, t );
	}

	//------------------------------------------------------------------------
	// how long the phases take (milliseconds, summed; for finding what is slow)
	//------------------------------------------------------------------------
	const _phaseTimes = new Float64Array( 8 );
	function now() { return ( typeof performance !== "undefined" ) ? performance.now() : 0; }
	function phaseTime( phase, since ) { const t = now(); _phaseTimes[ phase ] += t - since; return t; }
	this.getPhaseTimes = function() { return _phaseTimes; }

	// give a swimbot what the perception kernel found for it
	this.applyPerception = function( s )
	{
	    const me    = _swimbots[s];
	    const count = _st.seenCount[s];
	    const base  = s * SS.MAX_SEEN;
	    for (let k = 0; k < count; k++) { _nearbySwimbotsArray[k] = _swimbots[ _st.seen[ base + k ] ]; }
	    _numNearbySwimbots = count;

	    if ( me.getUsesNeuralBrain() ) { me.setSocialOffset( _st.socialX[s], _st.socialY[s] ); }

	    // (something may have been eaten since the look)
	    const f = _st.seenFood[s];
	    const p = _st.seenPrey[s];
	    const t = _st.seenThreat[s];
	    const foodOkay   = ( f >= 0 ) && _foodBits[f].getAlive();
	    const preyOkay   = ( p >= 0 ) && _swimbots[p].getAlive();
	    const threatOkay = ( t >= 0 ) && _swimbots[t].getAlive();
	    const a = _st.seenPredator[s];
	    const anyPredator = (( a >= 0 ) && _swimbots[a].getAlive() ) ? _swimbots[a] : null;

	    if ( preyOkay ) { me.notifyTargetFound(); }

	    // the mate the threads chose (-2: choose here, the old way)
	    const m = _st.seenMate[s];
	    const mateChoice = ( m === -2 ) ? undefined : (( m >= 0 && _swimbots[m].getAlive() ) ? _swimbots[m] : null );

	    me.setEnvironmentalStimuli( count, _nearbySwimbotsArray,
	                                foodOkay, foodOkay ? _foodBits[f] : null,
	                                preyOkay, preyOkay ? _swimbots[p] : null,
	                                threatOkay ? _swimbots[t] : null,
	                                mateChoice, _st.seen, base, anyPredator );
	}

	this.updateSwimbots = function()
	{
	    // Swimbots that died last step: leave the grid, maybe leave meat
	    for (let s = 0; s < MAX_SWIMBOTS; s++)
	    {
            if (_swimbotWasAlive[s] && !_swimbots[s].getAlive())
            {
                // Запомнить позицию трупа ДО удаления из грида
                let deadPosition = _swimbots[s].getPosition();

                _swimbotWasAlive[s] = false;

                // Мясо только от травоядных.
                // Источник мяса:
                // - смерть от старости (как раньше)
                // - смерть от голода (новое)
if ( _swimbots[s].getPredatorLevel() <= PREDATOR_LEVEL_THRESHOLD
                && ( _swimbots[s].getAge() >= _swimbots[s].getMaxAge() ) )
                {
                    let meatIndex = this.findLowestDeadFoodBitInArray();
                    if ( meatIndex !== NULL_INDEX )
                    {
                        _foodBits[meatIndex].initialize(meatIndex);
                        _foodBits[meatIndex].setType(2);
                        _foodBits[meatIndex].setPosition(deadPosition);
                    }
                }

            }
	    }

	    // who is alive now (after the meat above appeared)
        rebuildAliveIndexCaches();

	    // rebuild the swimbot grid from the living swimbots
	    for (let i = 0; i < _aliveSwimbotIndices.length; i++)
	    {
            let s = _aliveSwimbotIndices[i];
            syncSwimbot(s);
            _swimbotWasAlive[s] = true;
	    }
        _swimbotGrid.build( _aliveSwimbotIndices, _aliveSwimbotIndices.length, _botX, _botY );

	    // rebuild the food grid from the living food bits
	    _st.foodAlive.fill( 0 );
	    for (let i = 0; i < _aliveFoodBitIndices.length; i++)
	    {
            let f = _aliveFoodBitIndices[i];
            _st.foodAlive[f] = 1;
            const position = _foodBits[f].getPosition();
            _foodX[f] = position.x;
            _foodY[f] = position.y;
            _foodType[f] = _foodBits[f].getType();
	    }
        _foodBitGrid.build( _aliveFoodBitIndices, _aliveFoodBitIndices.length, _foodX, _foodY );

        if ( !INTERLEAVED_STEP )
        {
            this.updateSwimbotsInPhases();
        }
        else for (let i = 0; i < _aliveSwimbotIndices.length; i++)
        {
            let s = _aliveSwimbotIndices[i];
            if ( _swimbots[s].getAlive() )
            {



                _swimbots[s].update();
                syncSwimbotPosition(s);

                //-----------------------------------------------------------------
                // provide aspects of the environment for the swimbot to perceive
                //-----------------------------------------------------------------
                if ( _swimbots[s].getIsLookingForSensoryInput() )
                {
                    this.giveSwimbotNearbyEnvironmentalStimuli(s);
                }

                // Не сбрасываем _tryingToHunt принудительно.
                // Это ломало/теряло попытки укуса при некоторых состояниях мозга.


                this.interact(s);
            }            //     if ( _swimbots[s].getAlive() )
            else
            {
                //-------------------------------------------------------------
                // In case the selected swimbot has just died, de-select it!
                //-------------------------------------------------------------
                if ( _selectedSwimbot === s )
                {
                    setSelectedSwimbot( NULL_INDEX );
                }
            }
        } // for (let s=0; s<MAX_SWIMBOTS; s++)

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
	    let diff = ZERO;
	    let num = 0;
        for (let g=NUM_GENES_USED; g<NUM_GENES; g++)
        {
            diff += Math.abs( genotype1.getGeneValue(g) - genotype2.getGeneValue(g) ) / BYTE_SIZE;
            num ++;
        }

        let similarity = ONE - ( diff / num );

        //console.log( similarity );

	    return similarity;
	}


    //-----------------------------------
	this.generatePhyloTree = function()
	{
	    let numJunkGenes = NUM_GENES - NUM_GENES_USED;
	    _phyloTree.initialize( numJunkGenes );

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            if ( _swimbots[s].getAlive() )
            {
        	    _phyloTree.addJunkDNA( _swimbots[s].getGenotype() );
	        }
        }
    }


    //---------------------------------------------
	this.findLowestDeadSwimbotInArray = function()
	{
        let s = NULL_INDEX;
        let t = NULL_INDEX;

        // (_botAlive is fast to scan; it can lag behind right after a new
        //  pool is made, so the swimbot itself confirms)
        let looking = true;
        while ( looking )
        {
            t++;

            if (( _botAlive[t] === 0 ) && !_swimbots[t].getAlive() )
            {
                s = t;
                looking = false;
            }

            if ( t >= MAX_SWIMBOTS - 1 )
            {
                looking = false;
            }
        }

        return s;
    }


    //--------------------------------------------------------
	this.giveSwimbotNearbyEnvironmentalStimuli = function(s)
	{
        const me = _swimbots[s];
        const viewRadius = SWIMBOT_VIEW_RADIUS;
        const viewRadiusSquared = viewRadius * viewRadius;
        me.updateScanRadius();
        const preyViewRadius = me.getDynamicScanRadius();
        const preyViewRadiusSquared = preyViewRadius * preyViewRadius;

        const myGenitalPosition = me.getGenitalPosition();
        const myMouthPosition = me.getMouthPosition();
        const preferredFoodType = me.getPreferredFoodType();
        const predatorLevel     = me.getPredatorLevel();

        const myMass            = me.getPhenotypeMass();



	    //------------------------------------------------------
	    // collect the array of nearby visible swimbots...
	    //------------------------------------------------------
        _numNearbySwimbots = 0;

        //------------------------------------------------------------------
        // everybody within the search radius (wider for a hunting predator)
        //------------------------------------------------------------------
        const myPosition   = me.getPosition();
        const myX          = myPosition.x;
        const myY          = myPosition.y;
        const searchRadius = (predatorLevel > PREDATOR_LEVEL_THRESHOLD) ? preyViewRadius : viewRadius;
        const searchRadiusSquared = searchRadius * searchRadius;

        let numNearby = 0;
        const numInCells = _swimbotGrid.collect( myX, myY, searchRadius, _gridResult );

        for (let k = 0; k < numInCells; k++)
        {
            const o = _gridResult[k];
            if ( o === s ) continue;

            const dx = _botX[o] - myX;
            const dy = _botY[o] - myY;
            if ( dx * dx + dy * dy < searchRadiusSquared )
            {
                _nearbyIndices[ numNearby ++ ] = o;
            }
        }

        //------------------------------------------------------------------
        // the brain perceives the NEAREST swimbots within normal view,
        // always in order of distance
        //------------------------------------------------------------------
        const myGenitalX = myGenitalPosition.x;
        const myGenitalY = myGenitalPosition.y;
        let numCandidates = 0;

        for (let i = 0; i < numNearby; i++)
        {
            const o = _nearbyIndices[i];

            if ( _botAlive[o] === 1 )
            {
                const dx = myGenitalX - _genitalX[o];
                const dy = myGenitalY - _genitalY[o];
                const distanceSquared = dx * dx + dy * dy;

                if (distanceSquared < viewRadiusSquared)
                {
                    _candidateIndices  [numCandidates] = o;
                    _candidateDistances[numCandidates] = distanceSquared;
                    numCandidates++;
                }
            }
        }

        // usually only the nearest few are needed; if the obstacle hides
        // some of them, fall back to sorting the whole list
        let numNearest = selectNearestCandidates( numCandidates, BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS );
        let nearestList = _nearestIndices;

        for (let i = 0; i < numNearest; i++)
        {
            const o = _nearestIndices[i];
            _genitalPositionUtility.setXY( _genitalX[o], _genitalY[o] );
            if ( _obstacle.getObstruction( myGenitalPosition, _genitalPositionUtility ) && ( numCandidates > numNearest ))
            {
                sortCandidatesByDistance( numCandidates );
                nearestList = _candidateIndices;
                numNearest  = numCandidates;
                break;
            }
        }

        let socialX = 0, socialY = 0;
        for (let i = 0; i < numNearest && _numNearbySwimbots < BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS; i++)
        {
            const o = nearestList[i];
            _genitalPositionUtility.setXY( _genitalX[o], _genitalY[o] );

            if (!_obstacle.getObstruction(myGenitalPosition, _genitalPositionUtility))
            {
                _nearbySwimbotsArray[_numNearbySwimbots] = _swimbots[o];
                _numNearbySwimbots++;
                socialX += _botX[o] - myX;
                socialY += _botY[o] - myY;
            }
        }

        // the neural brain may want to swim towards (or away from) the others
        if ( me.getUsesNeuralBrain() ) { me.setSocialOffset( socialX, socialY ); }

        //------------------------------------------------------
        // find the closest food bit using spatial grid
        //------------------------------------------------------
        const environmentOn    = environment.active;
        const myEfficiencyWarm = environmentOn ? me.getDigestionEfficiency( PLANT_TYPE_WARM ) : ONE;
        const myEfficiencyCold = environmentOn ? me.getDigestionEfficiency( PLANT_TYPE_COLD ) : ONE;
        const iAmStarving      = me.getEnergy() < STARVING_FOOD_CHOICE;
        let foundFoodBit = false;
        let smallestDistanceSquared = Number.MAX_SAFE_INTEGER;

        const numFoodInCells = _foodBitGrid.collect( myX, myY, viewRadius, _foodGridResult );

        for (let k = 0; k < numFoodInCells; k++)
        {
            const f  = _foodGridResult[k];

            // within the search radius of my body center?
            const fx = _foodX[f] - myX;
            const fy = _foodY[f] - myY;
            if ( fx * fx + fy * fy >= viewRadiusSquared ) continue;

            const foodBit = _foodBits[f];
            const foodType = _foodType[f];

            let okay = true;

            // Check food type compatibility
            // Type 2 (meat) must be eaten only by predators, independent of numFoodTypes
            if (foodType === 2)
            {
                // Meat (type 2): eat only by predators
                if (predatorLevel <= PREDATOR_LEVEL_THRESHOLD) okay = false;
            }
            else if (predatorLevel > PREDATOR_LEVEL_THRESHOLD)
            {
                // Predators don't eat plants
                okay = false;
            }
            else if ( environmentOn )
            {
                // the environment: any plant, but poorly digestible ones only when starving
                if ((( foodType === PLANT_TYPE_WARM ) ? myEfficiencyWarm : myEfficiencyCold ) < IGNORE_FOOD_EFFICIENCY && !iAmStarving) okay = false;
            }
            else if (globalTweakers.numFoodTypes === 2)
            {
                if (foodType != preferredFoodType)
                {
                    okay = false;
                }
            }

            if (!okay) continue;

            // distance from my mouth (from the arrays; the food bit itself
            // is only looked at for the few that could be the closest)
            const mx = myMouthPosition.x - _foodX[f];
            const my = myMouthPosition.y - _foodY[f];
            let viewDistanceSquared = mx * mx + my * my;

            // in the environment, better food counts as nearer:
            // value = efficiency / distance, i.e. compare distance² / efficiency²
            if ( environmentOn && ( foodType !== 2 ))
            {
                if ( viewDistanceSquared >= viewRadiusSquared ) continue;
                const e = ( foodType === PLANT_TYPE_WARM ) ? myEfficiencyWarm : myEfficiencyCold;
                const scaled = viewDistanceSquared / ( e * e );
                if ( scaled < smallestDistanceSquared && foodBit.getAlive() && !_obstacle.getObstruction( myMouthPosition, foodBit.getPosition() ))
                {
                    smallestDistanceSquared = scaled;
                    _chosenFoodBit = foodBit;
                    foundFoodBit = true;
                }
                continue;
            }

            if ( viewDistanceSquared < viewRadiusSquared && viewDistanceSquared < smallestDistanceSquared && foodBit.getAlive() )
            {
                const foodPosition = foodBit.getPosition();
                {
                    {
                        if (!_obstacle.getObstruction(myMouthPosition, foodPosition))
                        {
                            smallestDistanceSquared = viewDistanceSquared;
                            _chosenFoodBit = foodBit;
                            foundFoodBit = true;
                        }
                    }
                }
            }
        }

	    //------------------------------------------------------------------------------
	    // pass these environmental stimuli along to the swimbot...
	    //------------------------------------------------------------------------------
        //------------------------------------------------------
        // find prey (for predators)
        //------------------------------------------------------
        let preyWasFound = false;
        let chosenPrey = null;
        let bestPreyValue = -Infinity;
        let chosenPreyDistance = 0;

        // Читаем predatorLevel и mass через публичные геттеры Swimbot
        // (predatorLevel объявлен выше, чтобы не ловить Temporal Dead Zone)


        // ─── Поиск добычи (только для хищников) ───────────────────────────────────
        if (predatorLevel > PREDATOR_LEVEL_THRESHOLD) {
            for (let i = 0; i < numNearby; i++) {
                const o = _nearbyIndices[i];
                if (_botAlive[o] === 0) continue;

                // Охотиться только на травоядных (хищники на хищников не нападают)
                // Порог совпадает с порогом окраски в чёрный (Embryology.js, predatorLevel > 0.6),
                // иначе боты с predatorLevel 0.5-0.6 визуально выглядят добычей,
                // но хищники их игнорируют как "своих"
                if (_botPredator[o] > PREDATOR_LEVEL_THRESHOLD) continue;

                // Бессмертных не едят
                if (_botEternal[o] === 1) continue;

                // Слишком крупная добыча хищнику не по зубам
                if (_botMass[o] > myMass * PREY_MAX_MASS_RATIO) continue;


                const px = myMouthPosition.x - _botX[o];
                const py = myMouthPosition.y - _botY[o];
                let distance = Math.sqrt( px * px + py * py );

                if (distance > preyViewRadius) continue;

                // camouflage: prey that matches the background is seen only up close
                if ( environmentOn && distance > preyViewRadius * preyVisibility( _botBrightness[o], environment.backgroundAt( _botX[o], _botY[o] ))) continue;

                const candidate = _swimbots[o];

                // Скоринг: предпочитаем максимально близкую жертву.
                // Энергия остаётся небольшим плюсом, но выбор делаем по близости.
                // Жёстко выбираем минимальную дистанцию среди видимых.
                // Энергия добавляется только как микроприбавка, чтобы избежать тикового залипания при равных расстояниях.
                let value = -distance + candidate.getEnergy() * 0.001;




                if (value > bestPreyValue) {
                    bestPreyValue = value;
                    chosenPrey = candidate;
                    preyWasFound = true;
                    chosenPreyDistance = distance;
                }
            }


        }






        // ─── Поиск ближайшего хищника (для механики побега травоядных) ───────
        let nearestPredator     = null;
        let nearestPredatorDist = Infinity;

        if (predatorLevel <= PREDATOR_LEVEL_THRESHOLD) { // Я — травоядный, ищу угрозу
            for (let i = 0; i < _numNearbySwimbots; i++) {
                let candidate = _nearbySwimbotsArray[i];
                const o = candidate.getIndex();
                if (_botAlive[o] === 0) continue;
                if (_botPredator[o] <= PREDATOR_LEVEL_THRESHOLD) continue;

                // сытый хищник не опасен — бежим только от охотящегося
                const predatorState = candidate.getBrainState();
                if ((predatorState !== BRAIN_STATE_LOOKING_FOR_PREY) && (predatorState !== BRAIN_STATE_PURSUING_PREY)) continue;

                const gx = myGenitalX - _genitalX[o];
                const gy = myGenitalY - _genitalY[o];
                let distance = Math.sqrt( gx * gx + gy * gy );
                if (distance > viewRadius) continue;

                if (distance < nearestPredatorDist) {
                    nearestPredatorDist = distance;
                    nearestPredator     = candidate;
                }
            }
        }

        //------------------------------------------------------------------------------
        // pass these environmental stimuli along to the swimbot...
        //------------------------------------------------------------------------------
        if (preyWasFound && chosenPrey) {
            // ensure the candidate is visible and can be targeted
            // (debugging aid; should be safe in production too)
            // console.log("[predation] chosenPrey index=" + chosenPrey.getIndex());

            // Found prey — dynamic radar should reset immediately (with cooldown).
            me.notifyTargetFound();
        }

        if ( PERCEPTION_CHECK )
        {
            this.checkPerceptionKernel( s, foundFoodBit ? _chosenFoodBit.getIndex() : -1, chosenPrey, nearestPredator, socialX, socialY );
        }

        me.setEnvironmentalStimuli(

            _numNearbySwimbots,
            _nearbySwimbotsArray,
            foundFoodBit,
            _chosenFoodBit,
            preyWasFound,
            chosenPrey,
            nearestPredator
        );

     }



	//----------------------------
	this.updateFood = function()
	{
        let numType0FoodBits = 0;
        let numType1FoodBits = 0;
        const counting = environment.active;
        if ( counting ) { environment.clearPlantCounts(); }

        //-------------------------------------------------
        // general update for all food bits; meat rots
        //-------------------------------------------------
        for (let i = 0; i < _aliveFoodBitIndices.length; i++)
        {
            let f = _aliveFoodBitIndices[i];
            if (!_foodBits[f].getAlive()) continue;

            _foodBits[f].update();

            let type = _foodBits[f].getType();

                 if ( type === 0 ) { numType0FoodBits ++; }
            else if ( type === 1 ) { numType1FoodBits ++; }
            else if ( _foodBits[f].getAge() > MEAT_DECAY_TIME )
            {
                _foodBits[f].kill();
            }

            if ( counting && ( type !== 2 ) && _foodBits[f].getAlive() )
            {
                const position = _foodBits[f].getPosition();
                environment.plantCount[ type ][ environment.plantCellIndex( position.x, position.y ) ] ++;
            }
        }

        if ( environment.active )
        {
            this.regrowFoodEnvironment( numType0FoodBits, numType1FoodBits );
            return;
        }

        if ( !LOCAL_PLANT_GROWTH )
        {
            this.regrowFoodClassic( numType0FoodBits, numType1FoodBits );
            return;
        }

        //------------------------------------------------------------------
        // plants reproduce: each living plant may drop a seed nearby.
        // The number of seeds is proportional to the number of plants,
        // and seeds only take root where it is not crowded (see spawnPlant),
        // so plants grow in patches, logistically.
        //------------------------------------------------------------------
        assert( globalTweakers.foodRegenerationPeriod > 0, "GenePool:updateFood:globalTweakers.foodRegenerationPeriod > 0"  );

        let numPlants = numType0FoodBits + numType1FoodBits;
        let expectedSeeds = numPlants * FOOD_SPROUT_RATE / globalTweakers.foodRegenerationPeriod;
        let numSeeds = Math.floor( expectedSeeds );
        if ( gpRandom() < expectedSeeds - numSeeds ) { numSeeds ++; }

        for (let n = 0; n < numSeeds; n++)
        {
            let parent = this.findRandomLivingPlant();
            if ( parent === null ) break;

            this.spawnPlant( parent.getPosition(), parent.getType(), numType0FoodBits, numType1FoodBits, true );
        }

        //------------------------------------------------------------------
        // now and then a seed drifts in from outside, so that plants
        // can never die out completely
        //------------------------------------------------------------------
        if ( gpRandom() < FOOD_RANDOM_SEED_CHANCE )
        {
            _vectorUtility.x = POOL_LEFT + FOOD_BIT_BOUNDARY_MARGIN + gpRandom() * ( POOL_WIDTH  - FOOD_BIT_BOUNDARY_MARGIN * 2 );
            _vectorUtility.y = POOL_TOP  + FOOD_BIT_BOUNDARY_MARGIN + gpRandom() * ( POOL_HEIGHT - FOOD_BIT_BOUNDARY_MARGIN * 2 );

            let type = ( globalTweakers.numFoodTypes === 2 ) ? Math.floor( gpRandom() * 2 ) : 0;
            this.spawnPlant( _vectorUtility, type, numType0FoodBits, numType1FoodBits, false );
        }
    }


    //------------------------------------------------------------------------------
    // spawnPlant: puts a new plant of the given type near (or exactly at) a
    // position, unless the place is crowded, the type is maxed out, or the
    // pool is full. Returns true if a plant was created.
    //------------------------------------------------------------------------------
    this.spawnPlant = function( position, type, numType0, numType1, scatter )
    {
        if ( globalTweakers.numFoodTypes === 2 )
        {
            if (( type === 0 ) && ( numType0 >= MAX_FOODBITS_PER_TYPE )) return false;
            if (( type === 1 ) && ( numType1 >= MAX_FOODBITS_PER_TYPE )) return false;
        }

        let child = this.findLowestDeadFoodBitInArray();
        if ( child === NULL_INDEX ) return false;

        _foodBits[ child ].initialize( child );
        _foodBits[ child ].setType( type );
        _foodBits[ child ].setMaxSpawnRadius( LOCAL_PLANT_SEED_RADIUS );
        _foodBits[ child ].setEnergy( globalTweakers.foodBitEnergy );

        _seedSource.getPosition().set( position );

        if ( scatter )
        {
            // seeds land near the parent; avoid landing behind the obstacle
            for (let attempt = 0; attempt < 10; attempt++)
            {
                _foodBits[ child ].randomizeSpawnPosition( _seedSource );
                if ( !_obstacle.getObstruction( position, _foodBits[ child ].getPosition() ) ) break;
            }
        }
        else
        {
            _foodBits[ child ].setPosition( position );
        }

        //---------------------------------------------
        // crowded? then the seed does not take root
        //---------------------------------------------
        const childPosition = _foodBits[ child ].getPosition();
        _foodX[ child ] = childPosition.x;
        _foodY[ child ] = childPosition.y;
        _foodType[ child ] = type;
        const numInCells = _foodBitGrid.collect( childPosition.x, childPosition.y, FOOD_LOCAL_RADIUS, _foodGridResult );
        let numPlantNeighbors = 0;
        for (let k = 0; k < numInCells; k++)
        {
            const f = _foodGridResult[k];
            if ( f === child ) continue;
            const neighbor = _foodBits[f];
            const p = neighbor.getPosition();
            const dx = p.x - childPosition.x;
            const dy = p.y - childPosition.y;
            if (( dx * dx + dy * dy < FOOD_LOCAL_RADIUS * FOOD_LOCAL_RADIUS ) && neighbor.getAlive() && ( neighbor.getType() !== 2 )) { numPlantNeighbors ++; }
        }

        if ( numPlantNeighbors >= FOOD_LOCAL_CAPACITY )
        {
            _foodBits[ child ].kill();
            return false;
        }

        // put it in the grid right away so the next seed this step sees it
        _foodBitGrid.addExtra( child );

        return true;
    }


    //------------------------------------------------------------------------------
    // the original Gene Pool food regrowth: every "food growth delay" steps one
    // new plant appears near a random living plant of the same type
    //------------------------------------------------------------------------------
    this.regrowFoodClassic = function( numType0FoodBits, numType1FoodBits )
    {
        if ( _clock % globalTweakers.foodRegenerationPeriod != 0 ) return;

        let childFoodBitIndex = this.findLowestDeadFoodBitInArray();
        if ( childFoodBitIndex == NULL_INDEX ) return;

        let newFoodType = 0;
        let parentFoodBitIndex;

        if ( globalTweakers.numFoodTypes === 2 )
        {
            // both types get the same chance to grow, within their limits
            newFoodType = Math.floor( gpRandom() * 2 );
            if      ( numType0FoodBits >= MAX_FOODBITS_PER_TYPE ) { newFoodType = 1; }
            else if ( numType1FoodBits >= MAX_FOODBITS_PER_TYPE ) { newFoodType = 0; }

            parentFoodBitIndex = this.findRandomLivingFoodBit( newFoodType );

            // a type that died out is re-seeded from the other type
            if ( numType0FoodBits === 0 ) { newFoodType = 0; parentFoodBitIndex = this.findRandomLivingFoodBit(1); }
            if ( numType1FoodBits === 0 ) { newFoodType = 1; parentFoodBitIndex = this.findRandomLivingFoodBit(0); }
        }
        else
        {
            parentFoodBitIndex = this.findRandomLivingFoodBit( newFoodType );
        }

        if ( parentFoodBitIndex == NULL_INDEX ) return;

        _foodBits[ childFoodBitIndex ].spawnFromParent( _foodBits[ parentFoodBitIndex ], childFoodBitIndex, newFoodType );

        // keep the new plant out from behind the obstacle
        for (let attempt = 0; attempt < 10; attempt++)
        {
            _foodBits[ childFoodBitIndex ].randomizeSpawnPosition( _foodBits[ parentFoodBitIndex ] );
            if ( !_obstacle.getObstruction( _foodBits[ parentFoodBitIndex ].getPosition(), _foodBits[ childFoodBitIndex ].getPosition() ) ) break;
        }
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
            _foodBits[f].setEnergy( globalTweakers.foodBitEnergy );
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
	this.findLowestDeadFoodBitInArray = function()
	{
        let f = NULL_INDEX;
        let t = NULL_INDEX;

        let looking = true;

        while ( looking )
        {
            t ++;

            if ( t < MAX_FOODBITS )
            {
                if ( ! _foodBits[t].getAlive() )
                {
                    f = t;
                    assert( f < MAX_FOODBITS, "Genepool.js: findLowestDeadFoodBitInArray: f < MAX_FOODBITS" );
                    looking = false;
                }
            }
            else
            {
                looking = false;
            }
         }

        return f;
    }


	//-------------------------------------------------
    this.createNewSwimbotWithGenes = function( genes )
    {
        let index = this.findLowestDeadSwimbotInArray();

        assert( index != NULL_INDEX, "GenePool.createNewSwimbotWithGenes: index != NULL_INDEX" );

        _myGenotype.setGenes( genes );

        let initialAge      = YOUNG_AGE_DURATION;
        let initialAngle    = ZERO;
        let initialEnergy   = DEFAULT_SWIMBOT_HUNGER_THRESHOLD;

        _swimbots[ index ].create( index, initialAge, _camera.getPosition(), initialAngle, initialEnergy, _myGenotype, _embryology );

        //-------------------------------------------------------
        // add the new swimbot to the family tree
        //-------------------------------------------------------
        _familyTree.addNode( index, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes( index ) );


        setSelectedSwimbot( index );
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
            let initialEnergy   = DEFAULT_SWIMBOT_HUNGER_THRESHOLD;

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
	    swimbot.setEnergy( Math.min( swimbot.getMaxEnergy(), swimbot.getEnergy() + 100 ));
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
	this.render = function()
	{
		//----------------------------------------------------------
		// set transform according to camera
		//----------------------------------------------------------
        let nx = _camera.getPosition().x / _camera.getXDimension();
        let ny = _camera.getPosition().y / _camera.getYDimension();

		let xTranslation = ( ONE_HALF - nx ) * _canvasWidth;
		let yTranslation = ( ONE_HALF - ny ) * _canvasHeight;

        let xScale = _canvasWidth  / _camera.getXDimension();
        let yScale = _canvasHeight / _camera.getYDimension();

		_canvas.translate( xTranslation, yTranslation );
        _canvas.scale( xScale, yScale );

		//----------------------------------
		// render the pool
		//----------------------------------
        // zoomed out (many swimbots on screen): bodies and food go to the
        // graphics card; zoomed in: the detailed 2D drawing as before
        const useGraphicsCard = ( _capsuleRenderer !== null ) && ( _levelOfDetail !== SWIMBOT_LEVEL_OF_DETAIL_HIGH );
        if ( useGraphicsCard ) { _capsuleRenderer.begin(); }

        _pool.render( _seconds, _camera );

		//-------------------------
		// render obstacle
		//-------------------------
		_obstacle.render( _camera );

		//-------------------------
		// render food
		//-------------------------
		this.renderFoodBits( useGraphicsCard );

		//----------------------------------
		// render swimbots with batching
		//----------------------------------
        this.renderSwimbotsWithBatching( useGraphicsCard );

        if ( useGraphicsCard )
        {
            _capsuleRenderer.draw
            (
                _camera.getPosition().x - _camera.getXDimension() * ONE_HALF,
                _camera.getPosition().y - _camera.getYDimension() * ONE_HALF,
                _camera.getXDimension(),
                _camera.getYDimension()
            );
        }
        else if ( _capsuleRenderer !== null )
        {
            _capsuleRenderer.clear();
        }

		//-----------------------------------------------------------------------
		// when view is in mutual love mode, show a line between the lovers...
		//-----------------------------------------------------------------------
        if ( _viewTracking.getMode() === ViewTrackingMode.MUTUAL )
        {
            //console.log( "mutual" );
            //console.log( _viewTracking.getLover1Index() + ", " + _viewTracking.getLover2Index() );
            if (( _viewTracking.getLover1Index() != NULL_INDEX )
            &&  ( _viewTracking.getLover2Index() != NULL_INDEX ))
            {
                _canvas.lineCap = "round";
                _canvas.lineWidth = 5;
                _canvas.strokeStyle = "rgba( 200, 200, 200, 0.06 )";
                _canvas.moveTo( _swimbots[ _viewTracking.getLover1Index() ].getGenitalPosition().x, _swimbots[ _viewTracking.getLover1Index() ].getGenitalPosition().y );
                _canvas.lineTo( _swimbots[ _viewTracking.getLover2Index() ].getGenitalPosition().x, _swimbots[ _viewTracking.getLover2Index() ].getGenitalPosition().y );
                _canvas.stroke();

                _canvas.lineWidth = 2;
                _canvas.strokeStyle = "rgba( 255, 255, 200, 0.06 )";
                _canvas.moveTo( _swimbots[ _viewTracking.getLover1Index() ].getGenitalPosition().x, _swimbots[ _viewTracking.getLover1Index() ].getGenitalPosition().y );
                _canvas.lineTo( _swimbots[ _viewTracking.getLover2Index() ].getGenitalPosition().x, _swimbots[ _viewTracking.getLover2Index() ].getGenitalPosition().y );
                _canvas.stroke();
            }
        }

		//---------------------
		// render camera
		//---------------------
		//renderCamera();

		//---------------------
		// reset transform
		//---------------------
        _canvas.resetTransform();

        /*
		//----------------------------------
		// render framerate
		//----------------------------------
        _canvas.font = "14px Arial";
		_canvas.fillStyle = "rgba( 255, 255, 255, 0.5 )";
        _canvas.fillText( "framerate = " + _frameRate.toString(), _canvasWidth - 200, 20 );
        */

		//----------------------------------
		// render view tracking info
		//----------------------------------
		if ( _showViewTrackingMode )
		{
            let viewTrackingMode = _viewTracking.getMode();

            if ( viewTrackingMode != NULL_INDEX )
            {
                let modeString = "(error)";

                     if ( viewTrackingMode === ViewTrackingMode.WHOLE_POOL ) { modeString = "viewing whole pool"         }
                else if ( viewTrackingMode === ViewTrackingMode.AUTOTRACK  ) { modeString = "autotracking group"         }
                else if ( viewTrackingMode === ViewTrackingMode.SELECTED   ) { modeString = "viewing selected swimbot"   }
                else if ( viewTrackingMode === ViewTrackingMode.MUTUAL     ) { modeString = "viewing mutual love"        }
                else if ( viewTrackingMode === ViewTrackingMode.PROLIFIC   ) { modeString = "viewing most prolific"      }
                else if ( viewTrackingMode === ViewTrackingMode.EFFICIENT  ) { modeString = "viewing most efficient"     }
                else if ( viewTrackingMode === ViewTrackingMode.VIRGIN     ) { modeString = "viewing oldest virgin"      }
                else if ( viewTrackingMode === ViewTrackingMode.HUNGRY     ) { modeString = "viewing glutton"            }

                _canvas.font = "14px Arial";
                _canvas.fillStyle = "rgba( 255, 255, 255, 0.5 )";
                _canvas.fillText( modeString, _canvasWidth - 170, _canvasHeight - 30 );
            }
        }

		//---------------------------
		// render touch state
		//---------------------------
		//_touch.render();

		//---------------------------
		// render border
		//---------------------------
        _canvas.lineWidth = 1;
        _canvas.strokeStyle = "rgb( 0, 0, 0 )";
		_canvas.strokeRect( 0, 0, _canvasWidth, _canvasHeight );
		/*
        //_canvas.strokeStyle = "rgb( 220, 230, 240 )";
        _canvas.beginPath();
        _canvas.moveTo( 0, _canvasHeight );
        _canvas.lineTo( _canvasWidth, _canvasHeight );
        _canvas.closePath();
        _canvas.stroke();

        _canvas.beginPath();
        _canvas.moveTo( _canvasWidth, _canvasHeight );
        _canvas.lineTo( _canvasWidth, 0 );
        _canvas.closePath();
        _canvas.stroke();


        _canvas.beginPath();
        _canvas.moveTo( 0, 0 );
        _canvas.lineTo( 0, _canvasHeight );
        _canvas.closePath();
        _canvas.stroke();

        _canvas.beginPath();
        _canvas.moveTo( 0, 0 );
        _canvas.lineTo( _canvasWidth, 0 );
        _canvas.closePath();
        _canvas.stroke();
        */
	}


	/*
	//----------------------------------------
	function renderSwimbotSelectCircle( s, m )
	{
	    let lineWidth = 1.6 + 0.005 * _camera.getScale();
	    let alpha = 0.07;

        if ( m )
        {
    	    alpha = 0.03;
        }

        canvas.lineWidth = lineWidth;
        canvas.strokeStyle = "rgba( 255, 255, 255, " + alpha + " )";
        canvas.beginPath();
        canvas.arc( _swimbots[s].getPosition().x, _swimbots[s].getPosition().y, _swimbots[s].getSelectRadius(), 0, PI2, false );
        canvas.stroke();
        canvas.closePath();

        canvas.lineWidth = lineWidth * 0.4;
        canvas.strokeStyle = "rgba( 255, 255, 255, " + alpha + " )";
        canvas.beginPath();
        canvas.arc( _swimbots[s].getPosition().x, _swimbots[s].getPosition().y, _swimbots[s].getSelectRadius(), 0, PI2, false );
        canvas.stroke();
        canvas.closePath();
	}
	*/


	//----------------------------------------
	function renderSelectCircle( x, y, r, m )
	{
	    let lineWidth = 1.6 + 0.005 * _camera.getScale();
	    let alpha = 0.07;

        if ( m )
        {
    	    alpha = 0.03;
        }

        canvas.lineWidth = lineWidth;
        canvas.strokeStyle = "rgba( 255, 255, 255, " + alpha + " )";
        canvas.beginPath();
        canvas.arc( x, y, r, 0, PI2, false );
        canvas.stroke();
        canvas.closePath();

        canvas.lineWidth = lineWidth * 0.4;
        canvas.strokeStyle = "rgba( 255, 255, 255, " + alpha + " )";
        canvas.beginPath();
        canvas.arc( x, y, r, 0, PI2, false );
        canvas.stroke();
        canvas.closePath();
	}



	//-------------------------------
	function renderCamera()
	{
		_canvas.strokeStyle = "rgb( 255, 255, 255 )";
		_canvas.lineWidth = _camera.getScale() * 0.007;

		let spacing = 15;

		let x = _camera.getPosition().x - _camera.getXDimension() * ONE_HALF;
		let y = _camera.getPosition().y - _camera.getYDimension() * ONE_HALF;
		let w = _camera.getXDimension();
		let h = _camera.getYDimension();

		_canvas.strokeRect( x + spacing * ONE_HALF, y + spacing * ONE_HALF, w - spacing, h - spacing );

		_canvas.fillStyle = "rgb( 255, 255, 255 )";
		_canvas.strokeRect
		(
			_camera.getPosition().x - _camera.getXDimension() * 0.01,
			_camera.getPosition().y - _camera.getYDimension() * 0.01, 0.01, 0.01
		);
    }





	//-------------------------------
this.renderFoodBits = function( useGraphicsCard )
{
        for (let i = 0; i < _aliveFoodBitIndices.length; i++)
        {
            let f = _aliveFoodBitIndices[i];
            if (!_foodBits[f].getAlive()) continue;

            if (_camera.getWithinView(_foodBits[f].getPosition(), FOOD_BIT_GRAB_RADIUS))
            {
                if ( useGraphicsCard ) { _foodBits[f].writeCapsule( _capsuleRenderer, _camera.getScale() ); }
                else                   { _foodBits[f].render( _camera.getScale() ); }

                if (f === _selectedFoodBit)
                {
                    _foodBits[f].renderSelectOutline(_camera.getScale());
                }

                if (f === _mousedOverFoodBit)
                {
                    _foodBits[f].renderMousedOverOutline(_camera.getScale());
                }
            }
        }
}

	//----------------------------------
	// render swimbots with batching
	//----------------------------------
	this.renderSwimbotsWithBatching = function( useGraphicsCard )
	{
    const cameraPos = _camera.getPosition();
    const cameraChanged = !_lastCameraPosition.equals(cameraPos);
    _lastCameraPosition.copyFrom(cameraPos);

    // Reuse existing batch objects
    while (_renderBatch.length > 0) {
        releaseBatchObject(_renderBatch.pop());
    }

    // Add all visible swimbots to the batch using object pooling
    for (let i = 0; i < _aliveSwimbotIndices.length; i++)
    {
        let s = _aliveSwimbotIndices[i];
        if (_swimbots[s].getAlive())
        {
            const position = _swimbots[s].getPosition();
            const boundingRadius = _swimbots[s].getBoundingRadius();

            if (_camera.getWithinView(position, boundingRadius))
            {
                const swimbotPos = _swimbots[s].getPosition();
                const posChanged = !_lastSwimbotPositions[s].equals(swimbotPos);

                // Update cache if needed
                if (cameraChanged || posChanged) {
                    _lastSwimbotPositions[s].copyFrom(swimbotPos);
                    // Calculate and cache squared distance to avoid sqrt
                    _distanceCache[s] = swimbotPos.getDistanceSquaredTo(cameraPos);
                }

                const batchObj = getBatchObject();
                batchObj.swimbot = _swimbots[s];
                batchObj.isSelected = (s === _selectedSwimbot);
                batchObj.isMousedOver = (s === _mousedOverSwimbot);
                batchObj.distance = _distanceCache[s];

                _renderBatch.push(batchObj);
            }
        }
    }

    // Если требуется сортировка (раскомментировать при необходимости)
    // _renderBatch.sort((a, b) => a.distance - b.distance);

    // Render all swimbots in the batch
    for (let i = 0; i < _renderBatch.length; i++)
    {
        const batchItem = _renderBatch[i];
        const swimbot = batchItem.swimbot;

	        if ( useGraphicsCard ) { swimbot.writeCapsules( _capsuleRenderer, _levelOfDetail === SWIMBOT_LEVEL_OF_DETAIL_DOT ); }
	        else                   { swimbot.render(_levelOfDetail); }

	        if (batchItem.isSelected || batchItem.isMousedOver)
	        {
	            if (batchItem.isSelected)
	            {
	                renderSelectCircle(swimbot.getPosition().x, swimbot.getPosition().y, swimbot.getSelectRadius(), false);
	            }
	            else
	            {
	                renderSelectCircle(swimbot.getPosition().x, swimbot.getPosition().y, swimbot.getSelectRadius(), true);
	            }

	            swimbot.setRenderingGoals(true);

	            if (DEBUG_SHOW_SWIMBOT_TRAIL)
	            {
	                this.showSwimbotTrail(swimbot.getIndex());
	            }
	        }
	        else
	        {
	            if (_renderingGoals)
	            {
	                swimbot.setRenderingGoals(true);
	            }
	        }
	    }
	}

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
	    let num = 0;
	    for (let f=0; f<MAX_FOODBITS; f++)
	    {
	        if ( _foodBits[f].getAlive() && ( _foodBits[f].getType() === type )) { num ++; }
	    }
	    return num;
	}

	this.getNumFoodBits = function()
	{
        let num = 0;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            if ( _foodBits[f].getAlive() )
            {
                if ( globalTweakers.numFoodTypes === 2  )
                {
                    if ( _foodBits[f].getType() === 0 )
                    {
                        num ++;
                    }
                }
                else
                {
                    num ++;
                }
            }
        }

        /*
        if ( globalTweakers.numFoodTypes === 2  )
        {
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
        }
        else
        {
            for (let f=0; f<MAX_FOODBITS; f++)
            {
                if ( _foodBits[f].getAlive() )
                {
                    num ++;
                }
            }
        }
        */

	    return num;
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
        let num = 0;

        for (let f=0; f<MAX_FOODBITS; f++)
        {
            if ( _foodBits[f].getAlive() )
            {
                if ( _foodBits[f].getType() === 1 )
                {
                    num ++;
                }
            }
        }

	    return num;
	}

	//------------------------------
	this.getNumSwimbots = function()
	{
        let num = 0;

        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            if ( _swimbots[s].getAlive() )
            {
                num ++;
            }
        }

	    return num;
	}


	//----------------------------
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
            "renderingGoals"            : _renderingGoals,
            "obstacleEnd1X"             : _obstacle.getEnd1Position().x,
            "obstacleEnd1Y"             : _obstacle.getEnd1Position().y,
            "obstacleEnd2X"             : _obstacle.getEnd2Position().x,
            "obstacleEnd2Y"             : _obstacle.getEnd2Position().y,
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
    resetSimulationCounters();

    // --- helper to create swimbot with predator gene ---
    const setPredatorGene = function(genotype, value255) {
        setTrait(genotype, GENES_PREDATOR, Math.floor(value255) / 255);
    };

    const createSwimbotWithPredatorGene = function(index, predatorGeneValue255, posOffsetX) {
        _myGenotype.randomize();

        // clear junk dna
        for (let g = NUM_GENES_USED; g < NUM_GENES; g++) {
            _myGenotype.setGeneValue(g, 0);
        }

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



