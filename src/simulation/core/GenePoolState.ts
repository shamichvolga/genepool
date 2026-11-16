/**
 * GenePoolState — Состояние симуляции
 * 
 * Отвечает за:
 * - Хранение массивов свимботов, еды, препятствий
 * - Сетки поиска соседей (UniformGrid)
 * - Счётчики и таймеры
 * - SharedState для многопоточности
 */

import { Swimbot } from "../Swimbot";
import { FoodBit } from "../FoodBit";
import { Camera } from "../Camera";
import { Embryology } from "../Embryology";
import { FamilyTree } from "../FamilyTree";
import { PhyloTree } from "../PhyloTree";
import { ViewTracking } from "../ViewTracking";
import { Touch } from "../Touch";
import { Vector2D } from "../Vector2D";
import { Genotype } from "../Genotype";
import { Obstacle } from "../Obstacle";
import { Pool } from "../Pool";
import * as SS from "../SharedState";
import { UniformGrid } from "../UniformGrid";
import { MAX_SWIMBOTS, MAX_FOODBITS } from "../Parameters";
import { BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS } from "../Brain";
import { NULL_INDEX, ZERO } from "../MathConstants";
import { PerceptionScratch } from "../PerceptionKernel";
import { environment } from "../Environment";
import { bindPlantGenes } from "../PlantGenes";

export class GenePoolState {
    // Основные массивы
    public swimbots: any[] = [];
    public foodBits: any[] = [];
    
    // Счётчики
    public numSwimbots = 0;
    public numFoodBits = 0;
    public numNearbySwimbots = 0;
    
    // Объекты для работы
    public touch = new Touch();
    public viewTracking = new ViewTracking();
    public camera = new Camera();
    public obstacle = new Obstacle();
    public pool = new Pool();
    public embryology = new Embryology();
    public familyTree = new FamilyTree();
    public phyloTree = new PhyloTree();
    
    // Утилиты
    public vectorUtility = new Vector2D();
    public poolCenter = new Vector2D();
    public potentialMate = new Swimbot();
    public chosenFoodBit = new FoodBit();
    public myGenotype = new Genotype();
    public mateGenotype = new Genotype();
    public childGenotype = new Genotype();
    
    // Флаги состояния
    public simulationRunning = false;
    public rendering = false;
    
    // Таймеры и время
    public clock = 0;
    public startTime = ZERO;
    public seconds = ZERO;
    
    // UI состояние
    public canvas: HTMLCanvasElement | null = null;
    public canvasWidth = 0;
    public canvasHeight = 0;
    public mousedOverSwimbot = NULL_INDEX;
    public mousedOverFoodBit = NULL_INDEX;
    public selectedSwimbot = NULL_INDEX;
    public selectedFoodBit = NULL_INDEX;
    
    // SharedState для многопоточности
    public readonly st: ReturnType<typeof SS.sharedState>;
    public readonly swimbotGrid: UniformGrid;
    public readonly foodBitGrid: UniformGrid;
    
    // Массивы из SharedState (прямой доступ)
    public readonly botX: Float64Array;
    public readonly botY: Float64Array;
    public readonly genitalX: Float64Array;
    public readonly genitalY: Float64Array;
    public readonly botAlive: Uint8Array;
    public readonly botEternal: Uint8Array;
    public readonly botPredator: Float64Array;
    public readonly botBrightness: Float64Array;
    public readonly botMass: Float64Array;
    public readonly foodX: Float64Array;
    public readonly foodY: Float64Array;
    public readonly foodType: Uint8Array;
    
    // Scratch массивы
    public readonly perceptionScratch: PerceptionScratch;
    public readonly gridResult = new Int32Array(MAX_SWIMBOTS * 2);
    public readonly foodGridResult = new Int32Array(MAX_FOODBITS * 2);
    public readonly plantShade = new Float32Array(environment.plantCount[0].length);
    public readonly nearbyIndices = new Int32Array(MAX_SWIMBOTS);
    public readonly nearbySwimbotsArray = new Array(BRAIN_MAX_PERCEIVED_NEARBY_SWIMBOTS);
    
