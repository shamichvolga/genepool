import { gpRandom } from "./Globals";
import { PI2, ZERO } from "./MathConstants";

export function Vector2D()
{	
	this.x = 0.0;
	this.y = 0.0;
}

// methods live on the prototype so each vector stays small


	//----------------------------------
	Vector2D.prototype.setXY = function( x_, y_ )
	{	
		this.x = x_;
		this.y = y_;
	}


	//--------------------------
	Vector2D.prototype.copyFrom = function(v)
	{	
		this.x = v.x;
		this.y = v.y;
	}

	//--------------------------
	Vector2D.prototype.equals = function(v)
	{
		return (this.x === v.x) && (this.y === v.y);
	}


	//--------------------------------------
	Vector2D.prototype.addXY  = function( x_, y_ )
	{
		this.x += x_;
		this.y += y_;	
	}
	
	
	//-----------------------
	Vector2D.prototype.set = function( p_ )
	{
		this.x = p_.x;
		this.y = p_.y;
	}
	
	
	
	//----------------------------------------
	Vector2D.prototype.setToDifference = function( v1, v2 )
	{
		this.x = v1.x - v2.x;
		this.y = v1.y - v2.y;		
	} 




	//-------------------------------------------------------------------------------------------
	Vector2D.prototype.normalize = function()
	{
		let m = Math.sqrt( this.x * this.x + this.y * this.y );
		
		if ( m > 0 )
		{
			this.x /= m;
			this.y /= m;
		}
		else
		{
			this.x = 1.0;
			this.y = 0.0;
		}
	} 


	
	//------------------------
	Vector2D.prototype.add = function( v )
	{
		this.x += v.x;
		this.y += v.y;
		
	} 

	
	//---------------------------- 
	Vector2D.prototype.subtract = function( v )
	{
		this.x -= v.x;
		this.y -= v.y;	
	}
	
	//-----------------------------------
	Vector2D.prototype.getMagnitude = function()
	{
		return Math.sqrt( this.x * this.x + this.y * this.y );
	}

	//-----------------------------------
	Vector2D.prototype.getMagnitudeSquared = function()
	{
		return this.x * this.x + this.y * this.y;
	}

	//-----------------------
	Vector2D.prototype.clear = function()
	{
		this.x = 0.0;
		this.y = 0.0;
	}
	
	//-------------------------
	Vector2D.prototype.scale = function( s )
	{
		this.x *= s;
		this.y *= s;
	}
	
	
	//----------------------------------------------
	Vector2D.prototype.addScaled = function( vectorToAdd, scale ) 
	{ 
		this.x += vectorToAdd.x * scale; 
		this.y += vectorToAdd.y * scale; 
	}
	
	//----------------------------------------------------------
	Vector2D.prototype.subtractScaled = function( vectorToSubtract, scale ) 
	{ 
		this.x -= vectorToSubtract.x * scale; 
		this.y -= vectorToSubtract.y * scale; 
	}


	//--------------------------
	Vector2D.prototype.dotWith = function( v )
	{
		return this.x * v.x + this.y * v.y;		
	} 
	
	

	//-----------------------------------------------------------
	Vector2D.prototype.setToRandomLocationInDisk = function( position, radius )
	{
		let radian = PI2 * gpRandom();
		let magnitude = radius * Math.sqrt( gpRandom() );

        this.x = position.x + Math.sin( radian ) * magnitude;
        this.y = position.y + Math.cos( radian ) * magnitude;
	}
	
	//-----------------------------------------------
    Vector2D.prototype.getDistanceSquaredTo = function( position )
    {
        let xx = this.x - position.x;
        let yy = this.y - position.y;
        return xx * xx + yy * yy;
    }


	//-----------------------------------------
    Vector2D.prototype.getDistanceTo = function( position )
    {
        let xx = this.x - position.x;
        let yy = this.y - position.y;
        return Math.sqrt( xx * xx + yy * yy );
    }


	//------------------------------------
    Vector2D.prototype.setToPerpendicular = function()
    {
        let px =  this.y;
        let py = -this.x;
        
        this.x = px;
        this.y = py;        
    }



	//----------------------------------------------------
	// check to see if segment a crosses segment b
	//----------------------------------------------------
    Vector2D.prototype.getSegmentsCrossing = function( a0, a1, b0, b1 )
    {
        //----------------------------
        // get the a and b vectors
        //----------------------------
        let aX = a1.x - a0.x;
        let aY = a1.y - a0.y;

        let bX = b1.x - b0.x;
        let bY = b1.y - b0.y;

        //----------------------------
        // get their perpendiculars
        //----------------------------
        let aPerpX = -aY;
        let aPerpY =  aX;

        let bPerpX = -bY;
        let bPerpY =  bX;
        
        //--------------------------------
        // get the vector from a0 to b0
        //--------------------------------
        let a0b0x = b0.x - a0.x;
        let a0b0y = b0.y - a0.y;

        //--------------------------------
        // get the vector from a0 to b1
        //--------------------------------
        let a0b1x = b1.x - a0.x;
        let a0b1y = b1.y - a0.y;

        //--------------------------------
        // get the vector from b0 to a0
        //--------------------------------
        let b0a0x = a0.x - b0.x;
        let b0a0y = a0.y - b0.y;
        
        //--------------------------------
        // get the vector from b0 to a1
        //--------------------------------
        let b0a1x = a1.x - b0.x;
        let b0a1y = a1.y - b0.y;
        
        //-------------------------------------------------------
        // get the dots of aPerp to the vectors to b0 and b1
        //-------------------------------------------------------
        let a0Dotb0 = aPerpX * a0b0x + aPerpY * a0b0y;
        let a0Dotb1 = aPerpX * a0b1x + aPerpY * a0b1y;

        //-------------------------------------------------------
        // get the dots of bPerp to the vectors to a0 and a1
        //-------------------------------------------------------
        let b0Dota0 = bPerpX * b0a0x + bPerpY * b0a0y;
        let b0Dota1 = bPerpX * b0a1x + bPerpY * b0a1y;
            
        //----------------------------------------------
        // if both pairs of dots are on opoosite 
        // sides of zero, then the lines are crossing.
        //----------------------------------------------
        if (((( a0Dotb0 > ZERO ) && ( a0Dotb1 < ZERO ))
        ||   (( a0Dotb1 > ZERO ) && ( a0Dotb0 < ZERO )))
        &&  ((( b0Dota0 > ZERO ) && ( b0Dota1 < ZERO ))
        ||   (( b0Dota1 > ZERO ) && ( b0Dota0 < ZERO ))))
        {
            return true;
        }
    
        return false;
    }





