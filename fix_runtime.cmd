@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$candidates = @('%~dp0'.TrimEnd('\'), (Join-Path $env:USERPROFILE 'genepool'), (Join-Path $env:USERPROFILE 'Desktop\genepool'), (Join-Path $env:USERPROFILE 'Documents\genepool'), (Join-Path $env:USERPROFILE 'Downloads\genepool'), (Join-Path $env:USERPROFILE 'source\repos\genepool'), 'C:\genepool', 'D:\genepool', 'E:\genepool');" ^
  "$repo = $null; foreach ($c in $candidates) { if ($c -and (Test-Path (Join-Path $c 'src\simulation\Swimbot.ts'))) { $repo = $c; break } }" ^
  "if (-not $repo) { $hit = Get-ChildItem -Path $env:USERPROFILE, 'C:\', 'D:\' -Directory -Depth 2 -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'src\simulation\Swimbot.ts') } | Select-Object -First 1; if ($hit) { $repo = $hit.FullName } }" ^
  "if (-not $repo) { Write-Host '[ERROR] GenePool folder not found.' -ForegroundColor Red; exit 1 }" ^
  "Write-Host ('Project folder: ' + $repo) -ForegroundColor Cyan;" ^
  "$lines = Get-Content -LiteralPath '%~f0' -Encoding UTF8;" ^
  "$idx = [Array]::IndexOf($lines, '::JS_START');" ^
  "$js = ($lines[($idx+1)..($lines.Length-1)] -join [Environment]::NewLine);" ^
  "$patchPath = Join-Path $repo '_fix_runtime.mjs';" ^
  "Set-Content -LiteralPath $patchPath -Value $js -Encoding UTF8;" ^
  "Set-Location -LiteralPath $repo;" ^
  "node _fix_runtime.mjs; if ($LASTEXITCODE -ne 0) { Remove-Item _fix_runtime.mjs -Force -ErrorAction SilentlyContinue; exit 1 }" ^
  "Remove-Item _fix_runtime.mjs -Force -ErrorAction SilentlyContinue;" ^
  "$env:TEMP = '.tmp'; $env:TMP = '.tmp';" ^
  "npm run build; $buildCode = $LASTEXITCODE;" ^
  "Remove-Item '.tmp' -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "if ($buildCode -ne 0) { exit 1 }" ^
  "git add src/;" ^
  "git commit -m 'fix(runtime): restore Swimbot.updateBodyParts for spawn and guard genePool in updateUI' | Out-Host;" ^
  "Write-Host ''; Write-Host '========================================================' -ForegroundColor Green;" ^
  "Write-Host '  DONE! Simulation & UI fixed. Refresh Ctrl+Shift+R' -ForegroundColor Green;" ^
  "Write-Host '========================================================' -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo [ERROR] Script aborted. See message above.
  pause
  exit /b 1
)

pause
exit /b 0
::JS_START
import fs from "node:fs";

function patchFile(file, replacer) {
  const raw = fs.readFileSync(file, "utf8");
  const norm = raw.replace(/\r\n/g, "\n");
  const next = replacer(norm);
  if (next === norm) {
    throw new Error("Anchor not found in " + file);
  }
  fs.writeFileSync(file, next, "utf8");
  console.log("OK: " + file);
}

// 1. Restore updateBodyParts in src/simulation/Swimbot.ts (needed by processPhenotype on spawn/zap)
patchFile("src/simulation/Swimbot.ts", (src) => {
  if (src.includes("this.updateBodyParts = function()")) {
    return src;
  }
  const anchor = "\t//------------------------------------------------------------------\n\t// copy the Part objects (fresh from embryology) into the arrays";
  if (!src.includes(anchor)) {
    throw new Error("Swimbot loadPartArrays anchor not found");
  }

  const updateBodyPartsCode = `\t//-----------------------------------------
\t// update body parts (used at spawn / processPhenotype & standalone tests)
\t//-----------------------------------------
\tthis.updateBodyParts = function()
\t{
        let oldAgeThreshold = this.getOldAgeThreshold();

        if (( _B[ _b + SS.B_AGE ] < oldAgeThreshold ) || ( _B[ _b + SS.B_ETERNAL ] === 1 ) )
        {
            if ( _B[ _b + SS.B_AGE ] < YOUNG_AGE_DURATION )
            {
                _B[ _b + SS.B_GROWTH ] = _B[ _b + SS.B_AGE ] / YOUNG_AGE_DURATION;
            }
            else
            {
                _B[ _b + SS.B_GROWTH ] = ONE;
            }

            if ( _B[ _b + SS.B_ENERGY ] < STARVING )
            {
                _B[ _b + SS.B_TIMER_DELTA ] = _B[ _b + SS.B_ENERGY ] / STARVING;
                if ( _B[ _b + SS.B_TIMER_DELTA ] < STARVING_TIMER_DELTA )
                {
                    _B[ _b + SS.B_TIMER_DELTA ] = STARVING_TIMER_DELTA;
                }
            }
            else
            {
                _B[ _b + SS.B_TIMER_DELTA ] += TIMER_DELTA_INCREASE_RATE;
                if ( _B[ _b + SS.B_TIMER_DELTA ] > ONE )
                {
                    _B[ _b + SS.B_TIMER_DELTA ] = ONE;
                }
            }
        }
        else
        {
            if ( _B[ _b + SS.B_AGE ] > globalTweakers.maximumLifeSpan )
            {
                this.die( "old_age" );
            }
            else
            {
                _B[ _b + SS.B_TIMER_DELTA ] = ONE - ( _B[ _b + SS.B_AGE ] - oldAgeThreshold ) / OLD_AGE_DURATION;
            }
        }

        _B[ _b + SS.B_TIMER ] += _B[ _b + SS.B_TIMER_DELTA ] * _B[ _b + SS.B_EFFORT ];

\t\tlet radian = _B[ _b + SS.B_ANGLE ] * PI_OVER_180;
\t\tconst hx = Math.sin( radian );
\t\tconst hy = Math.cos( radian );
\t\tlet perpX =  hy;
\t\tlet perpY = -hx;

        let directionDot = _focusDirection.x * perpX + _focusDirection.y * perpY;

\t\tconst pd = _pd;
\t\tpd[ ROOT_PART * PS + P_X ] = _position.x;
\t\tpd[ ROOT_PART * PS + P_Y ] = _position.y;
\t\tpd[ ROOT_PART * PS + C_A ] = _B[ _b + SS.B_ANGLE ] - this.getMomentAdjustment();

\t\tfor (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
\t\t{
\t\t\tconst i      = p * PS;
\t\t\tconst parent = _pParent[p];
\t\t\tconst j      = parent * PS;

\t\t\tif ( parent == NULL_PART )
\t\t\t{
\t\t\t\tpd[ i + P_X ] = _position.x;
\t\t\t\tpd[ i + P_Y ] = _position.y;
\t\t\t}
\t\t\telse
\t\t\t{
\t\t\t\tpd[ i + P_X ] = pd[ j + P_X ];
\t\t\t\tpd[ i + P_Y ] = pd[ j + P_Y ];
\t\t\t}

\t\t\tpd[ i + C_A ] = pd[ j + C_A ] + _pAngle[p];

\t\t\tif ( p > 1 )
\t\t\t{
\t\t\t\tlet ampModulator   = _pTurnAmp  [p] * directionDot;
\t\t\t\tlet phaseModulator = _pTurnPhase[p] * directionDot;

\t\t\t\tlet partRadian = _B[ _b + SS.B_TIMER ] * _B[ _b + SS.B_FREQUENCY ] + ( _pPhase[p] + phaseModulator );
\t\t\t\tpd[ i + B_A ] = ( _pAmp[p] + ampModulator ) * Math.sin( partRadian );

\t\t\t\tpd[ i + C_A ] += pd[ i + B_A ];
\t\t\t}

\t\t\tlet partAngleRad = pd[ i + C_A ] * PI_OVER_180;
\t\t\tlet length = _pLength[p];

\t\t\tif ( _B[ _b + SS.B_AGE ] < YOUNG_AGE_DURATION )
\t\t\t{
                const sizeScale = NEWBORN_SIZE_SCALE + ( 1 - NEWBORN_SIZE_SCALE ) * _B[ _b + SS.B_GROWTH ];
                length *= sizeScale;
\t\t\t}

\t\t\tlet x = length * Math.sin( partAngleRad );
\t\t\tlet y = length * Math.cos( partAngleRad );
\t\t\tpd[ i + Q_X ] = pd[ i + M_X ];
\t\t\tpd[ i + Q_Y ] = pd[ i + M_Y ];
\t\t\tpd[ i + M_X ] = pd[ i + P_X ];
\t\t\tpd[ i + M_Y ] = pd[ i + P_Y ];
\t\t\tpd[ i + P_X ] += x;
\t\t\tpd[ i + P_Y ] += y;
\t\t\tpd[ i + M_X ] += x * ONE_HALF;
\t\t\tpd[ i + M_Y ] += y * ONE_HALF;

            pd[ i + A_X ] = pd[ i + P_X ] - pd[ j + P_X ];
            pd[ i + A_Y ] = pd[ i + P_Y ] - pd[ j + P_Y ];
            pd[ i + N_X ] =  pd[ i + A_Y ] / length;
            pd[ i + N_Y ] = -pd[ i + A_X ] / length;

            pd[ i + V_X ] = pd[ i + M_X ] - pd[ i + Q_X ];
            pd[ i + V_Y ] = pd[ i + M_Y ] - pd[ i + Q_Y ];
\t\t}

\t\tthis.calculateCenterOfMass();
        this.adjustToCenterOfMass();
\t\tthis.calculateCenterOfMass();

\t\tif ( _B[ _b + SS.B_AGE ] % 20 === 0 )
\t\t{
            for (let p=1; p<_B[ _b + SS.B_NUM_PARTS ]; p++)
            {
                for (let o=1; o<_B[ _b + SS.B_NUM_PARTS ]; o++)
                {
                    if ( o != p )
                    {
                        let xx = pd[ p * PS + P_X ] - pd[ o * PS + P_X ];
                        let yy = pd[ p * PS + P_Y ] - pd[ o * PS + P_Y ];
                        let distance = Math.sqrt( xx * xx + yy * yy );
                        distance = SWIMBOT_SELECT_RADIUS_SCALAR * Math.sqrt( distance );
                        if ( distance > _B[ _b + SS.B_SELECT_RADIUS ] )
                        {
                            _B[ _b + SS.B_SELECT_RADIUS ] = distance;
                        }
                    }
                }
            }
\t\t}
\t}

`;

  return src.replace(anchor, updateBodyPartsCode + anchor);
});

// 2. Guard renderPlantInspector in src/ui/ui.ts when genePool is not yet initialized
patchFile("src/ui/ui.ts", (src) => {
  const target = `    renderPlantInspector( plantPanel, genePool );`;
  const replacement = `    if ( genePoolIsDefined ) { renderPlantInspector( plantPanel, genePool ); }`;
  if (!src.includes(target)) {
    throw new Error("ui.ts renderPlantInspector call not found");
  }
  return src.replace(target, replacement);
});

console.log("Runtime fixes applied!");
