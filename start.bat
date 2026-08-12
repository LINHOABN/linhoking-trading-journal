@echo off
REM start.bat — Lance LINHOKING (backend FastAPI + frontend React) en local sur Windows.
REM
REM Structure attendue a cote de ce script :
REM   .\backend    (contenu de linhoking-backend.zip)
REM   .\frontend   (contenu de linhoking-trading-journal-frontend-1.zip)
REM
REM Prerequis : Python 3.10+ (coche "Add to PATH" a l'installation), Node.js 18+,
REM             une base PostgreSQL accessible.

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
  echo [ERREUR] Dossier "backend" introuvable a cote de start.bat.
  echo          Verifie qu'il s'appelle bien "backend" et qu'il est au meme niveau que ce script.
  goto :end
)
if not exist "%FRONTEND_DIR%" (
  echo [ERREUR] Dossier "frontend" introuvable a cote de start.bat.
  echo          Verifie qu'il s'appelle bien "frontend" et qu'il est au meme niveau que ce script.
  goto :end
)

where python >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] "python" n'est pas reconnu. Python n'est pas installe ou pas dans le PATH.
  echo          Installe Python depuis https://python.org et coche "Add python.exe to PATH".
  goto :end
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] "npm" n'est pas reconnu. Node.js n'est pas installe ou pas dans le PATH.
  echo          Installe Node.js depuis https://nodejs.org.
  goto :end
)

REM ---------- BACKEND ----------
echo === Preparation du backend ===
cd /d "%BACKEND_DIR%"

if not exist "venv" (
  echo Creation de l'environnement virtuel...
  python -m venv venv
  if errorlevel 1 (
    echo [ERREUR] La creation du venv a echoue.
    goto :end
  )
)

call venv\Scripts\activate.bat
if errorlevel 1 (
  echo [ERREUR] Impossible d'activer le venv.
  goto :end
)

echo Installation des dependances Python...
pip install -r requirements.txt
if errorlevel 1 (
  echo [ERREUR] pip install a echoue. Regarde le message ci-dessus.
  goto :end
)

if not exist ".env" (
  echo Copie de .env.example vers .env - pense a renseigner DATABASE_URL et SECRET_KEY
  copy .env.example .env >nul
)

echo Demarrage de l'API sur http://localhost:8000 (docs: /docs)
start "LINHOKING backend" cmd /k "cd /d "%BACKEND_DIR%" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

REM ---------- FRONTEND ----------
cd /d "%FRONTEND_DIR%"
echo === Preparation du frontend ===

if not exist "node_modules" (
  echo Installation des dependances npm - ca peut prendre 1-2 minutes...
  call npm install
  if errorlevel 1 (
    echo [ERREUR] npm install a echoue. Regarde le message ci-dessus.
    goto :end
  )
)

if not exist ".env" (
  echo Copie de .env.example vers .env
  copy .env.example .env >nul
)

echo Demarrage du frontend sur http://localhost:5173
start "LINHOKING frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo ============================================
echo   LINHOKING est lance dans deux fenetres :
echo     - Backend  : http://localhost:8000/docs
echo     - Frontend : http://localhost:5173
echo   Ferme ces fenetres pour tout arreter.
echo ============================================

:end
echo.
pause
endlocal
