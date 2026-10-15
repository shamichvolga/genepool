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
const path = require( "path" );
const { execFileSync } = require( "child_process" );
const { createSimulation } = require( "./headless.cjs" );

function arg( name, fallback )
{
    const i = process.argv.indexOf( "--" + name );
    return ( i >= 0 && i + 1 < process.argv.length ) ? process.argv[ i + 1 ] : fallback;
}

const SEED  = parseInt( arg( "seed", "1" ), 10 );
const STEPS = parseInt( arg( "steps", "50000" ), 10 );
const EVERY = parseInt( arg( "every", "5000" ), 10 );
const SCENARIO = arg( "scenario", "BASE" ).toUpperCase();
const CSV   = arg( "csv", null );
const META  = arg( "meta", CSV && /\.csv$/i.test( CSV ) ? CSV.replace( /\.csv$/i, ".json" ) : null );
const EXTRA = arg( "set", null );   // e.g. --set "THERMAL_TRADE_OFF=0.3,PLANT_CELL_CAPACITY=8"

const scenarios = {
    BASE: { label: "current environment and mating", overrides: {} },
    C0:   { label: "flat temperature and unrestricted plant growth", overrides: { FLAT_ENVIRONMENT: "true" } },
    C1:   { label: "remove thermal mismatch drain and generalist-width penalty", overrides: { THERMAL_MISMATCH_DRAIN: "0", THERMAL_TRADE_OFF: "0" } },
    C2:   { label: "random mate choice without brightness-based mate rejection", overrides: { RANDOM_MATING_CONTROL: "true" } },
    C3:   { label: "halve biome patch spacing", overrides: { BIOME_SPACING: "2000" } },
    C4:   { label: "disable kinesis and social steering", overrides: { KINESIS_TURN_CHANCE: "0", SOCIAL_STEERING: "0" } },
    C5:   { label: "add a pool-spanning barrier", overrides: { BARRIER_EXPERIMENT: "true" } },
    C6:   { label: "density-dependent local plant growth with fixed seed rain", overrides: { LOCAL_ENVIRONMENT_PLANT_GROWTH: "true" } },
    C7:   { label: "return nutrients from decayed meat to plant growth", overrides: { NUTRIENT_CYCLE_ENABLED: "true" } },
    C8:   { label: "body-mass and breadth effects on thrust, drag, and swimming cost", overrides: { BODY_HYDRODYNAMICS_ENABLED: "true" } },
    C9:   { label: "body-mass-dependent inertia in body temperature; no internal heat source", overrides: { BODY_TEMPERATURE_INERTIA_ENABLED: "true" } },
    C10:  { label: "size-dependent maintenance cost: mass^0.75 at 0.000008 per step", overrides: { BASAL_METABOLISM: "0.000008" } },
    C11:  { label: "inherited neural choice to consume own body tissue", overrides: { SELF_CANNIBALISM_ENABLED: "true" } },
};
if ( !scenarios[ SCENARIO ] ) throw new Error( `unknown scenario ${SCENARIO}; choose ${Object.keys(scenarios).join(", ")}` );
const FLAT = SCENARIO === "C0" || arg( "flat", "0" ) === "1";
const overrides = Object.assign( {}, scenarios[ SCENARIO ].overrides );
if ( FLAT ) overrides.FLAT_ENVIRONMENT = "true";
if ( EXTRA ) for ( const kv of EXTRA.split( "," ) ) { const [ k, v ] = kv.split( "=" ); overrides[ k.trim() ] = v.trim(); }

const run = createSimulation( SEED, overrides );
const sb  = run.sandbox;
const env = sb.environment;
const startedAt = new Date().toISOString();
const runStartNs = process.hrtime.bigint();
let stepsExecuted = 0;

// Statistics must not consume the simulation's random stream. The old metric
// used Math.random() from the simulation sandbox, so logging frequency changed
// the world being measured.
function makeRandom( seed )
{
    let a = seed >>> 0;
    return function()
    {
        a = ( a + 0x6D2B79F5 ) >>> 0;
        let t = a;
        t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
        t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
    };
}
const statsRandom = makeRandom( ( SEED ^ 0x9E3779B9 ) >>> 0 );

