//------------------------------------------------------------------------------
// PlantInspectorUI — the plant card in the inspector tab: stage, energy,
// wood, age, lineage, suction and root flow, plus three test buttons.
// Strictly DOM: reads from the shared state, calls back through the pool.
//------------------------------------------------------------------------------
const stageName = ( e: number, w: number ): string =>
    ( e >= 42 ) ? "12-ray tree" : ( w >= 24 ) ? "grown bush" : ( e >= 22 ) ? "adult bush" : ( e >= 10 ) ? "young shoot" : "sprout";

const pad = ( n: number, d: number ): string => String( Math.round( n * 10 ** d ) / 10 ** d );

export function renderPlantInspector( panel: any, pool: any, st: any ): boolean
{
    const f = st.selectedPlantIndex;
    if ( !( f >= 0 ) || st.liveFood[ f ] !== 1 )
    {
        panel.classList.remove( "has-plant" );
        panel.style.display = "none";
        return false;
    }
    panel.classList.add( "has-plant" );
    panel.style.display = "block";

    const e = st.foodEnergy[ f ], w = st.foodWood[ f ], age = st.plantAge[ f ] ?? 0;
    const maxE = 95;
    let kids = 0;
    for ( let c = 0; c < st.plantParent.length; c++ ) { if ( st.plantParent[ c ] === f ) kids ++; }
    // Count grandchildren and deeper descendants (2+ generations)
    let grandkids = 0;
    const visited = new Set<number>([ f ]);
    const queue: number[] = [ f ];
    let depth = 0;
    while ( queue.length > 0 && depth < 32 )
    {
        const current = queue.shift()!;
        for ( let c = 0; c < st.plantParent.length; c++ )
        {
            if ( st.plantParent[ c ] === current && !visited.has( c ) )
            {
                visited.add( c );
                if ( depth >= 1 ) grandkids++;  // Only count 2+ generations
                queue.push( c );
            }
        }
        depth++;
    }
    const suck = st.foodSucking[ f ] || 0;
    const flow = st.plantRootFlow[ f ] || 0;

    const html = `
        <div class="plant-card">
            <div class="plant-card-head"><strong>Plant #${f}</strong> · ${stageName( e, w )}</div>
            <div class="plant-card-body">
                <div class="plant-card-row">Energy <span>${pad( e, 1 )}</span> / ${maxE} <div class="bar"><i style="width:${Math.min( 100, e / maxE * 100 )}%"></i></div></div>
                <div class="plant-card-row">Wood <span>${pad( w, 1 )}</span></div>
                <div class="plant-card-row">Age <span>${Math.round( age )}</span> steps</div>
                <div class="plant-card-row">Children <span>${kids}</span></div>
                <div class="plant-card-row">Grandchildren+ <span>${grandkids}</span></div>
                <div class="plant-card-row">Suction <span>${pad( suck, 3 )}</span>/step</div>
                <div class="plant-card-row">Root flow <span>${pad( flow, 3 )}</span></div>
            </div>
            <div class="plant-card-actions">
                <button class="btn-plant-fertilize">Fertilize +50</button>
                <button class="btn-plant-grow">Grow to tree</button>
                <button class="btn-plant-remove">Remove</button>
            </div>
        </div>`;
    if ( panel.innerHTML !== html ) { panel.innerHTML = html; }
    const q = ( sel: string ) => panel.querySelector( sel );
    q( ".btn-plant-fertilize" )?.addEventListener( "click", () => { pool.fertilizePlant( f ); }, { once: false } );
    q( ".btn-plant-grow" )?.addEventListener( "click", () => { pool.growPlant( f ); }, { once: false } );
    q( ".btn-plant-remove" )?.addEventListener( "click", () => { pool.removePlant( f ); }, { once: false } );
    return true;
}