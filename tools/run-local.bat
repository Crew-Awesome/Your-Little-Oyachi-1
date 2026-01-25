@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT=%%~fI"

set "SERVE_DIR="
if exist "%ROOT%\index.html" set "SERVE_DIR=%ROOT%"
if not defined SERVE_DIR if exist "%ROOT%\build\game-export\index.html" set "SERVE_DIR=%ROOT%\build\game-export"
if not defined SERVE_DIR (
  for /r "%ROOT%" %%F in (index.html) do (
    if not defined SERVE_DIR set "SERVE_DIR=%%~dpF"
  )
)

if not defined SERVE_DIR (
  echo No index.html found. Cannot start server.
  exit /b 1
)

if "%SERVE_DIR:~-1%"=="\" set "SERVE_DIR=%SERVE_DIR:~0,-1%"

call :pickPort
if not defined PORT (
  echo No available port found. Tried 5173-5175.
  exit /b 1
)

set "URL=http://localhost:%PORT%/"

pushd "%SERVE_DIR%"

set "SERVER_CMD="
where node >nul 2>nul && set "SERVER_CMD=npx http-server . -p %PORT% -c-1"
if not defined SERVER_CMD (
  where py >nul 2>nul && set "SERVER_CMD=py -m http.server %PORT%"
)
if not defined SERVER_CMD (
  where python >nul 2>nul && set "SERVER_CMD=python -m http.server %PORT%"
)
if not defined SERVER_CMD (
  echo Node or Python is required to run a local server.
  popd
  exit /b 1
)

echo Starting server in "%SERVE_DIR%"...
start "" /b cmd /c "%SERVER_CMD%"

timeout /t 1 /nobreak >nul

echo Game running at: %URL%
echo Close this window or press Ctrl+C to stop the server.
echo Press any key to open the URL again.
start "" "%URL%"

:wait
pause >nul
start "" "%URL%"
goto wait

:pickPort
for %%P in (5173 5174 5175) do (
  call :checkPort %%P
  if defined PORT goto :eof
)
goto :eof

:checkPort
set "PORT_IN_USE="
for /f %%A in ('powershell -NoProfile -Command "(Test-NetConnection -ComputerName localhost -Port %1 -WarningAction SilentlyContinue).TcpTestSucceeded"') do set "PORT_IN_USE=%%A"
if /i "%PORT_IN_USE%"=="True" goto :eof
set "PORT=%1"
goto :eof
