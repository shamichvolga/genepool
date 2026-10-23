import { simClock, gpRandom } from "./Globals";
import { NULL_INDEX, ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { plantSize } from "./PlantSize";
import { MEAT_PIECE_ENERGY, PLANT_SIZE_ENABLED, PLANT_TREE_ENERGY, PLANT_EVOLUTION_ENABLED, PLANT_STAGES_ENABLED, PLANT_STAGES_SHOWN, SPAWN_FOOD_RANDOMLY_IN_POOL } from "./Parameters";
import { plantGrowthOf, plantSpreadOf, plantSproutGrowth, plantStage, randomizePlantGenes } from "./PlantGenes";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { assert } from "./Utility";
import { SplitVector2D, Vector2D } from "./Vector2D";

export const FOOD_BIT_SIZE                     = 1.5; //default size
export const MIN_FOOD_BIT_MAX_SPAWN_RADIUS     = 10;
export const MAX_FOOD_BIT_MAX_SPAWN_RADIUS     = 4000.0;
export const DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS = 4000.0; //max distance for spawned child
export const MIN_FOOD_BIT_ENERGY               = 0.0;
export const MAX_FOOD_BIT_ENERGY               = 100.0;
export const DEFAULT_FOOD_BIT_ENERGY           = 50.0;  //when eaten, swimbot gets this much energy
export const FOOD_BIT_SIZE_VIEW_SCALE          = 0.03; //increase with view scale (a kind of LOD)
export const FOOD_BIT_GRAB_RADIUS              = 20.0;  // radius for grabbing food bit
export const FOOD_BIT_BOUNDARY_MARGIN          = POOL_WIDTH * 0.01; // important value - creates empty space from wall
export const FOOD_BIT_COLOR_COMPONENTS         = "100, 200, 100";
export const FOOD_BIT_ROLLOVER_COLOR           = "rgba( 100, 200, 100, 0.5 )";
export const FOOD_BIT_SELECT_COLOR             = "rgba( 200, 200, 200, 1.0 )";
export const FOOD_OPACITY_INCREMENT            = 0.01;


//------------------------
// Food bit
//------------------------
export function FoodBit()
{
    // position, type and energy live in the shared state once the food bit
    // has its slot (see bindShared), so the threads see them without copying
    let _fx = new Float64Array( 1 ), _fy = new Float64Array( 1 ), _fi = 0;
    let _fe = new Float64Array( 1 );
    let _ft = new Uint8Array( 1 );
    const _position     = new SplitVector2D( _fx, _fy, 0 );
    let _red            = ZERO;
    let _green          = ZERO;
    let _blue           = ZERO;
    let _index          = NULL_INDEX;
    let _fb = new Float64Array( 1 );   // the step it appeared (shared: foodBorn)
    let _maxSpawnRadius = DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS;
    let _autotomyDecoy  = false;
    let _shownFully     = false;   // (held in the "hand": no fading in)

    // alive or not, mirrored as one byte in the shared state (see bindLiveFlag)
    let _live   = new Uint8Array( 1 );
    let _liveAt = 0;
    const markLive = function() { _live[ _liveAt ] = ( _index != NULL_INDEX ) ? 1 : 0; }

    this.bindShared = function( st, slot: number )
    {
        _live   = st.liveFood;
        _liveAt = slot;
        markLive();
        st.foodEnergy[ slot ] = _fe[ _fi ];
        st.foodType  [ slot ] = _ft[ _fi ];
        st.foodBorn  [ slot ] = _fb[ _fi ];
        _fe = st.foodEnergy;
        _fb = st.foodBorn;
        _ft = st.foodType;
        _fi = slot;
        _position.rebind( st.foodX, st.foodY, slot );
    }

    //--------------------------------------------------------
    // initialize
    //--------------------------------------------------------
	this.initialize = function(f)
	{
        _index      = f;
        _shownFully = false;
        _fb[ _fi ] = simClock.step;
        _fe[ _fi ]     = DEFAULT_FOOD_BIT_ENERGY;
        _autotomyDecoy = false;
        _position.x = POOL_LEFT + gpRandom() * POOL_WIDTH;
        _position.y = POOL_TOP  + gpRandom() * POOL_HEIGHT;
        _ft[ _fi ]       = 0;
        if ( _index !== NULL_INDEX ) { randomizePlantGenes( _index ); }
        markLive();
    }



    //--------------------------------------
	this.setType = function(n)
	{
//assert ( ( n === 0 ) || ( n === 1 ), "Foodbit.js: setType: ( n === 0 ) || ( n === 1 )" );

	    _ft[ _fi ] = n;

        this.setColorAccordingToType();
	}

    this.setAutotomyDecoy = function( value ) { _autotomyDecoy = value === true; }




    //------------------------------------------------
	// PLANT_EVOLUTION_ENABLED: the genes show a little - fast plants are
	// yellower, slow ones darker green; far-seeding ones bluer
	this.tintByGenes = function()
	{
	    if ( !PLANT_EVOLUTION_ENABLED || ( _index === NULL_INDEX )) return;
	    const g = plantGrowthOf( _index ), s = plantSpreadOf( _index );
	    _red   = 0.15 + 0.45 * g;
	    _green = 0.55 + 0.30 * g;
	    _blue  = 0.10 + 0.45 * s;
	}

	this.setColorAccordingToType = function()
	{
       if ( _ft[ _fi ] === 0 ) { _red = 0.3; _green = 0.8; _blue = 0.2; this.tintByGenes(); }
       if ( _ft[ _fi ] === 1 ) { _red = 0.3; _green = 0.5; _blue = 0.9; }
       if ( _ft[ _fi ] === 2 ) { _red = 0.9; _green = 0.1; _blue = 0.1; }
	   }



    //----------------------------------------------------------------------------
	this.spawnFromParent = function( parentFoodBit, childIndex, childType )
	{
	       assert( parentFoodBit.getIndex() != NULL_INDEX, "foodbit.js: spawnNearParent: parentFoodBit.index != NULL_INDEX" );
	       assert( parentFoodBit.getAlive(), "foodbit.js: spawnNearParent: parentFoodBit.getAlive()" );
	       assert( childIndex != NULL_INDEX, "foodbit.js: spawnNearParent: childIndex != NULL_INDEX" );

        _index      = childIndex;
        markLive();
        _fb[ _fi ] = simClock.step;
        _fe[ _fi ]     = parentFoodBit.getEnergy();
        _ft[ _fi ]       = childType;
        _autotomyDecoy = false;

        this.setColorAccordingToType();

        //-----------------------------
        // set the position
        //-----------------------------
        _position.set( parentFoodBit.getPosition() );

              //-----------------------------
              // randomize position
              //-----------------------------
              this.randomizeSpawnPosition( parentFoodBit );

    }

    // GenePool.updateFood calls it by this name
    this.setSpawnPositionRelativeToParent = this.spawnFromParent;




    //-----------------------------------------------------------
	this.randomizeSpawnPosition = function( parentFoodBit )
    {
        _position.set( parentFoodBit.getPosition() );

        let xx = gpRandom() * gpRandom();
        let yy = gpRandom() * gpRandom();

        if ( gpRandom() < ONE_HALF ) { xx *= -ONE; }
        if ( gpRandom() < ONE_HALF ) { yy *= -ONE; }

        _position.x += xx * _maxSpawnRadius;
        _position.y += yy * _maxSpawnRadius;

        //-----------------------------
        // pool boundary collisions
        //-----------------------------
        let pb = POOL_TOP       + FOOD_BIT_BOUNDARY_MARGIN;
        let pt = POOL_BOTTOM    - FOOD_BIT_BOUNDARY_MARGIN;
        let pl = POOL_LEFT	    + FOOD_BIT_BOUNDARY_MARGIN;
        let pr = POOL_RIGHT	    - FOOD_BIT_BOUNDARY_MARGIN;

        //console.log( "before:" + _position.y );

                if ( _position.y < pb ) { _position.y += ( ( pb - _position.y ) * 2 ); }
        else	if ( _position.y > pt ) { _position.y += ( ( pt - _position.y ) * 2 ); }
                if ( _position.x > pr ) { _position.x += ( ( pr - _position.x ) * 2 ); }
        else	if ( _position.x < pl ) { _position.x += ( ( pl - _position.x ) * 2 ); }

        //console.log( "after:" + _position.y );

        if ( SPAWN_FOOD_RANDOMLY_IN_POOL )
        {
            _position.x = POOL_LEFT + gpRandom() * POOL_WIDTH;
            _position.y = POOL_TOP  + gpRandom() * POOL_HEIGHT;
        }


        assert( _position.x < POOL_RIGHT,   "foodbit.js: spawnNearParent: _position.x < POOL_RIGHT"  );
        assert( _position.x > POOL_LEFT,    "foodbit.js: spawnNearParent: _position.x > POOL_LEFT"   );
        assert( _position.y > POOL_TOP,     "foodbit.js: spawnNearParent: _position.y < POOL_TOP"	);
        assert( _position.y < POOL_BOTTOM,  "foodbit.js: spawnNearParent: _position.y > POOL_BOTTOM" );
    }



    //-----------------------------
	this.setPosition = function(p)
	{
        _position.set(p);

                if ( _position.y < POOL_TOP    ) { _position.y = POOL_TOP    + FOOD_BIT_SIZE; }
        else	if ( _position.y > POOL_BOTTOM ) { _position.y = POOL_BOTTOM - FOOD_BIT_SIZE; }
                if ( _position.x > POOL_RIGHT  ) { _position.x = POOL_RIGHT  - FOOD_BIT_SIZE; }
        else	if ( _position.x < POOL_LEFT   ) { _position.x = POOL_LEFT   + FOOD_BIT_SIZE; }

        assert( _position.x < POOL_RIGHT,   "foodbit.js: setPosition: _position.x < POOL_RIGHT"  );
        assert( _position.x > POOL_LEFT,    "foodbit.js: setPosition: _position.x > POOL_LEFT"   );
        assert( _position.y > POOL_TOP,     "foodbit.js: setPosition: _position.y < POOL_TOP"	);
        assert( _position.y < POOL_BOTTOM,  "foodbit.js: setPosition: _position.y > POOL_BOTTOM" );
    }



    //-------------------------------
	this.shiftPosition = function(s)
	{
	    _position.x += s.x;
	    _position.y += s.y;
    }

    //-----------------------------------
	this.setMaxSpawnRadius = function(r)
	{
	    _maxSpawnRadius = r;

	    assert( _maxSpawnRadius <= MAX_FOOD_BIT_MAX_SPAWN_RADIUS, "FoodBit: setMaxSpawnRadius: _maxSpawnRadius <= MAX_FOOD_BIT_MAX_SPAWN_RADIUS" );

	    assert( _maxSpawnRadius >= MIN_FOOD_BIT_MAX_SPAWN_RADIUS, "FoodBit: setMaxSpawnRadius: _maxSpawnRadius >= MIN_FOOD_BIT_MAX_SPAWN_RADIUS" );
    }


    //----------------------------------
	this.getMaxSpawnRadius = function()
	{
	    return _maxSpawnRadius;
    }

    //----------------------------
	this.setEnergy = function(e)
	{
	    _fe[ _fi ] = e;

	    // (PLANT_SIZE_ENABLED: a tree holds more than the food slider allows)
	    assert( _fe[ _fi ] <= ( PLANT_SIZE_ENABLED ? Math.max( MAX_FOOD_BIT_ENERGY, PLANT_TREE_ENERGY ) : MAX_FOOD_BIT_ENERGY ), "FoodBit:getMaxSpawnRadius setEnergy: _fe[ _fi ] <= MAX_FOOD_BIT_ENERGY" );
	    assert( _fe[ _fi ] >= MIN_FOOD_BIT_ENERGY, "FoodBit:getMaxSpawnRadius setEnergy: _fe[ _fi ] >= MIN_FOOD_BIT_ENERGY" );
	   }

    //----------------------
    this.kill = function()
    {
        _index = NULL_INDEX;
        markLive();
    }

	//----------------------------
	// getters
	//----------------------------
	this.getPosition    = function() { return _position;    }
	this.getEnergy      = function() { return _fe[ _fi ];      }
	this.getType   = function() { return _ft[ _fi ];   }
	this.getAutotomyDecoy = function() { return _autotomyDecoy; }
	this.getIndex       = function() { return _index;       }
	this.getAge         = function() { return simClock.step - _fb[ _fi ]; }

	// a new food bit fades in
	const opacity = function() { return _shownFully ? ONE : Math.min( ONE, ( simClock.step - _fb[ _fi ] ) * FOOD_OPACITY_INCREMENT ); }
	this.showFully = function() { _shownFully = true; }
	this.getOpacity = function() { return opacity(); }
    this.getAlive       = function() { return ( _index != NULL_INDEX ); }

    // Add method for spatial grid support
    this.getBoundingRadius = function() { return FOOD_BIT_GRAB_RADIUS; }

	// (nothing to do every step: the age and the fading in follow from the clock)
	this.update = function() {}

	//--------------------------------
	// render
	//--------------------------------
	//----------------------------------------------------
	// hand this food bit to the graphics-card renderer
	//----------------------------------------------------
	//------------------------------------------------------------------
	// how it looks: PLANT_STAGES_ENABLED - a sprout is small, an old plant
	// bigger and drawn as a star of 8 rays (like the Claude logo)
	//------------------------------------------------------------------
	const stage = function()
	{
	    if ( PLANT_SIZE_ENABLED ) return 1;
	    if ( !PLANT_STAGES_ENABLED || !PLANT_STAGES_SHOWN || ( _ft[ _fi ] === 2 )) return 1;
	    return plantStage( _fi, simClock.step - _fb[ _fi ] );
	}
	const STAGE_SIZE = [ 0.7, 1.0, 1.6 ];
	// (a sprout grows from half size to full, when plants have genes)
	const stageSize = function( st )
	{
	    // PLANT_SIZE_ENABLED: a sprout is a small dot, a tree a big one
	    if ( PLANT_SIZE_ENABLED && ( _ft[ _fi ] !== 2 )) return 0.6 + 1.8 * plantSize( simClock.step - _fb[ _fi ] );
	    if (( st !== 0 ) || !PLANT_EVOLUTION_ENABLED ) return STAGE_SIZE[ st ];
	    return 0.45 + 0.55 * plantSproutGrowth( _fi, simClock.step - _fb[ _fi ] );
	}

	// A piece of meat that holds less than a whole piece (what is left of a
	// carcass) is drawn as part of a dot: a half or a third. 1 = whole.
	const portion = function(): number
	{
	    if ( _ft[ _fi ] !== 2 ) return 1;
	    const share = _fe[ _fi ] / MEAT_PIECE_ENERGY;
	    return ( share >= 0.8 ) ? 1 : ( share >= 0.42 ) ? 0.5 : 1 / 3;
	}

	this.writeCapsule = function( capsules, viewScale )
	{
	    const st = stage();
	    let radius = ( FOOD_BIT_SIZE + viewScale * FOOD_BIT_SIZE_VIEW_SCALE * FOOD_BIT_SIZE_VIEW_SCALE ) * stageSize( st );
	    const part = portion();
	    if (( st !== 2 ) && ( part < 1 ))
	    {
	        // a wedge of a dot, as a fan of short thick capsules
	        const rays = ( part === 0.5 ) ? 5 : 4, span = part * PI2, w = radius * ( part === 0.5 ? 0.62 : 0.5 );
	        for (let k = 0; k < rays; k++)
	        {
	            const a = -span / 2 + k * span / ( rays - 1 );
	            capsules.add( _position.x, _position.y, _position.x + Math.cos( a ) * radius * 0.75, _position.y + Math.sin( a ) * radius * 0.75, w, _red, _green, _blue, opacity() );
	        }
	        return;
	    }
	    if ( st !== 2 )
	    {
	        capsules.add( _position.x, _position.y, _position.x, _position.y, radius, _red, _green, _blue, opacity() );
	        return;
	    }
	    // a star: 4 thin capsules through the middle (8 rays) and a small core
	    const ray = radius * 1.8, w = radius * 0.28, r = _red * 0.8, g = _green * 0.8, b = _blue * 0.8;
	    for (let k = 0; k < 4; k++)
	    {
	        const a = k * Math.PI / 4, dx = Math.cos( a ) * ray, dy = Math.sin( a ) * ray;
	        capsules.add( _position.x - dx, _position.y - dy, _position.x + dx, _position.y + dy, w, r, g, b, opacity() );
	    }
	    capsules.add( _position.x, _position.y, _position.x, _position.y, radius * 0.55, r, g, b, opacity() );
	}

	this.render = function( vewScale )
	{
	    const st = stage();
	    const color = "rgba( "
        + Math.floor( _red   * 255 * ( st === 2 ? 0.8 : 1 )) + ", "
        + Math.floor( _green * 255 * ( st === 2 ? 0.8 : 1 )) + ", "
        + Math.floor( _blue  * 255 * ( st === 2 ? 0.8 : 1 )) + ", "
        + opacity() + ")";
	    let radius = ( FOOD_BIT_SIZE + vewScale * FOOD_BIT_SIZE_VIEW_SCALE * FOOD_BIT_SIZE_VIEW_SCALE ) * stageSize( st );

	    if ( st === 2 )
	    {
	        // a star of 8 rays
	        canvas.strokeStyle = color;
	        canvas.lineWidth   = radius * 0.56;
	        canvas.lineCap     = "round";
	        canvas.beginPath();
	        for (let k = 0; k < 4; k++)
	        {
	            const a = k * Math.PI / 4, dx = Math.cos( a ) * radius * 1.8, dy = Math.sin( a ) * radius * 1.8;
	            canvas.moveTo( _position.x - dx, _position.y - dy );
	            canvas.lineTo( _position.x + dx, _position.y + dy );
	        }
	        canvas.stroke();
	        canvas.closePath();
	        return;
	    }

	    canvas.fillStyle = color;
        canvas.beginPath();
        const part = portion();
        if ( part < 1 ) { canvas.moveTo( _position.x, _position.y ); canvas.arc( _position.x, _position.y, radius, -part * PI2 / 2, part * PI2 / 2, false ); }
        else            { canvas.arc( _position.x, _position.y, radius, 0, PI2, false ); }
        canvas.fill();
        canvas.closePath();
    }

	//----------------------------
	// render moused-over outline
	//---------------------------
	this.renderMousedOverOutline = function( viewScale )
	{
	    this.showSelectCircle( viewScale, FOOD_BIT_ROLLOVER_COLOR );
    }

	//----------------------------
	// render select outline
	//---------------------------
	this.renderSelectOutline = function( viewScale )
	{
	    this.showSelectCircle( viewScale, FOOD_BIT_SELECT_COLOR );
    }

	//-----------------------------------------------------
	this.showSelectCircle = function( viewScale, color )
    {
	    let lineWidth = 1.0 + 0.005 * viewScale;

        canvas.lineWidth = lineWidth;
        canvas.strokeStyle = "rgba( 100, 200, 100, 0.05 )";
        canvas.beginPath();
        canvas.arc( _position.x, _position.y, FOOD_BIT_GRAB_RADIUS, 0, PI2, false );
        canvas.stroke();
        canvas.closePath();

        canvas.lineWidth = lineWidth * 0.3;
        canvas.strokeStyle = "rgba( 100, 200, 100, 0.1 )";
        canvas.beginPath();
        canvas.arc( _position.x, _position.y, FOOD_BIT_GRAB_RADIUS, 0, PI2, false );
        canvas.stroke();
        canvas.closePath();
     }

}
