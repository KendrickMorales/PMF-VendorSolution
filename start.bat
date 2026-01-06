@echo off
REM Start script for PMF Vendor Part Number Generator (Windows)

echo Starting PMF Vendor Part Number Generator...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Install Node.js dependencies if needed
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    call npm install
)

REM Try to use app.py (with SOLIDWORKS API), fallback to app_fallback.py
echo.
echo Starting backend server...
python -c "import win32com.client" >nul 2>&1
if errorlevel 1 (
    echo SOLIDWORKS API not available - using app_fallback.py
    start "Backend Server" python app_fallback.py
) else (
    echo SOLIDWORKS API detected - using app.py
    start "Backend Server" python app.py
)

REM Wait a moment for backend to start
timeout /t 2 /nobreak >nul

REM Start frontend
echo Starting frontend server...
start "Frontend Server" npm run dev

echo.
echo Backend running on http://localhost:5000
echo Frontend running on http://localhost:3000
echo.
echo Press any key to exit (servers will continue running)
pause >nul

