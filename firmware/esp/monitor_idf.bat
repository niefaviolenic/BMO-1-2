@echo off
title ESP-IDF Serial Monitor (COM7)
echo ==========================================
echo   ESP-IDF Serial Monitor - COM7
echo   Tekan [Ctrl] + []] untuk keluar
echo ==========================================
echo.
powershell -ExecutionPolicy Bypass -NoExit -Command ". C:\esp\v6.0.1\esp-idf\export.ps1; idf.py -p COM7 monitor"
