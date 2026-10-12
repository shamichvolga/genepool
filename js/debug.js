function debugSwimbot(id = selectedSwimbot) {
    const s = genePool.getSwimbots()[id];
    console.log('has getMaxEnergy?', typeof s.getMaxEnergy);
    console.log('numParts', s.getNumParts());
    console.log('maxEnergy', s.getMaxEnergy?.());
}