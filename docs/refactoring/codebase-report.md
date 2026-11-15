# Отчёт: Анализ кодовой базы GenePool

**Дата:** 15.11.2026  
**Цель:** Подготовка к рефакторингу — разделение монолитных файлов на модули

---

## 1. Файлы длиннее 500 строк в `src/simulation/`

| Файл | Строк | Статус |
|------|-------|--------|
| `GenePool.ts` | 5110 | 🔴 Критический размер — требуется разделение |
| `Swimbot.ts` | 2652 | 🟡 Большой — рассмотреть разделение |
| `DecisionKernel.ts` | 966 | 🟡 Средний — можно оптимизировать |
| `Embryology.ts` | 766 | 🟢 Близко к порогу |
| `SwimbotRenderer.ts` | 734 | 🟢 Близко к порогу |
| `ViewTracking.ts` | 618 | 🟢 Чуть выше порога |
| `PerceptionKernel.ts` | 613 | 🟢 Чуть выше порога |

**Приоритет рефакторинга:**
1. **GenePool.ts** (5110 строк) — монолит, содержит всё: состояние, рендеринг, логику симуляции
2. **Embryology.ts** (766 строк) — умеренный размер, можно разделить
3. **PhysicsKernel.ts** — размер неизвестен, проверить отдельно

---

## 2. TODO и FIXME в коде

✅ **Результат:** TODO и FIXME не найдены в кодовой базе.

Код содержит минимум технического долга в виде явных маркеров.

---

## 3. Граф зависимостей ключевых модулей

### 3.1 GenePool.ts (5110 строк)

**Импортирует 46 модулей:**
- Параметры: `Parameters.ts`, `ParamStore.ts`, `World.ts`
- Экология: `Environment.ts`, `Ecology.ts`, `EcologyGenes.ts`, `Disease.ts`, `PlantSize.ts`, `PlantGenes.ts`
- Симуляция: `Swimbot.ts`, `FoodBit.ts`, `Genotype.ts`, `Embryology.ts`
- Ядра: `PhysicsKernel.ts`, `PerceptionKernel.ts`, `DecisionKernel.ts` (через ParallelWork)
- Состояние: `SharedState.ts`, `Globals.ts`, `UniformGrid.ts`
- Интерфейс: `Camera.ts`, `ViewTracking.ts`, `../ui/panelTexts.ts`
- Утилиты: `Vector2D.ts`, `Utility.ts`, `Touch.ts`, `MathConstants.ts`
- Дополнительно: `FamilyTree.ts`, `PhyloTree.ts`, `Obstacle.ts`, `Pool.ts`, `WorldFile.ts`, `NeuralBrain.ts`, `MapZones.ts`, `Currents.ts`, `Petri.ts`, `EnergyBudget.ts`

**Кем используется:**
- `src/main.ts` (`import * as GenePoolModule`) и `src/simhost.worker.ts` (`import { GenePool }`)
- Экспорты также кладутся на `window`, потому что кнопки в `index.html` вызывают их через `onclick`

**Проблема:** GenePool.ts — центральный узел, содержащий всю логику управления симуляцией, отрисовки и состояния. Монолитная структура.

---

### 3.2 PhysicsKernel.ts

**Импортирует 6 модулей:**
- `Currents.ts` — течения
- `MathConstants.ts` — константы
- `Parameters.ts` — параметры
- `BodyPhysics.ts` — физика тела
- `Pool.ts` — границы бассейна
- `SwimbotTypes.ts` — типы свимботов

**Кем используется:**
- `GenePool.ts` — импортирует `physicsStep`
- `Swimbot.ts` — импортирует `physicsPartA`, `physicsPartB`
- `ParallelWork.ts` — импортирует `physicsStep` для многопоточности

**Вывод:** PhysicsKernel — самостоятельное ядро с чёткими границами. Используется в параллельных потоках.

---

### 3.3 Embryology.ts (766 строк)

**Импортирует 8 модулей:**
- `EcologyGenes.ts` — гены экологии
- `Environment.ts` — среда
- `Genotype.ts` — генотип
- `Globals.ts` — глобальное состояние
- `MathConstants.ts` — константы
- `Parameters.ts` — параметры
- `SwimbotTypes.ts` — типы
- `Utility.ts` — утилиты

**Кем используется:**
- `GenePool.ts` — импортирует `Embryology`, `BRIGHTNESS_FROM_GENES`, `isExperimentalEmbryologyGene`
- `Swimbot.ts` — импортирует `GREATEST_POSSIBLE_SWIMBOT_LENGTH`, `GREATEST_POSSIBLE_SWIMBOT_MASS`

**Вывод:** Embryology — модуль развития эмбриона. Имеет чёткую область ответственности (генерация тела из генов).

---

## 4. Рекомендации по рефакторингу

### Приоритет 1: GenePool.ts (5110 строк → <500 строк на модуль)

**Предлагаемое разделение:**

1. **GenePool.ts** (ядро, <500 строк)
   - Инициализация симуляции
   - Главный цикл `update()` / `simulateStep()`
   - Координация между модулями

2. **GenePoolState.ts** (состояние)
   - Массивы свимботов, еды, препятствий
   - Сетка поиска соседей (UniformGrid)
   - Глобальные счётчики и таймеры
   - Методы доступа к состоянию

3. **GenePoolRenderer.ts** (отрисовка)
   - Отрисовка свимботов, еды, среды
   - Управление камерой и масштабом
   - WebGL-рендеринг (CapsuleRenderer)
   - Панель информации о свимботе

4. **GenePoolActions.ts** (действия)
   - Рождение, смерть, спаривание
   - Поедание еды/мяса
   - Атаки хищников
   - Мутации и эволюция

5. **src/simulation/workers/physics.worker.ts** (Web Worker)
   - Вынести физику в отдельный поток
   - API: отправка состояния → расчёт физики → возврат результатов

### Приоритет 2: Embryology.ts (766 строк)

Возможное разделение:
- `Embryology.ts` — генерация структуры тела
- `EmbryologyPhysics.ts` — физические параметры частей
- `EmbryologyVisuals.ts` — визуальные параметры (цвет, яркость)

### Приоритет 3: PhysicsKernel.ts

Оставить как есть — уже работает в параллельных потоках, чёткая область ответственности.

---

## 5. Граф зависимостей (визуально)

```
┌─────────────────────────────────────────┐
│         GenePool.ts (5110 строк)        │
│  ┌────────────────────────────────────┐ │
│  │ • Состояние (массивы, счётчики)   │ │
│  │ • Отрисовка (canvas, WebGL)       │ │
│  │ • Логика (рождение, смерть, еда)  │ │
│  │ • Главный цикл (update)           │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
            ↓ импортирует всё ↓
┌──────────────────────────────────────────┐
│  46 модулей:                             │
│  • PhysicsKernel (физика движения)       │
│  • PerceptionKernel (восприятие)         │
│  • DecisionKernel (решения)              │
│  • Swimbot (свимбот)                     │
│  • Environment, Ecology (среда)          │
│  • Parameters (настройки)                │
│  • SharedState (общая память)            │
│  • UI (панели, камера)                   │
└──────────────────────────────────────────┘
```

---

## Выводы

1. **GenePool.ts — главная проблема:** 5110 строк, монолитная структура, содержит всё.
2. **Чёткие границы у ядер:** PhysicsKernel, PerceptionKernel, DecisionKernel — уже модульны.
3. **Embryology.ts — средний приоритет:** 766 строк, можно разделить при необходимости.
4. **Нет технического долга:** TODO/FIXME отсутствуют.

**Следующий шаг:** Архитектурное решение — план разделения GenePool.ts на модули.
