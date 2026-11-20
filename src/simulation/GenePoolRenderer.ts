/**
 * GenePoolRenderer — отрисовка мира GenePool.
 *
 * GenePool написан на замыканиях, поэтому рендерер получает объект `ctx`
 * с геттерами на нужные переменные (холст, камера, свимботы, еда, выбор мыши…).
 * Код отрисовки перенесён из GenePool.ts без изменения поведения.
 * Всё, что принадлежит только отрисовке (пакет рисования, метки течений,
 * замеры времени по фазам), живёт здесь.
 */
import { NULL_INDEX, ONE_HALF, PI2 } from "./MathConstants";
import { ViewTrackingMode } from "./ViewTracking";
import {
    MAX_SWIMBOTS, MEAT_PIECE_ENERGY, PLANT_EVOLUTION_ENABLED, PLANT_STAGES_ENABLED, PLANT_STAGES_SHOWN,
    SWIMBOT_LEVEL_OF_DETAIL_DOT, SWIMBOT_LEVEL_OF_DETAIL_HIGH, WOOD_PER_FRUIT_TIER
} from "./Parameters";
import { FOOD_BIT_GRAB_RADIUS, FOOD_BIT_SIZE, FOOD_BIT_SIZE_VIEW_SCALE, FOOD_OPACITY_INCREMENT } from "./FoodBit";
import { plantSize } from "./PlantSize";
import { setPlantSeason } from "./PlantVisuals";
import { currentAt, currentDriftX, currentDriftY, currentStrength, randomPointInCurrent } from "./Currents";
import { SEASON_PERIOD } from "./Environment";
import { PARAM_ENV_ACTIVE, PARAM_SHOW_SOIL, PARAM_TIME } from "./SharedState";
import { POOL_WIDTH } from "./Pool";
import { TASK_RENDER_DATA } from "../parallel/ParallelWork";

const OUTSIDE_POOL_COLOR = "rgb( 22, 26, 30 )";   // экран за краями бассейна
const DEBUG_SHOW_SWIMBOT_TRAIL = false;
const NUM_MARKS = 260;
const FOOD_RGB = [ 0.3, 0.8, 0.2,   0.3, 0.5, 0.9,   0.9, 0.1, 0.1 ];   // как FoodBit.setColorAccordingToType

