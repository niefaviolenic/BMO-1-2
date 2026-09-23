@echo off
title BMO Serial Monitor (COM5)
echo ==========================================
echo   BMO Serial Monitor - COM5 (115200)
echo   Tekan [Ctrl] + []] untuk keluar
echo ==========================================
echo.
python -m serial.tools.miniterm COM5 115200
pause
