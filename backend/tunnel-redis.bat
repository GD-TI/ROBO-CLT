@echo off
echo ================================================
echo   Tunel SSH para Redis do Google Cloud
echo ================================================
echo.

REM Configuracoes (EDITE AQUI)
set VM_NAME=sua-vm
set VM_ZONE=us-central1-a
set REDIS_IP=10.0.0.3
set REDIS_PORT=6379
set LOCAL_PORT=6379

echo Criando tunel SSH...
echo VM: %VM_NAME%
echo Zone: %VM_ZONE%
echo Redis: %REDIS_IP%:%REDIS_PORT%
echo Local: localhost:%LOCAL_PORT%
echo.
echo Conectando...
echo.

gcloud compute ssh %VM_NAME% --zone=%VM_ZONE% -- -N -L %LOCAL_PORT%:%REDIS_IP%:%REDIS_PORT%

echo.
echo Tunel encerrado.
pause
