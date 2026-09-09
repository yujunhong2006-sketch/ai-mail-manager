@echo off
chcp 65001 >nul
node "%~dp0launch.mjs" --stop
if errorlevel 1 pause
