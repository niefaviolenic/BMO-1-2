@echo off
title BMO Serial Monitor (COM7)
echo ==========================================
echo   BMO Serial Monitor - COM7 (115200)
echo   Tekan [Ctrl] + []] untuk keluar
echo ==========================================
echo.
python -m serial.tools.miniterm COM7 115200
pause
