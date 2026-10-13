//------------------------------------------------------------------------------
// The environment: a temperature map with biomes, seasons, and a count of the
// plants in each part of the pool.
//
// Temperature T (0 = cold .. 1 = hot) =
//     0.5 + 0.30 · latitude (north cold, south hot)
//         + 0.20 · biome offset (patches 2500–4000 units, soft 400–800 borders)
//         + season (period 10 000 steps, stronger towards the poles)
//
// Background brightness B (0 = dark bottom .. 1 = light bottom): half the
// temperature, half a random shade of each biome patch. Swimbots whose body
// brightness matches the background are harder for predators to see.
//
// Why these numbers: see docs/БИОЛОГ_ЭТАП5.md (patches must be much larger than
// how far a swimbot travels in its life, borders soft, changes slow).
//------------------------------------------------------------------------------
import { gpRandom } from "./Globals";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";

// Control experiment "no environment": set to true and the map is flat
// (T = 0.5 everywhere, plants grow anywhere) while all other rules stay.
export const FLAT_ENVIRONMENT          = false;

export const FIELD_SIZE                = 256;      // temperature grid: FIELD_SIZE x FIELD_SIZE cells
export const PLANT_CELL_SIZE           = 250;      // plant counting grid (pool units)

const LATITUDE_STRENGTH                = 0.30;
const BIOME_STRENGTH                   = 0.20;
const BIOME_SPACING                    = 4000;     // distance between biome patch centers
const BIOME_BORDER_SOFTNESS            = 300;      // larger = wider, softer borders
const BIOME_OFFSETS                    = [ -1.0, -0.5, 0.0, 0.5, 1.0 ];   // 5 biome types

export const SEASON_PERIOD             = 10000;    // steps
const SEASON_AMPLITUDE_EQUATOR         = 0.02;
const SEASON_AMPLITUDE_POLES           = 0.08;

// plants: A likes warm water, B likes cold water
export const PLANT_TYPE_WARM           = 0;
export const PLANT_TYPE_COLD           = 1;
const PLANT_OPTIMUM                    = [ 0.7, 0.3 ];
const PLANT_TOLERANCE                  = 0.15;

export const BIOME_NAMES               = [ "cold", "cool", "mild", "warm", "hot" ];

export class Environment
{
    private baseTemperature = new Float32Array( FIELD_SIZE * FIELD_SIZE );
    private biomeOfCell     = new Int8Array   ( FIELD_SIZE * FIELD_SIZE );
    private background      = new Float32Array( FIELD_SIZE * FIELD_SIZE );
    private biomeSeeds      : { x: number, y: number, type: number, shade: number }[] = [];
    private time            = 0;

    // the environment rules (temperature, climate plants, digestion) apply
    // only in the "random" pool; the classic presets keep the old rules
    active                  = false;

    readonly plantColumns   = Math.ceil( ( POOL_RIGHT  - POOL_LEFT ) / PLANT_CELL_SIZE );
    readonly plantRows      = Math.ceil( ( POOL_BOTTOM - POOL_TOP  ) / PLANT_CELL_SIZE );
    readonly plantCount     = [ new Int32Array( this.plantColumns * this.plantRows ),     // warm plants per cell
                                new Int32Array( this.plantColumns * this.plantRows ) ];   // cold plants per cell

    //--------------------------------------------------------------------
    // make a new map (uses the simulation's random numbers)
    //--------------------------------------------------------------------
    generate(): void
    {
        //------------------------------------------------------------
        // biome patch centers on a jittered grid, random biome types
        //------------------------------------------------------------
        this.biomeSeeds = [];
        const width  = POOL_RIGHT  - POOL_LEFT;
        const height = POOL_BOTTOM - POOL_TOP;
        const columns = Math.max( 1, Math.round( width  / BIOME_SPACING ));
        const rows    = Math.max( 1, Math.round( height / BIOME_SPACING ));
        for ( let r = 0; r < rows; r++ )
        {
            for ( let c = 0; c < columns; c++ )
            {
                this.biomeSeeds.push(
                {
                    x    : POOL_LEFT + ( c + 0.2 + 0.6 * gpRandom() ) * width  / columns,
                    y    : POOL_TOP  + ( r + 0.2 + 0.6 * gpRandom() ) * height / rows,
                    type : Math.floor( gpRandom() * BIOME_OFFSETS.length ),
                    shade: gpRandom(),
                });
            }
        }

        this.computeField();
    }

    //--------------------------------------------------------------------
    // saving and loading: the map is rebuilt from its patch centers
    //--------------------------------------------------------------------
    getState()
    {
        return { active: this.active, seeds: this.biomeSeeds.map( s => ({ x: s.x, y: s.y, type: s.type, shade: s.shade })) };
    }

