//------------------------------------------------------------------------
// Saving and loading the whole world, to continue exactly where it was
// (docs/схема_сохранения_мира.md). saveWorld() returns the bytes of a
// .gpworld file (not compressed); loadWorld( bytes ) puts them back.
//
// The code is moved as it was from GenePool.ts: the pool's variables are
// reached through ctx (the _serializerContext of GenePool.ts).
//------------------------------------------------------------------------
import { Chunk, WORLD_FORMAT, layoutFingerprint, packWorld, unpackWorld } from "./WorldFile";
import { PARAM_DEFAULTS, PARAM_LIST, changedParams, setParameter } from "./ParamStore";
import { BRAIN_SIZE } from "./NeuralBrain";
import { WORLD_SCALE } from "./World";
import { MAX_PARTS } from "./SwimbotTypes";
import { exportStrains, importStrains } from "./Disease";
import { environment } from "./Environment";
import { Genotype, NUM_GENES } from "./Genotype";
import { getRandomState, globalTweakers, setRandomState, simClock, simCounters } from "./Globals";
import { getAtmosphereEnergy, resetAtmosphere } from "./EnergyBudget";
import { NULL_INDEX } from "./MathConstants";
import { MAX_FOODBITS, MAX_SWIMBOTS } from "./Parameters";
import { Vector2D } from "./Vector2D";

declare const __GENEPOOL_VERSION__: string;

const WORLD_ARRAYS = [
    "bots", "parts", "partLength", "partWidth", "partMass", "partAngle", "partAmp", "partPhase", "partTurnAmp", "partTurnPhase", "partMoment", "partParent",
    "botX", "botY", "genitalX", "genitalY", "mouthX", "mouthY", "predator", "mass", "brightness", "energy", "scanRadius", "effWarm", "effCold", "preferred",
    "alive", "liveSwimbot", "liveFood", "eternal", "sensing", "brainState", "age", "colorR", "colorG", "colorB", "choosiness", "attraction",
    "imageR", "imageG", "imageB", "imageSize", "imageStrength", "preyValueWeight", "preyTravelWeight", "preyBaitBias",
    "foodX", "foodY", "foodType", "foodEnergy", "foodBorn", "foodWood", "foodFruit", "foodFruitAt", "plantGrowth", "plantSpread",
    "mind", "nnInputs", "nnHidden", "nnOutputs", "random",
    "seenCount", "seen", "seenFood", "seenPrey", "targetPreyDistance", "targetPreyReward", "targetPreySuccess", "targetPreyChase",
    "targetBaitPresent", "targetBaitDistance", "targetBaitReward", "seenThreat", "seenPredator", "seenMate", "socialX", "socialY",
];