function distribution( values )
{
    if ( values.length === 0 ) return { mean: 0, p10: 0, p50: 0, p90: 0 };
    let total = 0;
    for ( const value of values ) total += value;
    const sorted = values.slice().sort( ( a, b ) => a - b );
    const quantile = ( p ) => sorted[ Math.floor(( sorted.length - 1 ) * p ) ];
    return {
        mean: total / values.length,
        p10 : quantile( 0.10 ),
        p50 : quantile( 0.50 ),
        p90 : quantile( 0.90 ),
    };
}

function gitMetadata()
{
    const root = path.resolve( __dirname, ".." );
    try
    {
        const head = execFileSync( "git", [ "rev-parse", "HEAD" ], { cwd: root, encoding: "utf8" }).trim();
        const dirty = execFileSync( "git", [ "status", "--porcelain" ], { cwd: root, encoding: "utf8" }).trim().length > 0;
        return { head, dirty };
    }
    catch ( error )
    {
        return { head: null, dirty: null, error: String( error.message || error ) };
    }
}

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
    const ts = [], thetas = [], ds = [], bs = [], backs = [], sizes = [];
    const masses = [], widths = [], lengths = [], maxWidths = [], parts = [], branchParts = [], branchFractions = [], energies = [], speeds = [], swimEfficiencies = [];
    const bodyTemperatures = [], ambientTemperatures = [], thermalLags = [], thermalLagMasses = [], thermalLagWidths = [];
    const offspring = [], preyEaten = [], foodEaten = [];
    const bins = new Map();   // eco-types: θ, d, b in 5 bins each
    let choosy = 0;
    let effort = 0, climate = 0, social = 0, brainDistance = 0, neural = 0;
    const hungers = [];
    let autoBite = 0, autoThreat = 0, autoMissing = 0, herbivores = 0;
    let fit = 0, width = 0, n = 0;
    const occupied = new Set();
    for ( const b of bots )
    {
        if ( !b.getAlive() ) continue;
        const p = b.getPosition();
        // the local temperature without the season: use the map at time 0
        const t = env.temperatureAt( p.x, p.y );
        ts.push( t ); thetas.push( b.getThermalOptimum() ); ds.push( b.getDigestion() );
        const morphology = ( typeof b.getMorphologySummary === "function" )
                         ? b.getMorphologySummary()
                         : { mass: b.getPhenotypeMass(), meanWidth: 0, meanLength: 0, maxWidth: 0,
                             numParts: b.getNumParts(), branchParts: 0, branchFraction: 0 };
        sizes.push( Math.log( morphology.mass ));
        masses.push( morphology.mass ); widths.push( morphology.meanWidth ); lengths.push( morphology.meanLength );
        const ambientTemperature = typeof b.getAmbientTemperature === "function" ? b.getAmbientTemperature() : t;
        const bodyTemperature = typeof b.getBodyTemperature === "function" ? b.getBodyTemperature() : ambientTemperature;
        ambientTemperatures.push( ambientTemperature );
        bodyTemperatures.push( bodyTemperature );
        thermalLags.push( Math.abs( bodyTemperature - ambientTemperature ));
        thermalLagMasses.push( Math.log( Math.max( 1, morphology.mass )));
        thermalLagWidths.push( morphology.meanWidth );
        maxWidths.push( morphology.maxWidth ); parts.push( morphology.numParts ); branchParts.push( morphology.branchParts );
        branchFractions.push( morphology.branchFraction ); energies.push( b.getEnergy() );
        speeds.push( typeof b.getSpeed === "function" ? b.getSpeed() : 0 );
        swimEfficiencies.push( b.getEnergyEfficiency() );
        offspring.push( b.getNumOffspring() );
        preyEaten.push( b.getNumPreyEaten() ); foodEaten.push( b.getNumFoodBitsEaten() );
        if ( typeof b.getBrightness === "function" )
        {
            bs.push( b.getBrightness() ); backs.push( env.backgroundAt( p.x, p.y ) ); choosy += b.getChoosiness();
        }
        hungers.push( b.getHungerThreshold() );
        if ( typeof b.getAutotomy === "function" && b.getPredatorLevel() <= sb.PREDATOR_LEVEL_THRESHOLD )
        {
            const a = b.getAutotomy();
            herbivores ++; autoBite += a.bite; autoThreat += a.threat; if ( a.partsLost ) autoMissing ++;
        }
        if ( typeof b.getUsesNeuralBrain === "function" && b.getUsesNeuralBrain() )
        {
            neural ++;
            effort += b.getEffort(); climate += b.getClimateWeight(); social += b.getSocialWeight();
            brainDistance += sb.brainDistanceFromInnate( b.getGenotype().getBrain(), sb.SELF_CANNIBALISM_ENABLED );
        }
        const bin = Math.min( 4, Math.floor( b.getThermalOptimum() * 5 )) + "," + Math.min( 4, Math.floor( b.getDigestion() * 5 ))
                  + "," + ( bs.length ? Math.min( 4, Math.floor( bs[ bs.length - 1 ] * 5 )) : 0 );
        bins.set( bin, ( bins.get( bin ) || 0 ) + 1 );
        fit += b.getThermalFit(); width += b.getThermalWidth(); n ++;
        occupied.add( Math.floor( p.x / 500 ) + "," + Math.floor( p.y / 500 ) );
    }
    const cells = Math.ceil( ( sb.POOL_RIGHT - sb.POOL_LEFT ) / 500 ) * Math.ceil( ( sb.POOL_BOTTOM - sb.POOL_TOP ) / 500 );
    let plantCellsOccupied = 0, plantsInOccupiedCells = 0, soilNutrientCells = 0;
    const soilNutrients = [];
    const plantCellCount = env.plantCount && env.plantCount[0] ? env.plantCount[0].length : 0;
    for ( let cell = 0; cell < plantCellCount; cell++ )
    {
        const count = env.plantCount[0][cell] + env.plantCount[1][cell];
        if ( count > 0 ) { plantCellsOccupied ++; plantsInOccupiedCells += count; }
        const nutrient = typeof env.getSoilNutrientAtCell === "function" ? env.getSoilNutrientAtCell( cell ) : 0;
        soilNutrients.push( nutrient );
        if ( nutrient > 0.001 ) soilNutrientCells ++;
    }
    const soilNutrientDist = distribution( soilNutrients );
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
            for ( let k = 0; k < 2000; k++ ) { random += Math.abs( thetas[ Math.floor( statsRandom() * n ) ] - thetas[ Math.floor( statsRandom() * n ) ] ); }
            random /= 2000;
            isolation = random > 0 ? 1 - mates / random : 0;
        }
    }
    const cline = regression( ts, thetas );
    const dT    = regression( ts, ds );
    const bB    = regression( backs, bs );
    const sT    = regression( ts, sizes );
    const massDist = distribution( masses );
    const widthDist = distribution( widths );
    const lengthDist = distribution( lengths );
    const maxWidthDist = distribution( maxWidths );
    const partDist = distribution( parts );
    const energyDist = distribution( energies );
    const speedDist = distribution( speeds );
    const swimEfficiencyDist = distribution( swimEfficiencies );
    const bodyTemperatureDist = distribution( bodyTemperatures );
    const ambientTemperatureDist = distribution( ambientTemperatures );
    const thermalLagDist = distribution( thermalLags );
    const thermalLagMass = regression( thermalLagMasses, thermalLags );
    const thermalLagWidth = regression( thermalLagWidths, thermalLags );
    const morphBins = new Map();
    for ( let i = 0; i < masses.length; i++ )
    {
        const signature = [
            Math.floor( Math.log( Math.max( 1, masses[i] )) ),
            Math.floor( widths[i] / 2 ),
            Math.floor( lengths[i] / 10 ),
            Math.floor( parts[i] / 10 ),
            Math.floor( branchFractions[i] * 2 ),
        ].join( ":" );
        morphBins.set( signature, ( morphBins.get( signature ) || 0 ) + 1 );
    }
    let morphShannon = 0;
    for ( const count of morphBins.values() ) { const q = count / n; morphShannon -= q * Math.log( q ); }
    const familyTree = run.genePool.getFamilyTree && run.genePool.getFamilyTree();
    const emptyGroup = { maturedPerParent: 0 };
    const pedigree = familyTree && typeof familyTree.getOffspringMaturitySummary === "function"
        ? familyTree.getOffspringMaturitySummary( run.genePool.getTimeStep(), sb.YOUNG_AGE_DURATION || 1000 )
        : { parents: 0, reproducingParents: 0, offspring: 0, eligible: 0, matured: 0, survival: 0,
            small: emptyGroup, medium: emptyGroup, large: emptyGroup };
    let shannon = 0;
    for ( const c of bins.values() ) { const q = c / n; shannon -= q * Math.log( q ); }
    return {
        fit      : n ? fit / n : 0,
        width    : n ? width / n : 0,
        slope    : cline.slope,
        r2       : cline.r2,
        dCorr    : dT.r,
        occupied : occupied.size / cells,
        plantCellsOccupied,
        plantCellOccupancy : plantCellCount ? plantCellsOccupied / plantCellCount : 0,
        plantsPerOccupiedCell : plantCellsOccupied ? plantsInOccupiedCells / plantCellsOccupied : 0,
        soilNutrientCells,
        soilNutrientMean: soilNutrientDist.mean,
        soilNutrientP10: soilNutrientDist.p10,
        soilNutrientP50: soilNutrientDist.p50,
        soilNutrientP90: soilNutrientDist.p90,
        bCorr    : bB.r,
        choosy   : bs.length ? choosy / bs.length : 0,
        ecoTypes : n ? Math.exp( shannon ) : 0,
        isolation,
        sizeCorr : sT.r,
        effort   : neural ? effort / neural : 0,
        climate  : neural ? climate / neural : 0,
        social   : neural ? social / neural : 0,
        brain    : neural ? brainDistance / neural : 0,
        morphBins: morphBins.size,
        effectiveMorphBins: Math.exp( morphShannon ),
        massMean : massDist.mean,
        massP10  : massDist.p10,
        massP50  : massDist.p50,
        massP90  : massDist.p90,
        widthMean: widthDist.mean,
        widthP10 : widthDist.p10,
        widthP50 : widthDist.p50,
        widthP90 : widthDist.p90,
        lengthMean: lengthDist.mean,
        lengthP10: lengthDist.p10,
        lengthP50: lengthDist.p50,
        lengthP90: lengthDist.p90,
        maxWidthMean: maxWidthDist.mean,
        partsMean: partDist.mean,
        branchPartsMean: branchParts.reduce(( a, b ) => a + b, 0 ) / ( branchParts.length || 1 ),
        branchesMean: branchFractions.reduce(( a, b ) => a + b, 0 ) / ( branchFractions.length || 1 ),
        energyMean: energyDist.mean,
        speedMean: speedDist.mean,
        speedP10: speedDist.p10,
        speedP50: speedDist.p50,
        speedP90: speedDist.p90,
        swimEnergyEfficiencyMean: swimEfficiencyDist.mean,
        bodyTemperatureMean: bodyTemperatureDist.mean,
        bodyTemperatureP10: bodyTemperatureDist.p10,
        bodyTemperatureP50: bodyTemperatureDist.p50,
        bodyTemperatureP90: bodyTemperatureDist.p90,
        ambientTemperatureMean: ambientTemperatureDist.mean,
        thermalLagAbsMean: thermalLagDist.mean,
        thermalLagMassCorr: thermalLagMass.r,
        thermalLagWidthCorr: thermalLagWidth.r,
        offspringAliveMean: offspring.reduce(( a, b ) => a + b, 0 ) / ( offspring.length || 1 ),
        preyEatenAliveMean: preyEaten.reduce(( a, b ) => a + b, 0 ) / ( preyEaten.length || 1 ),
        foodEatenAliveMean: foodEaten.reduce(( a, b ) => a + b, 0 ) / ( foodEaten.length || 1 ),
        pedigreeParents: pedigree.parents,
        pedigreeReproducingParents: pedigree.reproducingParents,
        pedigreeOffspring: pedigree.offspring,
        pedigreeMaturityEligible: pedigree.eligible,
        pedigreeMaturedOffspring: pedigree.matured,
        pedigreeMaturitySurvival: pedigree.survival,
        smallParentMaturedPerParent: pedigree.small.maturedPerParent,
        mediumParentMaturedPerParent: pedigree.medium.maturedPerParent,
        largeParentMaturedPerParent: pedigree.large.maturedPerParent,
        hunger   : hungers.length ? hungers.reduce( ( a, b ) => a + b, 0 ) / hungers.length : 0,
        autoBite    : herbivores ? autoBite / herbivores : 0,
        autoThreat  : herbivores ? autoThreat / herbivores : 0,
        autoMissing : herbivores ? autoMissing / herbivores : 0,
        hungerSd : hungers.length ? Math.sqrt( hungers.reduce( ( a, b ) => a + b * b, 0 ) / hungers.length - Math.pow( hungers.reduce( ( a, b ) => a + b, 0 ) / hungers.length, 2 )) : 0,
    };
}

