@echo off
rem Flame in Freefall local preview: http://localhost:5180  (keep this window open)
cd /d "%~dp0"
set PORT=5180
set PY=python
where py >/dev/null 2>/dev/null && set PY=py
echo Flame in Freefall - http://localhost:%PORT%
echo Serving from %CD%
%PY% serve.py %PORT% 2> serve.log
echo.
echo The server stopped. Error details are in serve.log:
type serve.log
pause
