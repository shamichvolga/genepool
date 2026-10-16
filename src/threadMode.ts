//------------------------------------------------------------------------------
// Does the whole simulation run in its own thread (simhost.worker.ts)?
// Needs canvases that can be handed to a thread (OffscreenCanvas) and shared
// memory. "?local=1" in the address keeps it on the page (the old way).
//------------------------------------------------------------------------------
export const SIM_IN_THREAD =
       ( typeof window !== "undefined" )
    && !/[?&]local=1/.test( window.location.search )
    && ( typeof OffscreenCanvas !== "undefined" )
    && ( typeof HTMLCanvasElement !== "undefined" ) && ( "transferControlToOffscreen" in HTMLCanvasElement.prototype )
    && ( typeof crossOriginIsolated !== "undefined" ) && crossOriginIsolated;