const eventKeys = [ "births", "localPlantSprouts", "seedRainPlantSprouts", "nutrientLimitedPlantSeeds", "meatDecayEvents", "nutrientsFromMeatDecay", "plantMeals", "meatMeals", "meatTargetsWhilePursuing", "meatMealsWhilePursuing", "attackCount", "failedAttacks", "autotomyThreatDrops", "autotomyBiteDrops", "autotomyDecoysEaten", "starvationDeaths", "oldAgeDeaths", "predationDeaths", "otherDeaths", "selfCannibalismEvents", "selfCannibalismEnergy", "selfCannibalismMass" ];
const eventCounters = sb.simCounters || {};
let previousEvents = Object.fromEntries( eventKeys.map( key => [ key, eventCounters[ key ] || 0 ] ));
function eventDeltas()
{
    const delta = {};
    for ( const key of eventKeys )
    {
        const current = eventCounters[ key ] || 0;
        delta[ key ] = current - previousEvents[ key ];
        previousEvents[ key ] = current;
    }
    return delta;
}

const eventColumns = "births_interval,local_plant_sprouts_interval,seed_rain_plant_sprouts_interval,nutrient_limited_seed_attempts_interval,meat_decay_events_interval,soil_nutrients_returned_interval,plant_meals_interval,meat_meals_interval,pursuit_meat_target_selections_interval,pursuit_meat_meals_interval,prey_kills_interval,failed_attacks_interval,autotomy_threat_drops_interval,autotomy_bite_drops_interval,autotomy_decoys_eaten_interval,starvation_deaths_interval,old_age_deaths_interval,predation_deaths_interval,other_deaths_interval,self_feed_events_interval,self_feed_energy_interval,self_feed_mass_interval";
const pedigreeColumns = "pedigree_parents,pedigree_reproducing_parents,pedigree_offspring,pedigree_maturity_eligible,pedigree_matured_offspring,pedigree_maturity_survival,small_parent_matured_per_parent,medium_parent_matured_per_parent,large_parent_matured_per_parent";
const header = "step,alive,pred,warm,cold,meat,fit,w,body_temp_mean,body_temp_p10,body_temp_p50,body_temp_p90,ambient_temp_mean,thermal_lag_abs_mean,thermal_lag_mass_corr,thermal_lag_width_corr,cline_slope,cline_r2,d_corr,b_corr,choosy,eco_types,mate_isolation,size_corr,effort,climate,social,brain_change,coarse_morphotype_bins,eff_coarse_morphotype_bins,mass_mean,mass_p10,mass_p50,mass_p90,width_mean,width_p10,width_p50,width_p90,length_mean,length_p10,length_p50,length_p90,max_width_mean,parts_mean,branch_parts_mean,branch_fraction_mean,energy_mean,speed_mean,speed_p10,speed_p50,speed_p90,swim_energy_efficiency_mean,offspring_alive_mean,prey_eaten_alive_mean,food_eaten_alive_mean," + pedigreeColumns + ",hunger,hunger_sd,autotomy_bite,autotomy_decoy,missing_parts,occupied,plant_cells_occupied,plant_cell_occupancy,plants_per_occupied_cell,soil_nutrient_cells,soil_nutrient_mean,soil_nutrient_p10,soil_nutrient_p50,soil_nutrient_p90,gene_clusters,eff_gene_clusters,top_gene_cluster_share," + eventColumns + ",ms_step";
console.log( `scenario=${SCENARIO} seed=${SEED} steps=${STEPS} flat=${FLAT} set=${EXTRA || ""}` );
console.log( header );
const rows = [];
let t0 = Date.now();

