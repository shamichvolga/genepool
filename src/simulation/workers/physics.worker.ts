/**
 * Physics Web Worker
 * 
 * Выполняет физические вычисления в отдельном потоке.
 * Принимает состояние свимботов, возвращает обновлённые позиции и скорости.
 */

import { physicsStep } from "../PhysicsKernel";
import * as SS from "../SharedState";

// Типы сообщений
interface PhysicsStepMessage {
    type: 'step';
    swimbotIndices: number[];
    timestep: number;
}

interface PhysicsResultMessage {
    type: 'result';
    completed: number;
}

// Инициализация SharedState в worker-контексте
const st = SS.sharedState();

// Обработчик сообщений
self.onmessage = (e: MessageEvent<PhysicsStepMessage>) => {
    const { type, swimbotIndices, timestep } = e.data;
    
    if (type === 'step') {
        // Выполнение физики для каждого свимбота
        for (const index of swimbotIndices) {
            // physicsStep обновляет состояние в SharedArrayBuffer
            // Сигнатура: physicsStep(index, sharedState)
            physicsStep(index, st);
        }
        
        // Возврат результата
        const result: PhysicsResultMessage = {
            type: 'result',
            completed: swimbotIndices.length
        };
        
        self.postMessage(result);
    }
};

// Сообщение о готовности
self.postMessage({ type: 'ready' });
