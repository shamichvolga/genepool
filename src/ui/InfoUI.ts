//------------------------------------------------------------------------------
// InfoUI — info manual pagination and keyboard help overlay extracted from ui.ts.
//------------------------------------------------------------------------------
import { getInfoText } from "./info";
import { tr } from "./lang";

export const FIRST_INFO_PAGE = 1;
export const LAST_INFO_PAGE  = 28;

export let _currentInfoPage = FIRST_INFO_PAGE;

export function openInfoPanel(): void
{
    document.getElementById( "infoPanel" )?.classList.add( "active" );
    setInfoPage( _currentInfoPage );
}

export function advanceInfoPage( increment: number ): void
{
    _currentInfoPage = Math.max( FIRST_INFO_PAGE, Math.min( LAST_INFO_PAGE, _currentInfoPage + increment ));
    setInfoPage( _currentInfoPage );
}

export function setInfoPage( pageNumber: number ): void
{
    _currentInfoPage = Math.max( FIRST_INFO_PAGE, Math.min( LAST_INFO_PAGE, pageNumber ));
    const label = document.getElementById( "pageNumberLabel" );
    if ( label ) label.innerHTML = tr( "page" ) + " " + _currentInfoPage + " " + tr( "of" ) + " " + LAST_INFO_PAGE;
    const text = document.getElementById( "infoText" );
    if ( text ) text.innerHTML = getInfoText( _currentInfoPage );
    const prev = document.getElementById( "prevInfoButton" );
    if ( prev ) prev.style.visibility = ( _currentInfoPage === FIRST_INFO_PAGE ) ? "hidden" : "visible";
    const next = document.getElementById( "nextInfoButton" );
    if ( next ) next.style.visibility = ( _currentInfoPage === LAST_INFO_PAGE ) ? "hidden" : "visible";
}

export function toggleHelp(): void
{
    document.body.classList.toggle( "helpShown" );
}
