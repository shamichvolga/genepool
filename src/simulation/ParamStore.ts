//------------------------------------------------------------------------------
// The numbers of Parameters.ts, changeable while the world runs (debug mode,
// src/ui/debug.ts). Every thread has its own copy of the modules, so a change
// is written to shared memory too; the step's worker threads look at the
// version before each phase (sync) and take over what changed.
//
// __PARAMS / __setParam are added to Parameters.ts when the page is built
// (see vite.config.ts, liveParameters).
//------------------------------------------------------------------------------
import * as Parameters from "./Parameters";

const P: any = Parameters;
export type ParamInfo = { name: string, kind: "number" | "boolean" | "array", value: any, note: string };

export const PARAM_LIST: ParamInfo[] = ( P.__PARAMS || [] ).map( ( p ) => ( { ...p, value: Array.isArray( p.value ) ? p.value.slice() : p.value } ));
const setParam: ( name: string, value: any ) => boolean = P.__setParam || ( () => false );

// the values the code starts with
export const PARAM_DEFAULTS: Record<string, any> = {};
for ( const p of PARAM_LIST ) { PARAM_DEFAULTS[ p.name ] = p.value; }

// every value in one row of numbers: lists are put one after another
const slotOf: Record<string, number> = {};
let numSlots = 0;
for ( const p of PARAM_LIST ) { slotOf[ p.name ] = numSlots; numSlots += Array.isArray( p.value ) ? p.value.length : 1; }

let numbers : Float64Array = new Float64Array( numSlots );
let version : Int32Array   = new Int32Array( 1 );
let seen = 0;

function read( p: ParamInfo ): any
{
    const at = slotOf[ p.name ];
    if ( Array.isArray( p.value ))  { return Array.from( numbers.subarray( at, at + p.value.length )); }
    return ( p.kind === "boolean" ) ? numbers[ at ] !== 0 : numbers[ at ];
}

function write( p: ParamInfo, value: any ): void
{
    const at = slotOf[ p.name ];
    if ( Array.isArray( value )) { for (let i = 0; i < value.length; i++) { numbers[ at + i ] = Number( value[ i ] ); } }
    else                         { numbers[ at ] = ( value === true ) ? 1 : ( value === false ) ? 0 : Number( value ); }
}

function fill(): void { for ( const p of PARAM_LIST ) { write( p, p.value ); } }
fill();

// the owner (the thread that starts the worker threads) makes the shared memory
export function createParamBuffers(): { numbers: SharedArrayBuffer, version: SharedArrayBuffer } | null
{
    if ( typeof SharedArrayBuffer === "undefined" ) return null;
    const buffers = { numbers: new SharedArrayBuffer( Math.max( 1, numSlots ) * 8 ), version: new SharedArrayBuffer( 4 ) };
    const mine = new Float64Array( buffers.numbers );
    mine.set( numbers );
    numbers = mine;
    version = new Int32Array( buffers.version );
    return buffers;
}

// a worker thread joins
export function attachParamBuffers( buffers: { numbers: SharedArrayBuffer, version: SharedArrayBuffer } ): void
{
    numbers = new Float64Array( buffers.numbers );
    version = new Int32Array( buffers.version );
    seen    = -1;
    syncParams();
}

// the owner changes a value (here and for the workers)
export function setParameter( name: string, value: any ): boolean
{
    const p = PARAM_LIST.find( q => q.name === name );
    if ( !p ) return false;
    if ( p.kind === "boolean" ) { value = ( value === true || value === 1 || value === "true" ); }
    else if ( p.kind === "number" ) { value = Number( value ); if ( !isFinite( value )) return false; }
    else { value = ( Array.isArray( value ) ? value : [] ).map( Number ); if ( value.length !== p.value.length ) return false; }
    write( p, value );
    p.value = value;
    setParam( name, value );
    Atomics.add( version, 0, 1 );
    seen = Atomics.load( version, 0 );
    return true;
}

// a worker thread: take over what the owner changed (before each phase)
export function syncParams(): void
{
    const v = Atomics.load( version, 0 );
    if ( v === seen ) return;
    seen = v;
    for ( const p of PARAM_LIST )
    {
        const now = read( p );
        const same = Array.isArray( now ) ? now.every( ( x, i ) => x === p.value[ i ] ) : now === p.value;
        if ( !same ) { p.value = now; setParam( p.name, now ); }
    }
}

// the numbers that differ from the code's (a saved world keeps them)
export function changedParams(): Record<string, any>
{
    const out: Record<string, any> = {};
    for ( const p of PARAM_LIST ) { if ( JSON.stringify( p.value ) !== JSON.stringify( PARAM_DEFAULTS[ p.name ] )) { out[ p.name ] = p.value; } }
    return out;
}
