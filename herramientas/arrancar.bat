@echo off
setlocal
cd /d "%~dp0.."

set "PF86=%ProgramFiles(x86)%"
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%PF86%\Google\Chrome\Application\chrome.exe" set "CHROME=%PF86%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not defined CHROME echo No se encontro Chrome. Instalalo o edita la ruta en este archivo.
if not defined CHROME pause
if not defined CHROME exit /b 1

echo Levantando el servidor...
start "servidor-espejo" /min cmd /c "node servidor\servidor.js"

timeout /t 2 /nobreak >nul

echo Abriendo el espejo...
start "" "%CHROME%" --kiosk --user-data-dir="%~dp0..\.perfil-chrome" --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-features=Translate,TranslateUI "http://localhost:8080/"
