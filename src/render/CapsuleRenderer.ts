//------------------------------------------------------------------------------
// CapsuleRenderer: draws thousands of "capsules" (a line segment with round
// ends - one body part) and dots (food bits) on the graphics card in a single
// draw call (WebGL2 instancing).
//
// Each frame:   begin()  ->  add(...) for every capsule  ->  draw(view...)
// A dot is a capsule whose two ends are the same point.
//------------------------------------------------------------------------------
const FLOATS_PER_CAPSULE = 9;   // ax ay bx by radius red green blue alpha

const VERTEX_SHADER = `#version 300 es
in vec2  corner;        // quad corner: (-1 | 1, -1 | 1)
in vec2  endA;          // per capsule
in vec2  endB;
in float radius;
in vec4  color;

uniform vec2  viewOrigin;   // pool coordinates of the top-left corner of the view
uniform vec2  viewSize;     // size of the view in pool units
uniform float pixelSize;    // pool units per screen pixel

out vec2  vLocal;           // position along / across the capsule
out float vLength;
out float vRadius;
out vec4  vColor;
out float vPixel;

void main()
{
    vec2  d   = endB - endA;
    float len = length( d );
    vec2  dir = ( len > 1e-6 ) ? d / len : vec2( 1.0, 0.0 );
    vec2  nrm = vec2( -dir.y, dir.x );

    float r   = max( radius, pixelSize * 0.6 );   // never thinner than ~1 pixel
    float pad = r + pixelSize;                    // room for a soft edge

    float lx = ( corner.x < 0.0 ) ? -pad : len + pad;
    float ly = corner.y * pad;
    vec2 world = endA + dir * lx + nrm * ly;

    vec2 clip = ( world - viewOrigin ) / viewSize * 2.0 - 1.0;
    gl_Position = vec4( clip.x, -clip.y, 0.0, 1.0 );

    vLocal  = vec2( lx, ly );
    vLength = len;
    vRadius = r;
    vColor  = color;
    vPixel  = pixelSize;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2  vLocal;
in float vLength;
in float vRadius;
in vec4  vColor;
in float vPixel;

out vec4 outColor;

void main()
{
    // distance from this pixel to the capsule's middle line
    float x = clamp( vLocal.x, 0.0, vLength );
    float d = length( vec2( vLocal.x - x, vLocal.y ) );

    // soft one-pixel edge
    float coverage = clamp( ( vRadius - d ) / vPixel + 0.5, 0.0, 1.0 );
    if ( coverage <= 0.0 ) discard;

    float a = vColor.a * coverage;
    outColor = vec4( vColor.rgb * a, a );   // premultiplied alpha
}`;

export class CapsuleRenderer
{
    private gl            : WebGL2RenderingContext;
    private program       : WebGLProgram;
    private vao           : WebGLVertexArrayObject;
    private instanceBuffer: WebGLBuffer;
    private data          = new Float32Array( 4096 * FLOATS_PER_CAPSULE );
    private count         = 0;
    private uniforms      : { viewOrigin: WebGLUniformLocation, viewSize: WebGLUniformLocation, pixelSize: WebGLUniformLocation };
    private hasContent    = false;

    //--------------------------------------------------------------------
    // returns null if the browser has no WebGL2
    //--------------------------------------------------------------------
    static create( canvas: HTMLCanvasElement ): CapsuleRenderer | null
    {
        const gl = canvas.getContext( "webgl2", { premultipliedAlpha: true, antialias: false, alpha: true } );
        if ( !gl ) return null;
        try
        {
            return new CapsuleRenderer( gl );
        }
        catch ( e )
        {
            console.warn( "WebGL renderer unavailable:", e );
            return null;
        }
    }