export function saveWorld( ctx: any, withFamilyTree = true )
{
    const _st = ctx.st, _swimbots = ctx.swimbots, _foodBits = ctx.foodBits, _swimbotWasAlive = ctx.swimbotWasAlive;
    const chunks: Chunk[] = [];
    for ( const name of WORLD_ARRAYS ) { chunks.push({ name, data: ( _st as any )[ name ].slice() }); }

    // the swimbots that need their objects: alive, and those that died last step (their body is still needed)
    const slots: number[] = [];
    for (let s = 0; s < MAX_SWIMBOTS; s++) { if (( _st.liveSwimbot[s] === 1 ) || _swimbotWasAlive[s] ) slots.push( s ); }
    const n = slots.length;
    const genes = new Uint8Array( n * NUM_GENES ), brain = new Float32Array( n * BRAIN_SIZE );
    const priv = new Float64Array( n * 12 ), origin = new Int8Array( n * MAX_PARTS );
    slots.forEach( ( s, i ) =>
    {
        const genotype = _swimbots[s].getGenotype();
        genes.set( genotype.getGenes(), i * NUM_GENES );
        brain.set( genotype.getBrain(), i * BRAIN_SIZE );
        _swimbots[s].getPrivateState( priv, i * 12 );
        _swimbots[s].getPhenotypeOrigins( origin, i * MAX_PARTS );
    });
    const wasAlive = new Uint8Array( MAX_SWIMBOTS );
    for (let s = 0; s < MAX_SWIMBOTS; s++) { wasAlive[s] = _swimbotWasAlive[s] ? 1 : 0; }
    const decoy = new Uint8Array( MAX_FOODBITS );
    for (let f = 0; f < MAX_FOODBITS; f++) { decoy[f] = ( _st.liveFood[f] === 1 && _foodBits[f].getAutotomyDecoy() ) ? 1 : 0; }   // (only for food that exists: a dead slot keeps an old flag)
    chunks.push({ name: "botSlots", data: Int32Array.from( slots ) }, { name: "botGenes", data: genes }, { name: "botBrain", data: brain },
                { name: "botPrivate", data: priv }, { name: "botOrigin", data: origin }, { name: "wasAlive", data: wasAlive }, { name: "foodDecoy", data: decoy });

    // the rest of the world
    const raw = environment.exportRaw();
    chunks.push({ name: "diseaseStrains", data: exportStrains() },
                { name: "envSoil", data: raw.soilNutrient }, { name: "envSoilAt", data: raw.nutrientUpdatedAt },
                { name: "envPlants0", data: raw.plantCount0 }, { name: "envPlants1", data: raw.plantCount1 },
                { name: "matingRecord", data: ctx.matingRecord.slice() }, { name: "matingBrightness", data: ctx.matingBrightnessDifference.slice() },
                { name: "matingChoosiness", data: ctx.matingChoosinessMean.slice() });

    // (the random numbers among them: the state everything above went on from)
    chunks.push({ name: "poolScalars", data: Float64Array.from( [
        ctx.clock, getRandomState(), ctx.seedDebt, ctx.nurseryDebt, ctx.classicSeedDebt, ctx.serial, ctx.gardenOfEdenRadius, ctx.currentSpeed, ctx.numSick,
        ctx.matingCount, ctx.simulationRunning ? 1 : 0, ctx.startMode, ctx.meatZoneDebt, getAtmosphereEnergy() ] ) });

    // every counter in one row (some are lists)
    const counterNames = Object.keys( simCounters ), counterValues: number[] = [], counterSizes: number[] = [];
    for ( const key of counterNames )
    {
        const value = ( simCounters as any )[ key ];
        const list = Array.isArray( value ) ? value : [ value ];
        counterSizes.push( Array.isArray( value ) ? list.length : -1 );
        for ( const x of list ) { counterValues.push( x ); }
    }
    chunks.push({ name: "counters", data: Float64Array.from( counterValues ) });

    let tree: any = null;
    if ( withFamilyTree )
    {
        tree = ctx.familyTree.exportState();
        chunks.push({ name: "familyCols", data: tree.cols }, { name: "familyGenes", data: tree.genes });
    }

    const _history = ctx.history, _obstacle = ctx.obstacle, _camera = ctx.camera;
    const header: any =
    {
        code: ( typeof __GENEPOOL_VERSION__ !== "undefined" ) ? __GENEPOOL_VERSION__ : "headless", created: new Date().toISOString(),
        worldScale: WORLD_SCALE, clock: ctx.clock, numAlive: slots.length,
        params: changedParams(), tweakers: { ...globalTweakers },
        counterNames, counterSizes,
        history: { interval: _history.interval, step: _history.step, herbivores: _history.herbivores, predators: _history.predators, plants: _history.plants, meat: _history.meat },
        environment: environment.getState(),
        gardens: ctx.gardens.map( g => ({ x: g.x, y: g.y, type: g.type })),
        roots: ctx.roots.map( r => ({ ...r })),
        obstacle: { x1: _obstacle.getEnd1Position().x, y1: _obstacle.getEnd1Position().y, x2: _obstacle.getEnd2Position().x, y2: _obstacle.getEnd2Position().y, enabled: _obstacle.getEnabled(), segments: _obstacle.getSegments() },
        camera: { x: _camera.getPosition().x, y: _camera.getPosition().y, scale: _camera.getScale() },
        familyTree: tree ? { n: tree.n, length: tree.length, traits: tree.traits } : null,
        map: ctx.map,
    };
    return packWorld( header, chunks );
}

// the hashes of the parts of the world (to compare two worlds, and to check a load)
export function worldHashes( ctx: any )
{
    const header = unpackWorld( saveWorld( ctx, false )).header;
    const out: any = {};
    for ( const c of header.chunks ) { out[ c.name ] = c.hash; }
    return out;
}

