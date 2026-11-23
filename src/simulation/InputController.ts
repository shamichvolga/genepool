//------------------------------------------------------------------------------
// InputController — mouse/touch selection, dragging swimbots/plants/obstacles,
// zoom/pan camera navigation, and keyboard camera state.
//------------------------------------------------------------------------------
import { FOOD_BIT_GRAB_RADIUS } from "./FoodBit";
import { CameraNavigationAction } from "./Globals";
import { NULL_INDEX, ONE_HALF, ZERO } from "./MathConstants";
import { MAX_FOODBITS, MAX_SWIMBOTS } from "./Parameters";
import { TouchState } from "./Touch";
import * as SS from "./SharedState";

const CAMERA_PAN_SPEED        = 0.9;
const CAMERA_KEY_ZOOM_SPEED   = 1.6;
const CAMERA_WHEEL_ZOOM_SPEED = 0.0015;

export interface InputContext {
    readonly st: SS.SharedState;
    readonly touch: any;
    readonly camera: any;
    readonly pool: any;
    readonly obstacle: any;
    readonly viewTracking: any;
    readonly swimbots: any[];
    readonly foodBits: any[];
    readonly aliveFoodBitIndices: number[];
    readonly vectorUtility: any;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly viewScale: number;
    readonly seconds: number;
    selectedSwimbot: number;
    mousedOverSwimbot: number;
    mousedOverFoodBit: number;
    setSelectedSwimbot( index: number ): void;
    initializeDebugTrail( s: number ): void;
    moveFoodBitsFromObstacle(): void;
    clearViewMode(): void;
}

