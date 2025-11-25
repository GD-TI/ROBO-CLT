# 🐳 Docker - Sistema de Simulação Bancária

Configuração completa com Docker Compose incluindo PostgreSQL, Redis e a API.

## 📋 Pré-requisitos

- Docker Desktop instalado
- Docker Compose (já vem com Docker Desktop)

## 🚀 Início Rápido

### 1. Configure as variáveis de ambiente

Edite o arquivo `.env.docker` com suas credenciais do SQL Server:

```bash
# SQL Server (SERASA)
SQLSERVER_HOST=seu_servidor_sqlserver
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=SERASA
SQLSERVER_USER=seu_usuario
SQLSERVER_PASSWORD=sua_senha
```

### 2. Inicie o sistema

**Linux/Mac:**
```bash
./start-docker.sh
```

**Windows:**
```
start-docker.bat
```

**Ou manualmente:**
```bash
docker-compose --env-file .env.docker up -d
```

## 🎯 O que é criado

O Docker Compose cria 3 containers:

### 1. **PostgreSQL** (`simulacao-postgres`)
- Porta: `5432`
- Database: `simulacao_bancaria`
- User: `postgres`
- Password: `postgres`
- Schema aplicado automaticamente na primeira vez

### 2. **Redis** (`simulacao-redis`)
- Porta: `6379`
- Persistência habilitada (AOF)

### 3. **API** (`simulacao-api`)
- Porta: `3000`
- Healthcheck: `http://localhost:3000/health`
- Conecta automaticamente ao PostgreSQL e Redis
- Restart automático

## 📡 Endpoints Disponíveis

- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🛠️ Comandos Úteis

### Ver logs
```bash
# Todos os serviços
docker-compose logs -f

# Apenas a API
docker-compose logs -f api

# Últimas 100 linhas
docker-compose logs --tail=100 -f api
```

### Ver status
```bash
docker-compose ps
```

### Parar containers
```bash
docker-compose down
```

### Parar e remover volumes (CUIDADO: apaga dados!)
```bash
docker-compose down -v
```

### Reiniciar um serviço específico
```bash
docker-compose restart api
```

### Reconstruir após mudanças no código
```bash
docker-compose build
docker-compose up -d
```

### Acessar shell de um container
```bash
# API
docker exec -it simulacao-api sh

# PostgreSQL
docker exec -it simulacao-postgres psql -U postgres -d simulacao_bancaria

# Redis
docker exec -it simulacao-redis redis-cli
```

## 🔍 Verificar se está funcionando

```bash
# Health check
curl http://localhost:3000/health

# Deve retornar: {"status":"ok","timestamp":"..."}
```

## 🗄️ Banco de Dados

### Acessar PostgreSQL
```bash
docker exec -it simulacao-postgres psql -U postgres -d simulacao_bancaria
```

### Ver tabelas
```sql
\dt
```

### Fazer backup
```bash
docker exec simulacao-postgres pg_dump -U postgres simulacao_bancaria > backup.sql
```

### Restaurar backup
```bash
cat backup.sql | docker exec -i simulacao-postgres psql -U postgres -d simulacao_bancaria
```

## 🔴 Redis

### Acessar Redis CLI
```bash
docker exec -it simulacao-redis redis-cli
```

### Ver filas
```redis
KEYS bull:simulation-queue:*
```

### Ver informações
```redis
INFO
```

## 📊 Monitoramento

### Ver recursos usados
```bash
docker stats
```

### Ver healthchecks
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## 🔧 Troubleshooting

### Containers não iniciam
```bash
# Ver logs de erro
docker-compose logs

# Verificar se portas estão em uso
netstat -ano | findstr :3000
netstat -ano | findstr :5432
netstat -ano | findstr :6379
```

### API não conecta ao PostgreSQL
```bash
# Verificar se PostgreSQL está saudável
docker-compose ps postgres

# Ver logs do PostgreSQL
docker-compose logs postgres
```

### Resetar tudo
```bash
docker-compose down -v
docker-compose up -d
```

## 🔐 Segurança em Produção

⚠️ **IMPORTANTE**: Antes de usar em produção:

1. Mude `JWT_SECRET` em `.env.docker`
2. Mude `ENCRYPTION_KEY` em `.env.docker`
3. Mude senha do PostgreSQL
4. Use volumes externos para dados
5. Configure firewall/security groups
6. Habilite SSL/TLS

## 📦 Volumes

Dados persistidos em volumes Docker:
- `postgres_data`: Dados do PostgreSQL
- `redis_data`: Dados do Redis

### Backup de volumes
```bash
# PostgreSQL
docker run --rm -v simulacao-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Redis
docker run --rm -v simulacao-redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data
```

## 🌐 Rede

Todos os containers estão na rede `simulacao-network`:
- Comunicação interna entre containers
- API acessa PostgreSQL via hostname `postgres`
- API acessa Redis via hostname `redis`

## 🚀 Deploy em Produção

### Com Docker Swarm
```bash
docker stack deploy -c docker-compose.yml simulacao
```

### Com Kubernetes
Converta usando Kompose:
```bash
kompose convert
kubectl apply -f .
```

### Variáveis de ambiente em produção
Use secrets do Docker/Kubernetes ao invés de `.env.docker`
