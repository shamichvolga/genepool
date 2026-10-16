//------------------------------------------------------------------------------
// The main drawing canvas. This module is imported first by main.ts, so
// `canvas` / `canvasID` exist before any other module is evaluated.
//------------------------------------------------------------------------------
const canvasElement = document.getElementById( "Canvas" ) as HTMLCanvasElement;

import { SIM_IN_THREAD } from "./threadMode";

( window as any ).canvasID = canvasElement;
// (when the simulation thread draws, the page may not take a context:
//  the canvas is handed over to the thread, see main.ts)
( window as any ).canvas   = SIM_IN_THREAD ? null : canvasElement.getContext( "2d" );
