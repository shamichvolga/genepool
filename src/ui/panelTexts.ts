//------------------------------------------------------------------------------
// The texts of the panels that need the swimbot objects: built where the
// simulation lives (the main page or the simulation thread, see
// SimulationHost.ts), so the page only shows the finished HTML.
// No DOM here.
//------------------------------------------------------------------------------
import { TWO_PLANT_TYPES } from "../simulation/Ecology";
import { BRAIN_STATE_FLEEING_PREDATOR, BRAIN_STATE_LOOKING_FOR_FOOD, BRAIN_STATE_LOOKING_FOR_MATE, BRAIN_STATE_LOOKING_FOR_PREY, BRAIN_STATE_PURSUING_FOOD, BRAIN_STATE_PURSUING_MATE, BRAIN_STATE_PURSUING_PREY, BRAIN_STATE_RESTING } from "../simulation/Brain";
import { NULL_INDEX } from "../simulation/MathConstants";
import { CANNIBAL_GENE_THRESHOLD, PREDATOR_LEVEL_THRESHOLD, YOUNG_CANNIBALISM_ENABLED } from "../simulation/Parameters";

//------------------------------------------------------------
// a bar: energy of the selected swimbot, with its hunger threshold
//------------------------------------------------------------
export function energyBar( energy, maxEnergy, threshold )
{
    const fill   = Math.max( 0, Math.min( 100, 100 * energy    / Math.max( 1, maxEnergy )));
    const hunger = Math.max( 0, Math.min( 100, 100 * threshold / Math.max( 1, maxEnergy )));
    const color  = ( energy < threshold ) ? "#c8642a" : "#6e9f4c";
    return "<div class='energyBar' title='energy (the mark: hunger threshold)'>"
         +   "<div class='energyFill' style='width:" + fill.toFixed( 1 ) + "%;background:" + color + "'></div>"
         +   "<div class='energyMark' style='left:" + hunger.toFixed( 1 ) + "%'></div>"
         + "</div>";
}

