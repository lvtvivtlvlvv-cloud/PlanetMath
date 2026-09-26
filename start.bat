@echo off
cd /d "%~dp0"
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$code = [System.IO.File]::ReadAllText('%~dp0setup.ps1', [System.Text.Encoding]::UTF8); Invoke-Expression $code"
pause