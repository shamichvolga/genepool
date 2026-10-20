//------------------------------------------------------------------------------
// Runs the user starts in the browser (src/RunRecorder.ts sends, this keeps):
//
//   saveRunChunk( root, chunk )  appends a chunk to its run folder under root
//                                and rewrites the folder's REPORT.md
//   makeReport( folder )         the short summary of one run (Markdown)
//
// Used by the page's server (vite.config.ts, /__runs). Also by hand:
//
//   node tools/run-report.mjs runs/<folder>      prints the report
//   node tools/run-report.mjs runs                lists the runs, newest first
//------------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";

const folderOf = {};   // run id -> its folder (renamed as the run goes on)

function folderName( meta )
{
    const k = Math.floor( meta.step / 1000 );
    return meta.id + "_v" + meta.version.replace( /[^\w.+-]/g, "" ) + "_" + meta.mode.replace( /[^\w-]/g, "" ) + "_" + k + "k-steps";
}

export function saveRunChunk( root, chunk )
{
    fs.mkdirSync( root, { recursive: true });
    const wanted = path.join( root, folderName( chunk ));
    let folder = folderOf[ chunk.id ];
    if ( !folder )
    {
        // (the server restarted: find the folder of this run by its id)
        const found = fs.readdirSync( root ).find( d => d.startsWith( chunk.id + "_" ));
        folder = found ? path.join( root, found ) : wanted;
    }
    if ( folder !== wanted && fs.existsSync( folder )) { try { fs.renameSync( folder, wanted ); folder = wanted; } catch ( e ) { /* (open elsewhere: keep the old name) */ } }
    if ( !fs.existsSync( folder )) { fs.mkdirSync( folder, { recursive: true }); }
    folderOf[ chunk.id ] = folder;

    const append = ( file, header, rows ) =>
    {
        if ( !rows || rows.length === 0 ) return;
        const p = path.join( folder, file );
        if ( !fs.existsSync( p )) fs.writeFileSync( p, header + "\n" );
        fs.appendFileSync( p, rows.join( "\n" ) + "\n" );
    };
    append( "census.csv", chunk.censusHeader, chunk.census );
    append( "deaths.csv", chunk.deathsHeader, chunk.deaths );

    const metaFile = path.join( folder, "meta.json" );
    const old = fs.existsSync( metaFile ) ? JSON.parse( fs.readFileSync( metaFile, "utf8" )) : { started: new Date().toISOString() };
    const meta = { ...old, id: chunk.id, version: chunk.version, mode: chunk.mode, censusEvery: chunk.censusEvery, lastStep: chunk.step, lastSaved: new Date().toISOString() };
    fs.writeFileSync( metaFile, JSON.stringify( meta, null, 2 ));
    fs.writeFileSync( path.join( folder, "REPORT.md" ), makeReport( folder ));
    return folder;
}

function readCsv( file )
{
    if ( !fs.existsSync( file )) return [];
    const lines = fs.readFileSync( file, "utf8" ).trim().split( "\n" );
    const head = lines[0].split( "," );
    return lines.slice( 1 ).map( l => { const v = l.split( "," ); const o = {}; head.forEach( ( h, i ) => o[h] = ( v[i] === "" || v[i] === undefined ) ? NaN : +v[i] ); return o; });
}

function partsDiversity( row )
{
    const counts = []; for ( let p = 2; p <= 16; p++ ) counts.push( row[ "parts_" + p ] || 0 );
    const total = counts.reduce( ( s, x ) => s + x, 0 ) || 1;
    const shares = counts.map( c => c / total );
    const shannon = -shares.filter( x => x > 0 ).reduce( ( s, x ) => s + x * Math.log( x ), 0 );
    const top = shares.indexOf( Math.max( ...shares ));
    return { effective: Math.exp( shannon ), topShare: shares[ top ], topParts: top + 2 };
}

const f = ( x, d = 0 ) => Number.isFinite( x ) ? x.toFixed( d ) : "–";
const pct = x => Number.isFinite( x ) ? Math.round( x * 100 ) + " %" : "–";

