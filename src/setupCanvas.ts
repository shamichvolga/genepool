//------------------------------------------------------------------------------
// The main drawing canvas. This module is imported first by main.ts, so
// `canvas` / `canvasID` exist before any other module is evaluated.
//------------------------------------------------------------------------------
const canvasElement = document.getElementById( "Canvas" ) as HTMLCanvasElement;

( window as any ).canvasID = canvasElement;
( window as any ).canvas   = canvasElement.getContext( "2d" );
