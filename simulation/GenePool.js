 "use strict";
const SimulationStartMode = 
{
    RANDOM       : 0,
    FROGGIES     : 1,
    TANGO        : 2,
    RACE         : 3,
    NEIGHBORHOOD : 4,
    BIG_BANG     : 5,
    BAD_PARENTS  : 6,
    BARRIER      : 7,
    EMPTY        : 8,
    FILE         : 9,
    SPECIES      : 10
};

const CameraNavigationAction = 
{
    LEFT    : 0,
    RIGHT   : 1,
    UP      : 2,
    DOWN    : 3,
    IN      : 4,
    OUT     : 5
}





//---------------------------------------------------------------
// The following code is incomplete - it's purpose is to allow 
// pseudorandom number generation with seeds. 
//---------------------------------------------------------------
//var usingPseudoRandom = false;
//var pseudoRandomSeed = "defaultSeed";
function gpRandom()
{
    //if ( usingPseudoRandom )
    {
        /* ------------------  aleaPRNG 1.1  ------------------
        Copyright (c) 2017-2020, W. "Mac" McMeans
        LICENSE: BSD 3-Clause License
        https://github.com/macmcmeans/aleaPRNG/blob/master/aleaPRNG-1.1.min.js
        Use this to quickly generate random numbers with good statistical properties.

        Return a 32-bit fraction in the range [0, 1] just like Math.random()
        > gpRandom();  -->  0.30802189325913787
 
        // advance the generator specified number of cycles
        > myRandomNumbers.prng( 4 );

        Want to 'rewind' back to the initial sequence?
        > gpRandom.restart();
        -------------------------------------------------------*/

        /****************************************************************************
         *** THREE DIFFERENT WAYS TO INITIALIZE THE RANDOM NUMBER GENERATOR:      ***
         *** 1. gpRandom = aleaPRNG(); --> for an unpredictable start             ***
         *** 2. gpRandom = aleaPRNG('some seed'); --> for a predictable start     ***
         *** 3. function gpRandom() { return(Math.random()); } --> bypass PRNG    ***
         *** ************************************************************************/

        //function aleaPRNG(){return function(n){"use strict";var r,t,e,o,a,u=new Uint32Array(3),i="";function c(n){var a=function(){var n=4022871197,r=function(r){r=r.toString();for(var t=0,e=r.length;t<e;t++){var o=.02519603282416938*(n+=r.charCodeAt(t));o-=n=o>>>0,n=(o*=n)>>>0,n+=4294967296*(o-=n)}return 2.3283064365386963e-10*(n>>>0)};return r.version="Mash 0.9",r}();r=a(" "),t=a(" "),e=a(" "),o=1;for(var u=0;u<n.length;u++)(r-=a(n[u]))<0&&(r+=1),(t-=a(n[u]))<0&&(t+=1),(e-=a(n[u]))<0&&(e+=1);i=a.version,a=null}function f(n){return parseInt(n,10)===n}var l=function(){var n=2091639*r+2.3283064365386963e-10*o;return r=t,t=e,e=n-(o=0|n)};return l.fract53=function(){return l()+1.1102230246251565e-16*(2097152*l()|0)},l.int32=function(){return 4294967296*l()},l.cycle=function(n){(n=void 0===n?1:+n)<1&&(n=1);for(var r=0;r<n;r++)l()},l.range=function(){var n,r;return 1===arguments.length?(n=0,r=arguments[0]):(n=arguments[0],r=arguments[1]),arguments[0]>arguments[1]&&(n=arguments[1],r=arguments[0]),f(n)&&f(r)?Math.floor(l()*(r-n+1))+n:l()*(r-n)+n},l.restart=function(){c(a)},l.seed=function(){c(Array.prototype.slice.call(arguments))},l.version=function(){return"aleaPRNG 1.1.0"},l.versions=function(){return"aleaPRNG 1.1.0, "+i},0===n.length&&(window.crypto.getRandomValues(u),n=[u[0],u[1],u[2]]),a=n,c(n),l}(Array.prototype.slice.call(arguments))}
         
        //return aleaPRNG( pseudoRandomSeed );
    }
    
    // default...
    return Math.random();
}




