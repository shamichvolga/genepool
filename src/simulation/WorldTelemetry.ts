//------------------------------------------------------------------------------
// WorldTelemetry — all read-only statistics of the living pool.
//
// The bottom status bar, the population graphs and the ecology counters all
// need the same walk over the shared arrays. Keeping it here leaves GenePool
// with the job of driving a step instead of counting the world after it.
// Nothing in this module writes to the simulation.
//------------------------------------------------------------------------------
import { GENES_ASYMMETRY } from "./EcologyGenes";
import { NUM_GENES } from "./Genotype";
import { NUM_GENES_USED } from "./Globals";
import { getAtmosphereEnergy } from "./EnergyBudget";
import { asymmetryFromGene, isExperimentalEmbryologyGene } from "./Embryology";
import { BYTE_SIZE, ZERO, ONE } from "./MathConstants";
import { MAX_FOODBITS, MAX_SWIMBOTS, PREDATOR_LEVEL_THRESHOLD } from "./Parameters";
import * as SS from "./SharedState";
import { totalSoilEnergy } from "./SoilEcology";

export interface TelemetryContext
{
    st: any;
    swimbots: any[];
    foodBits: any[];
    maxSwimbotSlot: number;
    ambientEnergy: number;
    initialEnergy: number;
    phyloTree: any;
    environment: any;
    soilNutrient: () => number;
}

// Kill-the-Winner pressure. Only living herbivores count: a size niche is
// "common" when it holds more than 22% of them. Swimbot and PhysicsKernel read
// the four shares back from the shared state in the same step.
export function updateMorphShares( st: any ): void
{
    const counts = [ 0, 0, 0, 0 ];
    const exact = new Float32Array( 16 );
    let herbivores = 0;
    for ( let s = 0; s < MAX_SWIMBOTS; s++ )
    {
        if ( st.liveSwimbot[s] !== 1 ) continue;
        if ( st.predator[s] > PREDATOR_LEVEL_THRESHOLD ) continue;
        const parts = st.bots[ s * SS.BOT_STRIDE + SS.B_NUM_PARTS ];
        if ( parts < 1 || parts > 16 ) continue;
        const band = parts <= 5 ? 0 : parts <= 8 ? 1 : parts <= 12 ? 2 : 3;
        counts[band] ++;
        exact[ parts - 1 ] ++;
        herbivores ++;
    }
    for ( let b = 0; b < 4; b++ )
    {
        st.params[ SS.PARAM_MORPH_SHARE_0 + b ] = herbivores > 0 ? counts[b] / herbivores : 0;
    }
    for ( let p = 0; p < 16; p++ )
    {
        st.params[ SS.PARAM_PART_SHARE_BASE + p ] = herbivores > 0 ? exact[p] / herbivores : 0;
    }
}

// Atmosphere + soil + ambient + plants/meat + bodies. Must stay constant.
export function totalWorldEnergy( ctx: TelemetryContext ): number
{
    const st = ctx.st;
    let total = getAtmosphereEnergy() + ctx.ambientEnergy + totalSoilEnergy( st );
    for ( let f = 0; f < MAX_FOODBITS; f++ ) { if ( st.liveFood[f] === 1 ) total += st.foodEnergy[f]; }
    for ( let s = 0; s < MAX_SWIMBOTS; s++ ) { if ( st.liveSwimbot[s] === 1 ) total += st.bots[ s * SS.BOT_STRIDE + SS.B_ENERGY ]; }
    return total;
}

// The census-facing ecology summary (plants, trees, seeds, asymmetry).
export function ecologyStats( ctx: TelemetryContext ): any
{
    const st = ctx.st;
    let plants = 0, trees = 0, fruits = 0, carriedSeeds = 0;
    for ( let f = 0; f < MAX_FOODBITS; f++ )
    {
        if ( st.liveFood[f] !== 1 ) continue;
        if ( st.foodType[f] === 2 ) continue;
        plants ++;
        if ( st.foodWood[f] >= 28 ) trees ++;          // WOOD_PER_FRUIT_TIER
        if ( st.foodFruit[f] === 1 ) fruits ++;
    }
    let alive = 0, asymAbs = 0, asymStrong = 0;
    for ( let s = 0; s < MAX_SWIMBOTS; s++ )
    {
        if ( st.liveSwimbot[s] !== 1 ) continue;
        alive ++;
        if ( ctx.swimbots[s].hasCarriedSeed() ) carriedSeeds ++;
        const gene = ctx.swimbots[s].getGenotype().getGeneValue( GENES_ASYMMETRY[0] ) / BYTE_SIZE;
        const asym = Math.abs( asymmetryFromGene( gene ));
        asymAbs += asym;
        if ( asym > 0.05 ) asymStrong ++;
    }
    return { plants, trees, fruits, carriedSeeds, soil: ctx.soilNutrient(),
             soilEnergy: totalSoilEnergy( st ), ambientEnergy: ctx.ambientEnergy,
             atmosphere: getAtmosphereEnergy(), totalEnergy: totalWorldEnergy( ctx ),
             initialEnergy: ctx.initialEnergy,
             asymmetryMean: alive > 0 ? asymAbs / alive : 0,
             asymmetryShare: alive > 0 ? asymStrong / alive : 0 };
}