export function createGenePoolRenderer( ctx: any )
{
    const _renderBatch: any[] = [];
    const _batchObjectPool: any[] = [];
    const _renderList = new Int32Array( MAX_SWIMBOTS );
    const _renderPhaseMs = [ 0, 0, 0, 0 ];   // вода и препятствие, еда, свимботы, видеокарта
    const _marks: any[] = [];
    const _markPoint = { x: 0, y: 0 };
    const _treeParts: number[] = [];
    let _lastMarkTime = 0;

    // 45 decorative motes that ride the current map; visuals only, never
    // touching the simulation random state.
    const NUM_DRIFT = 45;
    const _drift: any[] = [];
    for ( let i = 0; i < NUM_DRIFT; i++ )
    {
        _drift.push({ x: 0, y: 0, seeded: false, age: Math.random() * 4, life: 5 + Math.random() * 5 });
    }

    function getBatchObject()
    {
        if ( _batchObjectPool.length > 0 ) { return _batchObjectPool.pop(); }
        return { swimbot: null, isSelected: false, isMousedOver: false, distance: 0 };
    }

    function releaseBatchObject( obj: any )
    {
        obj.swimbot = null;
        obj.isSelected = false;
        obj.isMousedOver = false;
        obj.distance = 0;
        _batchObjectPool.push( obj );
    }

    function renderPhase( phase: number, since: number )
    {
        const t = performance.now();
        _renderPhaseMs[ phase ] += ( t - since - _renderPhaseMs[ phase ] ) * 0.05;
        return t;
    }

    function renderCurrents()
    {
        const _canvas = ctx.canvas, _camera = ctx.camera;
        if ( !( ctx.currentSpeed > 0 )) { _marks.length = 0; return; }
        const now = performance.now();
        const dt = Math.min( 0.1, ( _lastMarkTime === 0 ) ? 0 : ( now - _lastMarkTime ) / 1000 );
        _lastMarkTime = now;

        const viewW = _camera.getXDimension(), viewH = _camera.getYDimension();
        const left = _camera.getPosition().x - viewW / 2, top = _camera.getPosition().y - viewH / 2;
        const inView = ( x: number, y: number ) => ( x > left ) && ( x < left + viewW ) && ( y > top ) && ( y < top + viewH );
        const speed = viewW * 0.06;             // на экране: ровный дрейф при любом масштабе
        const random = () => Math.random();     // только для рисования: не случайные числа симуляции

        while ( _marks.length < NUM_MARKS )
        {
            let placed = false;
            for (let attempt = 0; attempt < 30 && !placed; attempt++)
            {
                randomPointInCurrent( random, _markPoint );
                if ( !inView( _markPoint.x, _markPoint.y )) continue;
                _marks.push({ x: _markPoint.x, y: _markPoint.y, age: 0, life: 2.5 + 2.5 * random() });
                placed = true;
            }
            if ( !placed ) break;      // течения не видно
        }

        _canvas.lineCap = "round";
        _canvas.lineWidth = Math.max( 1, viewW / 700 );
        for (let i = _marks.length - 1; i >= 0; i--)
        {
            const m = _marks[i];
            currentAt( m.x, m.y );
            const vx = currentDriftX(), vy = currentDriftY(), g = currentStrength();
            m.x += vx * speed * dt;
            m.y += vy * speed * dt;
            m.age += dt;
            if (( m.age > m.life ) || ( g < 0.05 ) || !inView( m.x, m.y )) { _marks.splice( i, 1 ); continue; }
            const fade = Math.min( 1, m.age / 0.6, ( m.life - m.age ) / 0.6 );
            const n = Math.max( 1e-6, Math.sqrt( vx * vx + vy * vy ));
            const tail = viewW * 0.025 * g;
            _canvas.strokeStyle = "rgba( 205, 228, 255, " + ( 0.32 * fade * Math.min( 1, g * 1.5 )).toFixed( 3 ) + " )";
            _canvas.beginPath();
            _canvas.moveTo( m.x - vx / n * tail, m.y - vy / n * tail );
            _canvas.lineTo( m.x, m.y );
            _canvas.stroke();
        }
    }

    // Decorative drift motes: a fixed set of 45, moved by the current field.
    function renderDriftParticles()
    {
        const _canvas = ctx.canvas, _camera = ctx.camera;
        if ( !( ctx.currentSpeed > 0 )) return;
        const viewW = _camera.getXDimension(), viewH = _camera.getYDimension();
        const left = _camera.getPosition().x - viewW / 2, top = _camera.getPosition().y - viewH / 2;
        const right = left + viewW, bottom = top + viewH;
        const speed = viewW * 0.018;
        const dt = 0.016;
        for ( let i = 0; i < NUM_DRIFT; i++ )
        {
            const p = _drift[i];
            if ( !p.seeded || ( p.x < left ) || ( p.x > right ) || ( p.y < top ) || ( p.y > bottom ))
            {
                p.x = left + Math.random() * viewW;
                p.y = top + Math.random() * viewH;
                p.age = 0; p.life = 5 + Math.random() * 5; p.seeded = true;
            }
            currentAt( p.x, p.y );
            p.x += currentDriftX() * speed * dt;
            p.y += currentDriftY() * speed * dt;
            p.age += dt;
            const fade = Math.min( 1, p.age / 0.5, ( p.life - p.age ) / 0.8 );
            if ( fade <= 0 ) continue;
            _canvas.fillStyle = "rgba( 190, 232, 255, " + ( 0.28 * fade ).toFixed( 3 ) + " )";
            _canvas.beginPath();
            _canvas.arc( p.x, p.y, Math.max( 1, viewW / 1400 ), 0, PI2, false );
            _canvas.fill();
        }
    }

    // Root tendrils: five curved threads that grow out of a plant while it is
    // sucking soil. Their bend is fixed per plant; a slow sinusoidal impulse
    // travels along them so the crown looks alive instead of mechanical.
    function renderRootFilaments()
    {
        const _canvas = ctx.canvas, _camera = ctx.camera, _st = ctx.st;
        if ( _st.params[ PARAM_SHOW_SOIL ] === 0 ) return;
        const viewW = _camera.getXDimension(), viewH = _camera.getYDimension();
        if ( viewW / POOL_WIDTH < 0.32 ) return;      // too close in: the roots are off-screen detail
        const sucking = _st.foodSucking;
        if ( sucking === undefined ) return;
        const fx = _st.foodX, fy = _st.foodY, clock = ctx.clock;
        const pad = 160;
        const left = _camera.getPosition().x - viewW / 2 - pad, top = _camera.getPosition().y - viewH / 2 - pad;
        const right = left + viewW + 2 * pad, bottom = top + viewH + 2 * pad;
        _canvas.lineCap = "round";
        _canvas.lineWidth = Math.max( 0.7, viewW / 2200 );
        for ( let f = 0; f < sucking.length; f++ )
        {
            const s = sucking[f];
            if ( s <= 0.12 ) continue;
            const x = fx[f], y = fy[f];
            if (( x < left ) || ( x > right ) || ( y < top ) || ( y > bottom )) continue;
            // A narrow travelling impulse: sin(pi*t) is zero at both ends.
            const t = ( clock * 0.022 + f * 0.37 ) % 1;
            const envelope = Math.sin( Math.PI * t );
            const reach = ( 12 + 16 * s ) * ( 0.55 + 0.45 * envelope );
            const bend = (( f % 9 ) - 4 ) * 0.055;     // fixed, plant-specific curvature
            const spin = ( f % 17 ) * ( PI2 / 17 );
            _canvas.strokeStyle = "rgba( 165, 220, 105, " + ( 0.10 + 0.20 * envelope ).toFixed( 3 ) + " )";
            for ( let k = 0; k < 5; k++ )
            {
                const a = spin + k * ( PI2 / 5 );
                const dx = Math.cos( a ), dy = Math.sin( a );
                const px = -dy, py = dx;
                const cx = x + dx * reach * 0.55 + px * bend * reach;
                const cy = y + dy * reach * 0.55 + py * bend * reach;
                _canvas.beginPath();
                _canvas.moveTo( x, y );
                _canvas.quadraticCurveTo( cx, cy, x + dx * reach, y + dy * reach );
                _canvas.stroke();
            }
        }
    }

    // тонкая полупрозрачная серая линия к цели выбранного свимбота
    function renderTargetLine( line: any )
    {
        if ( line === null ) return;
        canvas.lineWidth = 1.2 + 0.004 * ctx.camera.getScale();
        canvas.strokeStyle = "rgba( 200, 200, 200, 0.35 )";
        canvas.beginPath();
        canvas.moveTo( line.fromX, line.fromY );
        canvas.lineTo( line.toX, line.toY );
        canvas.stroke();
        canvas.closePath();
    }

    function renderSelectCircle( x: number, y: number, r: number, m: boolean )
    {
        const lineWidth = 1.6 + 0.005 * ctx.camera.getScale();
        const alpha = m ? 0.03 : 0.07;

        canvas.lineWidth = lineWidth;
        canvas.strokeStyle = "rgba( 255, 255, 255, " + alpha + " )";
        canvas.beginPath();
        canvas.arc( x, y, r, 0, PI2, false );
        canvas.stroke();
        canvas.closePath();

        canvas.lineWidth = lineWidth * 0.4;
        canvas.strokeStyle = "rgba( 255, 255, 255, " + alpha + " )";
        canvas.beginPath();
        canvas.arc( x, y, r, 0, PI2, false );
        canvas.stroke();
        canvas.closePath();
    }

    //-------------------------------
    // еда
    //-------------------------------
    function renderFoodBits( useGraphicsCard: boolean )
    {
        const _camera = ctx.camera, _foodBits = ctx.foodBits, _aliveFoodBitIndices = ctx.aliveFoodBitIndices;
        const _capsuleRenderer = ctx.capsuleRenderer;
        // World-space screen rectangle with a plant-sized margin. This skips
        // off-screen plants before any capsule/outline data is prepared.
        const viewW = _camera.getXDimension(), viewH = _camera.getYDimension();
        const plantPad = Math.max( FOOD_BIT_GRAB_RADIUS, 120 );
        const left = _camera.getPosition().x - viewW / 2 - plantPad;
        const right = left + viewW + 2 * plantPad;
        const top = _camera.getPosition().y - viewH / 2 - plantPad;
        const bottom = top + viewH + 2 * plantPad;

        // простые точки на видеокарте: один плотный цикл по общим массивам
        if ( useGraphicsCard && !( PLANT_STAGES_ENABLED && PLANT_STAGES_SHOWN ) && !PLANT_EVOLUTION_ENABLED )
        {
            writeFoodDots();
            return;
        }
        for (let i = 0; i < _aliveFoodBitIndices.length; i++)
        {
            const f = _aliveFoodBitIndices[i];
            if ( !_foodBits[f].getAlive() ) continue;
            const pos = _foodBits[f].getPosition();
            if (( pos.x < left ) || ( pos.x > right ) || ( pos.y < top ) || ( pos.y > bottom )) continue;

            if ( _camera.getWithinView( pos, FOOD_BIT_GRAB_RADIUS ) )
            {
                if ( useGraphicsCard ) { _foodBits[f].writeCapsule( _capsuleRenderer, _camera.getScale() ); }
                else                   { _foodBits[f].render( _camera.getScale() ); }

                if ( f === ctx.selectedFoodBit )   { _foodBits[f].renderSelectOutline( _camera.getScale() ); }
                if ( f === ctx.mousedOverFoodBit ) { _foodBits[f].renderMousedOverOutline( _camera.getScale() ); }
            }
        }
    }

    function writeFoodDots()
    {
        const _camera = ctx.camera, _foodBits = ctx.foodBits, _st = ctx.st;
        const _aliveFoodBitIndices = ctx.aliveFoodBitIndices, _capsuleRenderer = ctx.capsuleRenderer;
        const _selectedFoodBit = ctx.selectedFoodBit, _mousedOverFoodBit = ctx.mousedOverFoodBit;
        const fx = _st.foodX, fy = _st.foodY, ft = _st.foodType, born = _st.foodBorn, live = _st.liveFood, fruit = _st.foodFruit, wood = _st.foodWood;
        const n = _aliveFoodBitIndices.length;
        const viewW = _camera.getXDimension(), viewH = _camera.getYDimension();
        const pad = Math.max( FOOD_BIT_GRAB_RADIUS, 120 );
        const left = _camera.getPosition().x - viewW / 2 - pad, right = left + viewW + 2 * pad;
        const top  = _camera.getPosition().y - viewH / 2 - pad, bottom = top + viewH + 2 * pad;
        const radius = FOOD_BIT_SIZE + _camera.getScale() * FOOD_BIT_SIZE_VIEW_SCALE * FOOD_BIT_SIZE_VIEW_SCALE;
        const pixel = viewW / Math.max( 1, ctx.canvasWidth );
        const stride = _capsuleRenderer.floatsPerCapsule;
        const capacity = n * 14; // до одного ядра, двенадцати лучей кроны и стебля
        let i = _capsuleRenderer.reserve( capacity );
        const d = _capsuleRenderer.reserved();
        let used = 0;
        _treeParts.length = 0;
        const parts = _treeParts;
        const add = ( ax: number, ay: number, bx: number, by: number, r: number, red: number, green: number, blue: number, alpha: number ) =>
        {
            d[ i ] = ax; d[ i + 1 ] = ay; d[ i + 2 ] = bx; d[ i + 3 ] = by;
            d[ i + 4 ] = r; d[ i + 5 ] = r;
            d[ i + 6 ] = red; d[ i + 7 ] = green; d[ i + 8 ] = blue; d[ i + 9 ] = alpha;
            i += stride; used ++;
        };
        for (let k = 0; k < n; k++)
        {
            const f = _aliveFoodBitIndices[k];
            if ( live[f] !== 1 ) continue;
            const x = fx[f], y = fy[f];
            if (( x < left ) || ( x > right ) || ( y < top ) || ( y > bottom )) continue;
            // кусок мяса меньше целого и ствол с плодами рисуются отдельно (ниже).
            // Плод — не дерево: он всегда остаётся оранжевой точкой, даже если в
            // старом сохранении у него случайно накопился ствол.
            if ((( ft[f] === 2 ) && ( _st.foodEnergy[f] < 0.8 * MEAT_PIECE_ENERGY ))
            || (( ft[f] !== 2 ) && ( fruit[f] !== 1 ) && ( _st.foodWood[f] >= WOOD_PER_FRUIT_TIER ))) { parts.push( f ); continue; }
            const isFruit = fruit[f] === 1;
            const t = ft[f] * 3;
            let alpha = ( ctx.clock - born[f] ) * FOOD_OPACITY_INCREMENT;
            if ( alpha < 1 ) { alpha = _foodBits[f].getOpacity(); }       // ещё проявляется или в «руке»
            alpha = alpha > 1 ? 1 : alpha;
            const plant = ft[f] !== 2;
            const size = plant ? plantSize( wood[f] ) : 0;
            const stage = size < 0.20 ? 0 : size < 0.70 ? 1 : 2;
            const baseRed = isFruit ? 0.98 : FOOD_RGB[ t ];
            const baseGreen = isFruit ? 0.61 : FOOD_RGB[ t + 1 ];
            const baseBlue = isFruit ? 0.12 : FOOD_RGB[ t + 2 ];
            // Размер растения в единицах мира. Раньше листья считались в экранных
            // пикселях (pixel * ...), а точка — в единицах мира: при приближении точка
            // разрасталась и полностью закрывала листья. Теперь всё масштабируется
            // вместе, с страховкой, что листья не мельче одного пикселя.
            const span = Math.max( radius * ( 0.6 + 1.8 * size ), pixel );
            const coreRadius = isFruit ? Math.max( radius * 0.62, pixel * 0.95 )
                : plant ? span : radius;
            add( x, y, x, y, coreRadius, baseRed, baseGreen, baseBlue, alpha );

            if ( plant && !isFruit )
            {
                if ( stage === 0 )
                {
                    // крошечный росток с двумя листьями
                    add( x, y + span * 0.15, x, y - span * 1.35, span * 0.20, 0.50, 0.91, 0.25, alpha );
                    for ( let leaf = 0; leaf < 2; leaf++ )
                    {
                        const side = leaf === 0 ? -1 : 1;
                        add( x, y - span * 0.42, x + side * span * 0.86, y - span * 0.92, span * 0.29, 0.50, 0.91, 0.25, alpha );
                    }
                }
                else if ( stage === 1 )
                {
                    // четыре круглых листа: хорошо заметный саженец
                    const leafRadius = span * 2.25;
                    for ( let leaf = 0; leaf < 4; leaf++ )
                    {
                        const a = -Math.PI / 2 + leaf * Math.PI / 2;
                        add( x + Math.cos( a ) * leafRadius * 0.12, y + Math.sin( a ) * leafRadius * 0.12,
                             x + Math.cos( a ) * leafRadius, y + Math.sin( a ) * leafRadius,
                             span * 0.34, 0.28, 0.77, 0.22, alpha );
                    }
                }
            }
        }
        _capsuleRenderer.release( capacity - used );
        for ( const f of parts ) { _foodBits[f].writeCapsule( _capsuleRenderer, _camera.getScale() ); }

        // выбранная и тронутая еда: контуры в 2D
        if (( _selectedFoodBit   != NULL_INDEX ) && _foodBits[ _selectedFoodBit   ].getAlive()) { _foodBits[ _selectedFoodBit   ].renderSelectOutline( _camera.getScale() ); }
        if (( _mousedOverFoodBit != NULL_INDEX ) && _foodBits[ _mousedOverFoodBit ].getAlive()) { _foodBits[ _mousedOverFoodBit ].renderMousedOverOutline( _camera.getScale() ); }
    }

    //----------------------------------
    // свимботы пакетом
    //----------------------------------
    function renderSwimbotsWithBatching( useGraphicsCard: boolean )
    {
        const _camera = ctx.camera, _swimbots = ctx.swimbots, _st = ctx.st, _capsuleRenderer = ctx.capsuleRenderer;
        const _aliveSwimbotIndices = ctx.aliveSwimbotIndices;
        const _lastSwimbotPositions = ctx.lastSwimbotPositions, _distanceCache = ctx.distanceCache;
        const _levelOfDetail = ctx.levelOfDetail;

        const cameraPos = _camera.getPosition();
        const cameraChanged = !ctx.lastCameraPosition.equals( cameraPos );
        ctx.lastCameraPosition.copyFrom( cameraPos );
        // A wider-than-screen AABB: bodies and their render buffers are not
        // prepared at all when the camera is zoomed into a small area.
        const viewW = _camera.getXDimension(), viewH = _camera.getYDimension();
        const bodyPad = 250;
        const left = cameraPos.x - viewW / 2 - bodyPad;
        const right = left + viewW + 2 * bodyPad;
        const top = cameraPos.y - viewH / 2 - bodyPad;
        const bottom = top + viewH + 2 * bodyPad;

        while ( _renderBatch.length > 0 ) { releaseBatchObject( _renderBatch.pop() ); }

        for (let i = 0; i < _aliveSwimbotIndices.length; i++)
        {
            const s = _aliveSwimbotIndices[i];
            if ( _swimbots[s].getAlive() )
            {
                const position = _swimbots[s].getPosition();
                if (( position.x < left ) || ( position.x > right ) || ( position.y < top ) || ( position.y > bottom )) continue;
                const boundingRadius = _swimbots[s].getBoundingRadius();

                if ( _camera.getWithinView( position, boundingRadius ) )
                {
                    const swimbotPos = _swimbots[s].getPosition();
                    const posChanged = !_lastSwimbotPositions[s].equals( swimbotPos );

                    if ( cameraChanged || posChanged )
                    {
                        _lastSwimbotPositions[s].copyFrom( swimbotPos );
                        _distanceCache[s] = swimbotPos.getDistanceSquaredTo( cameraPos );   // без sqrt
                    }

                    const batchObj = getBatchObject();
                    batchObj.swimbot = _swimbots[s];
                    batchObj.isSelected = ( s === ctx.selectedSwimbot );
                    batchObj.isMousedOver = ( s === ctx.mousedOverSwimbot );
                    batchObj.distance = _distanceCache[s];
                    _renderBatch.push( batchObj );
                }
            }
        }

        // a fixed draw order: Morton resorting of the work list must not make
        // overlapping bodies swap their z-order from frame to frame
        if ( _renderBatch.length > 1 )
        {
            _renderBatch.sort( ( a, b ) => a.swimbot.getIndex() - b.swimbot.getIndex() );
        }

        // тела на видеокарте: данные рисования готовят все потоки разом (RenderData.ts),
        // потом они только копируются, по одному блоку на тело
        const blocks = useGraphicsCard && ( _levelOfDetail !== SWIMBOT_LEVEL_OF_DETAIL_DOT );
        if ( blocks )
        {
            for (let i = 0; i < _renderBatch.length; i++) { _renderList[i] = _renderBatch[i].swimbot.getIndex(); }
            ctx.runner.task( TASK_RENDER_DATA, _renderList, _renderBatch.length );
        }

        for (let i = 0; i < _renderBatch.length; i++)
        {
            const batchItem = _renderBatch[i];
            const swimbot = batchItem.swimbot;

            if ( useGraphicsCard )
            {
                if ( blocks ) { _capsuleRenderer.copyBlock( _st.renderParts, swimbot.getRenderBlockStart(), swimbot.getRenderBlockLength() ); }
                else          { swimbot.writeCapsules( _capsuleRenderer, _levelOfDetail === SWIMBOT_LEVEL_OF_DETAIL_DOT ); }
            }
            else { swimbot.render( _levelOfDetail ); }

            if ( batchItem.isSelected || batchItem.isMousedOver )
            {
                swimbot.setRenderingGoals( true );   // круг и линия к цели рисуются сверху: renderSwimbotOverlays
            }
            else if ( ctx.renderingGoals )
            {
                swimbot.setRenderingGoals( true );
            }
        }
    }

    // рисуется после тел (и поверх картинки видеокарты): рты и половые органы вблизи,
    // круги выбора, линия к цели выбранного свимбота
    function renderSwimbotOverlays( useGraphicsCard: boolean )
    {
        const details = useGraphicsCard && ( ctx.levelOfDetail === SWIMBOT_LEVEL_OF_DETAIL_HIGH );
        for (let i = 0; i < _renderBatch.length; i++)
        {
            const item = _renderBatch[i], swimbot = item.swimbot;
            if ( details ) { swimbot.renderDetails(); }
            if ( item.isSelected )
            {
                renderSelectCircle( swimbot.getPosition().x, swimbot.getPosition().y, swimbot.getSelectRadius(), false );
                renderTargetLine( swimbot.getTargetLine() );
                if ( DEBUG_SHOW_SWIMBOT_TRAIL ) { ctx.showSwimbotTrail( swimbot.getIndex() ); }
            }
            else if ( item.isMousedOver )
            {
                renderSelectCircle( swimbot.getPosition().x, swimbot.getPosition().y, swimbot.getSelectRadius(), true );
            }
        }
    }

    //----------------------------------
    // главный кадр
    //----------------------------------
    function render()
    {
        const _canvas = ctx.canvas, _camera = ctx.camera, _swimbots = ctx.swimbots, _viewTracking = ctx.viewTracking;
        const _capsuleRenderer = ctx.capsuleRenderer;
        const _canvasWidth = ctx.canvasWidth, _canvasHeight = ctx.canvasHeight;

        // очищаем весь холст: бассейн квадратный, экран нет — при отдалении полосы
        // рядом с бассейном хранили бы куски старых кадров
        _canvas.resetTransform();
        _canvas.fillStyle = OUTSIDE_POOL_COLOR;
        _canvas.fillRect( 0, 0, _canvasWidth, _canvasHeight );

        const nx = _camera.getPosition().x / _camera.getXDimension();
        const ny = _camera.getPosition().y / _camera.getYDimension();
        const xTranslation = ( ONE_HALF - nx ) * _canvasWidth;
        const yTranslation = ( ONE_HALF - ny ) * _canvasHeight;
        const xScale = _canvasWidth  / _camera.getXDimension();
        const yScale = _canvasHeight / _camera.getYDimension();

        _canvas.translate( xTranslation, yTranslation );
        _canvas.scale( xScale, yScale );

        // отдалили (много свимботов): тела и еда на видеокарту; приблизили — подробное 2D
        // (клавиша V: тела на видеокарте и вблизи, детали в 2D сверху)
        const useGraphicsCard = ( _capsuleRenderer !== null ) && (( ctx.levelOfDetail !== SWIMBOT_LEVEL_OF_DETAIL_HIGH ) || ctx.gpuUpClose );
        if ( useGraphicsCard ) { _capsuleRenderer.begin(); }

        let phaseStart = performance.now();
        // The environment's sine season peaks in summer at phase PI/2; shift it
        // so that 0 is the winter peak, as the water palette expects.
        const params = ctx.st.params;
        const envActive = params[ PARAM_ENV_ACTIVE ] === 1;
        const yearPhase = PI2 * ( params[ PARAM_TIME ] / SEASON_PERIOD ) + PI2 / 4;
        ctx.pool.setSeason( yearPhase, envActive );
        setPlantSeason( yearPhase, envActive );
        ctx.pool.setSoilView( ctx.st.soilField, ctx.clock, params[ PARAM_SHOW_SOIL ] !== 0 );
        ctx.pool.render( ctx.seconds, _camera );
        ctx.obstacle.render( _camera );
        renderCurrents();
        renderDriftParticles();

        phaseStart = renderPhase( 0, phaseStart );
        renderFoodBits( useGraphicsCard );
        if ( params[ PARAM_SHOW_SOIL ] !== 0 ) { renderRootFilaments(); }
        phaseStart = renderPhase( 1, phaseStart );

        renderSwimbotsWithBatching( useGraphicsCard );
        phaseStart = renderPhase( 2, phaseStart );

        if ( useGraphicsCard )
        {
            _capsuleRenderer.draw
            (
                _camera.getPosition().x - _camera.getXDimension() * ONE_HALF,
                _camera.getPosition().y - _camera.getYDimension() * ONE_HALF,
                _camera.getXDimension(),
                _camera.getYDimension()
            );

            // картинка видеокарты кладётся в этот холст, чтобы то, что рисуется дальше
            // (выбор, линия к цели, рты), лежало сверху
            _canvas.save();
            _canvas.resetTransform();
            // 1:1 blit: bilinear interpolation would just re-sample millions
            // of pixels that already match the target canvas one to one.
            _canvas.imageSmoothingEnabled = false;
            _canvas.drawImage( _capsuleRenderer.getCanvas(), 0, 0, _canvasWidth, _canvasHeight );
            _canvas.imageSmoothingEnabled = true;
            _canvas.restore();
        }
        else if ( _capsuleRenderer !== null )
        {
            _capsuleRenderer.clear();
        }
        renderSwimbotOverlays( useGraphicsCard );
        renderPhase( 3, phaseStart );

        // режим взаимной любви: линия между влюблёнными
        if ( _viewTracking.getMode() === ViewTrackingMode.MUTUAL )
        {
            const i1 = _viewTracking.getLover1Index(), i2 = _viewTracking.getLover2Index();
            if (( i1 != NULL_INDEX ) && ( i2 != NULL_INDEX ))
            {
                const g1 = _swimbots[ i1 ].getGenitalPosition(), g2 = _swimbots[ i2 ].getGenitalPosition();
                _canvas.lineCap = "round";
                _canvas.lineWidth = 5;
                _canvas.strokeStyle = "rgba( 200, 200, 200, 0.06 )";
                _canvas.moveTo( g1.x, g1.y );
                _canvas.lineTo( g2.x, g2.y );
                _canvas.stroke();

                _canvas.lineWidth = 2;
                _canvas.strokeStyle = "rgba( 255, 255, 200, 0.06 )";
                _canvas.moveTo( g1.x, g1.y );
                _canvas.lineTo( g2.x, g2.y );
                _canvas.stroke();
            }
        }

        _canvas.resetTransform();

        // подпись режима слежения
        if ( ctx.showViewTrackingMode )
        {
            const viewTrackingMode = _viewTracking.getMode();
            if ( viewTrackingMode != NULL_INDEX )
            {
                let modeString = "(error)";
                     if ( viewTrackingMode === ViewTrackingMode.WHOLE_POOL ) { modeString = "viewing whole pool"         }
                else if ( viewTrackingMode === ViewTrackingMode.AUTOTRACK  ) { modeString = "autotracking group"         }
                else if ( viewTrackingMode === ViewTrackingMode.SELECTED   ) { modeString = "viewing selected swimbot"   }
                else if ( viewTrackingMode === ViewTrackingMode.MUTUAL     ) { modeString = "viewing mutual love"        }
                else if ( viewTrackingMode === ViewTrackingMode.PROLIFIC   ) { modeString = "viewing most prolific"      }
                else if ( viewTrackingMode === ViewTrackingMode.EFFICIENT  ) { modeString = "viewing most efficient"     }
                else if ( viewTrackingMode === ViewTrackingMode.VIRGIN     ) { modeString = "viewing oldest virgin"      }
                else if ( viewTrackingMode === ViewTrackingMode.HUNGRY     ) { modeString = "viewing glutton"            }

                _canvas.font = "14px Arial";
                _canvas.fillStyle = "rgba( 255, 255, 255, 0.5 )";
                _canvas.fillText( modeString, _canvasWidth - 170, _canvasHeight - 30 );
            }
        }

        // рамка
        _canvas.lineWidth = 1;
        _canvas.strokeStyle = "rgb( 0, 0, 0 )";
        _canvas.strokeRect( 0, 0, _canvasWidth, _canvasHeight );
    }

    return {
        render,
        renderFoodBits,
        writeFoodDots,
        renderSwimbotsWithBatching,
        renderSwimbotOverlays,
        getRenderPhaseMs: () => _renderPhaseMs.slice(),
    };
}
