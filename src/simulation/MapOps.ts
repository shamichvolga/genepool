//------------------------------------------------------------------------------
// MapOps — map-editor and map-spawn operations that work with the live world:
// showing a preview of a freshly generated map and dropping map-zone meat.
// State goes through the GenePool instance `g` (the preview restores the RNG
// state so it never touches a running world).
//------------------------------------------------------------------------------
import { drawFromAtmosphere } from "./EnergyBudget";
import { Environment } from "./Environment";
import { getRandomState, globalTweakers, gpRandom, setRandomState } from "./Globals";
import { GARDEN_RADIUS, INITIAL_NUM_SWIMBOTS, MAX_SWIMBOTS } from "./Parameters";
import { POOL_LEFT, POOL_TOP, POOL_WIDTH, POOL_HEIGHT } from "./Pool";
import { Vector2D } from "./Vector2D";
import { randomPointInZone } from "./MapZones";
import { NULL_INDEX } from "./MathConstants";

export function placeMapMeat( g: any, zone: any ): boolean
{
    const v = new Vector2D();
    if ( !randomPointInZone( zone, gpRandom, v )) return true;
    const f = g.findLowestDeadFoodBitInArray( true );
    if ( f === NULL_INDEX ) return false;
    const fb = g.getFoodBitAt( f );
    fb.initialize( f );
    fb.setType( 2 );
    fb.setPosition( v );
    const fundedMeat = drawFromAtmosphere( globalTweakers.foodBitEnergy );
    if ( fundedMeat <= 0 ) { fb.setEnergy( 0 ); fb.kill(); return false; }
    fb.setEnergy( fundedMeat );
    return true;
}

// The map editor draws a brand-new map as the first picture: generated
// gardens, temperature and size. The running world's RNG state is saved and
// restored, so this never affects a live simulation.
export function getMapPreview( g: any ): any
{
    const keep = getRandomState();
    const preview = new Environment();
    preview.active = true;
    preview.generate( false );
    const gardens = preview.gardenCenters();
    setRandomState( keep );
    return {
        left: POOL_LEFT, top: POOL_TOP, width: POOL_WIDTH, height: POOL_HEIGHT, field: preview.temperatureGrid(),
        environment: preview.getState(), gardens: gardens.map( gr => ({ x: gr.x, y: gr.y })), gardenRadius: GARDEN_RADIUS,
        numSwimbots: Math.min( MAX_SWIMBOTS, Math.max( 0, Math.floor( INITIAL_NUM_SWIMBOTS ))), maxSwimbots: MAX_SWIMBOTS,
    };
}
