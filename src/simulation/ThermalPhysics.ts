const REFERENCE_BODY_MASS = 450;
const REFERENCE_BODY_WIDTH = 3.5;
const REFERENCE_EXCHANGE_RATE_PER_STEP = 0.002;

function clamp( value: number, min: number, max: number ): number
{
    return Math.max( min, Math.min( max, value ));
}

// A simple Newton-style heat exchange model for this normalized, 2D world.
// Mass and width change how quickly internal temperature approaches the local
// felt-temperature signal; this function does not produce heat on its own.
export function advanceBodyTemperature( bodyTemperature: number, ambientTemperature: number, bodyMass: number, meanBodyWidth: number ): number
{
    if ( !Number.isFinite( ambientTemperature ) ) return 0.5;
    if ( !Number.isFinite( bodyTemperature ) ) return clamp( ambientTemperature, 0, 1 );
    if ( !( bodyMass > 0 ) || !( meanBodyWidth > 0 ) ) return clamp( ambientTemperature, 0, 1 );

    // In this 2D simulation, mass × mean width is a rough 3D volume proxy.
    const relativeVolume = clamp(
        ( bodyMass / REFERENCE_BODY_MASS ) * ( meanBodyWidth / REFERENCE_BODY_WIDTH ),
        0.25,
        4
    );
    const exchangeRate = REFERENCE_EXCHANGE_RATE_PER_STEP * Math.pow( relativeVolume, -1 / 3 );
    const exchangeFraction = 1 - Math.exp( -exchangeRate );
    return clamp( bodyTemperature + ( ambientTemperature - bodyTemperature ) * exchangeFraction, 0, 1 );
}