export function makeReport( folder )
{
    const meta = JSON.parse( fs.readFileSync( path.join( folder, "meta.json" ), "utf8" ));
    const census = readCsv( path.join( folder, "census.csv" ));
    const deaths = readCsv( path.join( folder, "deaths.csv" ));
    if ( census.length === 0 ) return "# " + path.basename( folder ) + "\n\n(no census yet)\n";

    const last = census[ census.length - 1 ];
    const alive = census.map( c => c.alive ), preds = census.map( c => c.predators ), plants = census.map( c => c.plants );
    const minOf = a => Math.min( ...a ), maxOf = a => Math.max( ...a );
    const after = census.filter( c => c.step >= Math.min( 40000, last.step / 2 ));
    const extinct = census.find( c => c.alive === 0 );
    const predGone = census.filter( ( c, i ) => i > 0 && c.predators === 0 && census[ i - 1 ].predators > 0 ).map( c => c.step );
    const predBack = census.filter( ( c, i ) => i > 0 && c.predators > 0 && census[ i - 1 ].predators === 0 ).map( c => c.step );

    // swings: how often the population fell to under a third of its last peak
    let peak = 0, crashes = 0, falling = false;
    for ( const c of census ) { if ( c.alive > peak ) { peak = c.alive; falling = false; } if ( !falling && c.alive < peak / 3 ) { crashes ++; falling = true; peak = c.alive; } }

    const sum = ( rows, key ) => rows.reduce( ( s, r ) => s + ( Number.isFinite( r[ key ] ) ? r[ key ] : 0 ), 0 );
    const causes = [ "starvation", "predation", "old_age", "other" ];
    const herbDeaths = causes.map( c => sum( deaths, "herb_" + c )), predDeaths = causes.map( c => sum( deaths, "pred_" + c ));
    const share = ( a ) => { const t = a.reduce( ( s, x ) => s + x, 0 ) || 1; return causes.map( ( c, i ) => c + " " + pct( a[i] / t )).join( ", " ); };

    // a table: about 12 rows across the run
    const every = Math.max( 1, Math.ceil( census.length / 12 ));
    const rows = census.filter( ( c, i ) => i % every === 0 || i === census.length - 1 );
    let table = "| step | alive | predators | plants | meat | sick | parts p50 | mass p50 | eff. forms | main form | clusters | steps/s |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";
    for ( const c of rows )
    {
        const d = partsDiversity( c );
        table += `| ${ c.step } | ${ c.alive } | ${ c.predators } | ${ c.plants } | ${ c.meat } | ${ f( c.sick ) } | ${ f( c.parts_p50 ) } | ${ f( c.mass_p50 ) } | ${ f( d.effective, 2 ) } | ${ d.topParts } parts ${ pct( d.topShare ) } | ${ f( c.genetic_clusters ) } (${ pct( c.largest_cluster_share ) }) | ${ f( c.steps_per_second ) } |\n`;
    }

    const lastDiv = partsDiversity( last );
    const lateDiv = after.map( partsDiversity );
    const meanOf = a => a.length ? a.reduce( ( s, x ) => s + x, 0 ) / a.length : NaN;

    return `# Run ${ path.basename( folder ) }

- code version: **${ meta.version }**; pool: ${ meta.mode }
- started ${ meta.started }, last saved ${ meta.lastSaved }
- steps: **${ last.step }** (census every ${ meta.censusEvery })

## In short
- population: now ${ last.alive }; min ${ minOf( alive ) }, max ${ maxOf( alive ) }; after step ${ after.length ? after[0].step : "–" }: min ${ after.length ? minOf( after.map( c => c.alive )) : "–" }, max ${ after.length ? maxOf( after.map( c => c.alive )) : "–" }
- crashes (to under a third of the peak): ${ crashes }${ extinct ? "; **extinct at step " + extinct.step + "**" : "" }
- predators: now ${ last.predators }; max ${ maxOf( preds ) }; died out at ${ predGone.join( ", " ) || "never" }; came back at ${ predBack.join( ", " ) || "–" }
- plants: now ${ last.plants }; min ${ minOf( plants ) }, max ${ maxOf( plants ) }
- forms (number of parts): now ${ f( lastDiv.effective, 2 ) } effective, main form ${ lastDiv.topParts } parts with ${ pct( lastDiv.topShare ) }; second half mean ${ f( meanOf( lateDiv.map( d => d.effective )), 2 ) } effective, main form ${ pct( meanOf( lateDiv.map( d => d.topShare ))) }
- bodies: parts p50 ${ f( last.parts_p50 ) } (p90 ${ f( last.parts_p90 ) }), mass p50 ${ f( last.mass_p50 ) } (p90 ${ f( last.mass_p90 ) })
- births: ${ f( sum( census, "births" )) }; deaths: herbivores ${ herbDeaths.reduce( ( s, x ) => s + x, 0 ) } (${ share( herbDeaths ) }), predators ${ predDeaths.reduce( ( s, x ) => s + x, 0 ) } (${ share( predDeaths ) }); sick at death ${ f( sum( deaths, "sick_at_death" )) }

## Over time
${ table }
Files: census.csv (every census, the columns of tools/form-census.cjs and more), deaths.csv (deaths by cause between censuses).
`;
}

// by hand
if ( process.argv[1] && process.argv[1].endsWith( "run-report.mjs" ))
{
    const target = process.argv[2] || "runs";
    if ( fs.existsSync( path.join( target, "meta.json" ))) { console.log( makeReport( target )); }
    else
    {
        const list = fs.existsSync( target ) ? fs.readdirSync( target ).filter( d => fs.existsSync( path.join( target, d, "meta.json" ))).sort().reverse() : [];
        for ( const d of list ) { const m = JSON.parse( fs.readFileSync( path.join( target, d, "meta.json" ), "utf8" )); console.log( d, " last saved", m.lastSaved ); }
        if ( list.length === 0 ) console.log( "no runs in", target );
    }
}
