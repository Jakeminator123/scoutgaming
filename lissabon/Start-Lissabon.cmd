@echo off
cd /d "%~dp0.."
node lissabon/start.mjs
if errorlevel 1 pause
