@echo off
chcp 65001 >nul
rem Projeyi tek tıkla başlatır: backend, frontend ve (varsa) ML servisi ayrı terminallerde açılır.
cd /d "%~dp0"

start "SAMU Server" cmd /k "cd /d server && npm run dev"
start "SAMU Client" cmd /k "cd /d client && npm run dev"

if not exist "ml\app\main.py" goto noml
if not exist "ml\.venv\Scripts\activate.bat" goto novenv
rem Model yoksa (ilk kurulum) once egitilir
start "SAMU ML" cmd /k "cd /d ml && call .venv\Scripts\activate.bat && (if not exist models\decision.joblib python -m app.train) && uvicorn app.main:app --reload --port 8000"
goto end

:novenv
echo ML servisi icin sanal ortam bulunamadi. Kurulum: cd ml ^&^& py -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
goto end

:noml
echo ML servisi henuz eklenmedi, atlandi.

:end