    private constructor( gl: WebGL2RenderingContext )
    {
        this.gl = gl;
        this.program = this.link( VERTEX_SHADER, FRAGMENT_SHADER );

        this.uniforms =
        {
            viewOrigin : gl.getUniformLocation( this.program, "viewOrigin" ),
            viewSize   : gl.getUniformLocation( this.program, "viewSize"   ),
            pixelSize  : gl.getUniformLocation( this.program, "pixelSize"  ),
        };

        this.vao = gl.createVertexArray();
        gl.bindVertexArray( this.vao );

        // the four corners of one quad, shared by all capsules
        const quad = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, quad );
        gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ -1, -1,  1, -1,  -1, 1,  1, 1 ] ), gl.STATIC_DRAW );
        const corner = gl.getAttribLocation( this.program, "corner" );
        gl.enableVertexAttribArray( corner );
        gl.vertexAttribPointer( corner, 2, gl.FLOAT, false, 0, 0 );

        // one record per capsule
        this.instanceBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, this.instanceBuffer );
        const stride = FLOATS_PER_CAPSULE * 4;
        const attribute = ( name: string, size: number, offset: number ) =>
        {
            const location = gl.getAttribLocation( this.program, name );
            gl.enableVertexAttribArray( location );
            gl.vertexAttribPointer( location, size, gl.FLOAT, false, stride, offset * 4 );
            gl.vertexAttribDivisor( location, 1 );
        };
        attribute( "endA",   2, 0 );
        attribute( "endB",   2, 2 );
        attribute( "radius", 1, 4 );
        attribute( "color",  4, 5 );

        gl.bindVertexArray( null );
    }

    private link( vertexSource: string, fragmentSource: string ): WebGLProgram
    {
        const gl = this.gl;
        const compile = ( type: number, source: string ) =>
        {
            const shader = gl.createShader( type );
            gl.shaderSource( shader, source );
            gl.compileShader( shader );
            if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) throw new Error( gl.getShaderInfoLog( shader ) );
            return shader;
        };
        const program = gl.createProgram();
        gl.attachShader( program, compile( gl.VERTEX_SHADER,   vertexSource   ) );
        gl.attachShader( program, compile( gl.FRAGMENT_SHADER, fragmentSource ) );
        gl.linkProgram( program );
        if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) throw new Error( gl.getProgramInfoLog( program ) );
        return program;
    }

    //--------------------------------------------------------------------
    // collecting capsules
    //--------------------------------------------------------------------
    begin(): void
    {
        this.count = 0;
    }

    add( ax: number, ay: number, bx: number, by: number, radius: number,
         red: number, green: number, blue: number, alpha: number ): void
    {
        if ( ( this.count + 1 ) * FLOATS_PER_CAPSULE > this.data.length ) { this.grow( this.count + 1 ); }
        const d = this.data;
        let i = this.count * FLOATS_PER_CAPSULE;
        d[ i++ ] = ax;  d[ i++ ] = ay;
        d[ i++ ] = bx;  d[ i++ ] = by;
        d[ i++ ] = radius;
        d[ i++ ] = red; d[ i++ ] = green; d[ i++ ] = blue; d[ i++ ] = alpha;
        this.count ++;
    }

    //--------------------------------------------------------------------
    // room for n more capsules, to be written straight into reserved():
    // returns where in it the first of them starts (a whole body at once,
    // without a call per part)
    //--------------------------------------------------------------------
    reserve( n: number ): number
    {
        if ( ( this.count + n ) * FLOATS_PER_CAPSULE > this.data.length ) { this.grow( this.count + n ); }
        const start = this.count * FLOATS_PER_CAPSULE;
        this.count += n;
        return start;
    }
    reserved(): Float32Array { return this.data; }

    private grow( capsules: number ): void
    {
        let length = this.data.length;
        while ( capsules * FLOATS_PER_CAPSULE > length ) { length *= 2; }
        const bigger = new Float32Array( length );
        bigger.set( this.data );
        this.data = bigger;
    }

    //--------------------------------------------------------------------
    // draw everything collected since begin()
    //--------------------------------------------------------------------
    draw( viewLeft: number, viewTop: number, viewWidth: number, viewHeight: number ): void
    {
        const gl = this.gl;
        gl.viewport( 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight );
        gl.clearColor( 0, 0, 0, 0 );
        gl.clear( gl.COLOR_BUFFER_BIT );
        this.hasContent = this.count > 0;
        if ( this.count === 0 ) return;

        gl.useProgram( this.program );
        gl.uniform2f( this.uniforms.viewOrigin, viewLeft, viewTop );
        gl.uniform2f( this.uniforms.viewSize, viewWidth, viewHeight );
        gl.uniform1f( this.uniforms.pixelSize, viewWidth / Math.max( 1, gl.drawingBufferWidth ) );

        gl.enable( gl.BLEND );
        gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

        gl.bindBuffer( gl.ARRAY_BUFFER, this.instanceBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, this.data.subarray( 0, this.count * FLOATS_PER_CAPSULE ), gl.DYNAMIC_DRAW );

        gl.bindVertexArray( this.vao );
        gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, this.count );
        gl.bindVertexArray( null );
    }

    //--------------------------------------------------------------------
    // wipe the layer (when the detailed 2D drawing takes over)
    //--------------------------------------------------------------------
    clear(): void
    {
        if ( !this.hasContent ) return;
        const gl = this.gl;
        gl.clearColor( 0, 0, 0, 0 );
        gl.clear( gl.COLOR_BUFFER_BIT );
        this.hasContent = false;
    }

    getCount(): number { return this.count; }
}