// this needs to be the same as the corresponding value in Embryology.js !!!!
const NUM_GENES_USED = 113;
const HUNGER_THRESHOLD_GENE_INDEX = 113;  // новый ген для порога голода
//---------------------------------------------------------------
// The global tweakers are all adjustable through the UI.
//---------------------------------------------------------------
var globalTweakers = new GlobalTweakers();
var _numDeadSwimbots = 0;
var _attackCount = 0;


//------------------
function GenePool() 
{	
    let _this = this;

    function scheduleNextUpdate()
    {
        _this.timer = setTimeout(function() { _this.update(); }, _millisecondsPerUpdate);
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
	let _swimbots 		        = new Array( Swimbot ); 
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

    // Performance optimization variables
    let _spatialGrid = new SpatialGrid(200); // Spatial grid for collision detection
    let _renderBatch = []; // Batch rendering array
    let _foodBitSpatialGrid = new SpatialGrid(150); // Separate grid for food bits
    let _batchObjectPool = [];
    let _distanceCache = new Array(MAX_SWIMBOTS);
    let _lastSwimbotPositions = new Array(MAX_SWIMBOTS);
    let _aliveSwimbotIndices = [];
    let _aliveFoodBitIndices = [];
    let _swimbotWasAlive = new Array(MAX_SWIMBOTS);
    let _foodBitWasAlive = new Array(MAX_FOODBITS);
    let _lastCameraPosition = new Vector2D();
    _lastCameraPosition.setXY(0, 0);
    
    let hhh = 0;	
	
	//-------------------------------------
	// create fixed-sized swimbot array
	//-------------------------------------
	for (let s=0; s<MAX_SWIMBOTS; s++)
	{
		_swimbots[s] = new Swimbot(); 
		_swimbots[s].setParent(this);
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
    let _candidateSwimbots  = new Array(MAX_SWIMBOTS);
    let _candidateDistances = new Float64Array(MAX_SWIMBOTS);

    function sortCandidatesByDistance(count)
    {
        // insertion sort: lists are short (tens of swimbots)
        for (let i = 1; i < count; i++)
        {
            const bot = _candidateSwimbots[i];
            const d   = _candidateDistances[i];
            let j = i - 1;
            while (j >= 0 && _candidateDistances[j] > d)
            {
                _candidateSwimbots [j + 1] = _candidateSwimbots [j];
                _candidateDistances[j + 1] = _candidateDistances[j];
                j--;
            }
            _candidateSwimbots [j + 1] = bot;
            _candidateDistances[j + 1] = d;
        }
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
        _foodBitWasAlive[f] = false;
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
		scheduleNextUpdate();
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

        _spatialGrid.clear();
        _foodBitSpatialGrid.clear();
        for (let s=0; s<MAX_SWIMBOTS; s++)
        {
            _swimbotWasAlive[s] = false;
        }
        for (let f=0; f<MAX_FOODBITS; f++)
        {
            _foodBitWasAlive[f] = false;
        }
        
        //-------------------------------------------------------------------
        // Here I set ecosystem tweak values to their defaults. Some of 
        // them may be changed afterwards depending on the simulation mode.
        //-------------------------------------------------------------------
        this.setFoodGrowthDelay     ( DEFAULT_FOOD_REGENERATION_PERIOD  );
        this.setFoodSpread          ( DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS );
        this.setFoodBitEnergy       ( DEFAULT_FOOD_BIT_ENERGY           );
        this.setHungerThreshold     ( DEFAULT_SWIMBOT_HUNGER_THRESHOLD  );
        this.setAttraction          ( ATTRACTION_SIMILAR_COLOR          );
        this.setGardenOfEdenRadius  ( DEFAULT_GARDEN_OF_EDEN_RADIUS     );
        this.setOffspringEnergyRatio( DEFAULT_CHILD_ENERGY_RATIO        );
        this.setMaximumSwimbotAge   ( DEFAULT_MAXIMUM_AGE               );
        
        // do this stuff after doing the stuff above:
        _numSwimbots = INITIAL_NUM_SWIMBOTS;
        _numFoodBits = INITIAL_NUM_FOODBITS;

        //-----------------------------------
        // default
        //-----------------------------------
        globalTweakers.numFoodTypes = 1;
        this.randomizeFood();
        
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
            _familyTree.addNode( i, NULL_INDEX, NULL_INDEX, _clock, this.getSwimbotGenes(i) );
        }	
        
        //--------------------------------------
        // initilize obstacle       
        //--------------------------------------  
		let end1 = new Vector2D();
		let end2 = new Vector2D();
		
		end1.setXY( POOL_LEFT + POOL_WIDTH * 0.005, POOL_TOP + POOL_HEIGHT * 0.005 );
		end2.setXY( POOL_LEFT + POOL_WIDTH * 0.01,  POOL_TOP + POOL_HEIGHT * 0.005 );

        if ( mode === SimulationStartMode.BARRIER )
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
	}
	
	

	//----------------------------------------
	this.setGardenOfEdenRadius = function(r)
	{
	    _gardenOfEdenRadius = r;
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
}

    // -------------------------------------------------------------
    // Predation overflow support: spawn extra red meat foodbits
    // -------------------------------------------------------------
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
                //--------------------
                // advance clock...
                //--------------------
                _clock ++;

                //----------------------
                // update swimbots...
                //----------------------
                this.updateSwimbots();

                //------------------
                // update food
                //------------------
                this.updateFood();
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



	//--------------------------------
	this.updateSwimbots = function()
	{		
        rebuildAliveIndexCaches();

	    // Incremental swimbot grid sync: remove dead, update living
	    for (let s = 0; s < MAX_SWIMBOTS; s++)
	    {
            if (_swimbotWasAlive[s] && !_swimbots[s].getAlive())
            {
                // Запомнить позицию трупа ДО удаления из грида
                let deadPosition = _swimbots[s].getPosition();

                _spatialGrid.removeObject(_swimbots[s]);
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
	    for (let i = 0; i < _aliveSwimbotIndices.length; i++)
	    {
            let s = _aliveSwimbotIndices[i];
	        _spatialGrid.addObject(_swimbots[s]);
            _swimbotWasAlive[s] = true;
	    }

	    // Incremental food grid sync: remove dead, update living
	    for (let f = 0; f < MAX_FOODBITS; f++)
	    {
            if (_foodBitWasAlive[f] && !_foodBits[f].getAlive())
            {
                _foodBitSpatialGrid.removeObject(_foodBits[f]);
                _foodBitWasAlive[f] = false;
            }
	    }
	    for (let i = 0; i < _aliveFoodBitIndices.length; i++)
	    {
            let f = _aliveFoodBitIndices[i];
	        _foodBitSpatialGrid.addObject(_foodBits[f]);
            _foodBitWasAlive[f] = true;
	    }

        for (let i = 0; i < _aliveSwimbotIndices.length; i++)
        {
            let s = _aliveSwimbotIndices[i];
            if ( _swimbots[s].getAlive() )
            {
                        
            
            
                _swimbots[s].update();
                
                //-----------------------------------------------------------------
                // provide aspects of the environment for the swimbot to perceive
                //-----------------------------------------------------------------
                if ( _swimbots[s].getIsLookingForSensoryInput() )
                {
                    this.giveSwimbotNearbyEnvironmentalStimuli(s);
                }

                // Не сбрасываем _tryingToHunt принудительно.
                // Это ломало/теряло попытки укуса при некоторых состояниях мозга.


                //--------------------------------------------------------------------------------------------------------
                // check for obstacle collision....
                //--------------------------------------------------------------------------------------------------------
                if ( _obstacle.getCollision( _swimbots[s].getPosition(), _swimbots[s].getBoundingRadius() * ONE_HALF ) )
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
                    let eatenFoodBit = _swimbots[s].eatChosenFoodBit();
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

                        if ( _potentialMate.getAlive() )
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
 
                                //--------------------------------------------------
                                // add the new swimbot to the family tree
                                //--------------------------------------------------
                                _familyTree.addNode( newBornSwimbotIndex, s, chosenMateIndex, _clock, this.getSwimbotGenes( newBornSwimbotIndex ) );

                            }// if ( getJunkDnaDistance( _myGenotype, _mateGenotype ) > NON_REPRODUCING_JUNK_DNA_LIMIT )
                            else 
                            {
                                //console.log( "reproduction not possible because junk dna is too dissimilar!" );
                            }
                        }   //  if ( _potentialMate.getAlive() )                     
                    }      //   if (( newBornSwimbotIndex != -1 ) &&  ( swimbot[s].getChosenMateIndex() != -1 ))
                }         //    if ( swimbot[s].isTryingToMate() )
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

        let looking = true;
        while ( looking )
        {
            t++;

            if ( ! _swimbots[t].getAlive() )
            {
                s = t;
                assert( s < MAX_SWIMBOTS, "s < MAX_SWIMBOTS" );
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

        // const myMass            = me.getPhenotypeMass();



	    //------------------------------------------------------
	    // collect the array of nearby visible swimbots...
	    //------------------------------------------------------
        _numNearbySwimbots = 0;

        // Use spatial grid for optimized nearby swimbot search
        const nearbySwimbots = _spatialGrid.getNearbyObjects(me, (predatorLevel > PREDATOR_LEVEL_THRESHOLD) ? preyViewRadius : viewRadius);


        //------------------------------------------------------------------
        // the brain perceives the NEAREST swimbots within normal view
        // (the grid returns them in cell order, so sort by distance first)
        //------------------------------------------------------------------
        let numCandidates = 0;

        for (let i = 0; i < nearbySwimbots.length; i++)
        {
            const other = nearbySwimbots[i];

            if ((other.getIndex() != s) && other.getAlive())
            {
                const distanceSquared = myGenitalPosition.getDistanceSquaredTo(other.getGenitalPosition());

                if (distanceSquared < viewRadiusSquared)
                {
                    _candidateSwimbots [numCandidates] = other;
                    _candidateDistances[numCandidates] = distanceSquared;
                    numCandidates++;
                }
            }
        }

        if (numCandidates > BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS)
        {
            sortCandidatesByDistance(numCandidates);
        }

        for (let i = 0; i < numCandidates && _numNearbySwimbots < BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS; i++)
        {
            const other = _candidateSwimbots[i];

            if (!_obstacle.getObstruction(myGenitalPosition, other.getGenitalPosition()))
            {
                _nearbySwimbotsArray[_numNearbySwimbots] = other;
                _numNearbySwimbots++;
            }
        }

        //------------------------------------------------------
        // find the closest food bit using spatial grid
        //------------------------------------------------------
        let foundFoodBit = false;
        let smallestDistanceSquared = Number.MAX_SAFE_INTEGER;

        // Use food bit spatial grid for optimized search
        const nearbyFoodBits = _foodBitSpatialGrid.getNearbyObjects(me, viewRadius);

        for (let i = 0; i < nearbyFoodBits.length; i++)
        {
            const foodBit = nearbyFoodBits[i];
            let okay = true;

            // Check food type compatibility
            // Type 2 (meat) must be eaten only by predators, independent of numFoodTypes
            if (foodBit.getType() === 2)
            {
                // Meat (type 2): eat only by predators
                if (predatorLevel <= PREDATOR_LEVEL_THRESHOLD) okay = false;
            }
            else if (predatorLevel > PREDATOR_LEVEL_THRESHOLD)
            {
                // Predators don't eat plants
                okay = false;
            }
            else if (globalTweakers.numFoodTypes === 2)
            {
                if (foodBit.getType() != preferredFoodType)
                {
                    okay = false;
                }
            }

            if (okay && foodBit.getAlive())
            {
                const foodPosition = foodBit.getPosition();
                let viewDistanceSquared = myMouthPosition.getDistanceSquaredTo(foodPosition);

                if (viewDistanceSquared < viewRadiusSquared)
                {
                    if (viewDistanceSquared < smallestDistanceSquared)
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
            for (let i = 0; i < nearbySwimbots.length; i++) {
                let candidate = nearbySwimbots[i];
                if (!candidate.getAlive()) continue;

                // Охотиться только на травоядных (хищники на хищников не нападают)
                // Порог совпадает с порогом окраски в чёрный (Embryology.js, predatorLevel > 0.6),
                // иначе боты с predatorLevel 0.5-0.6 визуально выглядят добычей,
                // но хищники их игнорируют как "своих"
                if (candidate.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD) continue;

                // Бессмертных не едят
                if (candidate.isEternal()) continue;


                let distance = myMouthPosition.getDistanceTo(candidate.getPosition());

                if (distance > preyViewRadius) continue;

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
                if (!candidate.getAlive()) continue;
                if (candidate.getPredatorLevel() <= PREDATOR_LEVEL_THRESHOLD) continue;

                let distance = myGenitalPosition.getDistanceTo(candidate.getGenitalPosition());
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
        
        //-------------------------------------
        // general update for all food bits
        //-------------------------------------
        for (let i = 0; i < _aliveFoodBitIndices.length; i++)
        {
            let f = _aliveFoodBitIndices[i];
            if (!_foodBits[f].getAlive()) continue;

            _foodBits[f].update();
            if ( globalTweakers.numFoodTypes === 2 )
            {
                //-----------------------------------------------------------------------
                // calculate num foodbits of both types...
                //-----------------------------------------------------------------------
                if ( _foodBits[f].getType() === 0 ) { numType0FoodBits ++; }
                else if ( _foodBits[f].getType() === 1 ) { numType1FoodBits ++; }
               
                assert( ( ( _foodBits[f].getType() === 0 ) || ( _foodBits[f].getType() === 1 ) || ( _foodBits[f].getType() === 2 ) ), "genepool.updateFood: _foodBits[f].getType() invalid!" );
                   
                assert( numType0FoodBits <= MAX_FOODBITS_PER_TYPE, "this.updateFood: numType0FoodBits > MAX_FOODBITS_PER_TYPE" );
                assert( numType1FoodBits <= MAX_FOODBITS_PER_TYPE, "this.updateFood: numType1FoodBits > MAX_FOODBITS_PER_TYPE" );
            }
        }
        
        
        //-------------------------------------
        // periodically regenerate food
        //-------------------------------------
        assert( globalTweakers.foodRegenerationPeriod > 0, "GenePool:updateFood:globalTweakers.foodRegenerationPeriod > 0"  );
        
        if ( _clock % globalTweakers.foodRegenerationPeriod == 0 )
        {
            let childFoodBitIndex = this.findLowestDeadFoodBitInArray();
        
            //console.log( "time to spawn a new food bit" );
                    
            if ( childFoodBitIndex != NULL_INDEX )
            {            
                assert( ! _foodBits[ childFoodBitIndex ].getAlive(), "GenePool:updateFood: ! _foodBits[ childFoodBit ].getAlive" );

                //console.log( "I found a dead food bit to reincarnate, with ID " + childFoodBitIndex );

                let newFoodType = 0;
                let parentFoodBitIndex = this.findRandomLivingFoodBit( newFoodType ); 

                //-------------------------------------------------------------------------------------------------------
                // If we are using two types of food bits, then we need to do some housekeeping to make sure that 
                // neither type exceeds max population and also that there is always at least one bit of each type  
                //-------------------------------------------------------------------------------------------------------
                if ( globalTweakers.numFoodTypes === 2  )
                {
                    //------------------------------------------------------
                    // randomize the new food bit type, so that both
                    // food types have a chance to grow at the same rate.
                    //------------------------------------------------------
                    newFoodType = Math.floor( gpRandom() * 2 );

                    //-------------------------------------------------------------------------------------
                    // make sure the number of food bits of both types do not exceed the maximum limit...
                    //-------------------------------------------------------------------------------------
                    /*
                    assert
                    ( 
                         ( ( numType0FoodBits < MAX_FOODBITS_PER_TYPE ) || ( numType1FoodBits < MAX_FOODBITS_PER_TYPE ) ),
                        "( ( numType0FoodBits < MAX_FOODBITS_PER_TYPE ) || ( numType1FoodBits < MAX_FOODBITS_PER_TYPE ) )"
                    );         
                    */
                                                   
                    if ( numType0FoodBits === MAX_FOODBITS_PER_TYPE )
                    {
                        newFoodType = 1;
                    }
                    else if ( numType1FoodBits === MAX_FOODBITS_PER_TYPE )
                    {
                        newFoodType = 0;
                    }

                    parentFoodBitIndex = this.findRandomLivingFoodBit( newFoodType ); 
                    
                    //-------------------------------------------------------------------
                    // If there are no more food bits left of a particular type, then
                    // I will force the child to have that type, and I will choose
                    // one of the existing food bits of the other type as its parent.
                    //-------------------------------------------------------------------
                    if ( numType0FoodBits === 0 ) 
                    { 
                        newFoodType = 0;
                        parentFoodBitIndex = this.findRandomLivingFoodBit(1); 
                    }

                    if ( numType1FoodBits === 0 ) 
                    { 
                        newFoodType = 1;
                        parentFoodBitIndex = this.findRandomLivingFoodBit(0); 
                    }                    
                }
                else
                {
                    assert( numType1FoodBits === 0, "genepool.js:updateFood: numType1FoodBits === 0" );
                }
                
                if ( parentFoodBitIndex != NULL_INDEX )
                {
                    //console.log( "I found a living food bit with ID " + parentFoodBitIndex + " of type " + newFoodType + " to be the parent." );
                    assert( ! _foodBits[ childFoodBitIndex ].getAlive(), "GenePool:updateFood: ! _foodBits[ childFoodBit ].getAlive" );
                    assert( childFoodBitIndex != _foodBits[ parentFoodBitIndex ].getIndex(), "genepool.js: updateFood: childFoodBitIndex != _foodBits[ parentFoodBitIndex ].getIndex()" );
                
                    //----------------------------------------------------------------
                    // spawn the child in a position relative to parent...
                    //----------------------------------------------------------------
                    _foodBits[ childFoodBitIndex ].spawnFromParent( _foodBits[ parentFoodBitIndex ], childFoodBitIndex, newFoodType );

                    //-------------------------------------------------------------------
                    // make sure the new food bit position is not obscured by
                    // the obstacle. If it is, keep trying new spawn positions...
                    //-------------------------------------------------------------------
                    let looking = true;
                    let num = 0;
                    while ( looking )                    
                    {                        
                        //----------------------------------------------------------------
                        // spawn the child to new position relative to parent...
                        //----------------------------------------------------------------
                        _foodBits[ childFoodBitIndex ].randomizeSpawnPosition( _foodBits[ parentFoodBitIndex ] );

                        if ( !_obstacle.getObstruction( _foodBits[ parentFoodBitIndex ].getPosition(), _foodBits[ childFoodBitIndex ].getPosition() ) )
                        {
                            looking = false;
                        }
                    
                        num ++;
                        if ( num > 10 )
                        {
                            looking = false;
                        }                        
                    }
                }
            }
        }        
        
        
        
        
        
        
        
        
        
        
        
        
        /*
        if ( globalTweakers.numFoodTypes === 2  )
        { 
            if ( _clock %100 === 0 )
            {
                // debug: food type population counts
            }
            
            //------------------------------------------------------------------------
            // if there are no more food bits left of either type, then
            // create a new food bit of that type in a random location
            //------------------------------------------------------------------------
            if ( numType0FoodBits === 0 ) 
            { 
                // debug: force spawn food type 0
                let f = this.findLowestDeadFoodBitInArray();
                if ( f != NULL_INDEX )
                {
                    _vectorUtility.x = POOL_LEFT + POOL_WIDTH  * gpRandom();
                    _vectorUtility.y = POOL_TOP  + POOL_HEIGHT * gpRandom();
                    _foodBits[f].initialize(f); 
                    _foodBits[f].setType(0); 
                    _foodBits[f].setPosition( _vectorUtility ); 
                    _numFoodBits ++; 
                }
            }

            if ( numType1FoodBits === 0 ) 
            { 
                // debug: force spawn food type 1
                let f = this.findLowestDeadFoodBitInArray();
                if ( f != NULL_INDEX )
                {
                    _vectorUtility.x = POOL_LEFT + POOL_WIDTH  * gpRandom();
                    _vectorUtility.y = POOL_TOP  + POOL_HEIGHT * gpRandom();
                    _foodBits[f].initialize(f); 
                    _foodBits[f].setType(1); 
                    _foodBits[f].setPosition( _vectorUtility ); 
                    _numFoodBits ++; 
                }
            }        
        }
        
        	    
        //-------------------------------------
        // periodically regenerate food
        //-------------------------------------
        assert( globalTweakers.foodRegenerationPeriod > 0, "GenePool:updateFood:globalTweakers.foodRegenerationPeriod > 0"  );
        
        if ( _clock % globalTweakers.foodRegenerationPeriod == 0 )
        {
            let childFoodBitIndex = this.findLowestDeadFoodBitInArray();
            
            if ( childFoodBitIndex != NULL_INDEX )
            {
                assert( ! _foodBits[ childFoodBitIndex ].getAlive(), "GenePool:updateFood: ! _foodBits[ childFoodBit ].getAlive" );

                //let parentFoodType = 0;
                let childFoodType = 0;
                let numFoodBitsOfChildType = numType0FoodBits;
                
                //This is not working correctly yet:
                //------------------------------------------------------------------------------------------------------
                // Subtle: if the number of food bits of the parent type is maxed-out, and also...
                // if the number of foodbits of the child type is maxed-out, then the parent cannot spawn.  
                //------------------------------------------------------------------------------------------------------
                let okay = true;



                
if ( globalTweakers.numFoodTypes === 2 )
{ 
    //-------------------------------------------------------
    // 50% chance of being born with the other food type...
    //-------------------------------------------------------
    if ( gpRandom() > ONE_HALF ) 
    {
        childFoodType = 1;
        numFoodBitsOfChildType  = numType1FoodBits;
    }

    //let childFoodType = parentFoodType;

    //let numFoodBitsOfParentType = numType0FoodBits;         

    //if ( parentFoodType === 1 ) { numFoodBitsOfParentType = numType1FoodBits; }
    //if ( childFoodType === 1 ) { ; }

    //assert( numFoodBitsOfParentType < MAX_FOODBITS_PER_TYPE, "GenePool.js:updateFood: numFoodBitsOfParentType < MAX_FOODBITS_PER_TYPE" );
    //assert( numFoodBitsOfChildType < MAX_FOODBITS_PER_TYPE, "GenePool.js:updateFood: numFoodBitsOfChildType  < MAX_FOODBITS_PER_TYPE" );

    if ( numFoodBitsOfChildType < MAX_FOODBITS_PER_TYPE )
    {
        okay = true;
    }
    else
    {
        okay = false;
    }
}





                if ( okay )
                {
                    let parentFoodBitIndex = this.findRandomLivingFoodBit( childFoodType );
                    //console.log( "parentFoodBitIndex parentFoodType = " + _foodBits[ parentFoodBitIndex ].getType() );

                    if ( parentFoodBitIndex != NULL_INDEX )
                    {
                        //console.log( parentFoodBitIndex );

                        assert( childFoodBitIndex != _foodBits[ parentFoodBitIndex ].getIndex(), "genepool.js: updateFood: childFoodBitIndex != _foodBits[ parentFoodBitIndex ].getIndex()" );
                    
                        //-------------------------------------------------------------------
                        // make sure the new food bit position is not obscured by
                        // the obstacle. If it is, keep trying new spawn positions...
                        //-------------------------------------------------------------------
                        let looking = true;
                        let num = 0;
                        while ( looking )                    
                        {                        
                            //----------------------------------------------------------------
                            // spawn the child to new position relative to parent...
                            //----------------------------------------------------------------
                            _foodBits[ childFoodBitIndex ].setSpawnPositionRelativeToParent( _foodBits[ parentFoodBitIndex ], childFoodBitIndex, childFoodType );

                            if ( !_obstacle.getObstruction( _foodBits[ parentFoodBitIndex ].getPosition(), _foodBits[ childFoodBitIndex ].getPosition() ) )
                            {
                                looking = false;
                            }
                        
                            num ++;
                            if ( num > 10 )
                            {
                                looking = false;
                            }                        
                        }
                    }
                }
            }
        }
            
            */
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
            
            _foodBits[ id ].initialize();
                
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
            loadedGenotype.setGenes( data.swimbotArray[s].genes );
            
            //this seems to be glitched - I must explore why
            //console.log( "s = " + s + "; id = " + id );            
            //assert( id === s, "GenePool.js: this.setPoolData: assert: id === s" );

            _swimbots[ id ].create
            ( 
                s,
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
        
		//---------------------------------
		// set clock to 0
		//---------------------------------
		_clock = 0;
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
        if ( _panningLeft  ) {  _camera.panLeft (); }	
        if ( _panningRight ) {  _camera.panRight(); }	
        if ( _panningUp    ) {  _camera.panUp   (); }	
        if ( _panningDown  ) {  _camera.panDown (); }	
        if ( _zoomingIn    ) {  _camera.zoomIn  (); }	
        if ( _zoomingOut   ) {  _camera.zoomOut (); }	
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

        if ( _fastMode )
        {
            _savedRenderingGoals = _renderingGoals;
            this.setRenderingGoals( false );
        }
        else
        {
            this.setRenderingGoals( _savedRenderingGoals );
        }
    }
    
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
        _pool.render( _seconds, _camera );
        
		//-------------------------
		// render obstacle
		//-------------------------
		_obstacle.render( _camera );

		//-------------------------
		// render food
		//-------------------------
		this.renderFoodBits();

		//----------------------------------
		// render swimbots with batching
		//----------------------------------
        this.renderSwimbotsWithBatching();

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
this.renderFoodBits = function()
{
        for (let i = 0; i < _aliveFoodBitIndices.length; i++)
        {
            let f = _aliveFoodBitIndices[i];
            if (!_foodBits[f].getAlive()) continue;

            if (_camera.getWithinView(_foodBits[f].getPosition(), FOOD_BIT_GRAB_RADIUS))
            {
                _foodBits[f].render(_camera.getScale());

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
	this.renderSwimbotsWithBatching = function()
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

	        swimbot.render(_levelOfDetail);

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
    this.getNumDeadSwimbots     = function() { return _numDeadSwimbots;         }   
    
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
            "obstacleEnd2Y"             : _obstacle.getEnd2Position().y
        }
        
        return poolData;
    }

    
	//------------------------------------
	this.getSwimbotGenes = function( ID )
	{		
        let genotype = _swimbots[ ID ].getGenotype();
        return genotype.getGenes();
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
    _numDeadSwimbots = 0;
    _attackCount = 0;

    // --- helper to create swimbot with predator gene ---
    const setPredatorGene = function(genotype, value255) {
        genotype.setGeneValue(51, Math.floor(value255));
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
                `[testPredation] tick=${t} predators=${stats.alivePred} herbivores=${stats.aliveHerb} avgEnergy=${stats.avgEnergy.toFixed(4)} attacks=${_attackCount}`
            );
        }
    }

    const finalStats = computeCountsAndAvgEnergy();
    const predatorsSurvived = finalStats.alivePred > 0;
    const herbivoresSurvived = finalStats.aliveHerb > 0;

    console.log(
        `[testPredation] FINAL predatorsAlive=${finalStats.alivePred} herbivoresAlive=${finalStats.aliveHerb} attacksTotal=${_attackCount}`
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
        attacksTotal: _attackCount
    };
};




// } // ← конец GenePool()
}



