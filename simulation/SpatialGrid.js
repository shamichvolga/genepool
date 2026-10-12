"use strict";

/**
 * Spatial Grid for efficient collision detection and object lookup
 * @param {number} cellSize - Size of each grid cell
 */
function SpatialGrid(cellSize) {
    this.cellSize = cellSize || 100;
    this.grid = {};
    this.objects = [];
    this.cellIndices = new WeakMap(); // Track cells per object
    // Neighbor cache: { cellKey: [neighborKeys...] }
    this.neighborCache = new Map();
    // Profile statistics
    this.stats = {
        addCount: 0,
        queryCount: 0,
        cacheHits: 0,
        cellLookups: 0
    };
}

/**
 * Clear the grid
 */
SpatialGrid.prototype.clear = function() {
    this.grid = {};
    this.objects = [];
    this.cellIndices = new WeakMap();
};

/**
 * Remove an object from the grid
 * @param {Object} obj - Object to remove
 */
SpatialGrid.prototype.removeObject = function(obj) {
    if (!obj || !this.cellIndices.has(obj)) {
        return;
    }

    const oldCells = this.cellIndices.get(obj);
    for (let i = 0; i < oldCells.length; i++) {
        const cellKey = oldCells[i];
        const cell = this.grid[cellKey];
        if (!cell) continue;

        const index = cell.indexOf(obj);
        if (index !== -1) {
            cell.splice(index, 1);
        }

        if (cell.length === 0) {
            delete this.grid[cellKey];
        }
    }

    const objIndex = this.objects.indexOf(obj);
    if (objIndex !== -1) {
        this.objects.splice(objIndex, 1);
    }
};

/**
 * Add an object to the grid
 * @param {Object} obj - Object to add (must have getPosition() and getBoundingRadius() methods)
 */
SpatialGrid.prototype.addObject = function(obj) {
    if (!obj || !obj.getPosition || !obj.getBoundingRadius) {
        console.warn("SpatialGrid: Object missing required methods");
        return;
    }

    const existed = this.cellIndices.has(obj);
    const pos = obj.getPosition();
    const radius = obj.getBoundingRadius();
    // Remove object from previous cells
    if (existed) {
        const oldCells = this.cellIndices.get(obj);
        for (const cellKey of oldCells) {
            const cell = this.grid[cellKey];
            if (cell) {
                const index = cell.indexOf(obj);
                if (index !== -1) cell.splice(index, 1);
            }
        }
    }

    const minX = Math.floor((pos.x - radius) / this.cellSize);
    const minY = Math.floor((pos.y - radius) / this.cellSize);
    const maxX = Math.floor((pos.x + radius) / this.cellSize);
    const maxY = Math.floor((pos.y + radius) / this.cellSize);

    const occupiedCells = [];
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const cellKey = x + ',' + y;
            if (!this.grid[cellKey]) {
                this.grid[cellKey] = [];
            }
            this.grid[cellKey].push(obj);
            occupiedCells.push(cellKey);
        }
    }
    
    this.cellIndices.set(obj, occupiedCells);
    this.stats.addCount++;

    if (!existed) {
        this.objects.push(obj);
    }
};

/**
 * Get nearby objects within a certain radius
 * @param {Object} obj - Reference object (must have getPosition() method)
 * @param {number} radius - Search radius
 * @returns {Array} Array of nearby objects
 */
SpatialGrid.prototype.getNearbyObjects = function(obj, radius) {
    const pos = obj.getPosition();
    const centerX = Math.floor(pos.x / this.cellSize);
    const centerY = Math.floor(pos.y / this.cellSize);
    const radiusInCells = Math.ceil(radius / this.cellSize) + 1;

    // Generate cell keys using neighbor cache
    const cellKeys = this.getCellsInRadius(centerX, centerY, radiusInCells);
    
    const nearbyObjects = [];
    const checkedObjects = new Set();
    this.stats.queryCount++;
    this.stats.cellLookups += cellKeys.length;

    // Check all cells that could contain nearby objects
    for (let i = 0; i < cellKeys.length; i++) {
        const cellKey = cellKeys[i];
        if (this.grid[cellKey]) {
            for (let j = 0; j < this.grid[cellKey].length; j++) {
                const candidate = this.grid[cellKey][j];
                if (candidate !== obj && !checkedObjects.has(candidate)) {
                    checkedObjects.add(candidate);
                    const distanceSquared = pos.getDistanceSquaredTo(candidate.getPosition());
                    if (distanceSquared < radius * radius) {
                        nearbyObjects.push(candidate);
                    }
                }
            }
        }
    }

    return nearbyObjects;
};

/**
 * Get cells in radius (using neighbor cache)
 * @private
 */
SpatialGrid.prototype.getCellsInRadius = function(centerX, centerY, radius) {
    const cacheKey = `${centerX},${centerY},${radius}`;
    
    // Check cache
    if (this.neighborCache.has(cacheKey)) {
        this.stats.cacheHits++;
        return this.neighborCache.get(cacheKey);
    }
    
    // Compute neighbors
    const keys = [];
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx*dx + dy*dy <= radius*radius) {
                const x = centerX + dx;
                const y = centerY + dy;
                keys.push(x + ',' + y);
            }
        }
    }
    
    // Update cache (limit size)
    if (this.neighborCache.size > 1000) {
        this.neighborCache.clear();
    }
    this.neighborCache.set(cacheKey, keys);
    return keys;
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