    // Кэши для рендеринга
    public aliveSwimbotIndices: number[] = [];
    public aliveFoodBitIndices: number[] = [];
    public distanceCache = new Array(MAX_SWIMBOTS);
    public lastSwimbotPositions = new Array(MAX_SWIMBOTS);
    public swimbotWasAlive = new Array(MAX_SWIMBOTS);
    public lastCameraPosition: any;
    
    // Параллельный раннер
    private _runner: any;
    
    constructor() {
        // Инициализация SharedState
        this.st = SS.sharedState();
        bindPlantGenes(this.st);
        
        this.swimbotGrid = this.st.swimbotGrid;
        this.foodBitGrid = this.st.foodGrid;
        this.botX = this.st.botX;
        this.botY = this.st.botY;
        this.genitalX = this.st.genitalX;
        this.genitalY = this.st.genitalY;
        this.botAlive = this.st.alive;
        this.botEternal = this.st.eternal;
        this.botPredator = this.st.predator;
        this.botBrightness = this.st.brightness;
        this.botMass = this.st.mass;
        this.foodX = this.st.foodX;
        this.foodY = this.st.foodY;
        this.foodType = this.st.foodType;
        
        this.perceptionScratch = new PerceptionScratch(MAX_SWIMBOTS, MAX_FOODBITS);
        
        // Инициализация массивов свимботов
        for (let s = 0; s < MAX_SWIMBOTS; s++) {
            this.swimbots[s] = new Swimbot();
            this.lastSwimbotPositions[s] = new Vector2D();
            this.distanceCache[s] = 0;
            this.swimbotWasAlive[s] = false;
        }
        
        // Инициализация массива еды
        for (let f = 0; f < MAX_FOODBITS; f++) {
            this.foodBits[f] = new FoodBit();
        }
        
        this.lastCameraPosition = new Vector2D();
        this.lastCameraPosition.setXY(0, 0);
        
        // Дефолтный раннер (1 поток)
        this._runner = {
            getNumThreads: () => 1,
            task: (task: any, list: any, n: number) => {
                // Заглушка — будет заполнено при интеграции с GenePool
            }
        };
    }
    
    // Методы доступа к параллельному раннеру
    setParallelRunner(runner: any) {
        this._runner = runner;
    }
    
    getParallelRunner() {
        return this._runner;
    }
    
    getNumThreads() {
        return this._runner.getNumThreads();
    }
    
    // Методы синхронизации
    syncSwimbotPosition(index: number) {
        // Копирует позицию свимбота в общие массивы (из SharedState)
        const k = index * SS.BOT_STRIDE, B = this.st.bots;
        this.botX[index] = B[k + SS.B_POS_X];
        this.botY[index] = B[k + SS.B_POS_Y];
        this.genitalX[index] = B[k + SS.B_GENITAL_X];
        this.genitalY[index] = B[k + SS.B_GENITAL_Y];
    }
    
    syncSwimbot(index: number) {
        // Копирует все поля свимбота в SharedState
        const swimbot = this.swimbots[index];
        this.syncSwimbotPosition(index);
        this.botAlive[index] = swimbot.getAlive() ? 1 : 0;
        this.botEternal[index] = swimbot.isEternal() ? 1 : 0;
        this.botPredator[index] = swimbot.getPredatorLevel();
        this.botBrightness[index] = swimbot.getBrightness();
        this.botMass[index] = swimbot.getPhenotypeMass();
    }
    
    rebuildAliveIndexCaches() {
        // Пересобирает индексы живых существ
        this.aliveSwimbotIndices.length = 0;
        this.aliveFoodBitIndices.length = 0;

        const liveSwimbot = this.st.liveSwimbot, liveFood = this.st.liveFood;
        for (let s = 0; s < MAX_SWIMBOTS; s++) {
            if (liveSwimbot[s] === 1) this.aliveSwimbotIndices.push(s);
        }
        for (let f = 0; f < MAX_FOODBITS; f++) {
            if (liveFood[f] === 1) this.aliveFoodBitIndices.push(f);
        }
    }
}
