// Usage: node tools/profile-lines.cjs <function name substring> [profile dir]
// Shows which lines of the headless bundle a function spends its time on.
"use strict";
const fs = require( "fs" ), path = require( "path" );
const dir = process.argv[3] || path.join( __dirname, "prof" );
const file = fs.readdirSync( dir ).find( f => f.endsWith( ".cpuprofile" ) );
const profile = JSON.parse( fs.readFileSync( path.join( dir, file ) ) );
const lines = {};
for ( const n of profile.nodes )
{
    if ( n.callFrame.functionName.includes( process.argv[2] ) && n.positionTicks )
        for ( const t of n.positionTicks ) lines[ t.line ] = ( lines[ t.line ] || 0 ) + t.ticks;
}
const esbuild = require( "esbuild" );
const sim = path.join( __dirname, "..", "src", "simulation" );
const modules = fs.readdirSync( sim ).filter( f => f.endsWith( ".ts" ) ).map( f => f.slice( 0, -3 ) );
const entry = [ ...modules.map( ( m, i ) => `import * as m${i} from "./${m}";` ), `Object.assign( globalThis, ${ modules.map( ( m, i ) => "m" + i ).join( ", " ) } );` ].join( "\n" );
const text = esbuild.buildSync({ stdin: { contents: entry, resolveDir: sim, sourcefile: "headless-entry.ts", loader: "ts" }, bundle: true, write: false, format: "iife", target: "es2022" }).outputFiles[0].text.split( "\n" );
const total = Object.values( lines ).reduce( ( a, b ) => a + b, 0 );
for ( const [ line, ticks ] of Object.entries( lines ).sort( ( a, b ) => b[1] - a[1] ).slice( 0, 12 ) )
    console.log( ( 100 * ticks / total ).toFixed( 1 ).padStart( 5 ) + "%  " + text[ line - 1 ].trim().slice( 0, 100 ) );