export function loadWorld( ctx: any, bytes: any )
{
    const _st = ctx.st, _swimbots = ctx.swimbots, _foodBits = ctx.foodBits, _swimbotWasAlive = ctx.swimbotWasAlive;
    const _familyTree = ctx.familyTree, _history = ctx.history, _roots = ctx.roots, _obstacle = ctx.obstacle, _camera = ctx.camera;

    let file;
    try { file = unpackWorld( bytes ); } catch ( e ) { return { ok: false, reason: "bad file: " + e.message }; }
    const header = file.header;
    if ( header.format !== WORLD_FORMAT ) { return { ok: false, reason: "format " + header.format + " is not " + WORLD_FORMAT }; }
    const mine: any = layoutFingerprint();
    if ( header.layout.WORLD_SCALE !== mine.WORLD_SCALE ) { return { ok: false, reason: "world size", needWorld: header.layout.WORLD_SCALE }; }
    for ( const key in mine )
    {
        if ( header.layout[ key ] !== mine[ key ] ) { return { ok: false, reason: "the code has other sizes now (" + key + "): load softly" }; }
    }

    // 1. the clock of the frames: no catching up after the load
    ctx.resetFrameClock();

    // 2. the changed numbers (the threads take them at the next phase); everything else as the code has it
    for ( const p of PARAM_LIST ) { setParameter( p.name, ( header.params && ( p.name in header.params )) ? header.params[ p.name ] : PARAM_DEFAULTS[ p.name ] ); }

    // 3. the settings (they go over all food and all swimbots: before the arrays are copied)
    const t = header.tweakers;
    ctx.setFoodGrowthDelay( t.foodRegenerationPeriod );
    ctx.setFoodSpread( t.foodSpread );
    ctx.setFoodBitEnergy( t.foodBitEnergy );
    ctx.setHungerThreshold( t.hungerThreshold );
    ctx.setAttraction( t.attractionCriterion );
    ctx.setOffspringEnergyRatio( t.childEnergyRatio );
    ctx.setMaximumSwimbotAge( t.maximumLifeSpan );
    globalTweakers.numFoodTypes = t.numFoodTypes;

    // 4. the map of the environment, then what changes in it
    const scalars = file.get( "poolScalars" );
    ctx.clock = scalars[0]; simClock.step = ctx.clock;
    environment.setState( header.environment );
    environment.importRaw({ time: ctx.clock, soilNutrient: file.get( "envSoil" ), nutrientUpdatedAt: file.get( "envSoilAt" ),
                            plantCount0: file.get( "envPlants0" ), plantCount1: file.get( "envPlants1" ) });
    if ( environment.active ) { environment.copyBackgroundTo( _st.background ); }
    try { const image = environment.active ? environment.makeImage() : null; ctx.setEnvironmentImage( image ); ctx.pool.setBackgroundImage( image ); } catch ( e ) { ctx.setEnvironmentImage( null ); }

    // 5. clear everything (dying counts and writes to the family tree: set right below)
    for (let f = 0; f < MAX_FOODBITS; f++) { _foodBits[f].kill(); }
    for (let s = 0; s < MAX_SWIMBOTS; s++) { _swimbots[s].die(); }
    
    // Reset atmosphere AFTER clearing bots/food, so die() energy transfers don't inflate the value
    if ( scalars.length > 13 ) { resetAtmosphere( scalars[13] ); }
    _familyTree.reset();
    importStrains( file.get( "diseaseStrains" ));

    // 6. the objects: swimbots (grown from their genes, put back as autotomy left them), food
    const slots = file.get( "botSlots" ), genes = file.get( "botGenes" ), brains = file.get( "botBrain" );
    const priv = file.get( "botPrivate" ), origin = file.get( "botOrigin" );
    const place = new Vector2D();
    const grown = new Genotype();      // (not the pool's own genotype: that one may be some swimbot's own genotype by now)
    for (let i = 0; i < slots.length; i++)
    {
        const s = slots[i];
        grown.setGenes( Array.from( genes.subarray( i * NUM_GENES, ( i + 1 ) * NUM_GENES )) );
        grown.setBrain( brains.subarray( i * BRAIN_SIZE, ( i + 1 ) * BRAIN_SIZE ));
        _swimbots[s].create( s, 0, place, 0, 0, grown, ctx.embryology );
        _swimbots[s].restorePhenotypeOrder( origin, i * MAX_PARTS );
        _swimbots[s].setPrivateState( priv, i * 12 );
    }
    const liveFood = file.get( "liveFood" ), decoy = file.get( "foodDecoy" );
    for (let f = 0; f < MAX_FOODBITS; f++)
    {
        if ( liveFood[f] !== 1 ) continue;
        _foodBits[f].initialize( f );
        _foodBits[f].setAutotomyDecoy( decoy[f] === 1 );
    }

    // 7. the numbers of the shared arrays, over everything the objects wrote (the arrays themselves stay: the threads hold them)
    for ( const name of WORLD_ARRAYS ) { if ( file.has( name )) ( _st as any )[ name ].set( file.get( name )); }
    for (let f = 0; f < MAX_FOODBITS; f++) { if ( liveFood[f] === 1 ) { _foodBits[f].setColorAccordingToType(); } }

    // 8. the rest of the pool
    const wasAlive = file.get( "wasAlive" );
    for (let s = 0; s < MAX_SWIMBOTS; s++) { _swimbotWasAlive[s] = wasAlive[s] === 1; }
    ctx.seedDebt = scalars[2]; ctx.nurseryDebt = scalars[3]; ctx.classicSeedDebt = scalars[4]; ctx.serial = scalars[5];
    ctx.gardenOfEdenRadius = scalars[6]; ctx.currentSpeed = scalars[7]; ctx.numSick = scalars[8]; ctx.matingCount = scalars[9];
    ctx.simulationRunning = scalars[10] === 1; ctx.startMode = scalars[11];
    ctx.map = header.map || null; ctx.prepareMapZones(); ctx.meatZoneDebt = ( scalars.length > 12 ) ? scalars[12] : 0;
    ctx.matingRecord.set( file.get( "matingRecord" )); ctx.matingBrightnessDifference.set( file.get( "matingBrightness" )); ctx.matingChoosinessMean.set( file.get( "matingChoosiness" ));
    ctx.gardens = header.gardens.map( g => ({ x: g.x, y: g.y, type: g.type }));
    _roots.length = 0;
    for ( const r of header.roots ) { _roots.push({ ...r }); }
    const h = header.history;
    _history.interval = h.interval;
    _history.step = h.step.slice(); _history.herbivores = h.herbivores.slice(); _history.predators = h.predators.slice(); _history.plants = h.plants.slice(); _history.meat = h.meat.slice();
    const end1 = new Vector2D(), end2 = new Vector2D();
    end1.setXY( header.obstacle.x1, header.obstacle.y1 ); end2.setXY( header.obstacle.x2, header.obstacle.y2 );
    if ( header.obstacle.segments ) { _obstacle.setSegments( header.obstacle.segments ); }
    else                            { _obstacle.setEndpointPositions( end1, end2 ); }
    _obstacle.setEnabled( header.obstacle.enabled );
    const cameraAt = new Vector2D(); cameraAt.setXY( header.camera.x, header.camera.y );
    _camera.setPosition( cameraAt );
    _camera.setScale( header.camera.scale );
    ctx.setSelectedSwimbot( NULL_INDEX );
    ctx.resetViewTracking();
    if ( header.familyTree && file.has( "familyCols" ))
    {
        _familyTree.importState({ ...header.familyTree, cols: file.get( "familyCols" ), genes: file.get( "familyGenes" ) });
    }

    // 9. the counters after everything that counted (die, create...), the caches, the random numbers last
    const counterValues = file.get( "counters" );
    let at = 0;
    header.counterNames.forEach( ( key, i ) =>
    {
        if ( header.counterSizes[i] < 0 ) { ( simCounters as any )[ key ] = counterValues[ at ++ ]; }
        else { for (let k = 0; k < header.counterSizes[i]; k++) { ( simCounters as any )[ key ][k] = counterValues[ at ++ ]; } }
    });
    ctx.writePerceptionParams();
    ctx.rebuildAliveIndexCaches();
    ctx.refreshCounts();
    setRandomState( scalars[1] );

    // 10. is it the same world? (the parts of the file against the parts now)
    const now = worldHashes( ctx ), mismatches: string[] = [];
    for ( const c of header.chunks ) { if ( c.name in now && now[ c.name ] !== c.hash ) mismatches.push( c.name ); }
    return { ok: true, mismatches, code: header.code, clock: ctx.clock };
}
