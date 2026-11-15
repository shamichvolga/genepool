# Архитектурное решение: Модульная структура GenePool

**Дата:** 15.11.2026  
**Цель:** Разделить монолитный GenePool.ts (5110 строк) на модули <500 строк каждый

---

## 1. Проблема

**GenePool.ts** — монолит размером 5110 строк, содержащий:
- Состояние симуляции (свимботы, еда, сетки)
- Главный цикл (update, simulateStep, renderFrame)
- Отрисовку (canvas 2D, WebGL, камера)
- Логику действий (рождение, смерть, спаривание, атаки)
- UI-методы (панели, информация, управление)
- Инициализацию и сохранение/загрузку миров
- ~100+ методов в одном файле

**Проблемы:**
- Сложность поддержки
- Долгая загрузка/компиляция
- Невозможно эффективно вынести в Web Worker
- Трудно тестировать отдельные части

---

## 2. Предлагаемая архитектура

### 2.1 Модульная структура

```
src/simulation/
├── GenePool.ts                 (<500 строк) — координатор
├── core/
│   ├── GenePoolState.ts        — состояние симуляции
│   ├── GenePoolActions.ts      — действия (рождение, смерть, еда)
│   └── GenePoolLoop.ts         — главный цикл (update, simulateStep)
├── render/
│   ├── GenePoolRenderer.ts     — отрисовка (canvas, WebGL)
│   └── GenePoolCamera.ts       — управление камерой
└── workers/
    └── physics.worker.ts       — Web Worker для физики
```

---

## 3. Разделение GenePool.ts

### 3.1 GenePool.ts — Координатор (<500 строк)

**Ответственность:**
- Инициализация модулей (State, Actions, Loop, Renderer)
- Делегирование вызовов к модулям
- Публичное API (экспорт на window)
- Минимальная логика — только координация

**Содержит:**
```typescript
export function GenePool() {
    // Создание модулей
    const state = new GenePoolState();
    const actions = new GenePoolActions(state);
    const loop = new GenePoolLoop(state, actions);
    const renderer = new GenePoolRenderer(state);
    
    // Делегирование методов
    this.startSimulation = (mode) => loop.startSimulation(mode);
    this.update = () => loop.update();
    this.renderFrame = () => renderer.renderFrame();
    // ... остальные публичные методы
}
```

**Примерный размер:** ~400 строк (инициализация + делегирование)

---

### 3.2 GenePoolState.ts — Состояние (~800 строк)

**Ответственность:**
- Хранение массивов свимботов, еды, препятствий
- Сетки поиска соседей (UniformGrid)
- Глобальные счётчики и таймеры
- Методы доступа к состоянию (геттеры/сеттеры)
- Shared State (SharedArrayBuffer для многопоточности)

**Содержит:**
```typescript
export class GenePoolState {
    // Массивы
    private _swimbots: Swimbot[];
    private _foodBits: FoodBit[];
    private _numSwimbots: number;
    private _numFoodBits: number;
    
    // Сетки
    private _swimbotGrid: UniformGrid;
    private _foodBitGrid: UniformGrid;
    
    // SharedState для многопоточности
    private _st: SharedState;
    private _botX: Float64Array;
    private _botY: Float64Array;
    private _botAlive: Uint8Array;
    // ...
    
    // Методы доступа
    getSwimbots() { return this._swimbots; }
    getNumSwimbots() { return this._numSwimbots; }
    getFoodBits() { return this._foodBits; }
    // ...
    
    // Синхронизация
    syncSwimbot(index: number) { /* ... */ }
    syncSwimbotPosition(index: number) { /* ... */ }
    rebuildAliveIndexCaches() { /* ... */ }
}
```

**Примерный размер:** ~800 строк

---

### 3.3 GenePoolActions.ts — Действия (~1200 строк)

**Ответственность:**
- Рождение свимботов (спаривание, мутации)
- Смерть свимботов (удаление, падение мяса)
- Поедание еды/мяса
- Атаки хищников
- Рост еды (regrowFoodEnvironment, regrowFoodOriginal)
- Пересадка (spawn, randomizeFood)

**Содержит:**
```typescript
export class GenePoolActions {
    constructor(private state: GenePoolState) {}
    
    // Рождение
    spawnSwimbot(genotype: Genotype, x: number, y: number, energy: number) { /* ... */ }
    breedSwimbots(parent1: number, parent2: number) { /* ... */ }
    
    // Смерть
    killSwimbot(index: number) { /* ... */ }
    notifySwimbotDeathTime(index: number) { /* ... */ }
    spawnMeatWithEnergy(x: number, y: number, energy: number) { /* ... */ }
    spawnCarcass(x: number, y: number, energy: number) { /* ... */ }
    
    // Еда
    plantEaten(plant: number) { /* ... */ }
    regrowFoodEnvironment(numType0: number, numType1: number) { /* ... */ }
    regrowFoodOriginal(numPlants: number) { /* ... */ }
    
    // Виды
    getSpeciesView() { /* ... */ }
    killSpecies(id: number) { /* ... */ }
}
```

