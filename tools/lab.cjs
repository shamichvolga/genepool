//------------------------------------------------------------------------------
// Laboratory bench: many short runs at once, on all processor cores.
//
// An experiment is a JSON file (see tools/lab/*.json):
//   { "name": "larva", "steps": 30000, "every": 2000, "seeds": 10, "world": 1,
//     "arms": [ { "name": "ctl", "set": {} },
//               { "name": "larva", "set": { "LARVA_DISPERSAL_ENABLED": "true" } } ] }
// The first arm is the control. Every arm runs with the same seeds, from the
// same code. "world": 1 = the small pool (8000 x 8000, up to 1500 swimbots, the
// same density as the normal one), about 4 times faster than the normal pool.
//
//   node tools/lab.cjs tools/lab/larva.json [--jobs 11] [--root <project>]
//
// Runs that are already finished are skipped: if the chat or the computer
// stops, start it again and it goes on. At the end (and after every finished
// run) tools/results/lab-<name>/REPORT.md is written:
//   - per arm and checkpoint: effective number of forms (by parts) and of body
//     plans, the share of the main form, swimbots alive - mean and spread over seeds;
//   - every arm against the control: the difference and a permutation test
//     (how often a random relabelling of the seeds gives a difference this big).
//------------------------------------------------------------------------------
"use strict";
const fs = require( "fs" );
const os = require( "os" );
const path = require( "path" );
const { spawn } = require( "child_process" );

const arg = ( name, fallback ) => { const i = process.argv.indexOf( "--" + name ); return ( i >= 0 ) ? process.argv[ i + 1 ] : fallback; };
const specFile = process.argv[2];
if ( !specFile || specFile.startsWith( "--" )) { console.log( "node tools/lab.cjs <experiment.json> [--jobs N] [--root project]" ); process.exit( 1 ); }
const spec = JSON.parse( fs.readFileSync( specFile, "utf8" ));
const ROOT = path.resolve( arg( "root", spec.root || path.join( __dirname, ".." )));
const JOBS = parseInt( arg( "jobs", String( Math.max( 1, os.cpus().length - 1 ))), 10 );
const OUT  = path.join( __dirname, "results", "lab-" + spec.name );
const seeds = Array.isArray( spec.seeds ) ? spec.seeds : Array.from({ length: spec.seeds || 5 }, ( _, i ) => i + 1 );
fs.mkdirSync( OUT, { recursive: true });

const jobs = [];
for ( const seed of seeds ) for ( const arm of spec.arms ) jobs.push({ arm, seed, dir: path.join( OUT, arm.name + "-s" + seed ) });
const finished = ( job ) =>
{
    try { const s = JSON.parse( fs.readFileSync( path.join( job.dir, "summary.json" ), "utf8" )); return s.stepsDone >= spec.steps; }
    catch ( e ) { return false; }
};

function runJob( job )
{
    return new Promise(( resolve ) =>
    {
        const set = Object.assign({}, spec.set || {}, job.arm.set || {});
        if ( spec.world ) set.DEFAULT_WORLD_SCALE = String( spec.world );
        const setText = Object.entries( set ).map(([ k, v ]) => k + "=" + v ).join( "," );
        const argv = [ path.join( ROOT, "tools", "form-census.cjs" ), "--seed", String( job.seed ), "--steps", String( spec.steps ),
                       "--every", String( spec.every || 2000 ), "--out", job.dir ];
        if ( setText ) argv.push( "--set", setText );
        const log = fs.openSync( job.dir + ".log", "w" );
        const child = spawn( process.execPath, argv, { cwd: ROOT, stdio: [ "ignore", log, log ] });
        child.on( "exit", ( code ) => { fs.closeSync( log ); resolve( code ); });
    });
}

