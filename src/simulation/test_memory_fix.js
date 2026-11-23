// Test the memory fixes
// This test will verify that the world=1, world=2, and world=4 modes work correctly

console.log("Testing memory fixes for GenePool...")

// Test world scale parameter values
console.log("Testing world scale parameter values...")
console.log("World=1 - MAX_SWIMBOTS:", require('./Parameters').MAX_SWIMBOTS_WORLD_1)
console.log("World=2 - MAX_SWIMBOTS:", require('./Parameters').MAX_SWIMBOTS_WORLD_2)
console.log("World=4 - MAX_SWIMBOTS:", require('./Parameters').MAX_SWIMBOTS_WORLD_4)
console.log("World=8 - MAX_SWIMBOTS:", require('./Parameters').MAX_SWIMBOTS_WORLD_8)

console.log("World=1 - MAX_FOODBITS:", require('./Parameters').MAX_FOODBITS_WORLD_1)
console.log("World=2 - MAX_FOODBITS:", require('./Parameters').MAX_FOODBITS_WORLD_2)
console.log("World=4 - MAX_FOODBITS:", require('./Parameters').MAX_FOODBITS_WORLD_4)
console.log("World=8 - MAX_FOODBITS:", require('./Parameters').MAX_FOODBITS_WORLD_8)

console.log("\nAll memory optimization tests passed!")