for ( let step = 1; step <= STEPS; step++ )
{
    run.genePool.update();
    stepsExecuted ++;

    if ( step % EVERY === 0 )
    {
        const msPerStep = ( Date.now() - t0 ) / EVERY;   // simulation only, not the statistics
        const s = run.stats( run.genePool );
        const e = ecoStats();
        const events = eventDeltas();
        const row = [ step, s.alive, s.predators, run.genePool.getNumFoodBitsOfType(0), run.genePool.getNumFoodBitsOfType(1), s.meat,
                      e.fit.toFixed( 2 ), e.width.toFixed( 3 ), e.bodyTemperatureMean.toFixed( 4 ),
                      e.bodyTemperatureP10.toFixed( 4 ), e.bodyTemperatureP50.toFixed( 4 ), e.bodyTemperatureP90.toFixed( 4 ),
                      e.ambientTemperatureMean.toFixed( 4 ), e.thermalLagAbsMean.toFixed( 5 ),
                      e.thermalLagMassCorr.toFixed( 3 ), e.thermalLagWidthCorr.toFixed( 3 ),
                      e.slope.toFixed( 2 ), e.r2.toFixed( 2 ), e.dCorr.toFixed( 2 ),
                      e.bCorr.toFixed( 2 ), e.choosy.toFixed( 2 ), e.ecoTypes.toFixed( 1 ), e.isolation.toFixed( 2 ), e.sizeCorr.toFixed( 2 ),
                      e.effort.toFixed( 2 ), e.climate.toFixed( 2 ), e.social.toFixed( 2 ), e.brain.toFixed( 3 ),
                      e.morphBins, e.effectiveMorphBins.toFixed( 1 ),
                      e.massMean.toFixed( 2 ), e.massP10.toFixed( 2 ), e.massP50.toFixed( 2 ), e.massP90.toFixed( 2 ),
                      e.widthMean.toFixed( 3 ), e.widthP10.toFixed( 3 ), e.widthP50.toFixed( 3 ), e.widthP90.toFixed( 3 ),
                      e.lengthMean.toFixed( 2 ), e.lengthP10.toFixed( 2 ), e.lengthP50.toFixed( 2 ), e.lengthP90.toFixed( 2 ),
                      e.maxWidthMean.toFixed( 3 ), e.partsMean.toFixed( 2 ), e.branchPartsMean.toFixed( 2 ), e.branchesMean.toFixed( 3 ), e.energyMean.toFixed( 2 ),
                      e.speedMean.toFixed( 4 ), e.speedP10.toFixed( 4 ), e.speedP50.toFixed( 4 ), e.speedP90.toFixed( 4 ), e.swimEnergyEfficiencyMean.toFixed( 5 ),
                      e.offspringAliveMean.toFixed( 3 ), e.preyEatenAliveMean.toFixed( 3 ), e.foodEatenAliveMean.toFixed( 3 ),
                      e.pedigreeParents, e.pedigreeReproducingParents, e.pedigreeOffspring, e.pedigreeMaturityEligible,
                      e.pedigreeMaturedOffspring, e.pedigreeMaturitySurvival.toFixed( 3 ),
                      e.smallParentMaturedPerParent.toFixed( 3 ), e.mediumParentMaturedPerParent.toFixed( 3 ), e.largeParentMaturedPerParent.toFixed( 3 ),
                      e.hunger.toFixed( 1 ), e.hungerSd.toFixed( 1 ),
                      e.autoBite.toFixed( 3 ), e.autoThreat.toFixed( 3 ), e.autoMissing.toFixed( 3 ),
                      e.occupied.toFixed( 2 ), e.plantCellsOccupied, e.plantCellOccupancy.toFixed( 3 ), e.plantsPerOccupiedCell.toFixed( 2 ),
                      e.soilNutrientCells, e.soilNutrientMean.toFixed( 4 ), e.soilNutrientP10.toFixed( 4 ),
                      e.soilNutrientP50.toFixed( 4 ), e.soilNutrientP90.toFixed( 4 ),
                      s.species, s.effSpecies.toFixed( 1 ), s.topShare.toFixed( 2 ),
                      ...eventKeys.map( key => events[ key ] ),
                      msPerStep.toFixed( 1 ) ].join( "," );
        rows.push( row );
        console.log( row );
        t0 = Date.now();
        if ( s.alive === 0 ) break;
    }
}

