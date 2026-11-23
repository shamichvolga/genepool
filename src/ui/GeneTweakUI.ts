//------------------------------------------------------------------------------
// GeneTweakUI — floating per-category gene slider popup extracted from ui.ts.
//------------------------------------------------------------------------------
import { tr } from "./lang";

let _tweakGenesCategory = 0;

export function openTweakGenesPanel( selectedSwimbotID: number ): void
{
    if ( selectedSwimbotID != -1 )
    {
        const panel = document.getElementById( "tweakGenesPanel" )!;
        panel.style.visibility = "visible";
        panel.style.display = "block";
        document.getElementById( "closeTweakGenesPanel" )!.style.display = "block";
        let html = "<div id = 'tweakGenesTitle' >" + tr( "Tweak the genes of swimbot" ) + " " + selectedSwimbotID + "</div>";
        html += "<div id = 'tweakGenesCategoryNote' >" + tr( "(choose which limb type to tweak)" ) + "</div>";
        const numCategories = genePool.getNumGeneCategories();
        for ( let c = 0; c < numCategories; c++ )
        {
            html += "<div id = 'category" + ( c + 1 ) + "' >" + ( c + 1 )
                 +  "<input type = 'radio' id = 'geneTweakerCategory" + c + "' name = 'geneTweakerCategory'"
                 +  " oninput = 'setGeneTweakCategory( " + selectedSwimbotID + ", " + c + ")'"
                 +  " onchange = 'setGeneTweakCategory( " + selectedSwimbotID + ", " + c + ")' ></div>";
        }
        let num = genePool.getNumGenesPerCategory() + 2;
        const width = 150;
        for ( let g = 0; g < num; g++ )
        {
            const geneTweakerName  = genePool.getGeneName( g );
            const geneTweakerValue = genePool.getGeneValue( selectedSwimbotID, g );
            const top = 60 + g * 20 + ( g > 1 ? 80.0 : 0 );
            html += "<div class = 'geneTweakerValue' id = 'gene" + g + "Value' style = 'top:" + top + "px;'>" + geneTweakerValue + "</div>";
            html += "<input style = 'top:" + ( top - 3 ) + "px; width:" + width + "px;' type = 'range' class = 'geneTweakerSlider' min = '0' max = '255'"
                 +  " value = '" + geneTweakerValue + "' id = 'geneTweaker" + g + "' name = 'geneTweaker' step = 1 autocomplete = 'off'"
                 +  " oninput = 'tweakGene( " + selectedSwimbotID + ", " + g + ")' >";
            html += "<div class = 'geneTweakerName' style = 'top:" + top + "px;'>" + tr( geneTweakerName ) + "</div>";
        }
        panel.innerHTML = html;
        _tweakGenesCategory = 0;
        const radioButtons = document.getElementsByName( "geneTweakerCategory" ) as NodeListOf<HTMLInputElement>;
        for ( let i = 0; i < radioButtons.length; i++ ) { radioButtons[i].checked = ( i === _tweakGenesCategory ); }
    }
    else
    {
        closeTweakGenesPanel();
    }
}

export function closeTweakGenesPanel(): void
{
    const panel = document.getElementById( "tweakGenesPanel" );
    if ( panel ) { panel.style.visibility = "hidden"; panel.style.display = "none"; }
    const closeBtn = document.getElementById( "closeTweakGenesPanel" );
    if ( closeBtn ) { closeBtn.style.display = "none"; }
}

export function updateGeneSliders( selectedSwimbotID: number ): void
{
    const num = genePool.getNumGenesPerCategory() + 2;
    for ( let g = 0; g < num; g++ )
    {
        let geneIndex = g;
        if ( g > 1 ) { geneIndex += genePool.getNumGenesPerCategory() * _tweakGenesCategory; }
        const geneTweakerValue = genePool.getGeneValue( selectedSwimbotID, geneIndex );
        const slider = document.getElementById( "geneTweaker" + g ) as HTMLInputElement | null;
        if ( slider ) slider.value = String( geneTweakerValue );
        const label = document.getElementById( "gene" + g + "Value" );
        if ( label ) label.innerHTML = String( geneTweakerValue );
    }
}

export function setGeneTweakCategory( selectedSwimbotID: number, c: number ): void
{
    _tweakGenesCategory = c;
    updateGeneSliders( selectedSwimbotID );
}

export function tweakGene( swimbotIndex: number, sliderIndex: number ): void
{
    let geneIndex = sliderIndex;
    if ( sliderIndex > 1 ) { geneIndex += genePool.getNumGenesPerCategory() * _tweakGenesCategory; }
    const input = document.getElementById( "geneTweaker" + sliderIndex ) as HTMLInputElement;
    const geneValue = input.value;
    genePool.tweakGene( swimbotIndex, geneIndex, geneValue );
    document.getElementById( "gene" + sliderIndex + "Value" )!.innerHTML = geneValue;
}

export function notifyGeneTweakPanelMouseDown(): void
{
    const selectedSwimbotID = genePool.getSelectedSwimbotID();
    if ( selectedSwimbotID === -1 ) { closeTweakGenesPanel(); }
    else if ( document.getElementById( "tweakGenesPanel" )?.style.display === "block" )
    {
        openTweakGenesPanel( selectedSwimbotID );
    }
}
