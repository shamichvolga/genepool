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
import { ZONE_TEMPERATURE, pointInZone, zoneBounds } from "./MapZones";
import { TEMPERATURE_ENABLED } from "./Parameters";
import { POOL_BOTTOM, POOL_LEFT, POOL_RIGHT, POOL_TOP } from "./Pool";
import { petriLevel, petriPosition, petriTemperature, petriSettings } from "./Petri";

// Control experiment "no environment": set to true and the map is flat
// (T = 0.5 everywhere, plants grow anywhere) while all other rules stay.
// (24.10: the temperature gradient is off - TEMPERATURE_ENABLED in Parameters.ts; flat = no map)
export const FLAT_ENVIRONMENT          = !TEMPERATURE_ENABLED;

// Optional matter cycle experiment: meat rot returns nutrients to the same
// plant cell, and each successful sprout consumes one nutrient unit.
export const NUTRIENT_CYCLE_ENABLED              = false;
export const INITIAL_SOIL_NUTRIENT_PER_CELL      = 3.0;
export const SOIL_NUTRIENT_CAPACITY_PER_CELL     = 12.0;
export const SOIL_NUTRIENT_PER_SPROUT            = 1.0;
export const MEAT_DETRITUS_YIELD                 = 0.05;
export const SOIL_NUTRIENT_DECAY_PER_STEP        = 0.00001;

// Optional seasonal availability pulse for the single plant food type.
// The multiplier averages to 1 over a full season and is disabled by default.
export const SEASONAL_PLANT_GROWTH_ENABLED       = false;
export const SEASONAL_PLANT_GROWTH_AMPLITUDE     = 0.5;

export const FIELD_SIZE                = 256;      // temperature grid: FIELD_SIZE x FIELD_SIZE cells
export const PLANT_CELL_SIZE           = 250;      // plant counting grid (pool units)

const LATITUDE_STRENGTH                = 0.30;
const BIOME_STRENGTH                   = 0.20;
const BIOME_SPACING                    = 4000;     // distance between biome patch centers
const BIOME_BORDER_SOFTNESS            = 300;      // larger = wider, softer borders
const BIOME_OFFSETS                    = [ -1.0, -0.5, 0.0, 0.5, 1.0 ];   // 5 biome types

