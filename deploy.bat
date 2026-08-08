@echo off
setlocal
set REPO_DIR=%~dp0
cd /d "%REPO_DIR%"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed.
  exit /b 1
)

if not exist .git (
  echo This directory is not a Git repository.
  exit /b 1
)

set /p COMMIT_MSG=Commit message: 
if "%COMMIT_MSG%"=="" (
  set COMMIT_MSG=Update shooting game
)

git add .
git commit -m "%COMMIT_MSG%"
git push origin main

echo.
echo Deployment completed.