    setState( state ): void
    {
        this.active     = !!( state && state.active && state.seeds && state.seeds.length > 0 );
        this.biomeSeeds = this.active ? state.seeds.map( s => ({ x: s.x, y: s.y, type: s.type, shade: ( s.shade !== undefined ) ? s.shade : 0.5 })) : [];
        if ( this.active ) { this.computeField(); }
    }

    //--------------------------------------------------------------------
    // base temperature in every cell, from the biome patch centers
    //--------------------------------------------------------------------
    private computeField(): void
    {
        const width  = POOL_RIGHT  - POOL_LEFT;
        const height = POOL_BOTTOM - POOL_TOP;
        for ( let j = 0; j < FIELD_SIZE; j++ )
        {
            for ( let i = 0; i < FIELD_SIZE; i++ )
            {
                const x = POOL_LEFT + ( i + 0.5 ) / FIELD_SIZE * width;
                const y = POOL_TOP  + ( j + 0.5 ) / FIELD_SIZE * height;
                const latitude = this.latitude( y );

                // soft Voronoi: nearby patch centers blend near the borders
                let nearest = Infinity, nearestType = 0;
                const distances = this.biomeSeeds.map( s => Math.hypot( s.x - x, s.y - y ));
                for ( let k = 0; k < distances.length; k++ )
                {
                    if ( distances[k] < nearest ) { nearest = distances[k]; nearestType = this.biomeSeeds[k].type; }
                }
                let weightSum = 0, offsetSum = 0, shadeSum = 0;
                for ( let k = 0; k < distances.length; k++ )
                {
                    const w = Math.exp( -( distances[k] - nearest ) / BIOME_BORDER_SOFTNESS );
                    weightSum += w;
                    offsetSum += w * BIOME_OFFSETS[ this.biomeSeeds[k].type ];
                    shadeSum  += w * this.biomeSeeds[k].shade;
                }

                const t = Math.min( 1, Math.max( 0, 0.5 + LATITUDE_STRENGTH * latitude + BIOME_STRENGTH * ( offsetSum / weightSum )));
                this.baseTemperature[ j * FIELD_SIZE + i ] = t;
                this.background     [ j * FIELD_SIZE + i ] = 0.5 * t + 0.5 * ( shadeSum / weightSum );
                this.biomeOfCell    [ j * FIELD_SIZE + i ] = nearestType;
            }
        }
    }

    // -1 at the top (north, cold) .. +1 at the bottom (south, hot)
    latitude( y: number ): number
    {
        return ( ( y - POOL_TOP ) / ( POOL_BOTTOM - POOL_TOP ) ) * 2 - 1;
    }

    setTime( step: number ): void { this.time = step; }

    // -1 (deep winter) .. +1 (high summer)
    seasonPhase(): number { return Math.sin( 2 * Math.PI * this.time / SEASON_PERIOD ); }

    // the season now (the warm part of the year is "summer")
    seasonName(): string
    {
        const phase = 2 * Math.PI * this.time / SEASON_PERIOD;
        const s = Math.sin( phase ), c = Math.cos( phase );
        if ( s >  0.5 ) return "summer";
        if ( s < -0.5 ) return "winter";
        return ( c > 0 ) ? "spring" : "autumn";
    }

    //--------------------------------------------------------------------
    // temperature at a point, now (smoothly interpolated, with season)
    //--------------------------------------------------------------------
    temperatureAt( x: number, y: number ): number
    {
        if ( !this.active || FLAT_ENVIRONMENT ) return 0.5;

        const fx = ( x - POOL_LEFT ) / ( POOL_RIGHT  - POOL_LEFT ) * FIELD_SIZE - 0.5;
        const fy = ( y - POOL_TOP  ) / ( POOL_BOTTOM - POOL_TOP  ) * FIELD_SIZE - 0.5;
        let i = Math.floor( fx ), j = Math.floor( fy );
        const ax = fx - i, ay = fy - j;
        const i0 = Math.min( FIELD_SIZE - 1, Math.max( 0, i     ));
        const i1 = Math.min( FIELD_SIZE - 1, Math.max( 0, i + 1 ));
        const j0 = Math.min( FIELD_SIZE - 1, Math.max( 0, j     ));
        const j1 = Math.min( FIELD_SIZE - 1, Math.max( 0, j + 1 ));
        const f = this.baseTemperature;
        const base = ( f[ j0 * FIELD_SIZE + i0 ] * ( 1 - ax ) + f[ j0 * FIELD_SIZE + i1 ] * ax ) * ( 1 - ay )
                   + ( f[ j1 * FIELD_SIZE + i0 ] * ( 1 - ax ) + f[ j1 * FIELD_SIZE + i1 ] * ax ) * ay;

        const latitude  = Math.abs( this.latitude( y ));
        const amplitude = SEASON_AMPLITUDE_EQUATOR + ( SEASON_AMPLITUDE_POLES - SEASON_AMPLITUDE_EQUATOR ) * latitude;
        const t = base + amplitude * Math.sin( 2 * Math.PI * this.time / SEASON_PERIOD );
        return t < 0 ? 0 : ( t > 1 ? 1 : t );
    }