export function createInputController( ctx: InputContext )
{
    let _swimbotBeingDragged      = false;
    let _foodBitBeingDragged      = false;
    let _panningLeft              = false;
    let _panningRight             = false;
    let _panningUp                = false;
    let _panningDown              = false;
    let _zoomingIn                = false;
    let _zoomingOut               = false;
    let _lastCameraNavigationTime = 0;

    function convertScreenToPool( x: number, y: number )
    {
        const cam = ctx.camera, v = ctx.vectorUtility;
        v.x = cam.getPosition().x - cam.getXDimension() * ONE_HALF + ( x / ctx.canvasWidth  ) * cam.getXDimension();
        v.y = cam.getPosition().y - cam.getYDimension() * ONE_HALF + ( y / ctx.canvasHeight ) * cam.getYDimension();
        return v;
    }

    function indexOfClosestSwimbot( x: number, y: number ): number
    {
        let indexOfClosest = NULL_INDEX;
        const vs = Math.max( 0.01, ctx.viewScale || 0.1 );
        const zoomPad = Math.max( 0, 14 / vs );
        let closestDistance = Infinity;
        const v = convertScreenToPool( x, y );
        const bots = ctx.swimbots;

        for ( let s = 0; s < MAX_SWIMBOTS; s++ )
        {
            if ( bots[s].getAlive() )
            {
                const r = bots[s].getSelectRadius() + zoomPad;
                const d2 = bots[s].getPosition().getDistanceSquaredTo( v );
                if ( d2 < r * r && d2 < closestDistance )
                {
                    indexOfClosest = s;
                    closestDistance = d2;
                }
            }
        }
        return indexOfClosest;
    }

    function indexOfClosestFoodBit( x: number, y: number ): number
    {
        let indexOfClosest = NULL_INDEX;
        const vs = Math.max( 0.01, ctx.viewScale || 0.1 );
        const grabR = Math.max( FOOD_BIT_GRAB_RADIUS, 16 / vs );
        let closestDistance = grabR * grabR;
        const v = convertScreenToPool( x, y );
        const foods = ctx.foodBits;

        for ( let f = 0; f < MAX_FOODBITS; f++ )
        {
            if ( foods[f].getAlive() )
            {
                const d2 = foods[f].getPosition().getDistanceSquaredTo( v );
                if ( d2 < closestDistance )
                {
                    indexOfClosest = f;
                    closestDistance = d2;
                }
            }
        }
        return indexOfClosest;
    }

    function findClosestPlant( poolX: number, poolY: number ): number
    {
        const st = ctx.st, list = ctx.aliveFoodBitIndices;
        const vs = Math.max( 0.01, ctx.viewScale || 0.1 );
        let bestD = Math.max( 55, 18 / vs );
        bestD = bestD * bestD;
        let best = -1;
        for ( let i = 0; i < list.length; i++ )
        {
            const f = list[i];
            if ( st.liveFood[ f ] !== 1 || st.foodType[ f ] === 2 ) continue;
            const dx = st.foodX[ f ] - poolX, dy = st.foodY[ f ] - poolY, d2 = dx * dx + dy * dy;
            if ( d2 < bestD ) { bestD = d2; best = f; }
        }
        return best;
    }

    function handleClickSelection( x: number, y: number, v: any ): void
    {
        const s = indexOfClosestSwimbot( x, y );
        if ( s !== NULL_INDEX ) { ctx.setSelectedSwimbot( s ); ctx.st.selectedPlantIndex = -1; return; }
        const f = findClosestPlant( v.x, v.y );
}

    function handleNonUITouchDown( x: number, y: number ): void
    {
        if ( x >= ctx.canvasWidth || y >= ctx.canvasHeight ) return;
        ctx.viewTracking.stopTracking();

        const pickedBot = indexOfClosestSwimbot( x, y );
        ctx.setSelectedSwimbot( pickedBot );

        if ( pickedBot != NULL_INDEX )
        {
            _swimbotBeingDragged = true;
            ctx.initializeDebugTrail( pickedBot );
        }

        if ( pickedBot === NULL_INDEX )
        {
            const pickedFood = indexOfClosestFoodBit( x, y );
            if ( pickedFood != NULL_INDEX )
            {
                _foodBitBeingDragged = true;
                const v = convertScreenToPool( x, y );
                ctx.foodBits[ pickedFood ].setPosition( v );
                ctx.foodBits[ pickedFood ].showFully();
            }
        }
        else
        {
            ctx.mousedOverFoodBit = NULL_INDEX;
        }

        if (( ctx.selectedSwimbot == NULL_INDEX ))
        {
            const v = convertScreenToPool( x, y );
            if ( ctx.obstacle.detectHover( v ) ) { ctx.obstacle.startMoving( v ); }
            else { ctx.pool.startTouch( v, ctx.seconds ); }
        }
    }

    return {
        convertScreenCoordinatesToPoolPosition: convertScreenToPool,
        indexOfClosestSwimbotToScreenPosition: indexOfClosestSwimbot,
        indexOfClosestFoodBitToScreenPosition: indexOfClosestFoodBit,
        findClosestPlantToPoolPosition: findClosestPlant,
        handleClickSelection,
        handleNonUITouchDownActions: handleNonUITouchDown,

        updateCameraNavigation()
        {
            const now = performance.now();
            let seconds = ( _lastCameraNavigationTime === 0 ) ? 0 : ( now - _lastCameraNavigationTime ) / 1000;
            _lastCameraNavigationTime = now;
            if ( seconds > 0.1 ) { seconds = 0.1; }

            const pan = ctx.camera.getScale() * CAMERA_PAN_SPEED * seconds;
            let dx = 0, dy = 0;
            if ( _panningLeft  ) { dx -= pan; }
            if ( _panningRight ) { dx += pan; }
            if ( _panningUp    ) { dy -= pan; }
            if ( _panningDown  ) { dy += pan; }
            if (( dx !== 0 ) || ( dy !== 0 )) { ctx.camera.moveBy( dx, dy ); }

            let zoom = 0;
            if ( _zoomingIn  ) { zoom -= CAMERA_KEY_ZOOM_SPEED * seconds; }
            if ( _zoomingOut ) { zoom += CAMERA_KEY_ZOOM_SPEED * seconds; }
            if ( zoom !== 0 )
            {
                const center = ctx.camera.getPosition();
                ctx.camera.zoomAt( Math.exp( zoom ), center.x, center.y );
            }
        },

        zoomCameraAtScreenPoint( x: number, y: number, wheelDelta: number )
        {
            ctx.viewTracking.stopTracking();
            const point = convertScreenToPool( x, y );
            ctx.camera.zoomAt( Math.exp( wheelDelta * CAMERA_WHEEL_ZOOM_SPEED ), point.x, point.y );
        },

        panCameraByScreenPixels( dxPixels: number, dyPixels: number )
        {
            ctx.viewTracking.stopTracking();
            const unitsPerPixel = ctx.camera.getXDimension() / ctx.canvasWidth;
            ctx.camera.moveBy( -dxPixels * unitsPerPixel, -dyPixels * unitsPerPixel );
        },

        touchDown( x: number, y: number )
        {
            ctx.touch.setToDown( x, y );
            handleNonUITouchDown( x, y );
        },

        touchMove( x: number, y: number )
        {
            if ( x >= ctx.canvasWidth || y >= ctx.canvasHeight ) return;
            ctx.touch.setToMove( x, y );
            const v = convertScreenToPool( x, y );
            ctx.pool.moveTouch( v, ctx.seconds );

            if (( ctx.touch.getState() === TouchState.JUST_DOWN ) || ( ctx.touch.getState() === TouchState.BEEN_DOWN ))
            {
                if ( _swimbotBeingDragged && ( ctx.selectedSwimbot != NULL_INDEX ))
                {
                    const pos = convertScreenToPool( x, y );
                    ctx.swimbots[ ctx.selectedSwimbot ].setPosition( pos );
                    pos.setXY( ZERO, ZERO );
                    ctx.swimbots[ ctx.selectedSwimbot ].setVelocity( pos );
                }
else if ( ctx.obstacle.getBeingMoved() )
                {
                    ctx.obstacle.setMovePosition( convertScreenToPool( x, y ) );
                    ctx.moveFoodBitsFromObstacle();
                }
                else
                {
                    ctx.camera.drag( ctx.touch.getVelocityX(), ctx.touch.getVelocityY() );
                }
            }
            else
            {
                ctx.mousedOverSwimbot = indexOfClosestSwimbot( x, y );
                ctx.mousedOverFoodBit = indexOfClosestFoodBit( x, y );
                ctx.obstacle.detectHover( v );
            }
        },

        touchUp( x: number, y: number )
        {
            ctx.touch.setToUp( x, y );
            _swimbotBeingDragged = false;
            _foodBitBeingDragged = false;

            if (( ctx.selectedSwimbot === NULL_INDEX ))
            {
                if ( ctx.obstacle.getBeingMoved() ) { ctx.obstacle.stopMoving(); }
                const v = convertScreenToPool( x, y );
                handleClickSelection( x, y, v );
                ctx.pool.endTouch( v, ctx.seconds );
            }
        },

        touchOut( x: number, y: number )
        {
            this.touchUp( x, y );
        },

        touchTwoFingerMove( e: any )
        {
            if ( e.x < ctx.canvasWidth && e.y < ctx.canvasHeight )
            {
                ctx.camera.drag( -e.deltaX, -e.deltaY );
                ctx.clearViewMode();
            }
        },

        startCameraNavigation( action: any )
        {
            ctx.viewTracking.stopTracking();
                 if ( action === CameraNavigationAction.LEFT  ) { _panningLeft  = true; }
            else if ( action === CameraNavigationAction.RIGHT ) { _panningRight = true; }
            else if ( action === CameraNavigationAction.DOWN  ) { _panningDown  = true; }
            else if ( action === CameraNavigationAction.UP    ) { _panningUp    = true; }
            else if ( action === CameraNavigationAction.IN    ) { _zoomingIn    = true; }
            else if ( action === CameraNavigationAction.OUT   ) { _zoomingOut   = true; }
        },

        stopCameraNavigation( action: any )
        {
                 if ( action === CameraNavigationAction.LEFT  ) { _panningLeft  = false; }
            else if ( action === CameraNavigationAction.RIGHT ) { _panningRight = false; }
            else if ( action === CameraNavigationAction.DOWN  ) { _panningDown  = false; }
            else if ( action === CameraNavigationAction.UP    ) { _panningUp    = false; }
            else if ( action === CameraNavigationAction.IN    ) { _zoomingIn    = false; }
            else if ( action === CameraNavigationAction.OUT   ) { _zoomingOut   = false; }
        },

        stopAllCameraNavigation()
        {
            _panningLeft = false; _panningRight = false; _panningUp = false;
            _panningDown = false; _zoomingIn = false; _zoomingOut = false;
        },

        getCameraNavigationActive( action: any ): boolean
        {
            if ( action === CameraNavigationAction.LEFT  && _panningLeft  ) return true;
            if ( action === CameraNavigationAction.RIGHT && _panningRight ) return true;
            if ( action === CameraNavigationAction.DOWN  && _panningDown  ) return true;
            if ( action === CameraNavigationAction.UP    && _panningUp    ) return true;
            if ( action === CameraNavigationAction.IN    && _zoomingIn    ) return true;
            if ( action === CameraNavigationAction.OUT   && _zoomingOut   ) return true;
            return false;
        },
    };
}
