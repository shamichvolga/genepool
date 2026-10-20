//------------------------------------------------------------------------------
// Run recorder: what happens in a pool the user runs in the browser is written
// to disk, so it can be studied later (by people or by Claude) without
// watching the screen.
//
// Lives in the simulation thread. Every CENSUS_EVERY steps it counts the pool
// (the same columns as tools/form-census.cjs, plus a few) and sends the new
// rows to the page's server (vite.config.ts: /__runs), which keeps one folder
// per run:
//
//   runs/<date>_<time>_v<code version>_<mode>_<steps>k/
//       meta.json    when, which code, which pool, how far
//       census.csv   one row per census
//       deaths.csv   per census: deaths by cause, herbivores and predators
//       REPORT.md    a short summary, rewritten after every census
//
// A new pool (any start button) starts a new folder. Nothing is sent when no
// server listens (a plain file page): the simulation does not care.
//------------------------------------------------------------------------------
import { PREDATOR_LEVEL_THRESHOLD } from "./simulation/Parameters";
import { simCounters } from "./simulation/Globals";

declare const __GENEPOOL_VERSION__: string;
const VERSION = ( typeof __GENEPOOL_VERSION__ !== "undefined" ) ? __GENEPOOL_VERSION__ : "unknown";

const CENSUS_EVERY = 5000;      // steps
const CHECK_MS     = 1000;
const URL          = "/__runs";

const MASS_BINS = [ 0, 100, 200, 300, 400, 600, 800, 1000, 1500, 99999 ];
export const CENSUS_HEADER = "step,alive,predators,plants,meat,mass_p10,mass_p50,mass_p90,parts_p10,parts_p50,parts_p90,freq_p50,energy_p50,age_p50,"
    + MASS_BINS.slice( 0, -1 ).map( ( m, i ) => "mass_" + m + "_" + MASS_BINS[ i + 1 ] ).join( "," ) + ","
    + Array.from({ length: 15 }, ( _, i ) => "parts_" + ( i + 2 )).join( "," )
    + ",sick,births,genetic_clusters,largest_cluster_share,steps_per_second";
const CAUSES = [ "starvation", "predation", "old_age", "other" ];
export const DEATHS_HEADER = "step," + CAUSES.map( c => "herb_" + c ).join( "," ) + "," + CAUSES.map( c => "pred_" + c ).join( "," ) + ",sick_at_death,mean_age_at_death";

export function startRunRecorder( pool: any, mode: () => string )
{
    let runId = "";
    let nextCensus = 0;
    let lastStep = -1;
    let lastBirths = 0;
    let censusRows: string[] = [];
    let deathRows: string[] = [];
    let serverMissing = false;
    const deaths = new Array( CAUSES.length * 2 ).fill( 0 );
    let sickDeaths = 0, ageSum = 0, numDeaths = 0;

    pool.onSwimbotDied = ( b: any ) =>
    {
        let c = CAUSES.indexOf( b.getDeathCause() );
        if ( c < 0 ) c = CAUSES.length - 1;
        const predator = b.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD;
        deaths[ ( predator ? CAUSES.length : 0 ) + c ] ++;
        if ( b.getIsSick && b.getIsSick() ) sickDeaths ++;
        ageSum += b.getAge(); numDeaths ++;
    };

    function newRun( step: number )
    {
        const d = new Date();
        const two = ( n: number ) => String( n ).padStart( 2, "0" );
        runId = d.getFullYear() + "-" + two( d.getMonth() + 1 ) + "-" + two( d.getDate() ) + "_" + two( d.getHours() ) + "-" + two( d.getMinutes() ) + "-" + two( d.getSeconds() );
        nextCensus = Math.ceil( step / CENSUS_EVERY ) * CENSUS_EVERY;
        lastBirths = simCounters.births;
        deaths.fill( 0 ); sickDeaths = 0; ageSum = 0; numDeaths = 0;
        censusRows = []; deathRows = [];
    }

    function quantiles( a: number[], qs: number[] )
    {
        if ( a.length === 0 ) return qs.map( () => "" );
        const b = a.slice().sort( ( x, y ) => x - y );
        return qs.map( q => b[ Math.min( b.length - 1, Math.floor( q * b.length )) ].toFixed( 2 ));
    }

    function takeCensus( step: number )
    {
        const mass: number[] = [], parts: number[] = [], freq: number[] = [], energy: number[] = [], age: number[] = [];
        let predators = 0, sick = 0;
        const massHist = new Array( MASS_BINS.length - 1 ).fill( 0 ), partsHist = new Array( 15 ).fill( 0 );
        for ( const b of pool.getSwimbots() )
        {
            if ( !b.getAlive() ) continue;
            const m = b.getPhenotypeMass(), p = b.getNumParts();
            mass.push( m ); parts.push( p ); energy.push( b.getEnergy() ); age.push( b.getAge() );
            freq.push( b.getFrequency() );
            if ( b.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD ) predators ++;
            if ( b.getIsSick && b.getIsSick() ) sick ++;
            for ( let i = 0; i < massHist.length; i++ ) if ( m >= MASS_BINS[i] && m < MASS_BINS[ i + 1 ] ) massHist[i] ++;
            if ( p >= 2 && p <= 16 ) partsHist[ p - 2 ] ++;
        }
        let clusters = "", largest = "";
        try { const r = pool.estimateGeneticClusters( 400 ); clusters = r.geneticClusters; largest = r.largestClusterShare.toFixed( 3 ); } catch ( e ) { /* (an empty pool) */ }
        const births = simCounters.births - lastBirths; lastBirths = simCounters.births;
        censusRows.push( [ step, mass.length, predators, pool.getNumFoodBitsOfType( 0 ) + pool.getNumFoodBitsOfType( 1 ), pool.getNumFoodBitsOfType( 2 ),
            ...quantiles( mass, [ 0.1, 0.5, 0.9 ] ), ...quantiles( parts, [ 0.1, 0.5, 0.9 ] ), ...quantiles( freq, [ 0.5 ] ),
            ...quantiles( energy, [ 0.5 ] ), ...quantiles( age, [ 0.5 ] ), ...massHist, ...partsHist,
            sick, births, clusters, largest, Math.round( pool.getStepsPerSecond() ) ].join( "," ));
        deathRows.push( [ step, ...deaths, sickDeaths, numDeaths > 0 ? Math.round( ageSum / numDeaths ) : "" ].join( "," ));
        deaths.fill( 0 ); sickDeaths = 0; ageSum = 0; numDeaths = 0;
    }

    function send( step: number )
    {
        if ( serverMissing ) return;
        const body = JSON.stringify({
            id: runId, version: VERSION, mode: mode(), step, censusEvery: CENSUS_EVERY,
            censusHeader: CENSUS_HEADER, deathsHeader: DEATHS_HEADER,
            census: censusRows, deaths: deathRows,
        });
        censusRows = []; deathRows = [];
        fetch( URL, { method: "POST", headers: { "Content-Type": "application/json" }, body })
            .then( r => { if ( r.status === 404 ) serverMissing = true; })
            .catch( () => { serverMissing = true; });
    }

    setInterval( () =>
    {
        const step = pool.getTimeStep();
        // a new pool started (the clock went back) or the very first look
        if ( runId === "" || step < lastStep ) { newRun( step ); }
        lastStep = step;
        if ( pool.getNumSwimbots() === 0 && step === 0 ) return;
        if ( step >= nextCensus )
        {
            takeCensus( step );
            nextCensus = ( Math.floor( step / CENSUS_EVERY ) + 1 ) * CENSUS_EVERY;
            send( step );
        }
    }, CHECK_MS );
}
