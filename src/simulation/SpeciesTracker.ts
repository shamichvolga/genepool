//------------------------------------------------------------------------------
// SpeciesTracker — groups living swimbots by genotype similarity, maintains
// stable cluster IDs across counts, and builds limb poses for the species UI.
//------------------------------------------------------------------------------
import { NUM_GENES_USED } from "./Globals";
import { NUM_GENES } from "./Genotype";
import { MAX_SWIMBOTS, PREDATOR_LEVEL_THRESHOLD } from "./Parameters";
import { MAX_PARTS } from "./SwimbotTypes";
import * as SS from "./SharedState";

const SPECIES_LIMIT     = 0.12 * NUM_GENES_USED * 255;
const SPECIES_MIN_SHARE = 0.005;
const SPECIES_MAX_SHOWN = 14;
const SPECIES_EVERY_MS  = 1500;

export interface SpeciesContext {
    readonly st: SS.SharedState;
    readonly swimbots: any[];
    killSwimbot( s: number ): void;
}

export function createSpeciesTracker( ctx: SpeciesContext )
{
    const _speciesCenters: { id: number, genes: Float64Array }[] = [];
    let _speciesNextId  = 1;
    let _speciesCounted = 0;
    let _speciesMembers: Map<number, number[]> = new Map();
    let _speciesInfo: any[] = [];
    let _speciesOther = 0;
    let _speciesTotal = 0;

    function countSpecies()
    {
        const st = ctx.st, bots = ctx.swimbots;
        const alive: number[] = [];
        for ( let s = 0; s < MAX_SWIMBOTS; s++ ) { if ( st.liveSwimbot[s] === 1 ) alive.push( s ); }

        const members = new Map<number, number[]>();
        for ( const c of _speciesCenters ) { members.set( c.id, [] ); }
        for ( const s of alive )
        {
            const genes = bots[s].getGenotype().getGenes();
            let best = null, bestDistance = SPECIES_LIMIT;
            for ( const c of _speciesCenters )
            {
                let sum = 0;
                for ( let g = 0; g < NUM_GENES_USED && sum < bestDistance; g++ ) { sum += Math.abs( c.genes[g] - genes[g] ); }
                if ( sum < bestDistance ) { bestDistance = sum; best = c; }
            }
            if ( best === null )
            {
                best = { id: _speciesNextId++, genes: Float64Array.from( genes.slice( 0, NUM_GENES_USED )) };
                _speciesCenters.push( best );
                members.set( best.id, [] );
            }
            members.get( best.id )!.push( s );
        }

        for ( let i = _speciesCenters.length - 1; i >= 0; i-- )
        {
            const c = _speciesCenters[i], list = members.get( c.id )!;
            if ( list.length === 0 ) { _speciesCenters.splice( i, 1 ); members.delete( c.id ); continue; }
            for ( let g = 0; g < NUM_GENES_USED; g++ )
            {
                let sum = 0;
                for ( const s of list ) { sum += bots[s].getGenotype().getGenes()[g]; }
                c.genes[g] = sum / list.length;
            }
        }

        const total = alive.length;
        const info: any[] = [];
        let other = 0;
        const order = _speciesCenters.slice().sort( ( a, b ) => members.get( b.id )!.length - members.get( a.id )!.length );
        for ( const c of order )
        {
            const list = members.get( c.id )!;
            if ( info.length >= SPECIES_MAX_SHOWN || list.length < total * SPECIES_MIN_SHARE ) { other += list.length; continue; }
            let mass = 0, parts = 0, predators = 0, energy = 0, r = 0, g = 0, b = 0;
            for ( const s of list )
            {
                const bot = bots[s], color = bot.getAverageColor();
                mass += bot.getPhenotypeMass(); parts += bot.getNumParts(); energy += bot.getEnergy();
                if ( bot.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD ) predators++;
                r += color.red; g += color.green; b += color.blue;
            }
            const n = list.length;
            info.push({ id: c.id, count: n, share: n / total, meanMass: mass / n, meanParts: parts / n, predatorShare: predators / n, meanEnergy: energy / n, color: [ r / n, g / n, b / n ] });
        }
        _speciesMembers = members;
        _speciesInfo = info;
        _speciesOther = other;
        _speciesTotal = total;
    }

    function speciesPose( list: number[] ): number[]
    {
        const st = ctx.st;
        let s = -1;
        for ( const q of list ) { if ( st.liveSwimbot[q] === 1 ) { s = q; break; } }
        if ( s < 0 ) return [];
        const B = st.bots, b = s * SS.BOT_STRIDE;
        const n = B[ b + SS.B_NUM_PARTS ];
        const cx = B[ b + SS.B_COM_X ], cy = B[ b + SS.B_COM_Y ];
        const heading = Math.atan2( B[ b + SS.B_MOUTH_Y ] - cy, B[ b + SS.B_MOUTH_X ] - cx );
        const cos = Math.cos( -heading ), sin = Math.sin( -heading );
        const out: number[] = [];
        const end = ( p: number ) => [ st.parts[ s * SS.PART_STRIDE + p * SS.PS + SS.P_X ] - cx, st.parts[ s * SS.PART_STRIDE + p * SS.PS + SS.P_Y ] - cy ];
        for ( let p = 1; p < n; p++ )
        {
            const parent = st.partParent[ s * MAX_PARTS + p ];
            const a = end( parent >= 0 ? parent : 0 ), e = end( p );
            const k = s * MAX_PARTS + p;
            out.push( a[0] * cos - a[1] * sin, a[0] * sin + a[1] * cos, e[0] * cos - e[1] * sin, e[0] * sin + e[1] * cos,
                      st.partWidth[ k ], st.partRGB[ k * 3 ], st.partRGB[ k * 3 + 1 ], st.partRGB[ k * 3 + 2 ] );
        }
        return out;
    }

    return {
        getSpeciesView()
        {
            const nowMs = ( typeof performance !== "undefined" ) ? performance.now() : 0;
            if (( _speciesInfo.length === 0 ) || ( nowMs - _speciesCounted > SPECIES_EVERY_MS ) || ( nowMs < _speciesCounted ))
            {
                countSpecies();
                _speciesCounted = nowMs;
            }
            return { total: _speciesTotal, other: _speciesOther, species: _speciesInfo.map( s => ({ ...s, pose: speciesPose( _speciesMembers.get( s.id ) || [] ) })) };
        },
        getSpeciesGenes( id: number )
        {
            const list = _speciesMembers.get( id );
            if ( !list || list.length === 0 ) return null;
            const genes = new Array( NUM_GENES ).fill( 0 );
            for ( const s of list ) { const g = ctx.swimbots[s].getGenotype().getGenes(); for ( let i = 0; i < NUM_GENES; i++ ) { genes[i] += g[i]; } }
            return genes.map( x => Math.max( 0, Math.min( 255, Math.round( x / list.length ))) );
        },
        killSpecies( id: number )
        {
            countSpecies();
            const list = _speciesMembers.get( id );
            if ( !list ) return;
            for ( const s of list )
            {
                if ( ctx.st.liveSwimbot[s] === 1 ) { ctx.killSwimbot( s ); }
            }
            _speciesCounted = 0;
        },
    };
}