//------------------------------------------------------------
// the report
//------------------------------------------------------------
function readCensus( dir )
{
    try
    {
        const lines = fs.readFileSync( path.join( dir, "census.csv" ), "utf8" ).trim().split( "\n" );
        const head = lines[0].split( "," );
        return lines.slice( 1 ).map( l => { const v = l.split( "," ); const r = {}; head.forEach(( h, i ) => r[h] = v[i] ); return r; });
    }
    catch ( e ) { return []; }
}
function measures( r )
{
    const counts = []; for ( let k = 2; k <= 16; k++ ) counts.push( parseFloat( r[ "parts_" + k ] ) || 0 );
    const n = counts.reduce(( a, b ) => a + b, 0 ) || 1;
    let H = 0, top = 0; for ( const c of counts ) if ( c > 0 ) { H -= c / n * Math.log( c / n ); top = Math.max( top, c / n ); }
    return { forms: Math.exp( H ), top, alive: parseFloat( r.alive ), plans: r.plan_eff !== undefined ? parseFloat( r.plan_eff ) : NaN };
}
const BIRTH_MARKS = [ 1000, 2000, 3000, 4000, 6000, 8000 ];
const mean = ( a ) => a.reduce(( s, x ) => s + x, 0 ) / Math.max( 1, a.length );
const sd   = ( a ) => { const m = mean( a ); return Math.sqrt( a.reduce(( s, x ) => s + ( x - m ) * ( x - m ), 0 ) / Math.max( 1, a.length - 1 )); };
function permutationP( a, b, rounds = 4000 )
{
    const all = a.concat( b ), d0 = Math.abs( mean( a ) - mean( b ));
    let hits = 0, state = 12345;
    const rnd = () => { state = ( state * 1103515245 + 12345 ) % 2147483648; return state / 2147483648; };
    for ( let i = 0; i < rounds; i++ )
    {
        const x = all.slice(); for ( let j = x.length - 1; j > 0; j-- ) { const k = Math.floor( rnd() * ( j + 1 )); [ x[j], x[k] ] = [ x[k], x[j] ]; }
        if ( Math.abs( mean( x.slice( 0, a.length )) - mean( x.slice( a.length ))) >= d0 - 1e-12 ) hits ++;
    }
    return hits / rounds;
}

