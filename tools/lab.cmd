@echo off
rem Runs a lab experiment detached from the chat: tools\lab.cmd larva  (= tools\lab\larva.json)
cd /d "%~dp0.."
start "" /b cmd /c "node tools\lab.cjs tools\lab\%1.json > tools\results\lab-%1.log 2>&1"
