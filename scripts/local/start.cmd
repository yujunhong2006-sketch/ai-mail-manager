@echo off
chcp 65001 >nul
node "%~dp0launch.mjs"
if errorlevel 1 pause
