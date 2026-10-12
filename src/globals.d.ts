// Globals that live on `window` so the inline onclick="..." handlers in
// index.html (and the UI code) can reach them. main.ts sets them up.
declare var genePool: any;
declare var canvas: CanvasRenderingContext2D;
declare var canvasID: HTMLCanvasElement;

// The legacy UI code reads form properties (value, checked, ...) straight off
// document.getElementById(...) results; declare them loosely here.
interface HTMLElement
{
    value: any;
    min: any;
    max: any;
    checked: any;
    type: any;
    width: any;
    height: any;
    getContext: any;
}
interface EventTarget
{
    tagName?: any;
    id?: any;
    innerText?: any;
    matches?: any;
}
