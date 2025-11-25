#!/bin/bash

echo "================================================"
echo "  Iniciando Sistema de Simulação Bancária"
echo "================================================"
echo ""

# Verificar se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando!"
    echo "   Por favor, inicie o Docker Desktop e tente novamente."
    exit 1
fi

# Verificar se o .env.docker existe
if [ ! -f .env.docker ]; then
    echo "⚠️  Arquivo .env.docker não encontrado!"
    echo "   Copiando .env.docker.example..."
    cp .env.docker.example .env.docker
    echo ""
    echo "📝 Por favor, edite o arquivo .env.docker com suas credenciais do SQL Server"
    echo "   e execute este script novamente."
    exit 1
fi

echo "🐳 Parando containers antigos..."
docker-compose down

echo ""
echo "🔨 Construindo imagens..."
docker-compose build

echo ""
echo "🚀 Iniciando containers..."
docker-compose --env-file .env.docker up -d

echo ""
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 10

echo ""
echo "✅ Sistema iniciado com sucesso!"
echo ""
echo "================================================"
echo "  Serviços Disponíveis:"
echo "================================================"
echo "📊 API:        http://localhost:3000"
echo "❤️  Health:    http://localhost:3000/health"
echo "🗄️  PostgreSQL: localhost:5432"
echo "🔴 Redis:      localhost:6379"
echo ""
echo "================================================"
echo "  Comandos Úteis:"
echo "================================================"
echo "📋 Ver logs:           docker-compose logs -f"
echo "📋 Ver logs da API:    docker-compose logs -f api"
echo "🔍 Status:             docker-compose ps"
echo "🛑 Parar:              docker-compose down"
echo "🔄 Reiniciar:          docker-compose restart"
echo "================================================"
echo ""
