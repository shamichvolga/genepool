/**
 * Physics Web Worker
 *
 * Выполняет физику тел (physicsStep из PhysicsKernel) в отдельном потоке.
 * Данные свимботов лежат в общей памяти (SharedArrayBuffer): воркер получает
 * буферы один раз в сообщении 'init' и пишет результат прямо в них.
 *
 * Протокол:
 *   главный поток -> воркер: { type: 'init', buffers, maxSwimbots, params? }
 *   воркер -> главный поток: { type: 'ready' }
 *   главный поток -> воркер: { type: 'step', swimbotIndices: Int32Array | number[] }
 *   воркер -> главный поток: { type: 'result', completed: number }
 *
 * Порядок импорта важен: модули ссылаются друг на друга по кругу,
 * рабочий порядок начинается с Globals (как в parallel/sim.worker.ts).
 */
import "../Globals";
import { SharedState } from "../SharedState";
import { physicsStep } from "../PhysicsKernel";
import { attachParamBuffers, syncParams } from "../ParamStore";

interface PhysicsInitMessage
{
    type: 'init';
    buffers: { [ name: string ]: ArrayBufferLike };
    maxSwimbots: number;
    params?: { numbers: SharedArrayBuffer, version: SharedArrayBuffer };
}

interface PhysicsStepMessage
{
    type: 'step';
    swimbotIndices: ArrayLike<number>;
}

type PhysicsMessage = PhysicsInitMessage | PhysicsStepMessage;

let st: SharedState | null = null;

self.onmessage = ( e: MessageEvent<PhysicsMessage> ) =>
{
    const msg = e.data;

    if ( msg.type === 'init' )
    {
        if ( msg.params ) { attachParamBuffers( msg.params ); }
        st = new SharedState( msg.maxSwimbots, msg.buffers );
        ( self as any ).postMessage({ type: 'ready' });
        return;
    }

    if ( msg.type === 'step' )
    {
        if ( st === null ) { ( self as any ).postMessage({ type: 'error', message: 'step before init' }); return; }

        syncParams();
        const list = msg.swimbotIndices;
        let completed = 0;
        for ( let i = 0; i < list.length; i++ )
        {
            const s = list[i];
            if ( st.alive[s] ) { physicsStep( s, st ); completed++; }   // как TASK_PHYSICS в ParallelWork
        }
        ( self as any ).postMessage({ type: 'result', completed });
    }
};
