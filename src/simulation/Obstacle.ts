import { ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { Vector2D } from "./Vector2D";

//------------------------
// Obstacle
// (the barrier may be several wall segments that share vertices: a T,
// a cross, a fenced pen... one segment only is the classic single wall)
//------------------------
export function Obstacle()
{
    const END_RADIUS = 20;
    const END_HOVER_RADIUS = 30;
    const END_MOVE_RADIUS  = 25;
    const MAX_SEGMENTS     = 24;    // (keep in step with MAX_WALL_SEGMENTS in SharedState)

    //----------------------------
    function ObstacleEndpoint()
    {
        this.position   = new Vector2D();
        this.hovered    = false;
        this.moved      = false;
        this.color      = "rgb( 100, 100, 100 )"

        //----------------------------
        this.setColor = function(c)
        {
            this.color = c;
        }

        //----------------------------
        this.setPosition = function(p)
        {
            this.position.x = p.x;
            this.position.y = p.y;
        }

        //----------------------------
        this.detectHover = function(p)
        {
            let x1 = p.x - this.position.x;
            let y1 = p.y - this.position.y;

            let d1 = x1 * x1 + y1 * y1;

            this.hovered = false;
            if ( d1 < END_HOVER_RADIUS * END_HOVER_RADIUS )
            {
                this.hovered = true;
                return true;
            }

            return false;
        }

        //----------------------------
        this.render = function( camera )
        {
            canvas.fillStyle = this.color;

            canvas.beginPath();
            canvas.arc( this.position.x, this.position.y, END_RADIUS, 0, PI2, false );
            canvas.fill();
            canvas.closePath();

            canvas.lineWidth = 0.003 * camera.getScale();

            canvas.strokeStyle = "rgba( 0, 0, 0, 0.4 )";
            canvas.beginPath();
            canvas.arc( this.position.x, this.position.y, END_RADIUS, 0, PI2, false );
            canvas.stroke();
            canvas.closePath();

            if ( this.hovered )
            {
                let r = END_HOVER_RADIUS;
                if ( this.moved )
                {
                    r = END_MOVE_RADIUS;
                }

                canvas.strokeStyle = "rgba(255, 255, 255, 0.4 )";
                canvas.beginPath();
                canvas.arc( this.position.x, this.position.y, r, 0, PI2, false );
                canvas.stroke();
                canvas.closePath();
            }

        }
    } // end of obstacle endpoint

    //----------------------------
    // one wall segment: two endpoints
    //----------------------------
    function ObstacleSegment()
    {
        this.end1   = new ObstacleEndpoint();
        this.end2   = new ObstacleEndpoint();
        this.end1.setColor( "rgb( 200, 150, 100 )" );
        this.end2.setColor( "rgb( 100, 150, 200 )" );

        this.mid    = new Vector2D();
        this.perp   = new Vector2D();
        this.length = ZERO;

        //----------------------------
        // the same geometry as the old single wall: midpoint, length,
        // perpendicular, endpoints not overlapping, inside the pool
        //----------------------------
        this.recalculate = function()
        {
            const e1 = this.end1.position, e2 = this.end2.position;

            const axisX = e2.x - e1.x;
            const axisY = e2.y - e1.y;

            this.mid.x   = e1.x + axisX * ONE_HALF;
            this.mid.y   = e1.y + axisY * ONE_HALF;

            this.length  = Math.sqrt( axisX * axisX + axisY * axisY );

            const minLength = END_RADIUS * 2;

            if ( this.length >= minLength )
            {
                const directionX = axisX / this.length;
                const directionY = axisY / this.length;

                this.perp.x =  directionY;
                this.perp.y = -directionX;
            }
            else
            {
                // handle endpoints bumping into each other
                const penetration = ONE - ( this.length / minLength );
                const shiftX = END_RADIUS * penetration;
                const shiftY = END_RADIUS * penetration;

                if ( axisX >= ZERO )
                {
                    e1.x -= shiftX; e2.x += shiftX;
                }
                else
                {
                    e1.x += shiftX; e2.x -= shiftX;
                }
                if ( axisY >= ZERO )
                {
                    e1.y -= shiftY; e2.y += shiftY;
                }
                else
                {
                    e1.y += shiftY; e2.y -= shiftY;
                }

                this.mid.x   = ( e1.x + e2.x ) * ONE_HALF;
                this.mid.y   = ( e1.y + e2.y ) * ONE_HALF;
                this.length  = minLength;

                const dx = e2.x - e1.x, dy = e2.y - e1.y;
                if ( dx !== ZERO && dy !== ZERO )
                {
                    const d = Math.sqrt( dx * dx + dy * dy );
                    if ( d > ZERO )
                    {
                        this.perp.x =  dy / d;
                        this.perp.y = -dx / d;
                    }
                }
                else
                {
                    this.perp.x = ZERO; this.perp.y = ONE;
                }
            }

            // handle collisions with the pool walls
            const left   = POOL_LEFT   + END_RADIUS;
            const right  = POOL_RIGHT  - END_RADIUS
            const bottom = POOL_BOTTOM - END_RADIUS
            const top    = POOL_TOP    + END_RADIUS

                 if ( e1.x > right  ) { e1.x = right;  }
            else if ( e1.x < left   ) { e1.x = left;   }
                 if ( e1.y > bottom ) { e1.y = bottom; }
            else if ( e1.y < top    ) { e1.y = top;    }

                 if ( e2.x > right  ) { e2.x = right;  }
            else if ( e2.x < left   ) { e2.x = left;   }
                 if ( e2.y > bottom ) { e2.y = bottom; }
            else if ( e2.y < top    ) { e2.y = top;    }

            // re-derive midpoint / length after any clamping
            const cx = e2.x - e1.x, cy = e2.y - e1.y;
            this.mid.x  = ( e1.x + e2.x ) * ONE_HALF;
            this.mid.y  = ( e1.y + e2.y ) * ONE_HALF;
            this.length = Math.sqrt( cx * cx + cy * cy );

            if ( this.length > ZERO )
            {
                this.perp.x =  cy / this.length;
                this.perp.y = -cx / this.length;
            }
        }

        //----------------------------
        this.setXY = function( x1, y1, x2, y2 )
        {
            this.end1.position.x = x1;
            this.end1.position.y = y1;
            this.end2.position.x = x2;
            this.end2.position.y = y2;
            this.recalculate();
        }
    } // end of obstacle segment

    //------------------------------------------
    // local variables
    //------------------------------------------
    let _segments       = [ new ObstacleSegment() ];
    let _collisionForce = new Vector2D();
    let _enabled        = true;

    //----------------------------
    // set all the wall segments: [{ x1, y1, x2, y2 }, ...] (or a flat
    // x1, y1, x2, y2, ... array, or the legacy single { x1, y1, x2, y2 })
    //----------------------------
    this.setSegments = function( segments )
    {
        let list: any[] = [];

        if ( Array.isArray( segments ))
        {
            if ( typeof segments[ 0 ] === "number" )
            {
                // the flat numbers the threads read: x1, y1, x2, y2, ...
                const count = Math.min( Math.floor( segments.length / 4 ), MAX_SEGMENTS );
                for ( let i = 0; i < count; i++ )
                {
                    list.push({ x1: segments[ i * 4     ], y1: segments[ i * 4 + 1 ],
                                x2: segments[ i * 4 + 2 ], y2: segments[ i * 4 + 3 ] });
                }
            }
            else if ( Array.isArray( segments[ 0 ] ))
            {
                // [ [ x1, y1, x2, y2 ], ... ]
                const count = Math.min( segments.length, MAX_SEGMENTS );
                for ( let i = 0; i < count; i++ )
                {
                    const a: any = segments[ i ];
                    if ( Array.isArray( a ) && ( a.length >= 4 ))
                    {
                        list.push({ x1: a[ 0 ], y1: a[ 1 ], x2: a[ 2 ], y2: a[ 3 ] });
                    }
                }
            }
            else
            {
                // [ { x1, y1, x2, y2 }, ... ]
                list = segments.slice( 0, MAX_SEGMENTS );
            }
        }
        else if (( segments !== null ) && ( segments !== undefined ) && ( segments.x1 !== undefined ))
        {
            // the legacy single wall { x1, y1, x2, y2 }
            list = [ segments ];
        }

        _segments = [];
        for ( const s of list )
        {
            if (( s === null ) || ( s === undefined )) continue;
            if ( s.x1 === undefined ) continue;
            const seg = new ObstacleSegment();
            seg.setXY( s.x1, s.y1, s.x2, s.y2 );
            _segments.push( seg );
        }

        if ( _segments.length === 0 ) { _segments = [ new ObstacleSegment() ]; }
    }

    this.getSegments = function()
    {
        const out = [];
        for ( const s of _segments )
        {
            out.push({ x1: s.end1.position.x, y1: s.end1.position.y, x2: s.end2.position.x, y2: s.end2.position.y });
        }
        return out;
    }

    this.getSegmentCount = function() { return _segments.length; }

    //-------------------------------------------------
    // set the endpoints of the (single) obstacle
    //------------------------------------------------
	this.setEndpointPositions = function( e1, e2 )
	{
        _segments = [ new ObstacleSegment() ];
        _segments[ 0 ].end1.setPosition( e1 );
        _segments[ 0 ].end2.setPosition( e2 );
        _segments[ 0 ].recalculate();
    }

    //------------------------------------------
    // start moving
    //------------------------------------------
	this.startMoving = function( movePosition )
	{
        for ( const s of _segments )
        {
            if ( s.end1.hovered )
            {
                s.end1.moved = true;
                s.end1.setPosition( movePosition );
                break;
            }
            else if ( s.end2.hovered )
            {
                s.end2.moved = true;
                s.end2.setPosition( movePosition );
                break;
            }
        }

        this.setMovePosition( movePosition );
    }

    //----------------------------------------------
    // move
    //----------------------------------------------
	this.setMovePosition = function( movePosition )
	{
        let changed = false;

        for ( const s of _segments )
        {
            if ( s.end1.moved )
            {
                s.end1.setPosition( movePosition ); changed = true;
            }
            if ( s.end2.moved )
            {
                s.end2.setPosition( movePosition ); changed = true;
            }
            s.recalculate();
        }
    }

    //-----------------------------------
    // stop moving
    //-----------------------------------
	this.stopMoving = function()
	{
        for ( const s of _segments )
        {
            s.end1.moved = false;
            s.end2.moved = false;
        }
    }


	//---------------------------------------------------
	// detect collision with a given position
	//---------------------------------------------------
	this.getCollision = function( testPosition, radius )
	{
	    if ( !_enabled ) return false;
	    if ( radius < END_RADIUS )
	    {
	        radius = END_RADIUS;
	    }

	    for ( const s of _segments )
	    {
	        let xx = testPosition.x - s.mid.x;
	        let yy = testPosition.y - s.mid.y;

	        let distanceSquared = xx * xx + yy * yy;

	        let ll = s.length * ONE_HALF + END_RADIUS + radius;

	        if ( distanceSquared < ll * ll )
	        {
	            let testX = testPosition.x - s.end1.position.x;
	            let testY = testPosition.y - s.end1.position.y;

	            let dot = testX * s.perp.x + testY * s.perp.y;

	            if ( Math.abs( dot ) < radius )
	            {
	                let penetration = ( ONE - ( dot / radius ) );

	                if ( dot < ZERO )
	                {
	                    penetration *= -ONE;
	                }

                    _collisionForce.setXY( s.perp.x * penetration, s.perp.y * penetration );
        	        return true;
	            }
	        }
	    }

	    return false;
	}


	//-------------------------------------------------------------------
	// if a collision has been detected, then add the resulting force
	// NOTE: call this immediately after calling "getCollision"
	//-------------------------------------------------------------------
	// the numbers the main-thread physics needs (the old single wall)
	this.writeGeometry = function( params, midX, midY, length, perpX, perpY, endRadius )
	{
	    const s = _segments[ 0 ];
	    params[ midX ] = s.mid.x;       params[ midY ] = s.mid.y;
	    params[ length ] = s.length;
	    params[ perpX ] = s.perp.x;     params[ perpY ] = s.perp.y;
	    params[ endRadius ] = _enabled ? END_RADIUS : 0;
	}

	//---------------------------------------------------
	// the numbers the physics and perception threads need:
	// the count of the walls, then x1 y1 x2 y2 per wall
	//---------------------------------------------------
	this.writeWalls = function( params, countParam, base, maxSegments )
	{
	    if ( !_enabled ) { params[ countParam ] = 0; return; }

	    const count = Math.min( _segments.length, maxSegments );
	    params[ countParam ] = count;

	    for ( let i = 0; i < maxSegments; i++ )
	    {
	        const p = base + i * 4;
	        if ( i < count )
	        {
	            const s = _segments[ i ];
	            params[ p     ] = s.end1.position.x;
	            params[ p + 1 ] = s.end1.position.y;
	            params[ p + 2 ] = s.end2.position.x;
	            params[ p + 3 ] = s.end2.position.y;
	        }
	        else
	        {
	            params[ p     ] = 0;
	            params[ p + 1 ] = 0;
	            params[ p + 2 ] = 0;
	            params[ p + 3 ] = 0;
	        }
	    }
	}

	this.setEnabled = function( enabled ) { _enabled = enabled === true; }
	this.getEnabled = function() { return _enabled; }

	this.getCurrentCollisionForce = function()
	{
    	return _collisionForce;
    }

	//-------------------------------------------------------
	// See if any wall lies between these two points
	// (blocking the view or stopping access)
	//-------------------------------------------------------
	this.getObstruction = function( p1, p2 )
	{
	    if ( !_enabled ) return false;
	    for ( const s of _segments )
	    {
	        if ( p1.getSegmentsCrossing( p1, p2, s.end1.position, s.end2.position )) return true;
	    }
	    return false;
    }

	//------------------------------------------------------------------
	// get end positions (of the first wall, for the old save format)
	//------------------------------------------------------------------
	this.getEnd1Position = function() { return _segments[ 0 ].end1.position; }
	this.getEnd2Position = function() { return _segments[ 0 ].end2.position; }

	//---------------------------------------------------
	// detect mouse hover hovered
	//---------------------------------------------------
	this.detectHover = function( touchPosition )
	{
	    for ( const s of _segments )
	    {
	        if (( s.end1.detectHover( touchPosition ))
	        ||   ( s.end2.detectHover( touchPosition )))
	        {
	            return true;
	        }
	    }

	    return false;
	}


	//-----------------------------
	// get hovered
	//-----------------------------
	this.getHovered = function()
	{
	    for ( const s of _segments )
	    {
	        if (( s.end1.hovered ) || ( s.end2.hovered )) return true;
	    }

	    return false;
	}

	//----------------------------
	// get being moved
	//---------------------------
	this.getBeingMoved = function()
	{
	    for ( const s of _segments )
	    {
	        if (( s.end1.moved ) || ( s.end2.moved )) return true;
	    }

	    return false;
	}

	//--------------------------------
	// render
	//--------------------------------
	this.render = function( camera )
	{
	    if ( !_enabled ) return;

        canvas.strokeStyle = "rgb( 200, 200, 200 )";
        canvas.lineWidth = END_RADIUS;

	    for ( const s of _segments )
        {
            //--------------------------------------------
            // show shaft
            //--------------------------------------------
            canvas.beginPath();
            canvas.moveTo( s.end1.position.x, s.end1.position.y );
            canvas.lineTo( s.end2.position.x, s.end2.position.y );
            canvas.closePath();
            canvas.stroke();
        }

        //-----------------------
        // show ends
        //-----------------------
        for ( const s of _segments )
        {
            s.end1.render( camera );
            s.end2.render( camera );
        }
    }
}