    // copy the bottom brightness map (for the perception threads)
    copyBackgroundTo( target: Float32Array ): void { target.set( this.background ); }

    // background brightness at a point (0 = dark .. 1 = light)
    backgroundAt( x: number, y: number ): number
    {
        if ( !this.active || FLAT_ENVIRONMENT ) return 0.5;
        const i = Math.min( FIELD_SIZE - 1, Math.max( 0, Math.floor( ( x - POOL_LEFT ) / ( POOL_RIGHT  - POOL_LEFT ) * FIELD_SIZE )));
        const j = Math.min( FIELD_SIZE - 1, Math.max( 0, Math.floor( ( y - POOL_TOP  ) / ( POOL_BOTTOM - POOL_TOP  ) * FIELD_SIZE )));
        return this.background[ j * FIELD_SIZE + i ];
    }

    // which biome type (0..4) a point belongs to
    biomeAt( x: number, y: number ): number
    {
        const i = Math.min( FIELD_SIZE - 1, Math.max( 0, Math.floor( ( x - POOL_LEFT ) / ( POOL_RIGHT  - POOL_LEFT ) * FIELD_SIZE )));
        const j = Math.min( FIELD_SIZE - 1, Math.max( 0, Math.floor( ( y - POOL_TOP  ) / ( POOL_BOTTOM - POOL_TOP  ) * FIELD_SIZE )));
        return this.biomeOfCell[ j * FIELD_SIZE + i ];
    }

    // how well a plant type grows at temperature T (0..1)
    plantSuitability( type: number, temperature: number ): number
    {
        if ( !this.active || FLAT_ENVIRONMENT ) return 1;
        const d = temperature - PLANT_OPTIMUM[ type ];
        return Math.exp( -( d * d ) / ( 2 * PLANT_TOLERANCE * PLANT_TOLERANCE ));
    }

    //--------------------------------------------------------------------
    // plant counts per cell (rebuilt by GenePool every step)
    //--------------------------------------------------------------------
    plantCellIndex( x: number, y: number ): number
    {
        const c = Math.min( this.plantColumns - 1, Math.max( 0, Math.floor( ( x - POOL_LEFT ) / PLANT_CELL_SIZE )));
        const r = Math.min( this.plantRows    - 1, Math.max( 0, Math.floor( ( y - POOL_TOP  ) / PLANT_CELL_SIZE )));
        return r * this.plantColumns + c;
    }

    clearPlantCounts(): void
    {
        this.plantCount[0].fill( 0 );
        this.plantCount[1].fill( 0 );
    }

    //--------------------------------------------------------------------
    // one center for a "garden" in each biome type (for the start)
    //--------------------------------------------------------------------
    gardenCenters(): { x: number, y: number, type: number }[]
    {
        const centers = [];
        const margin = 1500;
        for ( let type = 0; type < BIOME_OFFSETS.length; type++ )
        {
            const candidates = this.biomeSeeds.filter( s => s.type === type
                && s.x > POOL_LEFT + margin && s.x < POOL_RIGHT  - margin
                && s.y > POOL_TOP  + margin && s.y < POOL_BOTTOM - margin );
            const pool = candidates.length > 0 ? candidates : this.biomeSeeds.filter( s => s.type === type );
            if ( pool.length > 0 ) { centers.push( pool[ Math.floor( gpRandom() * pool.length ) ] ); }
        }
        return centers;
    }

    //--------------------------------------------------------------------
    // a picture of the temperature map (for drawing behind the pool);
    // returns null outside a browser
    //--------------------------------------------------------------------
    makeImage(): HTMLCanvasElement | null
    {
        if ( typeof document === "undefined" ) return null;
        const image = document.createElement( "canvas" );
        image.width = image.height = FIELD_SIZE;
        const context = image.getContext( "2d" );
        const pixels  = context.createImageData( FIELD_SIZE, FIELD_SIZE );
        for ( let k = 0; k < FIELD_SIZE * FIELD_SIZE; k++ )
        {
            // hue = temperature (cold: deep blue-grey; hot: muted brown-olive),
            // lightness = background brightness (the pool keeps its calm look)
            const on = this.active && !FLAT_ENVIRONMENT;
            const t  = on ? this.baseTemperature[k] : 0.5;
            const l  = 0.62 + 0.76 * ( on ? this.background[k] : 0.5 );
            pixels.data[ k * 4     ] = ( 38 + t * 40 ) * l;
            pixels.data[ k * 4 + 1 ] = ( 52 + t * 18 ) * l;
            pixels.data[ k * 4 + 2 ] = ( 82 - t * 34 ) * l;
            pixels.data[ k * 4 + 3 ] = 255;
        }
        context.putImageData( pixels, 0, 0 );
        return image;
    }
}

// the one environment of the simulation
export const environment = new Environment();
