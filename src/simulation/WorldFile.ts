//------------------------------------------------------------------------------
// The file of a saved world (.gpworld): a small JSON header and the big
// arrays one after the other, as they are in memory. No DOM, no compression
// here (the page and the tools gzip the whole file); see docs/схема_сохранения_мира.md.
//
//   "GPWORLD\0"        8 bytes
//   u32                length of the header, in bytes
//   header             JSON, ASCII only, padded with spaces to a multiple of 8
//   chunks             each starts at a multiple of 8 (offsets are in the header)
//------------------------------------------------------------------------------
import { MAX_FOODBITS, MAX_SWIMBOTS } from "./Parameters";
import { MAX_PARTS } from "./SwimbotTypes";
import { BOT_STRIDE, MAX_SEEN, MIND_STRIDE, NUM_IMMUNE_MEMORY, PART_STRIDE, PLANT_COLUMNS, PLANT_ROWS, PS } from "./SharedState";
import { BRAIN_SIZE, NUM_HIDDEN, NUM_INPUTS, NUM_OUTPUTS } from "./NeuralBrain";
import { NUM_GENES } from "./Genotype";
import { FIELD_SIZE } from "./Environment";
import { KEY_SIZE } from "./Disease";
import { WORLD_SCALE } from "./World";

export const WORLD_FORMAT = 1;
const MAGIC = "GPWORLD\0";

export type Chunk = { name: string, data: ArrayBufferView };

const TYPES: { [ type: string ]: any } =
{
    f64: Float64Array, f32: Float32Array, i32: Int32Array, u32: Uint32Array, i8: Int8Array, u8: Uint8Array,
};

function typeName( data: any ): string
{
    for ( const t in TYPES ) { if ( data instanceof TYPES[ t ] || Object.prototype.toString.call( data ) === "[object " + TYPES[ t ].name + "]" ) return t; }
    throw new Error( "WorldFile: unknown array type" );
}

// the numbers a world depends on: if one differs, the arrays do not fit
export function layoutFingerprint(): { [ name: string ]: number }
{
    return {
        MAX_SWIMBOTS, MAX_FOODBITS, MAX_PARTS, PS, PART_STRIDE, BOT_STRIDE, MIND_STRIDE, NUM_INPUTS, NUM_HIDDEN, NUM_OUTPUTS, BRAIN_SIZE,
        NUM_GENES, MAX_SEEN, FIELD_SIZE, PLANT_COLUMNS, PLANT_ROWS, KEY_SIZE, NUM_IMMUNE_MEMORY, WORLD_SCALE,
    };
}

// FNV-1a over the bytes of an array
export function hashChunk( data: ArrayBufferView ): string
{
    const bytes = new Uint8Array( data.buffer, data.byteOffset, data.byteLength );
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul( h, 0x01000193 ); }
    return ( h >>> 0 ).toString( 16 ).padStart( 8, "0" );
}

function asciiJson( value: any ): string
{
    return JSON.stringify( value ).replace( /[\u0080-￿]/g, ( c ) => "\\u" + c.charCodeAt( 0 ).toString( 16 ).padStart( 4, "0" ));
}

//------------------------------------------------------------
// header (any JSON) + chunks -> the bytes of the file
//------------------------------------------------------------
export function packWorld( header: any, chunks: Chunk[] ): Uint8Array
{
    // where each chunk lies, from the start of the chunk area
    let offset = 0;
    const list = chunks.map( ( c ) =>
    {
        const entry = { name: c.name, type: typeName( c.data ), offset, count: ( c.data as any ).length, hash: hashChunk( c.data ) };
        offset += Math.ceil( c.data.byteLength / 8 ) * 8;
        return entry;
    });
    const text  = asciiJson( { ...header, format: WORLD_FORMAT, layout: layoutFingerprint(), chunks: list } );
    const headerBytes = Math.ceil(( 12 + text.length ) / 8 ) * 8 - 12;
    const area  = 12 + headerBytes;

    const file = new Uint8Array( area + offset );
    for (let i = 0; i < 8; i++) { file[i] = MAGIC.charCodeAt( i ); }
    new DataView( file.buffer ).setUint32( 8, headerBytes, true );
    for (let i = 0; i < headerBytes; i++) { file[ 12 + i ] = ( i < text.length ) ? text.charCodeAt( i ) : 32; }
    chunks.forEach( ( c, i ) => { file.set( new Uint8Array( c.data.buffer, c.data.byteOffset, c.data.byteLength ), area + list[i].offset ); });
    return file;
}

//------------------------------------------------------------
// the bytes of a file -> header and chunks (each chunk is a copy: aligned, ready to use)
//------------------------------------------------------------
export function unpackWorld( bytes: Uint8Array ): { header: any, get: ( name: string ) => any, has: ( name: string ) => boolean }
{
    if ( bytes.length < 16 ) throw new Error( "not a world file (too short)" );
    for (let i = 0; i < 8; i++) { if ( bytes[i] !== MAGIC.charCodeAt( i )) throw new Error( "not a world file" ); }
    const headerBytes = new DataView( bytes.buffer, bytes.byteOffset, bytes.byteLength ).getUint32( 8, true );
    let text = "";
    for (let i = 0; i < headerBytes; i++) { text += String.fromCharCode( bytes[ 12 + i ] ); }
    const header = JSON.parse( text );
    const area = 12 + headerBytes;
    const byName: { [ name: string ]: any } = {};
    for ( const c of header.chunks ) { byName[ c.name ] = c; }

    return {
        header,
        has: ( name ) => name in byName,
        get: ( name ) =>
        {
            const c = byName[ name ];
            if ( !c ) throw new Error( "world file: no chunk " + name );
            const type = TYPES[ c.type ];
            const start = bytes.byteOffset + area + c.offset;
            return new type( bytes.buffer.slice( start, start + c.count * type.BYTES_PER_ELEMENT ));
        },
    };
}