export const SEASON_PERIOD             = 10000;    // steps
export const SEASON_AMPLITUDE_EQUATOR         = 0.02;
export const SEASON_AMPLITUDE_POLES           = 0.08;

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

    // the "petri" pool: zones instead of biome patches (null = normal map)
    petri : { zones: number, layout: number, softness: number } | null = null;
    private zoneOfCell      = new Int8Array( FIELD_SIZE * FIELD_SIZE );

    // a drawn map (map editor): flat or not, and the temperature zones painted over the generated map
    paint : { blank: boolean, zones: { kind: string, points: number[] }[] } | null = null;

    readonly plantColumns   = Math.ceil( ( POOL_RIGHT  - POOL_LEFT ) / PLANT_CELL_SIZE );
    readonly plantRows      = Math.ceil( ( POOL_BOTTOM - POOL_TOP  ) / PLANT_CELL_SIZE );
    readonly plantCount     = [ new Int32Array( this.plantColumns * this.plantRows ),     // warm plants per cell
                                new Int32Array( this.plantColumns * this.plantRows ) ];   // cold plants per cell
    private soilNutrient     = new Float32Array( this.plantColumns * this.plantRows );
    private nutrientUpdatedAt = new Int32Array( this.plantColumns * this.plantRows );

    //--------------------------------------------------------------------
    // make a new map (uses the simulation's random numbers)
    //--------------------------------------------------------------------
    generate( petri = false ): void
    {
        this.petri = petri ? { zones: petriSettings.zones, layout: petriSettings.layout, softness: petriSettings.softness } : null;
        this.paint = null;
        if ( this.petri ) { this.biomeSeeds = []; this.computePetriField(); return; }

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
        return { active: this.active, petri: this.petri, seeds: this.biomeSeeds.map( s => ({ x: s.x, y: s.y, type: s.type, shade: s.shade })), paint: this.paint };
    }

    // petri settings from a file: whole numbers in range, or the defaults
    static checkedPetri( p ): { zones: number, layout: number, softness: number }
    {
        const zones    = Math.round( Number( p.zones ));
        const layout   = Math.round( Number( p.layout ));
        const softness = Number( p.softness );
        return {
            zones   : Number.isFinite( zones )    ? Math.min( 12, Math.max( 2, zones )) : 7,
            layout  : Number.isFinite( layout ) && layout >= 0 ? layout : 0,
            softness: Number.isFinite( softness ) ? Math.min( 1, Math.max( 0, softness )) : 0.1,
        };
    }

    setState( state ): void
    {
        this.petri = ( state && state.petri ) ? Environment.checkedPetri( state.petri ) : null;
        if ( state && state.active && this.petri )
        {
            // the panel shows (and a new petri pool uses) the loaded settings
            petriSettings.zones    = this.petri.zones;
            petriSettings.layout   = this.petri.layout;
            petriSettings.softness = this.petri.softness;
            this.active = true; this.biomeSeeds = []; this.computePetriField(); return;
        }
        this.active     = !!( state && state.active && state.seeds && state.seeds.length > 0 );
        this.biomeSeeds = this.active ? state.seeds.map( s => ({ x: s.x, y: s.y, type: s.type, shade: ( s.shade !== undefined ) ? s.shade : 0.5 })) : [];
        this.paint = ( state && state.paint ) ? state.paint : null;
        if ( this.active ) { this.computeField(); this.applyPaint(); }
    }

    //--------------------------------------------------------------------
    // the "petri" pool: temperature by zone (see Petri.ts), no seasons
    //--------------------------------------------------------------------
    private computePetriField(): void
    {
        const p = this.petri;
        for ( let j = 0; j < FIELD_SIZE; j++ )
        {
            for ( let i = 0; i < FIELD_SIZE; i++ )
            {
                const level = petriLevel( petriPosition( ( i + 0.5 ) / FIELD_SIZE, ( j + 0.5 ) / FIELD_SIZE, p.layout ), p.zones, p.softness );
                const t = petriTemperature( level, p.zones );
                const k = j * FIELD_SIZE + i;
                this.baseTemperature[k] = t;
                this.background     [k] = 0.25 + 0.5 * t;
                this.zoneOfCell     [k] = Math.round( level );
                this.biomeOfCell    [k] = 0;
            }
        }
    }

    // which petri zone a point is in (0 .. zones-1)
    zoneAt( x: number, y: number ): number
    {
        const i = Math.min( FIELD_SIZE - 1, Math.max( 0, Math.floor( ( x - POOL_LEFT ) / ( POOL_RIGHT  - POOL_LEFT ) * FIELD_SIZE )));
        const j = Math.min( FIELD_SIZE - 1, Math.max( 0, Math.floor( ( y - POOL_TOP  ) / ( POOL_BOTTOM - POOL_TOP  ) * FIELD_SIZE )));
        return this.zoneOfCell[ j * FIELD_SIZE + i ];
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

    //--------------------------------------------------------------------
    // a drawn map: "blank" makes it flat (mild everywhere), then the
    // temperature zones are painted over it (warm, cold, mild)
    //--------------------------------------------------------------------
    applyPaint(): void
    {
        if ( !this.paint ) return;
        if ( this.paint.blank ) { this.baseTemperature.fill( 0.5 ); this.background.fill( 0.5 ); }
        const width  = POOL_RIGHT  - POOL_LEFT;
        const height = POOL_BOTTOM - POOL_TOP;
        for ( const zone of this.paint.zones )
        {
            const value = ZONE_TEMPERATURE[ zone.kind ];
            if ( value === undefined || zone.points.length < 6 ) continue;
            const box = zoneBounds( zone.points );
            const i0 = Math.max( 0, Math.floor(( box.left - POOL_LEFT ) / width * FIELD_SIZE )), i1 = Math.min( FIELD_SIZE - 1, Math.ceil(( box.right  - POOL_LEFT ) / width  * FIELD_SIZE ));
            const j0 = Math.max( 0, Math.floor(( box.top  - POOL_TOP  ) / height * FIELD_SIZE )), j1 = Math.min( FIELD_SIZE - 1, Math.ceil(( box.bottom - POOL_TOP ) / height * FIELD_SIZE ));
            for ( let j = j0; j <= j1; j++ )
            {
                for ( let i = i0; i <= i1; i++ )
                {
                    const x = POOL_LEFT + ( i + 0.5 ) / FIELD_SIZE * width, y = POOL_TOP + ( j + 0.5 ) / FIELD_SIZE * height;
                    if ( !pointInZone( x, y, zone.points )) continue;
                    const k = j * FIELD_SIZE + i;
                    this.background[k] = this.background[k] - 0.5 * this.baseTemperature[k] + 0.5 * value;
                    this.baseTemperature[k] = value;
                }
            }
        }
    }

    // the base temperature of every cell (the map editor draws it)
    temperatureGrid(): Float32Array { return this.baseTemperature.slice(); }

    // -1 at the top (north, cold) .. +1 at the bottom (south, hot)
    latitude( y: number ): number
    {
        return ( ( y - POOL_TOP ) / ( POOL_BOTTOM - POOL_TOP ) ) * 2 - 1;
    }

    setTime( step: number ): void { this.time = step; }

    // saving and loading a world: the numbers that change as it runs (the map
    // itself is rebuilt from getState). Reads nothing through the getters:
    // they age the soil.
    exportRaw()
    {
        return { time: this.time, soilNutrient: this.soilNutrient.slice(), nutrientUpdatedAt: this.nutrientUpdatedAt.slice(),
                 plantCount0: this.plantCount[0].slice(), plantCount1: this.plantCount[1].slice() };
    }
    importRaw( raw ): void
    {
        this.time = raw.time;
        this.soilNutrient.set( raw.soilNutrient );
        this.nutrientUpdatedAt.set( raw.nutrientUpdatedAt );
        this.plantCount[0].set( raw.plantCount0 );
        this.plantCount[1].set( raw.plantCount1 );
    }

    resetSoilNutrients( startingAmount: number ): void
    {
        const amount = Math.max( 0, Math.min( SOIL_NUTRIENT_CAPACITY_PER_CELL, startingAmount ));
        this.soilNutrient.fill( amount );
        this.nutrientUpdatedAt.fill( this.time );
    }

    private ageSoilNutrient( cell: number ): void
    {
        const elapsed = this.time - this.nutrientUpdatedAt[ cell ];
        if ( elapsed <= 0 ) return;
        if ( SOIL_NUTRIENT_DECAY_PER_STEP > 0 )
        {
            this.soilNutrient[ cell ] *= Math.exp( -SOIL_NUTRIENT_DECAY_PER_STEP * elapsed );
        }
        this.nutrientUpdatedAt[ cell ] = this.time;
    }

    returnMeatDetritusAt( x: number, y: number, meatEnergy: number ): number
    {
        if ( !NUTRIENT_CYCLE_ENABLED || !( meatEnergy > 0 )) return 0;
        const cell = this.plantCellIndex( x, y );
        this.ageSoilNutrient( cell );
        const returned = Math.min(
            Math.max( 0, SOIL_NUTRIENT_CAPACITY_PER_CELL - this.soilNutrient[ cell ] ),
            meatEnergy * MEAT_DETRITUS_YIELD
        );
        this.soilNutrient[ cell ] += returned;
        return returned;
    }

    takeSoilNutrientForSproutAt( x: number, y: number ): boolean
    {
        if ( !NUTRIENT_CYCLE_ENABLED ) return true;
        const cell = this.plantCellIndex( x, y );
        this.ageSoilNutrient( cell );
        if ( this.soilNutrient[ cell ] < SOIL_NUTRIENT_PER_SPROUT ) return false;
        this.soilNutrient[ cell ] -= SOIL_NUTRIENT_PER_SPROUT;
        return true;
    }

    getSoilNutrientAtCell( cell: number ): number
    {
        if ( cell < 0 || cell >= this.soilNutrient.length ) return 0;
        this.ageSoilNutrient( cell );
        return this.soilNutrient[ cell ];
    }

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
        const amplitude = this.petri ? 0 : SEASON_AMPLITUDE_EQUATOR + ( SEASON_AMPLITUDE_POLES - SEASON_AMPLITUDE_EQUATOR ) * latitude;
        const t = base + amplitude * Math.sin( 2 * Math.PI * this.time / SEASON_PERIOD );
        return t < 0 ? 0 : ( t > 1 ? 1 : t );
    }

    // the clock and the temperature map (for the decision kernel's threads)
    getTime(): number { return this.time; }
    copyTemperatureTo( target: Float32Array ): void { target.set( this.baseTemperature ); }

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
    makeImage(): any
    {
        // a page canvas, or in the simulation thread an offscreen one
        let image: any = null;
        if ( typeof document !== "undefined" )          { image = document.createElement( "canvas" ); }
        else if ( typeof OffscreenCanvas !== "undefined" ) { image = new OffscreenCanvas( FIELD_SIZE, FIELD_SIZE ); }
        else return null;
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