**Примерный размер:** ~1200 строк

---

### 3.4 GenePoolLoop.ts — Главный цикл (~700 строк)

**Ответственность:**
- Главный цикл симуляции (update, simulateStep)
- Управление скоростью (speedLevel, stepsPerSecond)
- AnimationFrame (browser loop)
- Управление симуляцией (start/pause/resume)
- Шаги симуляции по фазам (decide → physics → perceive → act)

**Содержит:**
```typescript
export class GenePoolLoop {
    constructor(
        private state: GenePoolState,
        private actions: GenePoolActions
    ) {}
    
    // Главный цикл
    update() { /* ... */ }
    simulateStep() {
        // Фазы симуляции
        this.decidePhase();
        this.physicsPhase();
        this.perceivePhase();
        this.actPhase();
    }
    
    // Управление
    startSimulation(mode: SimulationStartMode) { /* ... */ }
    pauseSimulation() { /* ... */ }
    resumeSimulation() { /* ... */ }
    
    // Browser loop
    runFrame(now: number, draw: boolean) { /* ... */ }
    private animationFrame(now: number) { /* ... */ }
}
```

**Примерный размер:** ~700 строк

---

### 3.5 GenePoolRenderer.ts — Отрисовка (~1500 строк)

**Ответственность:**
- Отрисовка свимботов (canvas 2D, WebGL)
- Отрисовка еды и мяса
- Отрисовка среды (температура, течения)
- Управление уровнем детализации (LOD)
- WebGL renderer (CapsuleRenderer)
- Batch rendering

**Содержит:**
```typescript
export class GenePoolRenderer {
    constructor(private state: GenePoolState) {}
    
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private _capsuleRenderer: CapsuleRenderer | null;
    
    // Главная отрисовка
    renderFrame() {
        this.clearCanvas();
        this.renderEnvironment();
        this.renderSwimbots();
        this.renderFoodBits();
        this.renderUI();
    }
    
    // Детали
    renderSwimbots() { /* ... */ }
    renderFoodBits() { /* ... */ }
    renderEnvironment() { /* ... */ }
    renderCurrents() { /* ... */ }
    
    // WebGL
    private renderWithWebGL() { /* ... */ }
    
    // LOD
    private updateLevelOfDetail() { /* ... */ }
}
```

**Примерный размер:** ~1500 строк

---

### 3.6 GenePoolCamera.ts — Управление камерой (~400 строк)

**Ответственность:**
- Управление позицией и масштабом камеры
- Обработка ввода (мышь, клавиатура, колесо)
- Слежение за свимботами
- Навигация (WASD, стрелки, зум)

**Содержит:**
```typescript
export class GenePoolCamera {
    private _camera: Camera;
    private _panningLeft = false;
    private _panningRight = false;
    // ...
    
    // Навигация
    handleKeyPress(key: string) { /* ... */ }
    handleMouseWheel(delta: number, mouseX: number, mouseY: number) { /* ... */ }
    handleMouseDrag(dx: number, dy: number) { /* ... */ }
    
    // Слежение
    followSwimbot(index: number) { /* ... */ }
    centerOnPool() { /* ... */ }
    
    // Обновление
    updateCamera(dt: number) { /* ... */ }
}
```

**Примерный размер:** ~400 строк

---

### 3.7 physics.worker.ts — Web Worker для физики (новый файл)

**Ответственность:**
- Вынос физических вычислений в отдельный поток
- Обработка сообщений от главного потока
- Расчёт физики для всех свимботов
- Возврат результатов в главный поток

**API (сообщения):**

```typescript
// Главный поток → Worker
interface PhysicsInput {
    type: 'step';
    swimbots: SwimbotPhysicsData[];  // позиция, скорость, силы
    environment: EnvironmentData;     // течения, температура
}

// Worker → Главный поток
interface PhysicsOutput {
    type: 'result';
    swimbots: SwimbotPhysicsData[];  // обновлённые позиция, скорость
}
```

**Содержит:**
```typescript
// physics.worker.ts
import { physicsStep } from '../simulation/PhysicsKernel';

self.onmessage = (e) => {
    const { type, swimbots, environment } = e.data;
    
    if (type === 'step') {
        // Расчёт физики для всех свимботов
        for (const swimbot of swimbots) {
            physicsStep(swimbot, environment);
        }
        
        // Возврат результатов
        self.postMessage({
            type: 'result',
            swimbots: swimbots
        });
    }
};
```