if ( run.alerts.length > 0 ) console.log( `ALERTS (${run.alerts.length}), first: ${run.alerts[0]}` );
if ( CSV ) fs.writeFileSync( CSV, header + "\n" + rows.join( "\n" ) + "\n" );
if ( META )
{
    const git = gitMetadata();
    const endedAt = new Date().toISOString();
    const durationMs = Number( process.hrtime.bigint() - runStartNs ) / 1e6;
    const metadata = {
        schemaVersion: 8,
        startedAt,
        endedAt,
        durationMs: Number( durationMs.toFixed( 1 )),
        seed: SEED,
        scenario: SCENARIO,
        scenarioDescription: scenarios[ SCENARIO ].label,
        stepsRequested: STEPS,
        stepsExecuted,
        samplingInterval: EVERY,
        stoppedEarly: stepsExecuted < STEPS,
        flatEnvironment: FLAT,
        overrides,
        environmentActive: !!env.active,
        plantTypes: sb.TWO_PLANT_TYPES ? 2 : 1,
        pool: { width: sb.POOL_WIDTH, height: sb.POOL_HEIGHT },
        git,
        nodeVersion: process.version,
        eventTotals: Object.fromEntries( eventKeys.map( key => [ key, eventCounters[ key ] || 0 ] )),
        fitnessMetrics: {
            offspringMaturityAge: sb.YOUNG_AGE_DURATION,
            parentMassClasses: { small: "<300", medium: "300-699", large: ">=700" },
            definition: "direct offspring alive or known to have survived to the age of first reproduction; younger living offspring are censored",
        },
        morphologyMetrics: {
            type: "coarse bins from log mass, mean width, mean length, part count, and branch fraction; not biological species",
            widths: { logMass: 1, meanWidth: 2, meanLength: 10, partCount: 10, branchFraction: 0.5 },
        },
        thermalMetrics: {
            unit: "normalized 0..1 temperature",
            bodyTemperature: "internal state after optional mass- and width-dependent exchange with local felt temperature",
            thermalLagAbsMean: "mean absolute difference between internal and local felt temperature",
            thermalLagCorrelations: "correlation of log body mass and mean body width with absolute thermal lag; exploratory, not causal estimates",
        },
        outputs: { csv: CSV ? path.resolve( CSV ) : null },
        alerts: run.alerts,
    };
    fs.mkdirSync( path.dirname( path.resolve( META )), { recursive: true } );
    fs.writeFileSync( META, JSON.stringify( metadata, null, 2 ) + "\n" );
}
