// Validate and summarize paired ecological runs produced by eco-matrix.cjs.
//
//   node tools/eco-compare.cjs --dir tools/results/eco-plant-standard-start-10k \
//     --scenarios BASE,C6 --seeds 1,2,3,4,5 --step 10000
"use strict";

const fs = require( "fs" );
const path = require( "path" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

const dir = path.resolve( arg( "dir", path.join( __dirname, "results", "ecology-matrix" ) ));
const scenarios = arg( "scenarios", "BASE,C6" ).split( "," ).map( x => x.trim().toUpperCase() );
const seeds = arg( "seeds", "1,2,3,4,5" ).split( "," ).map( x => parseInt( x.trim(), 10 ) );
const requestedStep = parseInt( arg( "step", "0" ), 10 );
const outputBase = path.resolve( arg( "out", path.join( dir, "comparison" ) ));

if ( scenarios.length < 2 || new Set( scenarios ).size !== scenarios.length ) throw new Error( "provide at least two unique scenarios" );
if ( seeds.length === 0 || seeds.some( x => !Number.isInteger( x ))) throw new Error( "seeds must be comma-separated integers" );
if ( !Number.isInteger( requestedStep ) || requestedStep < 0 ) throw new Error( "step must be a non-negative integer" );

const eventMap = {
    births_interval: "births",
    local_plant_sprouts_interval: "localPlantSprouts",
    seed_rain_plant_sprouts_interval: "seedRainPlantSprouts",
    nutrient_limited_seed_attempts_interval: "nutrientLimitedPlantSeeds",
    meat_decay_events_interval: "meatDecayEvents",
    soil_nutrients_returned_interval: "nutrientsFromMeatDecay",
    plant_meals_interval: "plantMeals",
    meat_meals_interval: "meatMeals",
    pursuit_meat_target_selections_interval: "meatTargetsWhilePursuing",
    pursuit_meat_meals_interval: "meatMealsWhilePursuing",
    prey_kills_interval: "attackCount",
    failed_attacks_interval: "failedAttacks",
    autotomy_threat_drops_interval: "autotomyThreatDrops",
    autotomy_bite_drops_interval: "autotomyBiteDrops",
    autotomy_decoys_eaten_interval: "autotomyDecoysEaten",
    starvation_deaths_interval: "starvationDeaths",
    old_age_deaths_interval: "oldAgeDeaths",
    predation_deaths_interval: "predationDeaths",
    other_deaths_interval: "otherDeaths",
};

const metrics = [
    "alive", "pred", "warm", "cold", "plant_cells_occupied", "plant_cell_occupancy", "plants_per_occupied_cell",
    "coarse_morphotype_bins", "eff_coarse_morphotype_bins", "gene_clusters", "eff_gene_clusters", "top_gene_cluster_share",
    "mate_isolation", "pedigree_matured_offspring", "pedigree_maturity_survival", "mass_mean", "width_mean",
];
const nutrientMetrics = [ "soil_nutrient_cells", "soil_nutrient_mean", "soil_nutrient_p10", "soil_nutrient_p50", "soil_nutrient_p90" ];

function readRun( scenario, seed )
{
    const basename = `${scenario}-seed-${seed}`;
    const csvPath = path.join( dir, basename + ".csv" );
    const jsonPath = path.join( dir, basename + ".json" );
    const lines = fs.readFileSync( csvPath, "utf8" ).trim().split( /\r?\n/ ).map( line => line.split( "," ));
    const header = lines[ 0 ];
    const index = Object.fromEntries( header.map(( name, i ) => [ name, i ]));
    if ( new Set( header ).size !== header.length ) throw new Error( `${basename}: duplicate CSV column` );
    if ( lines.slice( 1 ).some( row => row.length !== header.length )) throw new Error( `${basename}: CSV row/header width mismatch` );

    const metadata = JSON.parse( fs.readFileSync( jsonPath, "utf8" ));
    if ( metadata.seed !== seed || metadata.scenario !== scenario ) throw new Error( `${basename}: CSV/JSON identity mismatch` );
    if ( metadata.schemaVersion >= 2 )
    {
        for ( const [ column, event ] of Object.entries( eventMap ))
        {
            if ( index[ column ] === undefined || metadata.eventTotals[ event ] === undefined ) continue;
            const total = lines.slice( 1 ).reduce(( sum, row ) => sum + Number( row[ index[ column ]] ), 0 );
            if ( total !== metadata.eventTotals[ event ] ) throw new Error( `${basename}: ${column} does not match JSON event total` );
        }
    }

    const row = requestedStep > 0
        ? lines.slice( 1 ).find( r => Number( r[ index.step ]) === requestedStep )
        : lines[ lines.length - 1 ];
    if ( !row ) throw new Error( `${basename}: no sample at step ${requestedStep}` );
    const selectedStep = Number( row[ index.step ]);
    const values = {};
    for ( const name of metrics )
    {
        if ( index[ name ] === undefined ) throw new Error( `${basename}: missing metric ${name}` );
        values[ name ] = Number( row[ index[ name ]] );
    }
    values.plants = values.warm + values.cold;
    for ( const column of Object.keys( eventMap ))
    {
        if ( index[ column ] === undefined ) { values[ column.replace( /_interval$/, "_total" ) ] = 0; continue; }
        values[ column.replace( /_interval$/, "_total" ) ] = lines.slice( 1 )
            .filter( r => Number( r[ index.step ]) <= selectedStep )
            .reduce(( sum, r ) => sum + Number( r[ index[ column ]] ), 0 );
    }
    for ( const name of nutrientMetrics )
    {
        if ( index[ name ] !== undefined ) values[ name ] = Number( row[ index[ name ]] );
    }
    return { scenario, seed, step: selectedStep, values, metadata, columns: header };
}

function stats( values )
{
    const mean = values.reduce(( sum, value ) => sum + value, 0 ) / values.length;
    const sorted = values.slice().sort(( a, b ) => a - b );
    const variance = values.length > 1 ? values.reduce(( sum, value ) => sum + ( value - mean ) ** 2, 0 ) / ( values.length - 1 ) : 0;
    return {
        mean: Number( mean.toFixed( 4 )),
        median: Number( ( sorted.length % 2 ? sorted[ Math.floor( sorted.length / 2 ) ] : ( sorted[ sorted.length / 2 - 1 ] + sorted[ sorted.length / 2 ]) / 2 ).toFixed( 4 )),
        standardDeviation: Number( Math.sqrt( variance ).toFixed( 4 )),
        min: sorted[ 0 ],
        max: sorted[ sorted.length - 1 ],
    };
}

const runs = scenarios.map( scenario => seeds.map( seed => readRun( scenario, seed )));
const schemaVersions = new Set( runs.flatMap( scenarioRuns => scenarioRuns.map( run => run.metadata.schemaVersion )));
if ( schemaVersions.size !== 1 ) throw new Error( "compared runs use different CSV schema versions" );
for ( let i = 1; i < runs.length; i++ )
{
    for ( let s = 0; s < seeds.length; s++ )
    {
        if ( runs[ i ][ s ].step !== runs[ 0 ][ s ].step ) throw new Error( `unmatched checkpoint for seed ${seeds[s]}` );
        if ( runs[ i ][ s ].metadata.stepsExecuted !== runs[ 0 ][ s ].metadata.stepsExecuted ) throw new Error( `unmatched run length for seed ${seeds[s]}` );
    }
}

const hasNutrientMetrics = runs.flat().every( run => nutrientMetrics.every( name => run.columns.includes( name )));
const availableEventTotals = Object.keys( eventMap ).filter( column => runs.flat().every( run => run.columns.includes( column )));
const metricNames = [...metrics, ...( hasNutrientMetrics ? nutrientMetrics : [] ), "plants",
    ...availableEventTotals.map( x => x.replace( /_interval$/, "_total" ))];
const scenarioSummary = {};
for ( let i = 0; i < scenarios.length; i++ )
{
    const summary = {};
    for ( const name of metricNames ) summary[ name ] = stats( runs[ i ].map( run => run.values[ name ] ));
    scenarioSummary[ scenarios[ i ]] = summary;
}

const pairedDifferences = {};
for ( let i = 1; i < scenarios.length; i++ )
{
    const treatment = scenarios[ i ];
    pairedDifferences[ `${treatment} - ${scenarios[0]}` ] = {};
    for ( const name of metricNames )
    {
        pairedDifferences[ `${treatment} - ${scenarios[0]}` ][ name ] = stats(
            seeds.map(( _, s ) => runs[ i ][ s ].values[ name ] - runs[ 0 ][ s ].values[ name ] ));
    }
}

const summary = {
    directory: dir,
    schemaVersion: [...schemaVersions][0],
    scenarios,
    seeds,
    step: runs[0][0].step,
    pedigreeCountMeaning: [...schemaVersions][0] >= 4 ? "unique offspring; parental phenotype groups count parent-child links" : "legacy parent-child links, not unique offspring",
    note: "Paired seed differences describe this run set; they do not establish a species count or causation beyond the tested scenario change.",
    scenariosSummary: scenarioSummary,
    pairedDifferences,
};
const csvHeader = [ "seed", "step", ...scenarios.flatMap( scenario => metricNames.map( name => `${scenario}_${name}` )),
    ...scenarios.slice( 1 ).flatMap( scenario => metricNames.map( name => `${scenario}_minus_${scenarios[0]}_${name}` )) ].join( "," );
const csvRows = seeds.map(( seed, s ) =>
{
    const deltas = runs.slice( 1 ).flatMap( scenarioRuns => metricNames.map( name =>
        Number(( scenarioRuns[s].values[name] - runs[0][s].values[name] ).toFixed( 6 ))));
    return [ seed, runs[0][s].step,
        ...runs.flatMap( scenarioRuns => metricNames.map( name => scenarioRuns[s].values[name] )),
        ...deltas,
    ].join( "," );
});

fs.writeFileSync( outputBase + ".json", JSON.stringify( summary, null, 2 ) + "\n" );
fs.writeFileSync( outputBase + ".csv", csvHeader + "\n" + csvRows.join( "\n" ) + "\n" );
const digestMetrics = [ "alive", "plants", ...( hasNutrientMetrics ? [ "soil_nutrient_mean" ] : [] ), "eff_coarse_morphotype_bins", "pedigree_maturity_survival", "pedigree_matured_offspring", "births_total",
    ...( hasNutrientMetrics ? [ "soil_nutrients_returned_total" ] : [] ) ];
const digest = {
    outputJson: outputBase + ".json",
    outputCsv: outputBase + ".csv",
    seeds: seeds.length,
    step: summary.step,
    meanByScenario: Object.fromEntries( scenarios.map( scenario => [ scenario,
        Object.fromEntries( digestMetrics.map( name => [ name, scenarioSummary[scenario][name].mean ] )) ] )),
    meanPairedDifference: Object.fromEntries( Object.entries( pairedDifferences ).map(([ comparison, differences ]) => [ comparison,
        Object.fromEntries( digestMetrics.map( name => [ name, differences[name].mean ] )) ] )),
};
console.log( JSON.stringify( digest, null, 2 ));
