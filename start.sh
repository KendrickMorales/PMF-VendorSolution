#!/bin/bash

# Start script for PMF Vendor Part Number Generator

echo "Starting PMF Vendor Part Number Generator..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Try to use app.py (with SOLIDWORKS API), fallback to app_fallback.py
echo ""
echo "Starting backend server..."
if python3 -c "import win32com.client" 2>/dev/null; then
    echo "SOLIDWORKS API detected - using app.py"
    python3 app.py &
else
    echo "SOLIDWORKS API not available - using app_fallback.py"
    python3 app_fallback.py &
fi

BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend running on http://localhost:5000"
echo "Frontend running on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

