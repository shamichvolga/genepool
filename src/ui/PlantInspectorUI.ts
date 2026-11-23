//------------------------------------------------------------------------------
// PlantInspectorUI — the plant card: stage, energy, wood, age, parent,
// children (1st gen), grandchildren+ (2+ gen), suction and root flow.
// Works seamlessly with both RemotePool (worker snapshot) and local SharedState.
//------------------------------------------------------------------------------
import { computePlantLineage } from "../simulation/RootNetwork";

const stageName = ( e: number, w: number ): string =>
    ( e >= 42 ) ? "12-ray tree" : ( w >= 24 ) ? "grown bush" : ( e >= 22 ) ? "adult bush" : ( e >= 10 ) ? "young shoot" : "sprout";

const pad = ( n: number, d: number ): string => String( Math.round( n * 10 ** d ) / 10 ** d );

export function renderPlantInspector( panel: any, pool: any, st?: any ): boolean
{
    if ( !panel ) return false;

    let data: any = ( pool && pool.getSelectedPlant ) ? pool.getSelectedPlant() : null;
    if ( !data && st && st.selectedPlantIndex >= 0 && st.liveFood[ st.selectedPlantIndex ] === 1 )
    {
        const f = st.selectedPlantIndex;
        const lineage = computePlantLineage( st.plantParent, st.liveFood, f );
        data = {
            index: f,
            energy: st.foodEnergy[ f ],
            wood: st.foodWood[ f ],
            age: st.plantAge[ f ] ?? 0,
            sucking: st.foodSucking[ f ] || 0,
            sapFlow: st.plantRootFlow[ f ] || 0,
            parent: lineage.parent,
            childrenCount: lineage.children.length,
            grandchildrenCount: lineage.grandchildren.length,
            maxDepth: lineage.maxDepth,
        };
    }

    if ( !data )
    {
        panel.classList.remove( "has-plant" );
        panel.style.display = "none";
        return false;
    }

    panel.classList.add( "has-plant" );
    panel.style.display = "block";

    const f = data.index;
    const e = data.energy || 0;
    const w = data.wood || 0;
    const maxE = 95;
    const parentLabel = data.parent >= 0 ? `#${data.parent}` : "root founder";

    const html = `
        <div class="plant-card">
            <div class="plant-card-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border-bottom:1px solid rgba(135,225,95,0.35);padding-bottom:4px;">
                <span><strong>Plant #${f}</strong> · ${stageName( e, w )}</span>
                <button class="btn-plant-close" style="background:none;border:none;color:#cfd;cursor:pointer;font-size:14px;">✕</button>
            </div>
            <div class="plant-card-body" style="display:grid;gap:3px;">
                <div class="plant-card-row">Energy: <b>${pad( e, 1 )}</b> / ${maxE}</div>
                <div class="plant-card-row">Wood: <b>${pad( w, 1 )}</b> · Age: <b>${Math.round( data.age || 0 )}</b></div>
                <div class="plant-card-row">Parent: <b>${parentLabel}</b></div>
                <div class="plant-card-row" style="color:#9eff8a;">Children (1st gen): <b>${data.childrenCount}</b></div>
                <div class="plant-card-row" style="color:#6ceeff;">Grandchildren+ (2+ gen): <b>${data.grandchildrenCount}</b> (depth ${data.maxDepth})</div>
                <div class="plant-card-row">Suction: <b>${pad( data.sucking || 0, 3 )}</b>/step · Flow: <b>${pad( data.sapFlow || 0, 3 )}</b></div>
            </div>
            <div class="plant-card-actions" style="display:flex;gap:4px;margin-top:8px;">
                <button class="btn-plant-fertilize" style="flex:1;padding:4px;cursor:pointer;">Fertilize +50</button>
                <button class="btn-plant-grow" style="flex:1;padding:4px;cursor:pointer;">Grow tree</button>
                <button class="btn-plant-remove" style="padding:4px 6px;cursor:pointer;">Remove</button>
            </div>
        </div>`;
    if ( panel.innerHTML !== html ) { panel.innerHTML = html; }
    panel.querySelector( ".btn-plant-close" )?.addEventListener( "click", () => { pool.setSelectedPlantIndex?.( -1 ); panel.style.display = "none"; });
    panel.querySelector( ".btn-plant-fertilize" )?.addEventListener( "click", () => { pool.fertilizePlant?.( f ); });
    panel.querySelector( ".btn-plant-grow" )?.addEventListener( "click", () => { pool.growPlant?.( f ); });
    panel.querySelector( ".btn-plant-remove" )?.addEventListener( "click", () => { pool.removePlant?.( f ); });
    return true;
}
