//------------------------------------------------------------------------------
// Ecology experiment (stage 5): runs the "random" pool with the environment and
// prints, every --every steps:
//   alive, predators, warm/cold plants,
//   mean thermal fit g, mean tolerance w,
//   cline: slope and R² of the preferred temperature θ against the local T
//          (0 = no adaptation, 1 = perfect tracking),
//   d~T: correlation of digestion with the local T (warm places = warm plants),
//   occupied: share of 500x500 cells with at least one swimbot,
//   body species (as in headless.cjs).
//
//   node tools/eco.cjs --seed 1 --steps 100000 --every 5000 [--flat 1] [--csv out.csv]
//   --flat 1 = control C0 (no temperature differences, plants grow anywhere)
//------------------------------------------------------------------------------
const fs = require( "fs" );
const { createSimulation } = require( "./headless.cjs" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

const SEED  = parseInt( arg( "seed", "1" ), 10 );
const STEPS = parseInt( arg( "steps", "50000" ), 10 );
const EVERY = parseInt( arg( "every", "5000" ), 10 );
const FLAT  = arg( "flat", "0" ) === "1";
const CSV   = arg( "csv", null );
const EXTRA = arg( "set", null );   // e.g. --set "THERMAL_TRADE_OFF=0.3,PLANT_CELL_CAPACITY=8"

const overrides = {};
if ( FLAT ) overrides.FLAT_ENVIRONMENT = "true";
if ( EXTRA ) for ( const kv of EXTRA.split( "," ) ) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }

const run = createSimulation( SEED, overrides );
const sb  = run.sandbox;
const env = sb.environment;

function regression( xs, ys )
{
    const n = xs.length;
    if ( n < 3 ) return { slope: 0, r2: 0, r: 0 };
    let mx = 0, my = 0;
    for ( let i = 0; i < n; i++ ) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for ( let i = 0; i < n; i++ ) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const slope = sxx > 0 ? sxy / sxx : 0;
    const r = ( sxx > 0 && syy > 0 ) ? sxy / Math.sqrt( sxx * syy ) : 0;
    return { slope, r2: r * r, r };
}

