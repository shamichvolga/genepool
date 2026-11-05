//------------------------------------------------------------------------------
// The closed energy cycle (concept: docs/концепт_деревья_и_почва_v2..v4).
//
// One global pool, the "atmosphere". Every energy loss of the world
// (metabolism, swimming, digestion losses, rot) returns here; every new plant
// and every body that becomes meat is funded from here. With the flag on,
// world energy (atmosphere + plants + meat + swimbots) is constant; with it
// off, every function behaves as if there were no pool (the old rules).
//
// All credits and debits go through these two functions, so a broken
// conservation invariant can be chased by logging in exactly one place.
//------------------------------------------------------------------------------
import { CLOSED_ENERGY_CYCLE_ENABLED } from "./Parameters";

let atmosphereEnergy = 0;

// how much the pool has paid out / taken in, for diagnostics
export const energyBudgetCounters = { photosynthesis: 0, bodiesFunded: 0, returned: 0 };

export function resetAtmosphere( amount: number ): void
{
    atmosphereEnergy = Math.max( 0, amount );
    energyBudgetCounters.photosynthesis = 0;
    energyBudgetCounters.bodiesFunded   = 0;
    energyBudgetCounters.returned       = 0;
}

export function getAtmosphereEnergy(): number { return atmosphereEnergy; }

// a meal or any other handover: the receiver may keep less than was removed
// (the loss returns to the pool) or, when the rules pay a bonus (a mature
// plant is worth more than its stored energy), the pool funds the difference.
// Returns what the receiver actually gets.
export function settleEnergyTransfer( removed: number, gained: number ): number
{
    if ( !CLOSED_ENERGY_CYCLE_ENABLED ) return gained;
    if ( gained <= removed ) { transferToAtmosphere( removed - gained ); return gained; }
    return removed + drawFromAtmosphere( gained - removed );
}

export function transferToAtmosphere( amount: number ): void
{
    if ( !CLOSED_ENERGY_CYCLE_ENABLED || !( amount > 0 )) return;
    atmosphereEnergy += amount;
    energyBudgetCounters.returned += amount;
}

// photosynthesis and body funding: never more than the pool holds
// (auto-throttling: an empty pool means no new growth)
export function drawFromAtmosphere( requested: number ): number
{
    if ( !CLOSED_ENERGY_CYCLE_ENABLED ) return requested;
    if ( !( requested > 0 )) return 0;
    const drawn = Math.min( requested, atmosphereEnergy );
    atmosphereEnergy -= drawn;
    energyBudgetCounters.photosynthesis += drawn;
    return drawn;
}