//------------------------------------------------------------
// the card of the selected swimbot (the swimbot tab)
//------------------------------------------------------------
export function buildSwimbotPanelHTML( genePool ): string
{
    const selectedSwimbot = genePool.getSelectedSwimbotID();
    if ( selectedSwimbot === NULL_INDEX ) return "";

    let brainState = genePool.getSwimbotBrainState( selectedSwimbot );
    let mateString = genePool.getSwimbotChosenMate( selectedSwimbot ).toString();
    let goalDescription = "";
    if ( brainState ===  BRAIN_STATE_RESTING            ) { goalDescription = "resting";           }
    else if ( brainState ===  BRAIN_STATE_LOOKING_FOR_MATE   ) { goalDescription = "looking for mate";              }
    else if ( brainState ===  BRAIN_STATE_PURSUING_MATE      ) { goalDescription = "pursuing mate " + mateString;   }
    else if ( brainState ===  BRAIN_STATE_LOOKING_FOR_FOOD   ) { goalDescription = "looking for food bit";          }
    else if ( brainState ===  BRAIN_STATE_PURSUING_FOOD      ) { goalDescription = "pursuing food bit";             }
    else if ( brainState ===  BRAIN_STATE_LOOKING_FOR_PREY   ) { goalDescription = "looking for prey";              }
    else if ( brainState ===  BRAIN_STATE_PURSUING_PREY      ) { goalDescription = "pursuing prey";     }
    else if ( brainState ===  BRAIN_STATE_FLEEING_PREDATOR   ) { goalDescription = "fleeing predator";              }
    let foodPreferenceText = "green";
    let foodTypeText       = "green";
    if ( genePool.getSwimbotPreferredFoodType ( selectedSwimbot ) === 1 ) { foodPreferenceText = "blue"; }
    if ( genePool.getSwimbotDigestibleFoodType( selectedSwimbot ) === 1 ) { foodTypeText       = "blue"; }
    let swimbot = genePool.getSwimbots()[selectedSwimbot];
    let threshold = Math.floor(swimbot.getHungerThreshold());
    let maxEnergy = swimbot.getMaxEnergy();
    let ratioPercent = Math.round((threshold / maxEnergy) * 100);

    const isPredator = swimbot.getPredatorLevel() > PREDATOR_LEVEL_THRESHOLD;
    const row = ( label, value ) => "<tr><td>" + label + "</td><td>" + value + "</td></tr>";

    //------------------------------------------------------------
    // food and climate: the environment pool shows the ecology
    // traits, the classic pools the old food colors
    //------------------------------------------------------------
    let foodRows;
    const environment = genePool.getEnvironment();
    if ( environment.active )
    {
        const position = swimbot.getPosition();
        const here     = environment.temperatureAt( position.x, position.y );
        const percent  = ( x ) => Math.round( x * 100 ) + "%";
        foodRows =
            row( "likes temperature", swimbot.getThermalOptimum().toFixed(2) + " ± " + swimbot.getThermalWidth().toFixed(2) ) +
            row( "temperature here",  here.toFixed(2) + " (suits " + percent( swimbot.getThermalFit() ) + ")" ) +
            ( TWO_PLANT_TYPES ? row( "digests", "green " + percent( swimbot.getDigestionEfficiency(0) ) + " · blue " + percent( swimbot.getDigestionEfficiency(1) ) ) : "" ) +
            row( "brightness",        swimbot.getBrightness().toFixed(2) + " (picky " + percent( swimbot.getChoosiness() ) + ")" );
        const a = swimbot.getAutotomy();
        if ( !isPredator )
        {
            foodRows += row( "drops a part", ( a.bite > 0.01 || a.threat > 0.05 )
                ? percent( a.amount ) + " of body · bitten " + percent( a.bite ) + ( a.threat > 0.05 ? " · when chased" : "" )
                  + ( a.partsLost ? " · <b>missing</b> (" + Math.max( 0, a.regrowIn ) + ")" : "" )
                : "never" );
        }
        else if ( swimbot.getNumPartsEaten() > 0 )
        {
            foodRows += row( "parts eaten", swimbot.getNumPartsEaten() );
        }
        const image = swimbot.getSearchImage();
        if ( isPredator && image && image.strength > 0.05 )
        {
            const swatch = "rgb(" + Math.round( image.red * 255 ) + "," + Math.round( image.green * 255 ) + "," + Math.round( image.blue * 255 ) + ")";
            foodRows += row( "hunts for",
                "<span style='display:inline-block;width:10px;height:10px;background:" + swatch + ";border:1px solid #888'></span> "
                + ( image.size < 0.4 ? "small" : ( image.size > 0.6 ? "big" : "medium" )) + " prey (" + percent( image.strength ) + ")" );
        }
        if ( swimbot.getUsesNeuralBrain() )
        {
            const social = swimbot.getSocialWeight();
            foodRows +=
                row( "brain",         "neural" ) +
                row( "swims",         percent( swimbot.getEffort() ) + " effort" ) +
                row( "climate pull",  percent( swimbot.getClimateWeight() ) ) +
                row( "company",       ( social >= 0 ? "seeks " : "avoids " ) + percent( Math.abs( social ) ) );
        }
    }
    else
    {
        foodRows =
            row( "food preferred",    foodPreferenceText ) +
            row( "food digested best",foodTypeText );
    }

    let swimbotPanelHTML =
        "<div class='swimbotKind " + ( isPredator ? "predator" : "herbivore" ) + "'>" +
            "swimbot " + genePool.getSwimbotIndex(selectedSwimbot) + " · " +
            ( isPredator ? "predator" : "herbivore" ) + " (" + swimbot.getPredatorLevel().toFixed(2) + ")" +
            ( genePool.getSwimbotEternalStatus(selectedSwimbot) ? " · immortal" : "" ) +
        "</div>" +
        energyBar( genePool.getSwimbotEnergy(selectedSwimbot), maxEnergy, threshold ) +
        "<table class='swimbotTable'>" +
        row( "goal",              goalDescription ) +
        row( "age",               genePool.getSwimbotAge(selectedSwimbot) ) +
        row( "energy",            Math.floor(genePool.getSwimbotEnergy(selectedSwimbot)) + " / " + Math.round( maxEnergy ) ) +
        row( "hunger threshold",  threshold + " (" + ratioPercent + "%)" ) +
        row( "segments",          swimbot.getNumParts() ) +
        row( "food eaten",        Math.floor(genePool.getSwimbotNumFoodBitsEaten(selectedSwimbot)) ) +
        row( "prey eaten",        swimbot.getNumPreyEaten() ) +
        row( "offspring",         Math.floor(genePool.getSwimbotNumOffspring(selectedSwimbot)) ) +
        row( "gives a child",     Math.round( swimbot.getInvestment() * 100 ) + "% of its energy" ) +
        ( YOUNG_CANNIBALISM_ENABLED ? row( "eats young", ( swimbot.getCannibalGene() >= CANNIBAL_GENE_THRESHOLD ? "yes (gene " : "no (gene " ) + swimbot.getCannibalGene().toFixed( 2 ) + ")" ) : "" ) +
        ( swimbot.getIsSick() ? row( "sick", "yes" ) : "" ) +
        foodRows +
        row( "attracted to",      genePool.getSwimbotAttractionDescription(selectedSwimbot) ) +
        "</table>";

    return swimbotPanelHTML;
}

//----------------------------------------------------------
// Genetic clusters, not biological species; recounted every 5 seconds.
//----------------------------------------------------------
let _geneticClustersText = "genetic clusters: …";
let _geneticClustersTime = 0;
export function geneticClustersText( genePool )
{
    const now = performance.now();
    if ( now - _geneticClustersTime > 5000 )
    {
        _geneticClustersTime = now;
        const result = genePool.estimateGeneticClusters( 400 );
        _geneticClustersText = "genetic clusters (used genes): " + result.geneticClusters
            + ", largest " + Math.round( result.largestClusterShare * 100 ) + "%";
    }
    return _geneticClustersText;
}



//------------------------------------------------------------
// the family tree as text (pool tab: "print swimbot data")
//------------------------------------------------------------
export function buildFamilyTreeText( genePool ): string
{
    genePool.generatePhyloTree();
    const familyTree = genePool.getFamilyTree();
    const THROTTLE = 5;   // (Luka's change: every 5th swimbot, so it is not too big)
    let f = "";
    for (let n = 0; n < familyTree.getNumNodes(); n += THROTTLE )
    {
        f += "swimbot index: " + n.toString() + "<br>";
        f += "parent 1 index: " + familyTree.getNodeParent1Index(n).toString() + "<br>";
        f += "parent 2 index: " + familyTree.getNodeParent2Index(n).toString() + "<br>";
        f += "birth time: " + familyTree.getNodeBirthTime(n).toString() + "<br>";
        f += "death time: " + familyTree.getNodeDeathTime(n).toString() + "<br>";
        f += "genes: <br>" + Array.from( familyTree.getNodeGenes(n) ).join( ", " ) + "<br><br>";
    }
    return f;
}
