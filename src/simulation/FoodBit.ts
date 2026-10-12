import { gpRandom } from "./Globals";
import { NULL_INDEX, ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { SPAWN_FOOD_RANDOMLY_IN_POOL } from "./Parameters";
import { POOL_BOTTOM, POOL_HEIGHT, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { assert } from "./Utility";
import { Vector2D } from "./Vector2D";

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
    let _position       = new Vector2D();
    let _energy         = ZERO;
    let _type           = 0;
    let _red            = ZERO;
    let _green          = ZERO;
    let _blue           = ZERO;
    let _opacity        = ZERO;
    let _index          = NULL_INDEX;
    let _age            = 0;
    let _maxSpawnRadius = DEFAULT_FOOD_BIT_MAX_SPAWN_RADIUS;

    //--------------------------------------------------------
    // initialize
    //--------------------------------------------------------
	this.initialize = function(f)
	{
        _index      = f;
        _age        = 0;
        _energy     = DEFAULT_FOOD_BIT_ENERGY;  
        _opacity    = ZERO;
        _position.x = POOL_LEFT + gpRandom() * POOL_WIDTH;
        _position.y = POOL_TOP  + gpRandom() * POOL_HEIGHT;
        _type       = 0;
    }



    //--------------------------------------
	this.setType = function(n)
	{
//assert ( ( n === 0 ) || ( n === 1 ), "Foodbit.js: setType: ( n === 0 ) || ( n === 1 )" );
	    
	    _type = n;
	    
        this.setColorAccordingToType();
	}




    //------------------------------------------------
	this.setColorAccordingToType = function()
	{
       if ( _type === 0 ) { _red = 0.3; _green = 0.8; _blue = 0.2; }
       if ( _type === 1 ) { _red = 0.3; _green = 0.5; _blue = 0.9; }
       if ( _type === 2 ) { _red = 0.9; _green = 0.1; _blue = 0.1; }
	   }
    
        
    
    //----------------------------------------------------------------------------
	this.spawnFromParent = function( parentFoodBit, childIndex, childType )
	{
	       assert( parentFoodBit.getIndex() != NULL_INDEX, "foodbit.js: spawnNearParent: parentFoodBit.index != NULL_INDEX" );
	       assert( parentFoodBit.getAlive(), "foodbit.js: spawnNearParent: parentFoodBit.getAlive()" );
	       assert( childIndex != NULL_INDEX, "foodbit.js: spawnNearParent: childIndex != NULL_INDEX" );

        _index      = childIndex;
        _age        = 0;
        _opacity    = ZERO;
        _energy     = parentFoodBit.getEnergy();
        _type       = childType;
                
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
	    _energy = e;
	
	    assert( _energy <= MAX_FOOD_BIT_ENERGY, "FoodBit:getMaxSpawnRadius setEnergy: _energy <= MAX_FOOD_BIT_ENERGY" );
	    assert( _energy >= MIN_FOOD_BIT_ENERGY, "FoodBit:getMaxSpawnRadius setEnergy: _energy >= MIN_FOOD_BIT_ENERGY" );
	   }

    //----------------------
    this.kill = function()
    {	
        _index = NULL_INDEX;
    }
    
	//----------------------------
	// getters
	//----------------------------
	this.getPosition    = function() { return _position;    }
	this.getEnergy      = function() { return _energy;      }
	this.getType   = function() { return _type;   }
	this.getIndex       = function() { return _index;       }
	this.getAge         = function() { return _age;         }
    this.getAlive       = function() { return ( _index != NULL_INDEX ); }

    // Add method for spatial grid support
    this.getBoundingRadius = function() { return FOOD_BIT_GRAB_RADIUS; }

	//----------------------------
	// update
	//----------------------------
	this.update = function()
	{
	    _age ++;

	    if ( _opacity < ONE )
	    {
    	    _opacity += FOOD_OPACITY_INCREMENT;
	        if ( _opacity > ONE )
	        {
	            _opacity = ONE;
	        }
        }	
    }
    
    
	//--------------------------------
	// render
	//--------------------------------
	this.render = function( vewScale )
	{
	    canvas.fillStyle
        = "rgba( " 
        + Math.floor( _red   * 255 ) + ", " 
        + Math.floor( _green * 255 ) + ", " 
        + Math.floor( _blue  * 255 ) + ", "
        + _opacity + ")";	    
	    
	    let radius = FOOD_BIT_SIZE + vewScale * FOOD_BIT_SIZE_VIEW_SCALE * FOOD_BIT_SIZE_VIEW_SCALE;
	    
        canvas.beginPath();
        canvas.arc( _position.x, _position.y, radius, 0, PI2, false );
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
