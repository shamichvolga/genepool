import { gpRandom } from "./Globals";

	//-----------------------------------
	// color
    // all values should be 0.0 to 1.0
	//-----------------------------------
    export function Color( red?, green?, blue?, opacity? )
    {
        if (red === undefined) {
            this.red     = 1.0;
            this.green   = 1.0;
            this.blue    = 1.0;
            this.opacity = 1.0;
        }
		else {
            this.red     = red;
            this.green   = green;
            this.blue    = blue;
            this.opacity = opacity;
        }

		this.set = function( red, green, blue, opacity ) {
			this.red     = red;
			this.green   = green;
			this.blue    = blue;
			this.opacity = opacity;
		}

        // css style 'rgba' for HTML canvas rendering
        this.rgba = function() {
           return "rgba( " 
            + Math.floor( this.red   * 255 ) + ", " 
            + Math.floor( this.green * 255 ) + ", " 
            + Math.floor( this.blue  * 255 ) + ", "
            + this.opacity + ")";
        }
    }
    
	// a failed check: a message box on the page, the console elsewhere
	function report( text )
	{
		if ( typeof alert === "function" ) { alert( text ); } else { console.error( text ); }
	}

	//-----------------------------------
	// assert
	//-----------------------------------
	export function assert( assertion, string )
	{
		if ( !assertion )
		{
			report( "assertion failed: " + string );
		} 
	}


	//-----------------------------------
	// assert integer
	//-----------------------------------
	export function assertInteger( value, string )
	{
		if ( !Number.isInteger( value ))    // (a number, finite, whole)
		{
			report( "assertInteger: value not an integer! - " + string );
		} 
	}
	
	//-----------------------------------
	// getRandomAngleInDegrees
	//-----------------------------------
	export function getRandomAngleInDegrees()
	{
		return -180.0 + gpRandom() * 360.0;
	}
	