**Примерный размер:** ~200 строк

**Преимущества:**
- Физика работает в отдельном потоке → не блокирует UI
- Используется существующий PhysicsKernel.ts
- Простое API (JSON сообщения)

**Недостатки:**
- Сериализация данных (можно оптимизировать через SharedArrayBuffer)
- Синхронизация состояния

---

## 4. Граф зависимостей после рефакторинга

```
┌─────────────────────────────────────┐
│      GenePool.ts (координатор)      │
│           (<500 строк)              │
└─────────────────────────────────────┘
        │ создаёт и делегирует ↓
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│  GenePoolState   │ GenePoolActions  │  GenePoolLoop    │ GenePoolRenderer │
│   (~800 строк)   │  (~1200 строк)   │   (~700 строк)   │  (~1500 строк)   │
│                  │                  │                  │                  │
│ • Массивы        │ • Рождение       │ • Главный цикл   │ • Canvas 2D      │
│ • Сетки          │ • Смерть         │ • SimulateStep   │ • WebGL          │
│ • SharedState    │ • Еда            │ • AnimationFrame │ • Среда          │
│ • Счётчики       │ • Атаки          │ • Фазы           │ • UI             │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
        │                   │                   │                   │
        └───────────────────┴───────────────────┴───────────────────┘
                                      ↓
                    ┌─────────────────────────────────┐
                    │  Существующие ядра (без изм.)   │
                    │                                 │
                    │  • PhysicsKernel.ts (465 строк) │
                    │  • PerceptionKernel.ts (613)    │
                    │  • DecisionKernel.ts (966)      │
                    │  • Swimbot.ts (2652)            │
                    │  • Embryology.ts (766)          │
                    └─────────────────────────────────┘

┌─────────────────────────────────────┐
│   physics.worker.ts (новый файл)    │
│          (~200 строк)               │
│                                     │
│  • Web Worker для физики            │
│  • Использует PhysicsKernel.ts      │
│  • API: JSON messages               │
└─────────────────────────────────────┘
```

---

## 5. План миграции (поэтапный)

### Шаг 1: Создать GenePoolState.ts
1. Вынести все переменные состояния (_swimbots, _foodBits, _st, массивы)
2. Создать геттеры/сеттеры
3. Вынести методы синхронизации (syncSwimbot, rebuildAliveIndexCaches)
4. Обновить импорты в GenePool.ts

### Шаг 2: Создать GenePoolActions.ts
1. Вынести методы рождения (spawnSwimbot, breedSwimbots)
2. Вынести методы смерти (killSwimbot, spawnMeat, spawnCarcass)
3. Вынести методы еды (plantEaten, regrowFood)
4. Вынести методы видов (getSpeciesView, killSpecies)
5. Обновить импорты

### Шаг 3: Создать GenePoolLoop.ts
1. Вынести главный цикл (update, simulateStep, runFrame)
2. Вынести управление скоростью
3. Вынести animationFrame
4. Обновить импорты

### Шаг 4: Создать GenePoolRenderer.ts
1. Вынести методы отрисовки (renderFrame, renderSwimbots, renderFoodBits)
2. Вынести WebGL (CapsuleRenderer)
3. Вынести LOD
4. Обновить импорты

### Шаг 5: Создать GenePoolCamera.ts
1. Вынести управление камерой
2. Вынести обработку ввода
3. Обновить импорты

### Шаг 6: Упростить GenePool.ts до координатора
1. Оставить только создание модулей
2. Добавить делегирование методов
3. Очистить от логики

### Шаг 7: Создать physics.worker.ts (опционально)
1. Создать Web Worker
2. Реализовать API сообщений
3. Интегрировать с PhysicsKernel.ts
4. Протестировать производительность

---

## 6. API между модулями

### GenePool → State
```typescript
state.getSwimbots()
state.getNumSwimbots()
state.getFoodBits()
state.syncSwimbot(index)
state.rebuildAliveIndexCaches()
```

### GenePool → Actions
```typescript
actions.spawnSwimbot(genotype, x, y, energy)
actions.killSwimbot(index)
actions.plantEaten(plant)
actions.regrowFoodEnvironment(n0, n1)
```

### GenePool → Loop
```typescript
loop.startSimulation(mode)
loop.update()
loop.simulateStep()
loop.runFrame(now, draw)
```

### GenePool → Renderer
```typescript
renderer.renderFrame()
renderer.setCanvas(canvas)
renderer.setCanvasDimensions(w, h)
```

---

## 7. Преимущества предлагаемой архитектуры

