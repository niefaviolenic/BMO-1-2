@echo off
title BMO Serial Monitor (COM7)
echo ==========================================
echo   BMO Serial Monitor - COM7 (115200)
echo   Tekan [Ctrl] + []] untuk keluar
echo ==========================================
echo.
C:\Users\violenic\.espressif\python_env\idf6.0_py3.13_env\Scripts\python.exe -m serial.tools.miniterm COM7 115200
pause
