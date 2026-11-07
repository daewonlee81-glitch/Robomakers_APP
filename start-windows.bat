@echo off
chcp 65001 > nul
title RoboMakers WordBlock
echo 로보메이커스 워드블럭을 시작합니다... (이 창을 닫으면 종료)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\server.ps1"
pause
