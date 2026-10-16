//------------------------------------------------------------------------------
// Report on tools/form-census.cjs results: tables by body mass and by number
// of parts, over all given result folders (several seeds).
//
//   node tools/form-census-report.cjs tools/results/census-1 tools/results/census-2 ... > report.md
//------------------------------------------------------------------------------
"use strict";
const fs = require( "fs" );
const path = require( "path" );

const dirs = process.argv.slice( 2 );
function readCsv( file )
{
    const lines = fs.readFileSync( file, "utf8" ).trim().split( "\n" );
    const head = lines[0].split( "," );
    return lines.slice( 1 ).map( l => { const v = l.split( "," ); const o = {}; head.forEach( ( h, i ) => o[h] = isNaN( +v[i] ) || v[i] === "" ? v[i] : +v[i] ); return o; });
}

const deaths = [], births = [], census = {};
for ( const d of dirs )
{
    deaths.push( ...readCsv( path.join( d, "deaths.csv" )));
    births.push( ...readCsv( path.join( d, "births.csv" )));
    census[ path.basename( d ) ] = readCsv( path.join( d, "census.csv" ));
}

const mean = a => a.length ? a.reduce( ( s, x ) => s + x, 0 ) / a.length : NaN;
const median = a => { if ( !a.length ) return NaN; const b = a.slice().sort( ( x, y ) => x - y ); return b[ Math.floor( b.length / 2 ) ]; };
const f = ( x, d = 1 ) => Number.isFinite( x ) ? x.toFixed( d ) : "–";
function corr( xs, ys )
{
    const n = xs.length, mx = mean( xs ), my = mean( ys );
    let sxy = 0, sxx = 0, syy = 0;
    for ( let i = 0; i < n; i++ ) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return { r: sxy / Math.sqrt( sxx * syy ), slope: sxy / sxx, n };
}

// born during the run (founders have random ages and no history)
const lived = deaths.filter( d => d.step - d.age > 0 && d.age > 0 );
const herb = lived.filter( d => d.predator_level <= 0.6 ), pred = lived.filter( d => d.predator_level > 0.6 );