function ecoStats()
{
    const bots = run.genePool.getSwimbots();
    const ts = [], thetas = [], ds = [], bs = [], backs = [];
    const bins = new Map();   // eco-types: θ, d, b in 5 bins each
    let choosy = 0;
    let effort = 0, climate = 0, social = 0, brainDistance = 0, neural = 0;
    let fit = 0, width = 0, n = 0;
    const occupied = new Set();
    for ( const b of bots )
    {
        if ( !b.getAlive() ) continue;
        const p = b.getPosition();
        // the local temperature without the season: use the map at time 0
        const t = env.temperatureAt( p.x, p.y );
        ts.push( t ); thetas.push( b.getThermalOptimum() ); ds.push( b.getDigestion() );
        if ( typeof b.getBrightness === "function" )
        {
            bs.push( b.getBrightness() ); backs.push( env.backgroundAt( p.x, p.y ) ); choosy += b.getChoosiness();
        }
        if ( typeof b.getUsesNeuralBrain === "function" && b.getUsesNeuralBrain() )
        {
            neural ++;
            effort += b.getEffort(); climate += b.getClimateWeight(); social += b.getSocialWeight();
            brainDistance += sb.brainDistanceFromInnate( b.getGenotype().getBrain() );
        }
        const bin = Math.min( 4, Math.floor( b.getThermalOptimum() * 5 )) + "," + Math.min( 4, Math.floor( b.getDigestion() * 5 ))
                  + "," + ( bs.length ? Math.min( 4, Math.floor( bs[ bs.length - 1 ] * 5 )) : 0 );
        bins.set( bin, ( bins.get( bin ) || 0 ) + 1 );
        fit += b.getThermalFit(); width += b.getThermalWidth(); n ++;
        occupied.add( Math.floor( p.x / 500 ) + "," + Math.floor( p.y / 500 ) );
    }
    const cells = Math.ceil( ( sb.POOL_RIGHT - sb.POOL_LEFT ) / 500 ) * Math.ceil( ( sb.POOL_BOTTOM - sb.POOL_TOP ) / 500 );
    // mating isolation: how much more alike in preferred temperature are
    // the parents of recent births than two random swimbots (0 = random, 1 = identical)
    let isolation = 0;
    if ( typeof run.genePool.getRecentMatings === "function" && n > 10 )
    {
        const m = run.genePool.getRecentMatings();
        if ( m.a.length > 20 )
        {
            let mates = 0;
            for ( let k = 0; k < m.a.length; k++ ) { mates += Math.abs( m.a[k] - m.b[k] ); }
            mates /= m.a.length;
            let random = 0;
            for ( let k = 0; k < 2000; k++ ) { random += Math.abs( thetas[ Math.floor( Math.random() * n ) ] - thetas[ Math.floor( Math.random() * n ) ] ); }
            random /= 2000;
            isolation = random > 0 ? 1 - mates / random : 0;
        }
    }
    const cline = regression( ts, thetas );
    const dT    = regression( ts, ds );
    const bB    = regression( backs, bs );
    let shannon = 0;
    for ( const c of bins.values() ) { const q = c / n; shannon -= q * Math.log( q ); }
    return {
        fit      : n ? fit / n : 0,
        width    : n ? width / n : 0,
        slope    : cline.slope,
        r2       : cline.r2,
        dCorr    : dT.r,
        occupied : occupied.size / cells,
        bCorr    : bB.r,
        choosy   : bs.length ? choosy / bs.length : 0,
        ecoTypes : n ? Math.exp( shannon ) : 0,
        isolation,
        effort   : neural ? effort / neural : 0,
        climate  : neural ? climate / neural : 0,
        social   : neural ? social / neural : 0,
        brain    : neural ? brainDistance / neural : 0,
    };
}

const header = "step,alive,pred,warm,cold,meat,fit,w,cline_slope,cline_r2,d_corr,b_corr,choosy,eco_types,mate_isolation,effort,climate,social,brain_change,occupied,species,eff_species,top_share,ms_step";
console.log( `seed=${SEED} steps=${STEPS} flat=${FLAT} set=${EXTRA || ""}` );
console.log( header );
const rows = [];
let t0 = Date.now();

for ( let step = 1; step <= STEPS; step++ )
{
    run.genePool.update();

    if ( step % EVERY === 0 )
    {
        const msPerStep = ( Date.now() - t0 ) / EVERY;   // simulation only, not the statistics
        const s = run.stats( run.genePool );
        const e = ecoStats();
        const row = [ step, s.alive, s.predators, run.genePool.getNumFoodBitsOfType(0), run.genePool.getNumFoodBitsOfType(1), s.meat,
                      e.fit.toFixed( 2 ), e.width.toFixed( 3 ), e.slope.toFixed( 2 ), e.r2.toFixed( 2 ), e.dCorr.toFixed( 2 ),
                      e.bCorr.toFixed( 2 ), e.choosy.toFixed( 2 ), e.ecoTypes.toFixed( 1 ), e.isolation.toFixed( 2 ),
                      e.effort.toFixed( 2 ), e.climate.toFixed( 2 ), e.social.toFixed( 2 ), e.brain.toFixed( 3 ),
                      e.occupied.toFixed( 2 ), s.species, s.effSpecies.toFixed( 1 ), s.topShare.toFixed( 2 ),
                      msPerStep.toFixed( 1 ) ].join( "," );
        rows.push( row );
        console.log( row );
        t0 = Date.now();
        if ( s.alive === 0 ) break;
    }
}

if ( run.alerts.length > 0 ) console.log( `ALERTS (${run.alerts.length}), first: ${run.alerts[0]}` );
if ( CSV ) fs.writeFileSync( CSV, header + "\n" + rows.join( "\n" ) + "\n" );
