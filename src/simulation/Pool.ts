import { ONE, ONE_HALF, PI2, ZERO } from "./MathConstants";
import { WORLD_SCALE } from "./World";
import { Touch } from "./Touch";
import { Vector2D } from "./Vector2D";

//-------------------------------------
// metrics
//-------------------------------------
export const POOL_LEFT     = ZERO;
export const POOL_RIGHT    = 8000.0 * WORLD_SCALE;
export const POOL_TOP      = ZERO;
export const POOL_BOTTOM   = 8000.0 * WORLD_SCALE;

export const POOL_WIDTH  = ( POOL_RIGHT  - POOL_LEFT );
export const POOL_HEIGHT = ( POOL_BOTTOM - POOL_TOP  );

export const POOL_X_CENTER = POOL_LEFT + POOL_WIDTH    * ONE_HALF;
export const POOL_Y_CENTER = POOL_TOP  + POOL_HEIGHT   * ONE_HALF;

//--------------------------------------------------
// pool
//--------------------------------------------------
export function Pool()
{
// Seasonal water: winter, spring, summer, autumn. The renderer supplies the
// continuous phase; these four colours are interpolated, never regenerated.
const SEASON_WATER = [ [ 36, 54, 78 ], [ 44, 70, 82 ], [ 52, 74, 92 ], [ 48, 60, 74 ]];
const ICE_SIZE = 512;

    const BOUNDARY_MARGIN_COLOR     = "rgb(  0,  0,  0 )";
    const EFFECT_COLOR 	            = "220, 240, 255";

const POOL_BOUNDARY_MARGIN      = 1200.0;

    const TOUCH_RIPPLE_DURATION	    = 0.3;
    const MAX_TOUCH_RIPPLE_RADIUS   = 0.04;
    const NUM_EFFECT_BLOBS          = 20;
    const EFFECT_BLOB_COLOR         = "70, 80, 90";
    const EFFECT_BLOB_DURATION      = 8.0;
    const EFFECT_BLOB_PERIOD        = 20;
    const EFFECT_BLOB_ALPHA         = 0.5;

	function Touch()
	{	
		this.down		= false;
		this.moving		= false;
		this.position	= new Vector2D();
		this.time 		= ZERO;
		this.radius		= ZERO;
	}

    function EffectBlob()
    {
        let startTime = ZERO;
        let xPosition = ZERO;    
        let yPosition = ZERO;    
        let radius    = ZERO;    
     }

	let _touch = new Touch();
	let _center = new Vector2D();
	let _currentEffectBlob = 0;
	let _effectClock = 0;
	let _effectBlob = new Array( NUM_EFFECT_BLOBS );
	
	//----------------------------------
	// do this now
	//----------------------------------
    _center.x = POOL_LEFT + POOL_WIDTH  * ONE_HALF;
    _center.y = POOL_TOP  + POOL_HEIGHT * ONE_HALF;
        
	//----------------------------------
	// initialize
	//----------------------------------
	this.initialize = function( t )
	{
    	_touch.time = t;
    	
    	for (let b=0; b<NUM_EFFECT_BLOBS; b++)
    	{
    	    _effectBlob[b] = new EffectBlob();
    	}

    }
    
	//----------------------------------------
	// start touch
	//----------------------------------------
	this.startTouch = function( position, time )
	{
		_touch.down 		= true;
		_touch.position.x	= position.x;
		_touch.position.y 	= position.y;
		_touch.time 		= time;
	}

	//--------------------------------------
	// move touch
	//--------------------------------------
	this.moveTouch = function( position, time )
	{
		if ( _touch.down ) 
		{
			_touch.position.x = position.x;
			_touch.position.y = position.y;
		}
	}

	//--------------------------------------
	// end touch
	//--------------------------------------
	this.endTouch = function( position, time )
	{
		_touch.down 		= false;
		_touch.position.x 	= position.x;
		_touch.position.y 	= position.y;
		_touch.time 		= time;
	}

	//---------------------------
	// get center
	//---------------------------
	this.getCenter = function()
	{
		return _center;
	}

	let _backgroundImage = null;
	this.setBackgroundImage = function( image ) { _backgroundImage = image; }

    //------------------------------------------------
    // season tint and the once-baked shore ice
    //------------------------------------------------
    let _seasonFill = "rgb( 52, 74, 92 )";
    let _seasonKey = -1;
    let _seasonActive = false;
    let _winterAlpha = 0;
    let _shoreIceCanvas: HTMLCanvasElement | null = null;

    function bakeShoreIce(): void
    {
        if ( typeof document === "undefined" ) return;
        const off = document.createElement( "canvas" );
        off.width = ICE_SIZE; off.height = ICE_SIZE;
        const g = off.getContext( "2d" );
        if ( !g ) return;

        const base = ICE_SIZE * 0.035;
        const wave = ( t: number ) => base * ( 0.65 + 0.25 * Math.sin( 5 * t )
                                                + 0.15 * Math.sin( 13 * t + 1.1 )
                                                + 0.08 * Math.sin( 23 * t + 2.4 ));
        const ring = ( scale: number, alpha: number ) =>
        {
            g.beginPath();
            const steps = 96;
            for ( let e = 0; e < 4; e++ )
            {
                for ( let i = 0; i <= steps; i++ )
                {
                    const u = i / steps;
                    const t = PI2 * ( e + u ) / 4;
                    const w = wave( t ) * scale;
                    let x = 0, y = 0;
                    if ( e === 0 )      { x = u * ICE_SIZE;           y = w; }
                    else if ( e === 1 ) { x = ICE_SIZE - w;           y = u * ICE_SIZE; }
                    else if ( e === 2 ) { x = ICE_SIZE - u * ICE_SIZE; y = ICE_SIZE - w; }
                    else                { x = w;                       y = ICE_SIZE - u * ICE_SIZE; }
                    if ( e === 0 && i === 0 ) { g.moveTo( x, y ); } else { g.lineTo( x, y ); }
                }
            }
            g.closePath();
            g.rect( 0, 0, ICE_SIZE, ICE_SIZE );
            g.fillStyle = "rgba( 190, 224, 248, " + alpha + " )";
            g.fill( "evenodd" );
        };
        // the shelf fades softly into open water; the outermost ring is faintest
        ring( 1.0, 0.24 );
        ring( 1.7, 0.10 );
        ring( 2.6, 0.05 );
        g.strokeStyle = "rgba( 235, 248, 255, 0.45 )";
        g.lineWidth = 2;
        g.strokeRect( 1, 1, ICE_SIZE - 2, ICE_SIZE - 2 );
        _shoreIceCanvas = off;
    }
    bakeShoreIce();   // once, off-screen: no per-frame geometry or allocation

    this.setSeason = function( yearPhase: number, active: boolean )
    {
        _seasonActive = active;
        let phase = yearPhase % PI2;
        if ( phase < 0 ) phase += PI2;
        const quarter = PI2 / 4;
        const k = Math.floor( phase / quarter ) % 4;
        const n = ( k + 1 ) % 4;
        const t = active ? ( phase - k * quarter ) / quarter : 0;
        const ci = active ? k : 2, cj = active ? n : 2;
        const r = SEASON_WATER[ci][0] + ( SEASON_WATER[cj][0] - SEASON_WATER[ci][0] ) * t;
        const g = SEASON_WATER[ci][1] + ( SEASON_WATER[cj][1] - SEASON_WATER[ci][1] ) * t;
        const b = SEASON_WATER[ci][2] + ( SEASON_WATER[cj][2] - SEASON_WATER[ci][2] ) * t;
        const key = ( Math.round( r ) << 16 ) | ( Math.round( g ) << 8 ) | Math.round( b );
        if ( key !== _seasonKey )
        {
            _seasonKey = key;
            _seasonFill = "rgb( " + Math.round( r ) + ", " + Math.round( g ) + ", " + Math.round( b ) + " )";
        }
        const rawWinter = active ? Math.max( 0, Math.cos( phase )) : 0;
        _winterAlpha = rawWinter * rawWinter * ( 3 - 2 * rawWinter );
    }

	//------------------------------------------------
	// render
	//------------------------------------------------
	this.render = function( _seconds, viewport )
	{
		//------------------------------
		// show pool background
		//------------------------------
        let lineWidth = 0.005 + 0.001 * viewport.getScale(); 	

        canvas.fillStyle = _seasonFill;
        canvas.fillRect( POOL_LEFT, POOL_TOP, POOL_WIDTH, POOL_HEIGHT );

        // the temperature map of the environment (cold = blue, warm = brown)
        if ( _backgroundImage !== null )
        {
            canvas.imageSmoothingEnabled = true;
            canvas.globalAlpha = 0.72;
            canvas.drawImage( _backgroundImage, POOL_LEFT, POOL_TOP, POOL_WIDTH, POOL_HEIGHT );
            canvas.globalAlpha = 1.0;
        }

        // Baked shore ice: one drawImage, only in winter, always below the
        // plants and swimbots that the renderer draws after this call. The
        // canvas is baked once at construction; the camera transform already
        // in effect scales the image with the current zoom.
        if ( _seasonActive && _winterAlpha > 0.01 && _shoreIceCanvas !== null )
        {
            canvas.globalAlpha = _winterAlpha * 0.85;
            canvas.drawImage( _shoreIceCanvas, POOL_LEFT, POOL_TOP, POOL_WIDTH, POOL_HEIGHT );
            canvas.globalAlpha = 1.0;
        }


		//------------------------------------------------------------
		// show touch
		//------------------------------------------------------------
		if ( ( _seconds - _touch.time ) < TOUCH_RIPPLE_DURATION )
		{
			let f = ( _seconds - _touch.time ) / TOUCH_RIPPLE_DURATION;

			if ( _touch.down )
			{
				_touch.radius = MAX_TOUCH_RIPPLE_RADIUS * ( ONE - f );
			}
			else
			{
				_touch.radius = MAX_TOUCH_RIPPLE_RADIUS * f;
			}

            let radius = _touch.radius * viewport.getScale();

            if ( radius > ZERO )
            {
                let alpha = ONE - _touch.radius / MAX_TOUCH_RIPPLE_RADIUS;
            
                canvas.lineWidth = lineWidth;
                canvas.strokeStyle = "rgba( " + EFFECT_COLOR + ", " + alpha + " )";	
                canvas.beginPath();
                canvas.arc( _touch.position.x, _touch.position.y, radius, 0, PI2, false );
                canvas.stroke();
                canvas.closePath();	
			}
		}

		//----------------
		// reset this!
		//----------------
		_touch.moving = false;
		
		//------------------------------------------
		// show watery effects
		//------------------------------------------
		
		//------------------
		// show boundary
		//------------------
		canvas.fillStyle = BOUNDARY_MARGIN_COLOR;	
		canvas.fillRect( POOL_LEFT,                         POOL_TOP - POOL_BOUNDARY_MARGIN,    POOL_WIDTH,             POOL_BOUNDARY_MARGIN    );
		canvas.fillRect( POOL_LEFT,                         POOL_BOTTOM,                        POOL_WIDTH,             POOL_BOUNDARY_MARGIN    );
		canvas.fillRect( POOL_LEFT - POOL_BOUNDARY_MARGIN,  POOL_TOP,                           POOL_BOUNDARY_MARGIN,   POOL_HEIGHT             );
		canvas.fillRect( POOL_RIGHT,                        POOL_TOP,                           POOL_BOUNDARY_MARGIN,   POOL_HEIGHT             );
	}
	


	//---------------------------------------------
    function showWateryEffects( seconds, viewport )
    {        
        let v = viewport.getScale() * 0.3;
        _effectClock ++;

        let viewCenterX = 4000;
        let viewCenterY = 4000;
    
        if ( _effectClock % EFFECT_BLOB_PERIOD === 0 )
        {
            _currentEffectBlob ++;
            if ( _currentEffectBlob >= NUM_EFFECT_BLOBS )
            {
                _currentEffectBlob = 0;
            }
            
            _effectBlob[ _currentEffectBlob ].startTime = seconds;
            _effectBlob[ _currentEffectBlob ].radius = v;
            
            //_effectBlob[ _currentEffectBlob ].xPosition = viewport.getPosition().x - v + v * 2 * gpRandom(); 
            //_effectBlob[ _currentEffectBlob ].yPosition = viewport.getPosition().y - v + v * 2 * gpRandom();    

            _effectBlob[ _currentEffectBlob ].xPosition = viewport.getPosition().x + v * Math.sin( _effectClock * 0.040 ); 
            _effectBlob[ _currentEffectBlob ].yPosition = viewport.getPosition().y + v * Math.sin( _effectClock * 0.080 ); 
        }

        canvas.lineWidth = 3;
        
    	for (let b=0; b<NUM_EFFECT_BLOBS; b++)
    	{
    	    let timePassed = seconds - _effectBlob[b].startTime;
    	    
    	    if ( timePassed < EFFECT_BLOB_DURATION )
    	    {    	
    	        let fraction = timePassed / EFFECT_BLOB_DURATION;
    	        let wave = ONE_HALF - ONE_HALF * Math.cos( fraction * PI2 );
    	        //let radius   = _effectBlob[b].radius * 0.3 + wave * _effectBlob[b].radius;
    	        let radius   = _effectBlob[b].radius * 0.3 + fraction * _effectBlob[b].radius;
    	        let alpha    = wave * EFFECT_BLOB_ALPHA;    	        
    	        
                canvas.strokeStyle = "rgba( " + EFFECT_BLOB_COLOR + ", " + alpha + " )";	
                canvas.fillStyle   = "rgba( " + EFFECT_BLOB_COLOR + ", " + alpha + " )";	
                canvas.beginPath();
//canvas.arc( _effectBlob[b].xPosition, _effectBlob[b].yPosition, radius, 0, PI2, false );
canvas.ellipse( _effectBlob[b].xPosition, _effectBlob[b].yPosition, radius, radius * 0.5, 0.0, 0, PI2, false );                
                
                //canvas.stroke();
                canvas.fill();
                canvas.closePath();	 
            }
    	}
    }
}





