//------------------------------------------------------------------------------
// UniformGrid: "who is near this point?" for thousands of items, fast.
//
// Items are plain integer indices (a swimbot or food bit slot number) with
// coordinates kept in Float64Arrays. Once per step the grid is rebuilt from
// scratch with a counting sort - no objects, no maps, no garbage:
//
//   cellCount[c]  how many items are in cell c
//   cellStart[c]  where cell c's items begin in `sorted`
//   sorted[]      item indices grouped cell by cell
//
// A cell is floor( x / cellSize ), exactly like the previous object-based
// grid, so queries return the same items. Items added after the rebuild
// (e.g. a plant that sprouted this step) go to a small "extras" list that
// queries also scan.
//------------------------------------------------------------------------------
const MARGIN_CELLS = 16;  // room for items outside the pool walls

// where the grid's arrays come from: by default plain memory; the shared
// state passes an allocator so worker threads can read the same grid
export type GridAllocator = ( name: string, bytes: number ) => ArrayBufferLike;
const plainMemory: GridAllocator = ( name, bytes ) => new ArrayBuffer( bytes );

export class UniformGrid
{
    readonly cellSize   : number;
    private  minCellX   : number;
    private  minCellY   : number;
    private  cols       : number;
    private  rows       : number;
    private  cellStart  : Int32Array;
    private  cellCount  : Int32Array;
    private  cellOfItem : Int32Array;
    private  sorted     : Int32Array;
    private  extras     : Int32Array;
    private  meta       : Int32Array;   // [0] = number of extras
    private  isExtra    : Uint8Array;   // 1 = moved to extras since the rebuild

    constructor( cellSize: number, left: number, top: number, right: number, bottom: number, capacity: number, alloc: GridAllocator = plainMemory )
    {
        this.cellSize   = cellSize;
        this.minCellX   = Math.floor( left   / cellSize ) - MARGIN_CELLS;
        this.minCellY   = Math.floor( top    / cellSize ) - MARGIN_CELLS;
        this.cols       = Math.floor( right  / cellSize ) + MARGIN_CELLS - this.minCellX + 1;
        this.rows       = Math.floor( bottom / cellSize ) + MARGIN_CELLS - this.minCellY + 1;
        const cells = this.cols * this.rows;
        this.cellStart  = new Int32Array( alloc( "cellStart",  ( cells + 1 ) * 4 ));
        this.cellCount  = new Int32Array( alloc( "cellCount",  cells * 4 ));
        this.cellOfItem = new Int32Array( alloc( "cellOfItem", capacity * 4 ));
        this.sorted     = new Int32Array( alloc( "sorted",     capacity * 4 ));
        this.extras     = new Int32Array( alloc( "extras",     capacity * 4 ));
        this.isExtra    = new Uint8Array( alloc( "isExtra",    capacity ));
        this.meta       = new Int32Array( alloc( "meta",       4 * 4 ));
    }

    private get numExtras(): number  { return this.meta[0]; }
    private set numExtras( n: number ) { this.meta[0] = n; }

    //--------------------------------------------------------------------
    // column / row of a coordinate (clamped to the grid)
    //--------------------------------------------------------------------
    private column( x: number ): number
    {
        const c = Math.floor( x / this.cellSize ) - this.minCellX;
        return c < 0 ? 0 : ( c >= this.cols ? this.cols - 1 : c );
    }

    private row( y: number ): number
    {
        const r = Math.floor( y / this.cellSize ) - this.minCellY;
        return r < 0 ? 0 : ( r >= this.rows ? this.rows - 1 : r );
    }

    //--------------------------------------------------------------------
    // rebuild from the given items (indices) and their coordinates
    //--------------------------------------------------------------------
    build( items: ArrayLike<number>, numItems: number, xs: Float64Array, ys: Float64Array ): void
    {
        const cellCount = this.cellCount;
        cellCount.fill( 0 );

        for ( let e = 0; e < this.numExtras; e++ ) this.isExtra[ this.extras[e] ] = 0;
        this.numExtras = 0;

        for ( let i = 0; i < numItems; i++ )
        {
            const item = items[i];
            const cell = this.row( ys[ item ] ) * this.cols + this.column( xs[ item ] );
            this.cellOfItem[ item ] = cell;
            cellCount[ cell ] ++;
        }

        // running total: where each cell starts
        const cellStart = this.cellStart;
        let total = 0;
        for ( let c = 0; c < cellCount.length; c++ )
        {
            cellStart[c] = total;
            total += cellCount[c];
        }
        cellStart[ cellCount.length ] = total;

        // place the items (cellCount is reused as a fill counter)
        cellCount.fill( 0 );
        for ( let i = 0; i < numItems; i++ )
        {
            const item = items[i];
            const cell = this.cellOfItem[ item ];
            this.sorted[ cellStart[ cell ] + cellCount[ cell ] ] = item;
            cellCount[ cell ] ++;
        }
    }

    //--------------------------------------------------------------------
    // an item that appeared after the last rebuild
    //--------------------------------------------------------------------
    addExtra( item: number ): void
    {
        if ( this.isExtra[ item ] ) return;
        this.isExtra[ item ] = 1;
        this.extras[ this.numExtras ] = item;
        this.numExtras = this.numExtras + 1;
    }

    //--------------------------------------------------------------------
    // collect: writes into `out` every item whose cell overlaps the square
    // around (x, y). With xs/ys it also applies the caller's strict circle test.
    // Extras come last; an item moved to the extras is not listed twice.
    //--------------------------------------------------------------------
    collect( x: number, y: number, radius: number, out: Int32Array, xs?: Float64Array, ys?: Float64Array ): number
    {
        const c0 = this.column( x - radius ), c1 = this.column( x + radius );
        const r0 = this.row   ( y - radius ), r1 = this.row   ( y + radius );
        const cols = this.cols, cellStart = this.cellStart, sorted = this.sorted;
        const radiusSquared = radius * radius;
        let n = 0;

        for ( let c = c0; c <= c1; c++ )
        {
            for ( let r = r0; r <= r1; r++ )
            {
                const cell = r * cols + c;
                const end = cellStart[ cell + 1 ];
                for ( let k = cellStart[ cell ]; k < end; k++ )
                {
                    const item = sorted[k];
                    if ( this.isExtra[ item ] !== 0 ) continue;
                    if ( xs !== undefined && ys !== undefined )
                    {
                        const dx = xs[item] - x, dy = ys[item] - y;
                        if ( dx * dx + dy * dy >= radiusSquared ) continue;
                    }
                    out[ n ++ ] = item;
                }
            }
        }

        const numExtras = this.numExtras;
        for ( let e = 0; e < numExtras; e++ )
        {
            const item = this.extras[e];
            if ( xs !== undefined && ys !== undefined )
            {
                const dx = xs[item] - x, dy = ys[item] - y;
                if ( dx * dx + dy * dy >= radiusSquared ) continue;
            }
            out[ n ++ ] = item;
        }

        return n;
    }
}
