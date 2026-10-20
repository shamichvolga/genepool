//------------------------------------------------------------------------------
// Predators by body size: how they die, how much prey they got, how long they
// lived. From the deaths.csv of form-census runs.
//
//   node tools/predator-by-size.cjs tools/results --prefix d19- [--from STEP] [--at STEP]
//------------------------------------------------------------------------------
"use strict";
const fs = require( "fs" ), path = require( "path" );
const opt = ( n, d ) => { const i = process.argv.indexOf( "--" + n ); return i >= 0 ? process.argv[ i + 1 ] : d; };
const dir = process.argv[2], PREFIX = opt( "prefix", "" ), AT = +opt( "at", "Infinity" ), FROM = +opt( "from", "0" );
const groups = {};
for ( const run of fs.readdirSync( dir ).filter( d => d.startsWith( PREFIX ) && fs.existsSync( path.join( dir, d, "deaths.csv" ))))
{
    const cfg = run.slice( PREFIX.length ).replace( /-\d+$/, "" );
    const lines = fs.readFileSync( path.join( dir, run, "deaths.csv" ), "utf8" ).trim().split( "\n" );
    const h = lines[0].split( "," ), ix = k => h.indexOf( k );
    const iStep = ix( "step" ), iLevel = ix( "predator_level" ), iParts = ix( "parts" ), iCause = ix( "cause" ), iPrey = ix( "prey_gained" ), iAge = ix( "age" ), iKids = ix( "children" );
    for ( let n = 1; n < lines.length; n++ )
    {
        const v = lines[n].split( "," );
        const step = +v[ iStep ]; if ( step > AT || step < FROM ) continue;
        if ( +v[ iLevel ] <= 0.5 ) continue;
        const parts = +v[ iParts ];
        const size = parts <= 6 ? "a ≤6" : parts <= 11 ? "b 7-11" : "c 12+";
        const key = cfg + "|" + size;
        const g = groups[ key ] = groups[ key ] || { n: 0, starve: 0, prey: 0, age: 0, kids: 0, caught: 0 };
        g.n ++; if ( v[ iCause ] === "starvation" ) g.starve ++;
        g.prey += +v[ iPrey ]; g.age += +v[ iAge ]; g.kids += +v[ iKids ];
        if ( +v[ iPrey ] > 0 ) g.caught ++;
    }
}
console.log( "| config | parts | predator deaths | starved | caught any prey | prey energy / life | age | children |\n|---|---|---|---|---|---|---|---|" );
for ( const [ k, g ] of Object.entries( groups ).sort())
{
    const [ cfg, size ] = k.split( "|" );
    console.log( `| ${ cfg } | ${ size.slice( 2 ) } | ${ g.n } | ${ Math.round( 100 * g.starve / g.n ) } % | ${ Math.round( 100 * g.caught / g.n ) } % | ${ ( g.prey / g.n ).toFixed( 0 ) } | ${ ( g.age / g.n ).toFixed( 0 ) } | ${ ( g.kids / g.n ).toFixed( 2 ) } |` );
}