function table( rows, key, bins, title )
{
    let out = `\n### ${ title }\n\n| ${ key } | число | голод % | старость % | хищник % | прочее % | средний возраст | медиана возраста | детей в среднем | доля с детьми % | еды за жизнь | приёмов пищи | интервал между едой | средняя скорость | ср. \\|поворот\\| | ср. усилие |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    for ( let i = 0; i < bins.length - 1; i++ )
    {
        const g = rows.filter( d => d[ key ] >= bins[i] && d[ key ] < bins[ i + 1 ] );
        if ( g.length < 20 ) continue;
        const pct = c => f( 100 * g.filter( d => d.cause === c ).length / g.length, 0 );
        out += `| ${ bins[i] }–${ bins[ i + 1 ] - ( key === "parts" ? 1 : 0 ) } | ${ g.length } | ${ pct( "starvation" ) } | ${ pct( "old_age" ) } | ${ pct( "predation" ) } | ${ pct( "other" ) } | ${ f( mean( g.map( d => d.age )), 0 ) } | ${ f( median( g.map( d => d.age )), 0 ) } | ${ f( mean( g.map( d => d.children )), 2 ) } | ${ f( 100 * g.filter( d => d.children > 0 ).length / g.length, 0 ) } | ${ f( mean( g.map( d => d.food_gained + d.prey_gained )), 0 ) } | ${ f( mean( g.map( d => d.meals )), 1 ) } | ${ f( median( g.filter( d => d.mean_gap_between_meals !== "" ).map( d => d.mean_gap_between_meals )), 0 ) } | ${ f( mean( g.map( d => d.mean_speed )), 3 ) } | ${ f( mean( g.filter( d => d.mean_abs_spin !== "" ).map( d => d.mean_abs_spin )), 3 ) } | ${ f( mean( g.filter( d => d.mean_effort !== "" ).map( d => d.mean_effort )), 2 ) } |\n`;
    }
    return out;
}

let md = `# Перепись форм тела: данные прогонов\n\nПрогоны: ${ dirs.map( d => path.basename( d )).join( ", " ) }; режим «random» (среда включена), все настройки по умолчанию, мир 16 000 × 16 000 (до 6 000 существ), по 50 000 шагов. Учтены только существа, родившиеся во время прогона (основатели стартуют со случайным возрастом).\n\nСмертей учтено: ${ lived.length } (травоядных ${ herb.length }, хищников ${ pred.length }); рождений: ${ births.length }.\n`;

// energy budget per step of life (what was spent on living)
md += `\n## Расход энергии за шаг жизни (по массе, травоядные)\n\nРасход = (энергия при рождении + съеденное − отданное детям − энергия при смерти) / возраст. Это всё вместе: плавание, постоянный расход, плата за температуру.\n\n| масса | число | расход за шаг | из него «постоянный» 0,0001 % |\n|---|---|---|---|\n`;
const MASS = [ 0, 200, 400, 600, 800, 1000, 1300, 3000 ];
for ( let i = 0; i < MASS.length - 1; i++ )
{
    const g = herb.filter( d => d.mass >= MASS[i] && d.mass < MASS[ i + 1 ] && d.age > 200 );
    if ( g.length < 20 ) continue;
    const spend = g.map( d => ( d.energy_at_birth + d.food_gained + d.prey_gained - d.given_to_children - d.energy_at_death ) / d.age );
    md += `| ${ MASS[i] }–${ MASS[ i + 1 ] } | ${ g.length } | ${ f( mean( spend ), 4 ) } | ${ f( 100 * 0.0001 / mean( spend ), 1 ) } |\n`;
}

md += table( herb, "mass", MASS, "Травоядные по массе" );
md += table( herb, "parts", [ 2, 4, 6, 8, 10, 12, 14, 17 ], "Травоядные по числу частей" );
md += table( pred, "mass", MASS, "Хищники по массе" );

// heritability and mating
const full = births.filter( b => Number.isFinite( b.parent2_mass ) && Number.isFinite( b.parent1_mass ));
const mid = full.map( b => ( b.parent1_mass + b.parent2_mass ) / 2 ), child = full.map( b => b.child_mass );
const h = corr( mid, child );
const assort = corr( full.map( b => b.parent1_mass ), full.map( b => b.parent2_mass ));
const assortParts = corr( full.map( b => b.parent1_parts ), full.map( b => b.parent2_parts ));
const hParts = corr( full.map( b => ( b.parent1_parts + b.parent2_parts ) / 2 ), full.map( b => b.child_parts ));
md += `\n## Наследуемость и выбор партнёра\n\n| показатель | значение |\n|---|---|\n`
    + `| рождений с обоими родителями | ${ full.length } |\n`
    + `| масса потомка от средней массы родителей: наклон (≈ наследуемость h²) | ${ f( h.slope, 2 ) } (r = ${ f( h.r, 2 ) }) |\n`
    + `| число частей потомка от среднего у родителей: наклон | ${ f( hParts.slope, 2 ) } (r = ${ f( hParts.r, 2 ) }) |\n`
    + `| сходство масс партнёров (корреляция) | ${ f( assort.r, 2 ) } |\n`
    + `| сходство числа частей партнёров (корреляция) | ${ f( assortParts.r, 2 ) } |\n`
    + `| энергия новорождённого: медиана | ${ f( median( births.map( b => b.child_energy )), 1 ) } |\n`;

// census over time (seed 1..n): medians
md += `\n## Перепись во времени (медианы; по прогонам)\n\n| прогон | шаг | живых | хищников | растений | мясо | масса p10 / p50 / p90 | частей p10 / p50 / p90 | частота взмахов p50 | энергия p50 | возраст p50 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for ( const [ name, rows ] of Object.entries( census ))
{
    for ( const r of rows.filter( r => r.step % 10000 === 0 ))
    {
        md += `| ${ name } | ${ r.step } | ${ r.alive } | ${ r.predators } | ${ r.plants } | ${ r.meat } | ${ r.mass_p10 } / ${ r.mass_p50 } / ${ r.mass_p90 } | ${ r.parts_p10 } / ${ r.parts_p50 } / ${ r.parts_p90 } | ${ r.freq_p50 } | ${ r.energy_p50 } | ${ r.age_p50 } |\n`;
    }
}

// parts histogram at the end
md += `\n## Распределение числа частей в конце (шаг 50 000, все прогоны вместе)\n\n| частей | ${ Array.from({ length: 15 }, ( _, i ) => i + 2 ).join( " | " ) } |\n|---|${ "---|".repeat( 15 ) }\n| существ | `;
const last = Object.values( census ).map( rows => rows[ rows.length - 1 ] );
md += Array.from({ length: 15 }, ( _, i ) => last.reduce( ( s, r ) => s + ( r[ "parts_" + ( i + 2 )] || 0 ), 0 )).join( " | " ) + " |\n";

process.stdout.write( md );