function writeReport()
{
    const every = spec.every || 2000;
    const checkpoints = [];
    for ( let s = 0; s <= spec.steps; s += every ) if ( s > 0 && ( s % Math.max( every, Math.round( spec.steps / 5 / every ) * every ) === 0 || s === spec.steps )) checkpoints.push( s );
    const data = {};   // arm -> step -> [ measures per seed ]
    for ( const arm of spec.arms )
    {
        data[ arm.name ] = {};
        for ( const seed of seeds )
            for ( const r of readCensus( path.join( OUT, arm.name + "-s" + seed )))
            {
                const st = parseInt( r.step, 10 );
                ( data[ arm.name ][ st ] = data[ arm.name ][ st ] || [] ).push( measures( r ));
            }
    }
    const f = ( x, d = 2 ) => isFinite( x ) ? x.toFixed( d ) : "–";
    const lines = [ "# Опыт «" + spec.name + "» (лабораторный стенд)", "",
                    "Шагов " + spec.steps + ", миров " + seeds.length + ", размер мира " + ( spec.world || "как задано" ) + ". Контроль — «" + spec.arms[0].name + "». Готово прогонов: " + jobs.filter( finished ).length + " из " + jobs.length + ".", "",
                    "Плечи: " + spec.arms.map( a => "**" + a.name + "** " + JSON.stringify( a.set || {} )).join( "; " ), "" ];
    for ( const [ key, title ] of [ [ "forms", "Эффективное число форм (по числу частей)" ], [ "plans", "Эффективное число планов тела (звенья × лапы)" ], [ "top", "Доля главной формы" ], [ "alive", "Живых" ] ] )
    {
        lines.push( "## " + title, "", "| плечо | " + checkpoints.join( " | " ) + " |", "|---|" + checkpoints.map(() => "---|" ).join( "" ));
        for ( const arm of spec.arms )
            lines.push( "| " + arm.name + " | " + checkpoints.map( s => { const v = ( data[ arm.name ][s] || [] ).map( m => m[ key ] ).filter( isFinite ); return v.length ? f( mean( v ), key === "alive" ? 0 : 2 ) + " ± " + f( sd( v ), key === "alive" ? 0 : 2 ) + " (" + v.length + ")" : "–"; }).join( " | " ) + " |" );
        lines.push( "" );
    }
    // at equal numbers of births (generations), not of steps: an arm that only
    // slows breeding down looks more diverse at the same step, but is not
    const byBirths = {};   // arm -> births -> [ measures per seed ]
    for ( const arm of spec.arms )
    {
        byBirths[ arm.name ] = {};
        for ( const seed of seeds )
        {
            const dir = path.join( OUT, arm.name + "-s" + seed );
            let born = [];
            try { born = fs.readFileSync( path.join( dir, "births.csv" ), "utf8" ).trim().split( "\n" ).slice( 1 ).map( l => parseInt( l, 10 )); } catch ( e ) {}
            const rows = readCensus( dir );
            for ( const B of BIRTH_MARKS )
            {
                if ( born.length < B || !rows.length ) continue;
                const at = born[ B - 1 ];
                const row = rows.reduce(( best, r ) => Math.abs( parseInt( r.step, 10 ) - at ) < Math.abs( parseInt( best.step, 10 ) - at ) ? r : best );
                ( byBirths[ arm.name ][B] = byBirths[ arm.name ][B] || [] ).push( measures( row ));
            }
        }
    }
    lines.push( "## При равном числе рождений (по поколениям)", "", "Эффективное число форм / планов; в скобках — сколько миров дошло до этого числа рождений.", "",
                "| плечо | " + BIRTH_MARKS.join( " | " ) + " |", "|---|" + BIRTH_MARKS.map(() => "---|" ).join( "" ));
    for ( const arm of spec.arms )
        lines.push( "| " + arm.name + " | " + BIRTH_MARKS.map( B => { const v = byBirths[ arm.name ][B] || []; return v.length ? f( mean( v.map( m => m.forms ))) + " / " + f( mean( v.map( m => m.plans ))) + " (" + v.length + ")" : "–"; }).join( " | " ) + " |" );
    lines.push( "" );
    const ctlName = spec.arms[0].name;
    lines.push( "Против контроля при равных рождениях (последняя отметка, до которой дошли не меньше половины миров обоих плеч):", "", "| плечо | рождений | формы: разница | p | планы: разница | p |", "|---|---|---|---|---|---|" );
    for ( const arm of spec.arms.slice( 1 ))
    {
        const B = BIRTH_MARKS.slice().reverse().find( B => ( byBirths[ arm.name ][B] || [] ).length >= seeds.length / 2 && ( byBirths[ ctlName ][B] || [] ).length >= seeds.length / 2 );
        if ( !B ) { lines.push( "| " + arm.name + " | – | – | – | – | – |" ); continue; }
        const x = byBirths[ arm.name ][B], c = byBirths[ ctlName ][B];
        const cell = ( key ) => { const a = x.map( m => m[ key ] ).filter( isFinite ), b = c.map( m => m[ key ] ).filter( isFinite ); return ( a.length && b.length ) ? f( mean( a ) - mean( b )) + " | " + f( permutationP( a, b ), 3 ) : "– | –"; };
        lines.push( "| " + arm.name + " | " + B + " | " + cell( "forms" ) + " | " + cell( "plans" ) + " |" );
    }
    lines.push( "" );

    const last = checkpoints[ checkpoints.length - 1 ];
    lines.push( "## Против контроля на шаге " + last, "", "| плечо | формы: разница | p | планы: разница | p |", "|---|---|---|---|---|" );
    const ctl = data[ spec.arms[0].name ][ last ] || [];
    for ( const arm of spec.arms.slice( 1 ))
    {
        const x = data[ arm.name ][ last ] || [];
        const cell = ( key ) => { const a = x.map( m => m[ key ] ).filter( isFinite ), b = ctl.map( m => m[ key ] ).filter( isFinite ); return ( a.length && b.length ) ? f( mean( a ) - mean( b )) + " | " + f( permutationP( a, b ), 3 ) : "– | –"; };
        lines.push( "| " + arm.name + " | " + cell( "forms" ) + " | " + cell( "plans" ) + " |" );
    }
    lines.push( "", "p — доля случайных перестановок миров между плечами, где разница не меньше. p < 0,05 — разница скорее настоящая; при p > 0,2 — скорее случайность." );
    fs.writeFileSync( path.join( OUT, "REPORT.md" ), lines.join( "\n" ) + "\n" );
}

(async () =>
{
    const todo = jobs.filter( j => !finished( j ));
    console.log( "lab " + spec.name + ": " + jobs.length + " runs, " + todo.length + " to do, " + JOBS + " at a time" );
    let next = 0, done = 0;
    const worker = async () =>
    {
        while ( next < todo.length )
        {
            const job = todo[ next ++ ];
            const code = await runJob( job );
            done ++;
            console.log( "  " + job.arm.name + " seed " + job.seed + ( code === 0 ? " done" : " failed (" + code + ")" ) + " - " + done + "/" + todo.length );
            writeReport();
        }
    };
    await Promise.all( Array.from({ length: Math.min( JOBS, todo.length ) }, worker ));
    writeReport();
    console.log( "report: " + path.join( OUT, "REPORT.md" ));
})();
