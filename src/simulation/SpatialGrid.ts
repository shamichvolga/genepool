/**
 * Uniform spatial grid for fast "who is near this point" queries.
 *
 * Each object lives in exactly one cell (the one containing its position),
 * cells are addressed by an integer key, and removal is O(1) (swap-remove).
 * Queries scan the cells overlapping the search circle and test real distances.
 *
 * @param {number} cellSize - Size of each grid cell
 */
export function SpatialGrid(cellSize) {
    this.cellSize = cellSize || 100;
    this.cells    = new Map();      // integer key -> array of objects
    this.records  = new Map();      // object -> { key, index }
    this.objects  = [];
    this.stats = {
        addCount: 0,
        queryCount: 0,
        cacheHits: 0,
        cellLookups: 0
    };
}

// cell coordinates are packed into one 32-bit integer (range ±32767 cells)
SpatialGrid.prototype.cellKey = function(cx, cy) {
    return ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
};

/**
 * Clear the grid
 */
SpatialGrid.prototype.clear = function() {
    this.cells.clear();
    this.records.clear();
    this.objects.length = 0;
};

/**
 * Take an object out of its current cell (swap-remove)
 * @private
 */
SpatialGrid.prototype.detach = function(record, obj) {
    const cell = this.cells.get(record.key);
    const last = cell.pop();
    if (last !== obj) {
        cell[record.index] = last;
        this.records.get(last).index = record.index;
    }
};

/**
 * Remove an object from the grid
 * @param {Object} obj - Object to remove
 */
SpatialGrid.prototype.removeObject = function(obj) {
    const record = this.records.get(obj);
    if (record === undefined) {
        return;
    }

    this.detach(record, obj);
    this.records.delete(obj);

    const objIndex = this.objects.indexOf(obj);
    if (objIndex !== -1) {
        this.objects[objIndex] = this.objects[this.objects.length - 1];
        this.objects.pop();
    }
};

/**
 * Add an object to the grid, or move it if it is already there
 * @param {Object} obj - Object to add (must have a getPosition() method)
 */
SpatialGrid.prototype.addObject = function(obj) {
    const pos = obj.getPosition();
    const key = this.cellKey(Math.floor(pos.x / this.cellSize), Math.floor(pos.y / this.cellSize));
    let record = this.records.get(obj);

    if (record !== undefined) {
        if (record.key === key) {
            return;     // still in the same cell - nothing to do
        }
        this.detach(record, obj);
    } else {
        record = { key: 0, index: 0 };
        this.records.set(obj, record);
        this.objects.push(obj);
    }

    let cell = this.cells.get(key);
    if (cell === undefined) {
        cell = [];
        this.cells.set(key, cell);
    }

    record.key   = key;
    record.index = cell.length;
    cell.push(obj);
    this.stats.addCount++;
};

/**
 * Get nearby objects within a certain radius
 * @param {Object} obj - Reference object (must have getPosition() method)
 * @param {number} radius - Search radius
 * @returns {Array} Array of nearby objects (excluding obj itself)
 */
SpatialGrid.prototype.getNearbyObjects = function(obj, radius) {
    const pos = obj.getPosition();
    const size = this.cellSize;
    const minX = Math.floor((pos.x - radius) / size);
    const maxX = Math.floor((pos.x + radius) / size);
    const minY = Math.floor((pos.y - radius) / size);
    const maxY = Math.floor((pos.y + radius) / size);
    const radiusSquared = radius * radius;
    const nearbyObjects = [];

    this.stats.queryCount++;

    for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
            const cell = this.cells.get(this.cellKey(cx, cy));
            if (cell === undefined) continue;

            this.stats.cellLookups++;

            for (let j = 0; j < cell.length; j++) {
                const candidate = cell[j];
                if (candidate === obj) continue;

                const p = candidate.getPosition();
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                if (dx * dx + dy * dy < radiusSquared) {
                    nearbyObjects.push(candidate);
                }
            }
        }
    }

    return nearbyObjects;
};

/**
 * Get profiling statistics
 * @returns {Object} Stats object
 */
SpatialGrid.prototype.getStats = function() {
    return this.stats;
};

/**
 * Reset profiling statistics
 */
SpatialGrid.prototype.resetStats = function() {
    this.stats.addCount = 0;
    this.stats.queryCount = 0;
    this.stats.cacheHits = 0;
    this.stats.cellLookups = 0;
};

/**
 * Get all objects in the grid
 * @returns {Array} Array of all objects
 */
SpatialGrid.prototype.getAllObjects = function() {
    return this.objects;
};

/**
 * Get number of objects in the grid
 * @returns {number} Number of objects
 */
SpatialGrid.prototype.getObjectCount = function() {
    return this.objects.length;
};