// //---------------------------------------------------------------------------------
 //---------------  END of class constructor ---------------------------------------
//---------------------------------------------------------------------------------






//------------------------------------------------------------------------------
// A vector whose x and y live in a number array (the shared state of the
// threads, see SharedState.ts) at [ offset ] and [ offset + 1 ]. It has all the
// methods of Vector2D. rebind() moves it to another array without making a
// new object (others may keep a reference to it).
//------------------------------------------------------------------------------
export function SharedVector2D( array: Float64Array, offset: number )
{
    this.array  = array;
    this.offset = offset;
}

SharedVector2D.prototype = Object.create( Vector2D.prototype );
SharedVector2D.prototype.constructor = SharedVector2D;

Object.defineProperty( SharedVector2D.prototype, "x", {
    get: function() { return this.array[ this.offset ]; },
    set: function( v ) { this.array[ this.offset ] = v; },
});
Object.defineProperty( SharedVector2D.prototype, "y", {
    get: function() { return this.array[ this.offset + 1 ]; },
    set: function( v ) { this.array[ this.offset + 1 ] = v; },
});

SharedVector2D.prototype.rebind = function( array: Float64Array, offset: number )
{
    const x = this.x, y = this.y;
    this.array  = array;
    this.offset = offset;
    this.x = x;
    this.y = y;
}


//------------------------------------------------------------------------------
// A vector whose x lives in xs[ index ] and y in ys[ index ] (for example the
// food positions of the shared state: foodX, foodY). All Vector2D methods.
//------------------------------------------------------------------------------
export function SplitVector2D( xs: Float64Array, ys: Float64Array, index: number )
{
    this.xs = xs;
    this.ys = ys;
    this.index = index;
}

SplitVector2D.prototype = Object.create( Vector2D.prototype );
SplitVector2D.prototype.constructor = SplitVector2D;

Object.defineProperty( SplitVector2D.prototype, "x", {
    get: function() { return this.xs[ this.index ]; },
    set: function( v ) { this.xs[ this.index ] = v; },
});
Object.defineProperty( SplitVector2D.prototype, "y", {
    get: function() { return this.ys[ this.index ]; },
    set: function( v ) { this.ys[ this.index ] = v; },
});

SplitVector2D.prototype.rebind = function( xs: Float64Array, ys: Float64Array, index: number )
{
    const x = this.x, y = this.y;
    this.xs = xs;
    this.ys = ys;
    this.index = index;
    this.x = x;
    this.y = y;
}
