@echo off
cd /d %~dp0
echo.
echo  Starting ML Classifier Service on http://127.0.0.1:5001
echo  Press Ctrl+C to stop.
echo.
python -m uvicorn app:app --host 127.0.0.1 --port 5001
