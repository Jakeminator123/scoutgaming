@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Labb.ps1" %*
set "LAB_START_EXIT=%ERRORLEVEL%"
if not "%LAB_START_EXIT%"=="0" pause
exit /b %LAB_START_EXIT%
