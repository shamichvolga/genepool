import { ONE, ONE_HALF, ZERO } from "./MathConstants";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP, POOL_WIDTH } from "./Pool";
import { Vector2D } from "./Vector2D";

//------------------------------------------
export function Camera()
{
    const FRICTION   			=  8.0;
	const BUTTON_FORCE          =  0.3;
	const DRAG_FORCE            =  0.03;
    const PAN_OVERSHOOT_PUSH 	=  0.7;
    const SCALE_OVERSHOOT_PUSH	=  0.7;
    const MINIMUM_SCALE 		=  80.0;    // closest zoom: height of the view in pool units
    
	//------------------------------------------
	// members
	//------------------------------------------
	let _position  		    = new Vector2D();
	let _velocity  		    = new Vector2D();
	let _vectorUtility      = new Vector2D();
	let _scaleDelta 	    = ZERO;
	let _scale      	    = ONE;
    let _aspectRatio        = ONE;
	let _left	    	    = ZERO;
	let _right	    	    = ZERO;
	let _top	    	    = ZERO;
	let _bottom	    	    = ZERO;
	let _seconds		    = ZERO;
	let _secondsDelta	    = ZERO;
	
	//--------------------------------
	this.update = function( seconds )
	{		
        //-------------------------------------------
        // friction
        //-------------------------------------------
        let f = ONE - FRICTION  * _secondsDelta;

        if ( f < ZERO )
        {
            _velocity.clear();
            _scaleDelta = ZERO;				
        }
        else if ( f < ONE )
        {
            _velocity.scale(f);
            _scaleDelta *= (f);
        }

        //-----------------------------
        // update position and scale
        //-----------------------------
        _position.add( _velocity );
        _scale += _scaleDelta;

        //----------------------
        // calculate frame
        //----------------------
        calculateFrame();

        //----------------------
        // apply constraints
        //----------------------
        applyConstraints();

		//-----------------------------------
		// update seconds
		//-----------------------------------
		_secondsDelta = seconds - _seconds;
		_seconds = seconds;
	}



	//----------------------------------------------
	this.addForce = function( force, scaleForce )
	{
        _velocity.x = force.x;
        _velocity.y = force.y;
        
        _scaleDelta = scaleForce;
    }
	

	//--------------------------------------
	this.setAspectRatio = function(a)
	{
		_aspectRatio = a;

        //---------------------
        // important
        //---------------------
        calculateFrame();
        
        //---------------------
        // apply constraints
        //---------------------
        applyConstraints();        
	}

	//-------------------------
	function calculateFrame()
	{	
        _right  = _position.x + _scale * ONE_HALF * _aspectRatio;
        _left   = _position.x - _scale * ONE_HALF * _aspectRatio;

		_top    = _position.y + _scale * ONE_HALF;
		_bottom	= _position.y - _scale * ONE_HALF;
	}


	//--------------------------
	function applyConstraints()
	{	
        let scaleOvershoot = _scale - ( POOL_RIGHT - POOL_LEFT );
        if ( scaleOvershoot > ZERO )
        {
            _scale -= scaleOvershoot * SCALE_OVERSHOOT_PUSH;
        }

        let scaleUndershoot = _scale - MINIMUM_SCALE;
        if ( scaleUndershoot < ZERO )
        {
            _scale -= scaleUndershoot * SCALE_OVERSHOOT_PUSH;
        }

        let rightOverShoot  = _right  - POOL_RIGHT;
        let leftOverShoot   = _left   + POOL_LEFT;
        let topOverShoot    = _top    - POOL_BOTTOM;
        let bottomOverShoot = _bottom + POOL_TOP;

        if ( rightOverShoot > ZERO  )
        {
            _position.x -= rightOverShoot * PAN_OVERSHOOT_PUSH; 
            calculateFrame();
        }
        if ( leftOverShoot < ZERO  )
        {
            _position.x -= leftOverShoot * PAN_OVERSHOOT_PUSH; 
            calculateFrame();
        }

        if ( topOverShoot > ZERO  )
        {
            _position.y -= topOverShoot * PAN_OVERSHOOT_PUSH; 
            calculateFrame();
        }
        if ( bottomOverShoot < ZERO  )
        {
            _position.y -= bottomOverShoot * PAN_OVERSHOOT_PUSH; 
            calculateFrame();
        }
	}

	//----------------------------------------------------------------------------------------
	// controls
	//----------------------------------------------------------------------------------------
	//------------------------------------------------------------------
	// Direct control (keys, mouse wheel, middle-button drag): the camera
	// goes exactly where it is told, without drifting afterwards.
	//------------------------------------------------------------------
	this.moveBy = function( dx, dy )
	{
		_velocity.clear();
		_scaleDelta = ZERO;
		_position.x += dx;
		_position.y += dy;
		clampToPool();
	}

	// zoom by `factor` (<1 = closer) keeping the pool point (worldX, worldY) in place
	this.zoomAt = function( factor, worldX, worldY )
	{
		_velocity.clear();
		_scaleDelta = ZERO;

		let newScale = _scale * factor;
		if ( newScale < MINIMUM_SCALE           ) { newScale = MINIMUM_SCALE;           }
		if ( newScale > POOL_RIGHT - POOL_LEFT  ) { newScale = POOL_RIGHT - POOL_LEFT;  }

		let k = newScale / _scale;
		_position.x = worldX + ( _position.x - worldX ) * k;
		_position.y = worldY + ( _position.y - worldY ) * k;
		_scale = newScale;
		clampToPool();
	}

	// keep the view inside the pool (centered on an axis where it does not fit)
	function clampToPool()
	{
		let halfWidth  = _scale * ONE_HALF * _aspectRatio;
		let halfHeight = _scale * ONE_HALF;

		if ( halfWidth * 2 >= POOL_RIGHT - POOL_LEFT ) { _position.x = ( POOL_LEFT + POOL_RIGHT ) * ONE_HALF; }
		else { _position.x = Math.min( Math.max( _position.x, POOL_LEFT + halfWidth ), POOL_RIGHT - halfWidth ); }

		if ( halfHeight * 2 >= POOL_BOTTOM - POOL_TOP ) { _position.y = ( POOL_TOP + POOL_BOTTOM ) * ONE_HALF; }
		else { _position.y = Math.min( Math.max( _position.y, POOL_TOP + halfHeight ), POOL_BOTTOM - halfHeight ); }

		calculateFrame();
	}

	this.panLeft    = function() { _velocity.x -= _scale * BUTTON_FORCE * _secondsDelta; }
	this.panRight   = function() { _velocity.x += _scale * BUTTON_FORCE * _secondsDelta; }
	this.panDown    = function() { _velocity.y += _scale * BUTTON_FORCE * _secondsDelta; }
	this.panUp      = function() { _velocity.y -= _scale * BUTTON_FORCE * _secondsDelta; }
	this.zoomIn     = function() { _scaleDelta -= _scale * BUTTON_FORCE * _secondsDelta; }
	this.zoomOut    = function() { _scaleDelta += _scale * BUTTON_FORCE * _secondsDelta; }

	//----------------------------
	this.drag = function( x, y )
	{	
		_velocity.x -= x * _scale * DRAG_FORCE * _secondsDelta;
		_velocity.y -= y * _scale * DRAG_FORCE * _secondsDelta;
		
		//---------------------------------------------------------------
		// as the scale approaches the whole pool, the drag gets 
		// more dampened, until it is fully dampened at the limit.
		//---------------------------------------------------------------
		let limit = POOL_WIDTH * 0.4;

		if ( _scale > limit )
		{
		    if ( _scale > POOL_WIDTH )
		    {
		        _scale = POOL_WIDTH;
		    }

		    let dampening = ONE - ( ( _scale - limit ) / ( POOL_WIDTH - limit ) );
		    		    
		    _velocity.x *= dampening;
		    _velocity.y *= dampening;
		}
    }
    
    
	//--------------------------------------
	this.setPosition = function( position )
	{	
		_position.copyFrom( position );
		_velocity.clear();

        //---------------------
        // important
        //---------------------
        calculateFrame();
	}

	//---------------------------------
	this.setScale = function( scale )
	{	
		_scale = scale;
		_scaleDelta = ZERO;

        //---------------------
        // important
        //---------------------
        calculateFrame();
	}
	
	//-------------------------------------
	this.setScaleToMax = function()
	{	
		_scale = POOL_RIGHT - POOL_LEFT;
	    _scaleDelta = ZERO;
        _position.setXY( POOL_LEFT + _scale * ONE_HALF, POOL_TOP + _scale * ONE_HALF );
	    _velocity.clear()

        //---------------------
        // important
        //---------------------
        calculateFrame();
	}

	//---------------------------
	this.getPosition = function()
	{	
	    _vectorUtility.x = _position.x;
	    _vectorUtility.y = _position.y;
	
		return _vectorUtility;
	}	

	//---------------------------
	this.getScale = function()
	{	
        return _scale;
	}
	
	//---------------------------
	this.getXDimension = function()
	{	
        return _scale * _aspectRatio;
	}
	
	//---------------------------
	this.getYDimension = function()
	{	
		return _scale;
	}

	//------------------------------------------------
	this.getWithinView = function( position, buffer )
	{
		if (( position.x < _right  + buffer )
		&&  ( position.x > _left   - buffer )
		&&  ( position.y < _top    + buffer )
		&&  ( position.y > _bottom - buffer ))
		{
			return true;
		}

		return false;
	}
	
}