1. **Модульность:** Каждый файл <500 строк, одна область ответственности
2. **Тестируемость:** Модули можно тестировать отдельно
3. **Читаемость:** Легко найти нужную функциональность
4. **Производительность:** Возможность вынести физику в Web Worker
5. **Поддержка:** Изменения локализованы в одном модуле
6. **Компиляция:** Быстрее компилируется (TypeScript кэширует модули)
7. **Совместимость:** Публичное API GenePool.ts не меняется

---

## 8. Риски и ограничения

1. **Объём работы:** ~5000 строк кода нужно переместить
2. **Регрессия:** Риск сломать поведение при переносе
3. **Тестирование:** Нужна тщательная проверка после каждого шага
4. **Web Worker:** Сложность синхронизации состояния
5. **Производительность:** Возможен небольшой overhead от делегирования

**Минимизация рисков:**
- Поэтапная миграция (по одному модулю за раз)
- Запуск `npm run build` после каждого шага
- Проверка `tsc --noEmit` на ошибки типов
- Ручное тестирование в браузере (запуск симуляции)
- Сравнение поведения до/после (визуально)

---

## 9. Оценка размеров после рефакторинга

| Файл | Строк | Статус |
|------|-------|--------|
| GenePool.ts (координатор) | ~400 | ✅ Меньше 500 |
| GenePoolState.ts | ~800 | ⚠️ Чуть больше 500, но допустимо |
| GenePoolActions.ts | ~1200 | 🔴 Больше 500 — можно разделить дальше |
| GenePoolLoop.ts | ~700 | ⚠️ Чуть больше 500, но допустимо |
| GenePoolRenderer.ts | ~1500 | 🔴 Больше 500 — можно разделить дальше |
| GenePoolCamera.ts | ~400 | ✅ Меньше 500 |
| physics.worker.ts | ~200 | ✅ Меньше 500 |

**Итого:** 5110 строк → 7 файлов (средний размер ~730 строк)

**Дальнейшее разделение (если нужно):**

**GenePoolActions.ts (1200 строк) → 3 файла:**
- `GenePoolBirth.ts` (~400 строк) — рождение, спаривание
- `GenePoolDeath.ts` (~300 строк) — смерть, мясо
- `GenePoolFood.ts` (~500 строк) — рост еды

**GenePoolRenderer.ts (1500 строк) → 3 файла:**
- `GenePoolCanvas.ts` (~600 строк) — Canvas 2D отрисовка
- `GenePoolWebGL.ts` (~500 строк) — WebGL рендеринг
- `GenePoolEnvironmentRenderer.ts` (~400 строк) — среда, течения

---

## 10. Структура папок после рефакторинга

```
src/simulation/
├── GenePool.ts                     (координатор, ~400 строк)
│
├── core/                           (ядро симуляции)
│   ├── GenePoolState.ts            (~800 строк)
│   ├── GenePoolLoop.ts             (~700 строк)
│   ├── GenePoolBirth.ts            (~400 строк)
│   ├── GenePoolDeath.ts            (~300 строк)
│   └── GenePoolFood.ts             (~500 строк)
│
├── render/                         (отрисовка)
│   ├── GenePoolCanvas.ts           (~600 строк)
│   ├── GenePoolWebGL.ts            (~500 строк)
│   ├── GenePoolEnvironmentRenderer.ts (~400 строк)
│   └── GenePoolCamera.ts           (~400 строк)
│
├── workers/                        (Web Workers)
│   └── physics.worker.ts           (~200 строк)
│
└── [существующие файлы без изменений]
    ├── PhysicsKernel.ts            (465 строк)
    ├── PerceptionKernel.ts         (613 строк)
    ├── DecisionKernel.ts           (966 строк)
    ├── Swimbot.ts                  (2652 строк)
    ├── Embryology.ts               (766 строк)
    └── ...
```

---

## 11. Следующие шаги (Этап 3: Реализация)

1. ✅ Создать `analysis/architecture-proposal.md` (этот документ)
2. ⏭ Создать `src/simulation/core/GenePoolState.ts`
3. ⏭ Обновить `GenePool.ts` — использовать GenePoolState
4. ⏭ Проверить сборку: `npm run build`
5. ⏭ Создать `src/simulation/core/GenePoolActions.ts` (или разбить на 3 файла)
6. ⏭ Обновить `GenePool.ts`
7. ⏭ Создать `src/simulation/core/GenePoolLoop.ts`
8. ⏭ Создать `src/simulation/render/GenePoolRenderer.ts` (или разбить на 3 файла)
9. ⏭ Создать `src/simulation/render/GenePoolCamera.ts`
10. ⏭ Упростить `GenePool.ts` до координатора
11. ⏭ Создать `src/simulation/workers/physics.worker.ts` (опционально)
12. ⏭ Финальная проверка: сборка + тестирование в браузере

---

**Готов приступить к реализации (Этап 3).**
