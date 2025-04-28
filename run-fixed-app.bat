@echo off
echo Starting IntelliLend IOTA DeFi application with fixes...
echo.
echo Starting backend server on port 3002...
start cmd /k "cd %~dp0 && node backend/server.js"
echo.
echo Waiting for backend to initialize...
timeout /t 5 /nobreak > nul
echo.
echo Starting frontend on port 3000...
start cmd /k "cd %~dp0/frontend && npm start"
echo.
echo IntelliLend is now running!
echo - Frontend: http://localhost:3000
echo - Backend: http://localhost:3002
echo.
echo Press any key to close this window...
pause > nul