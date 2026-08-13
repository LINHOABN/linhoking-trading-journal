@echo off
REM start.bat -- Lance LINHOKING (backend FastAPI + frontend React) en local sur Windows.
setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend

echo ============================================
echo   LINHOKING - lancement backend + frontend
echo ============================================
echo.

REM ---------- Verifications preliminaires ----------
if not exist "%BACKEND_DIR%" (
  echo [ERREUR] Dossier "backend" introuvable.
  goto :end
)
if not exist "%FRONTEND_DIR%" (
  echo [ERREUR] Dossier "frontend" introuvable.
  goto :end
)
where python >nul 2>nul || (echo [ERREUR] Python non trouve. && goto :end)
where npm    >nul 2>nul || (echo [ERREUR] npm non trouve.    && goto :end)

REM ---------- Nettoyage des anciens process sur port 8000 ----------
echo Nettoyage des anciens processus sur le port 8000...
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    taskkill /F /PID %%P >nul 2>nul
  )
)

REM ---------- Nettoyage des anciens process sur port 5173 ----------
echo Nettoyage des anciens processus sur le port 5173...
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    taskkill /F /PID %%P >nul 2>nul
  )
)
timeout /t 2 /nobreak >nul

REM ---------- BACKEND ----------
echo.
echo === Demarrage du backend ===
cd /d "%BACKEND_DIR%"

if not exist "venv" (
  echo Creation de l'environnement virtuel...
  python -m venv venv
)

call venv\Scripts\activate.bat

echo Installation des dependances Python...
pip install -q -r requirements.txt

if not exist ".env" (
  if exist ".env.example" copy .env.example .env >nul
)

start "LINHOKING backend" cmd /k "cd /d "%BACKEND_DIR%" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

REM ---------- FRONTEND ----------
cd /d "%FRONTEND_DIR%"
echo.
echo === Demarrage du frontend ===

if not exist "node_modules" (
  echo Installation des dependances npm...
  call npm install
)

if not exist ".env" (
  if exist ".env.example" copy .env.example .env >nul
)

start "LINHOKING frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   LINHOKING est lance !
echo     Backend  : http://localhost:8000/docs
echo     Frontend : http://localhost:5173
echo ============================================
echo.
echo Ferme les deux fenetres de commande pour tout arreter.

:end
echo.
pause
endlocal
