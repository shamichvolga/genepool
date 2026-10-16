//------------------------------------------------------------------------------
// Compare the 250 000-step experiments (tools/run-experiments.sh): for each
// configuration (averaged over its seeds) - population, form diversity
// (how many body forms hold at least 10 % of the population, Shannon index of
// the number of parts), mass, meals, causes of death, children.
//
//   node tools/experiment-compare.cjs [results folder] [--prefix exp-] [--at STEP] > report.md
//
// --prefix: which run folders (exp-<config>-<seed>, r3-<config>-<seed> ...);
// --at: compare every run at this step (runs that went further are cut there,
// so configurations of different speed are compared fairly).
//------------------------------------------------------------------------------
"use strict";
const fs = require( "fs" );
const path = require( "path" );
const option = ( name, fallback ) => { const i = process.argv.indexOf( "--" + name ); return i >= 0 ? process.argv[ i + 1 ] : fallback; };
const dir    = ( process.argv[2] && !process.argv[2].startsWith( "--" )) ? process.argv[2] : path.join( __dirname, "results" );
const PREFIX = option( "prefix", "exp-" );
const AT     = +option( "at", "Infinity" );

function readCsv( file )
{
    const lines = fs.readFileSync( file, "utf8" ).trim().split( "\n" );
    const head = lines[0].split( "," );
    return lines.slice( 1 ).map( l => { const v = l.split( "," ); const o = {}; head.forEach( ( h, i ) => o[h] = v[i] === "" ? NaN : ( isNaN( +v[i] ) ? v[i] : +v[i] )); return o; });
}
const mean = a => a.length ? a.reduce( ( s, x ) => s + x, 0 ) / a.length : NaN;
const f = ( x, d = 1 ) => Number.isFinite( x ) ? x.toFixed( d ) : "–";

// diversity of the number of parts in one census row
function partsDiversity( row )
{
    const counts = []; for ( let p = 2; p <= 16; p++ ) counts.push( row[ "parts_" + p ] || 0 );
    const total = counts.reduce( ( s, x ) => s + x, 0 ) || 1;
    const shares = counts.map( c => c / total );
    const shannon = -shares.filter( x => x > 0 ).reduce( ( s, x ) => s + x * Math.log( x ), 0 );
    return { forms10: shares.filter( x => x >= 0.10 ).length, effective: Math.exp( shannon ), top: Math.max( ...shares ) };
}

const runs = fs.readdirSync( dir ).filter( d => d.startsWith( PREFIX ) && fs.existsSync( path.join( dir, d, "census.csv" )));
const byConfig = {};
for ( const r of runs ) { const cfg = r.slice( PREFIX.length ).replace( /-\d+$/, "" ); ( byConfig[ cfg ] = byConfig[ cfg ] || [] ).push( r ); }

let md = `# Эксперименты разных форм: сравнение\n\nПапка: ${ dir }. Для каждой конфигурации — среднее по семенам. «Форм ≥ 10 %» — сколько вариантов числа частей держат каждый не меньше 10 % популяции; «эффективное число форм» — exp(энтропии Шеннона) распределения числа частей. Последние 50 000 шагов — среднее по переписям этого отрезка.\n\n`;
md += `| конфигурация | семян | шагов | живых | хищников | масса p50 | частей p50 | форм ≥ 10 % (конец) | эфф. число форм (последние 50k) | доля главной формы | голод % | хищник % | детей на смерть | еды за жизнь |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

for ( const [ cfg, list ] of Object.entries( byConfig ).sort())
{
    const rows = [];
    for ( const r of list )
    {
        const census = readCsv( path.join( dir, r, "census.csv" )).filter( c => c.step <= AT );
        if ( census.length === 0 ) continue;
        const last = census[ census.length - 1 ];
        const lateRows = census.filter( c => c.step >= last.step - 50000 );
        const div = partsDiversity( last );
        const late = lateRows.map( partsDiversity );
        let deaths = [];
        try { deaths = readCsv( path.join( dir, r, "deaths.csv" )).filter( d => d.step >= last.step - 50000 && d.step <= last.step ); } catch ( e ) {}
        const born = deaths.filter( d => d.step - d.age > 0 );
        rows.push({
            steps: last.step, alive: last.alive, predators: last.predators, mass: last.mass_p50, parts: last.parts_p50,
            forms10: div.forms10, effective: mean( late.map( x => x.effective )), top: div.top,
            starv: deaths.length ? 100 * deaths.filter( d => d.cause === "starvation" ).length / deaths.length : NaN,
            pred: deaths.length ? 100 * deaths.filter( d => d.cause === "predation" ).length / deaths.length : NaN,
            children: mean( born.map( d => d.children )), meals: mean( born.map( d => d.meals )),
        });
    }
    const m = k => mean( rows.map( x => x[k] ));
    md += `| ${ cfg } | ${ rows.length } | ${ f( m( "steps" ), 0 ) } | ${ f( m( "alive" ), 0 ) } | ${ f( m( "predators" ), 0 ) } | ${ f( m( "mass" ), 0 ) } | ${ f( m( "parts" ), 1 ) } | ${ f( m( "forms10" ), 1 ) } | ${ f( m( "effective" ), 2 ) } | ${ f( 100 * m( "top" ), 0 ) } % | ${ f( m( "starv" ), 0 ) } | ${ f( m( "pred" ), 0 ) } | ${ f( m( "children" ), 2 ) } | ${ f( m( "meals" ), 2 ) } |\n`;
}
md += `\nПо отдельным семенам — \`census.csv\` в каждой папке \`${ PREFIX }*\`.${ Number.isFinite( AT ) ? ` Все прогоны обрезаны на шаге ${ AT }.` : "" }\n`;
process.stdout.write( md );
