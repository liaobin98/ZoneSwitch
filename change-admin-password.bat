@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0"
if errorlevel 1 exit /b 1

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node.js 并重新打开脚本。
  popd
  pause
  exit /b 1
)

node "scripts\change-admin-password.mjs"
set "result=%errorlevel%"
echo.
pause
popd
exit /b %result%
