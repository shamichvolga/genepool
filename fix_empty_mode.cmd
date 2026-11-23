@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$candidates = @('%~dp0'.TrimEnd('\'), (Join-Path $env:USERPROFILE 'genepool'), (Join-Path $env:USERPROFILE 'Desktop\genepool'), (Join-Path $env:USERPROFILE 'Documents\genepool'), (Join-Path $env:USERPROFILE 'Downloads\genepool'), (Join-Path $env:USERPROFILE 'source\repos\genepool'), 'C:\genepool', 'D:\genepool', 'E:\genepool');" ^
  "$repo = $null; foreach ($c in $candidates) { if ($c -and (Test-Path (Join-Path $c 'src\simulation\GenePool.ts'))) { $repo = $c; break } }" ^
  "if (-not $repo) { $hit = Get-ChildItem -Path $env:USERPROFILE, 'C:\', 'D:\' -Directory -Depth 2 -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'src\simulation\GenePool.ts') } | Select-Object -First 1; if ($hit) { $repo = $hit.FullName } }" ^
  "if (-not $repo) { Write-Host '[ERROR] GenePool folder not found.' -ForegroundColor Red; exit 1 }" ^
  "Write-Host ('Project folder: ' + $repo) -ForegroundColor Cyan;" ^
  "$lines = Get-Content -LiteralPath '%~f0' -Encoding UTF8;" ^
  "$idx = [Array]::IndexOf($lines, '::JS_START');" ^
  "$js = ($lines[($idx+1)..($lines.Length-1)] -join [Environment]::NewLine);" ^
  "$patchPath = Join-Path $repo '_fix_empty.mjs';" ^
  "Set-Content -LiteralPath $patchPath -Value $js -Encoding UTF8;" ^
  "Set-Location -LiteralPath $repo;" ^
  "node _fix_empty.mjs; if ($LASTEXITCODE -ne 0) { Remove-Item _fix_empty.mjs -Force -ErrorAction SilentlyContinue; git checkout -- src/ 2>$null; exit 1 }" ^
  "Remove-Item _fix_empty.mjs -Force -ErrorAction SilentlyContinue;" ^
  "$env:TEMP = '.tmp'; $env:TMP = '.tmp';" ^
  "npm run build; $buildCode = $LASTEXITCODE;" ^
  "Remove-Item '.tmp' -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "if ($buildCode -ne 0) { Write-Host '[ROLLBACK] Build failed, reverting...' -ForegroundColor Yellow; git checkout -- src/ 2>$null; exit 1 }" ^
  "git add src/;" ^
  "git commit -m 'fix(empty-mode): enable full living soil, oases, plants, and root dynasties in EMPTY mode' | Out-Host;" ^
  "Write-Host ''; Write-Host '========================================================' -ForegroundColor Green;" ^
  "Write-Host '  DONE! EMPTY mode now spawns full groves & root networks! Ctrl+Shift+R' -ForegroundColor Green;" ^
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

patchFile("src/simulation/GenePool.ts", (src) => {
  let out = src;

  // 1. Fund 100% of INITIAL_NUM_FOODBITS at start (accounting for foodBitEnergy & 1.4x grove bonus)
  const oldEnergy = `        const START_FOOD_ENERGY        = INITIAL_NUM_FOODBITS * PLANT_SPROUT_ENERGY * energyMult;`;
  const newEnergy = `        const unitPlantEnergy        = Math.max( PLANT_SPROUT_ENERGY, globalTweakers.foodBitEnergy ) * 1.15;
        const START_FOOD_ENERGY        = INITIAL_NUM_FOODBITS * unitPlantEnergy * Math.max( 1, energyMult );`;
  if (!out.includes(oldEnergy)) throw new Error("START_FOOD_ENERGY anchor not found");
  out = out.replace(oldEnergy, newEnergy);

  // 2. Enable full living soil/oases/plants environment in SimulationStartMode.EMPTY (with 0 swimbots)
  const oldEnv = `        const petri = ( mode === SimulationStartMode.PETRI );
        environment.active = ( mode === SimulationStartMode.RANDOM ) || petri;`;
  const newEnv = `        const petri = ( mode === SimulationStartMode.PETRI );
        const empty = ( mode === SimulationStartMode.EMPTY );
        environment.active = ( mode === SimulationStartMode.RANDOM ) || petri || empty;`;
  if (!out.includes(oldEnv)) throw new Error("environment.active anchor not found");
  out = out.replace(oldEnv, newEnv);

  // 3. Set _numSwimbots = 0 when empty mode is active
  const oldBots = `            _numSwimbots = Math.min( MAX_SWIMBOTS, Math.max( 0, Math.floor( INITIAL_NUM_SWIMBOTS )));`;
  const newBots = `            _numSwimbots = empty ? 0 : Math.min( MAX_SWIMBOTS, Math.max( 0, Math.floor( INITIAL_NUM_SWIMBOTS )));`;
  if (!out.includes(oldBots)) throw new Error("_numSwimbots anchor not found");
  out = out.replace(oldBots, newBots);

  // 4. Do not overwrite oasis groves with randomizeFood() in EMPTY mode
  const oldEmptyBranch = `        else if ( mode === SimulationStartMode.EMPTY )
        {
            _numSwimbots = 0;
            this.randomizeFood();   // empty pool: oases + starter groves, no animals
        }`;
  const newEmptyBranch = `        else if ( mode === SimulationStartMode.EMPTY )
        {
            _numSwimbots = 0;   // living oases, groves, trees & root dynasties with no animals
        }`;
  if (!out.includes(oldEmptyBranch)) throw new Error("EMPTY branch anchor not found");
  out = out.replace(oldEmptyBranch, newEmptyBranch);

  return out;
});

console.log("EMPTY mode & initial plant funding updated successfully!");