// Bottom status bar: five reservoirs, three herbivore size bands, four plant
// stages. The returned object is reused by GenePool every eight steps.
export function fillTelemetry( out: any, ctx: TelemetryContext ): any
{
    const st = ctx.st;
    let eBots = 0, ePlants = 0, eMeat = 0;
    let sprouts = 0, young = 0, grown = 0, trees = 0;
    for ( let f = 0; f < MAX_FOODBITS; f++ )
    {
        if ( st.liveFood[f] !== 1 ) continue;
        const e = st.foodEnergy[f];
        if ( st.foodType[f] === 2 ) { eMeat += e; continue; }
        ePlants += e;
        if ( e < 9 ) sprouts ++;
        else if ( e < 20 ) young ++;
        else if ( e < 42 ) grown ++;
        else trees ++;
    }
    let herbSmall = 0, herbMed = 0, herbLarge = 0, predators = 0;
    for ( let s = 0; s < MAX_SWIMBOTS; s++ )
    {
        if ( st.liveSwimbot[s] !== 1 ) continue;
        const base = s * SS.BOT_STRIDE;
        eBots += st.bots[ base + SS.B_ENERGY ];
        if ( ctx.swimbots[s].getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD ) { predators ++; continue; }
        const parts = st.bots[ base + SS.B_NUM_PARTS ];
        if ( parts <= 5 ) herbSmall ++;
        else if ( parts <= 8 ) herbMed ++;
        else herbLarge ++;
    }
    out.eBots = eBots;   out.ePlants = ePlants; out.eMeat = eMeat;
    out.eSoil = totalSoilEnergy( st );
    out.eAmbient = ctx.ambientEnergy;
    out.eAtmosphere = getAtmosphereEnergy();
    out.eTotal = eBots + ePlants + eMeat + out.eSoil + ctx.ambientEnergy + out.eAtmosphere;
    out.eInitial = ctx.initialEnergy;
    out.eDelta = out.eTotal - ctx.initialEnergy;
    out.sprouts = sprouts; out.young = young; out.grown = grown; out.trees = trees;
    out.herbSmall = herbSmall; out.herbMed = herbMed; out.herbLarge = herbLarge;
    out.predators = predators; out.soilTotal = out.eSoil;
    return out;
}

// Even sample of at most `sampleSize` live bodies; no random numbers.
export function estimateGeneticClusters( swimbots: any[], sampleSize = 400 ): any
{
    const alive = [];
    for ( let s = 0; s < MAX_SWIMBOTS; s++ ) { if ( swimbots[s].getAlive() ) alive.push( s ); }
    const n = alive.length;
    if ( n === 0 ) return { geneticClusters: 0, largestClusterShare: 0, sampled: 0 };
    const stride = Math.max( 1, n / sampleSize );
    const groups: { genes: number[], count: number }[] = [];
    let sampled = 0;
    for ( let i = 0; i < n; i += stride )
    {
        const genes = swimbots[ alive[ Math.floor( i ) ] ].getGenotype().getGenes();
        const limit = 0.12 * NUM_GENES_USED * 255;
        let found = null;
        for ( const group of groups )
        {
            let sum = 0;
            for ( let g = 0; g < NUM_GENES_USED && sum < limit; g++ ) { sum += Math.abs( group.genes[g] - genes[g] ); }
            if ( sum < limit ) { found = group; break; }
        }
        if ( found ) { found.count ++; }
        else { groups.push({ genes: genes.slice( 0, NUM_GENES_USED ), count: 1 }); }
        sampled ++;
    }
    const largeClusters = groups.filter( g => g.count >= sampled * 0.03 );
    const largest = groups.reduce( ( m, g ) => Math.max( m, g.count ), 0 );
    return { geneticClusters: largeClusters.length, largestClusterShare: largest / sampled, sampled };
}

export function junkDnaSimilarity( genotype1: any, genotype2: any ): number
{
    let diff = ZERO, num = 0;
    for ( let g = NUM_GENES_USED; g < NUM_GENES; g++ )
    {
        if ( isExperimentalEmbryologyGene( g )) { continue; }
        diff += Math.abs( genotype1.getGeneValue( g ) - genotype2.getGeneValue( g )) / BYTE_SIZE;
        num ++;
    }
    return ONE - diff / num;
}

export function generatePhyloTree( swimbots: any[], tree: any ): void
{
    tree.initialize( NUM_GENES - NUM_GENES_USED );
    for ( let s = 0; s < MAX_SWIMBOTS; s++ )
    {
        if ( swimbots[s].getAlive() ) { tree.addJunkDNA( swimbots[s].getGenotype() ); }
    }
}

export function countFoodBitsOfType( st: any, type: number ): number
{
    let num = 0;
    for ( let f = 0; f < MAX_FOODBITS; f++ )
    {
        if (( st.liveFood[f] === 1 ) && ( st.foodType[f] === type )) { num ++; }
    }
    return num;
}

export function countFoodBits( foodBits: any[], numFoodTypes: number ): number
{
    let num = 0;
    for ( let f = 0; f < MAX_FOODBITS; f++ )
    {
        if ( foodBits[f].getAlive() && ( numFoodTypes !== 2 || foodBits[f].getType() === 0 )) { num ++; }
    }
    return num;
}

export function countSwimbots( st: any, maxSlot: number ): number
{
    let num = 0;
    for ( let s = 0; s < maxSlot; s++ ) { if ( st.liveSwimbot[s] === 1 ) { num ++; } }
    return num;
}
