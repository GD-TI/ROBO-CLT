@echo off
echo ================================================
echo   Iniciando Sistema de Simulacao Bancaria
echo ================================================
echo.

REM Verificar se o .env.docker existe
if not exist .env.docker (
    echo Arquivo .env.docker nao encontrado!
    echo Por favor, copie .env.docker.example para .env.docker
    echo e configure suas credenciais.
    pause
    exit /b 1
)

echo Parando containers antigos...
docker-compose down

echo.
echo Construindo imagens...
docker-compose build

echo.
echo Iniciando containers...
docker-compose --env-file .env.docker up -d

echo.
echo Aguardando servicos ficarem prontos...
timeout /t 10 /nobreak > nul

echo.
echo Sistema iniciado com sucesso!
echo.
echo ================================================
echo   Servicos Disponiveis:
echo ================================================
echo API:        http://localhost:3000
echo Health:     http://localhost:3000/health
echo PostgreSQL: localhost:5432
echo Redis:      localhost:6379
echo.
echo ================================================
echo   Comandos Uteis:
echo ================================================
echo Ver logs:           docker-compose logs -f
echo Ver logs da API:    docker-compose logs -f api
echo Status:             docker-compose ps
echo Parar:              docker-compose down
echo Reiniciar:          docker-compose restart
echo ================================================
echo.
pause
