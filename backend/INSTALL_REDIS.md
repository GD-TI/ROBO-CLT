# 🔴 Instalar Redis Localmente

## 🐧 Linux (Ubuntu/Debian)

### Método 1: Repositório Oficial (Recomendado)

```bash
# Atualizar repositórios
sudo apt update

# Instalar Redis
sudo apt install redis-server

# Iniciar Redis
sudo systemctl start redis-server

# Habilitar para iniciar com o sistema
sudo systemctl enable redis-server

# Verificar status
sudo systemctl status redis-server

# Testar
redis-cli ping
# Deve retornar: PONG
```

### Método 2: Compilar da Fonte

```bash
# Instalar dependências
sudo apt install build-essential tcl

# Baixar última versão
cd /tmp
curl -O http://download.redis.io/redis-stable.tar.gz
tar xzvf redis-stable.tar.gz
cd redis-stable

# Compilar e instalar
make
make test
sudo make install

# Iniciar Redis
redis-server
```

### Configuração

```bash
# Editar configuração
sudo nano /etc/redis/redis.conf

# Reiniciar após mudanças
sudo systemctl restart redis-server
```

---

## 🍎 macOS

### Método 1: Homebrew (Recomendado)

```bash
# Instalar Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar Redis
brew install redis

# Iniciar Redis
brew services start redis

# Ou rodar em foreground
redis-server

# Testar
redis-cli ping
# Deve retornar: PONG
```

### Método 2: Compilar da Fonte

```bash
# Instalar Xcode Command Line Tools
xcode-select --install

# Baixar e compilar
cd /tmp
curl -O http://download.redis.io/redis-stable.tar.gz
tar xzvf redis-stable.tar.gz
cd redis-stable
make
sudo make install

# Iniciar
redis-server
```

### Comandos Úteis macOS

```bash
# Parar Redis
brew services stop redis

# Reiniciar Redis
brew services restart redis

# Ver status
brew services list

# Ver configuração
cat /usr/local/etc/redis.conf
```

---

## 🪟 Windows

### Método 1: WSL2 (Windows Subsystem for Linux) - Recomendado

```bash
# 1. Instalar WSL2
wsl --install

# 2. Abrir Ubuntu no WSL
wsl

# 3. Instalar Redis no Ubuntu
sudo apt update
sudo apt install redis-server

# 4. Iniciar Redis
sudo service redis-server start

# 5. Testar
redis-cli ping
```

### Método 2: Memurai (Fork do Redis para Windows)

1. **Download**: https://www.memurai.com/get-memurai
2. Instalar o executável
3. Redis roda como serviço do Windows automaticamente

### Método 3: Docker (Melhor para Windows)

```bash
# Instalar Docker Desktop
# Download: https://www.docker.com/products/docker-desktop

# Rodar Redis
docker run -d -p 6379:6379 --name redis redis:alpine

# Ver logs
docker logs redis

# Parar
docker stop redis

# Iniciar novamente
docker start redis

# Conectar
redis-cli -h localhost -p 6379
```

### Método 4: Versão antiga Microsoft (Não recomendado)

```bash
# Download: https://github.com/microsoftarchive/redis/releases
# Última versão: Redis 3.2 (desatualizada)

# Extrair ZIP e executar
redis-server.exe
```

---

## 🐳 Docker (Multiplataforma)

### Rodar Redis com Docker

```bash
# Básico
docker run -d -p 6379:6379 --name redis redis:alpine

# Com persistência
docker run -d \
  -p 6379:6379 \
  --name redis \
  -v redis-data:/data \
  redis:alpine redis-server --appendonly yes

# Com senha
docker run -d \
  -p 6379:6379 \
  --name redis \
  redis:alpine redis-server --requirepass minhasenha

# Conectar
docker exec -it redis redis-cli
```

### Docker Compose (arquivo docker-compose.yml)

```yaml
version: '3.8'
services:
  redis:
    image: redis:alpine
    container_name: redis-local
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis-data:
```

```bash
# Iniciar
docker-compose up -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f
```

---

## ✅ Verificar Instalação

```bash
# Verificar versão
redis-server --version

# Verificar se está rodando
redis-cli ping
# Retorno esperado: PONG

# Ver informações
redis-cli info

# Testar comandos básicos
redis-cli
> SET teste "hello"
> GET teste
"hello"
> DEL teste
> QUIT
```

---

## ⚙️ Configurações Importantes

### Arquivo de Configuração

**Linux**: `/etc/redis/redis.conf`
**macOS**: `/usr/local/etc/redis.conf` ou `/opt/homebrew/etc/redis.conf`
**Windows/WSL**: `/etc/redis/redis.conf`

### Configurações Úteis

```conf
# Porta
port 6379

# Bind (aceitar conexões de qualquer IP)
bind 0.0.0.0

# Ou apenas local
bind 127.0.0.1

# Senha (descomente para habilitar)
# requirepass sua_senha_aqui

# Persistência
appendonly yes
appendfilename "appendonly.aof"

# Snapshot (backup)
save 900 1      # Salva se pelo menos 1 key mudou em 900 segundos
save 300 10     # Salva se pelo menos 10 keys mudaram em 300 segundos
save 60 10000   # Salva se pelo menos 10000 keys mudaram em 60 segundos

# Memória máxima
maxmemory 256mb
maxmemory-policy allkeys-lru

# Log
loglevel notice
logfile /var/log/redis/redis-server.log
```

### Aplicar configurações

```bash
# Linux
sudo systemctl restart redis-server

# macOS
brew services restart redis

# Windows WSL
sudo service redis-server restart

# Docker
docker restart redis
```

---

## 🔒 Habilitar Senha

```bash
# Método 1: Configuração
sudo nano /etc/redis/redis.conf
# Descomentar e alterar:
requirepass sua_senha_forte

# Reiniciar
sudo systemctl restart redis-server

# Conectar com senha
redis-cli -a sua_senha_forte
```

```bash
# Método 2: Comando direto
redis-cli
> CONFIG SET requirepass "sua_senha_forte"
> AUTH sua_senha_forte
> QUIT
```

---

## 🚀 Iniciar Automaticamente

### Linux

```bash
# Habilitar
sudo systemctl enable redis-server

# Desabilitar
sudo systemctl disable redis-server

# Status
sudo systemctl status redis-server
```

### macOS

```bash
# Iniciar automaticamente
brew services start redis

# Parar
brew services stop redis

# Ver serviços
brew services list
```

### Windows WSL

```bash
# Adicionar ao ~/.bashrc para iniciar automaticamente
echo "sudo service redis-server start" >> ~/.bashrc
```

---

## 📊 Monitorar Redis

```bash
# Ver estatísticas em tempo real
redis-cli --stat

# Ver comandos sendo executados
redis-cli MONITOR

# Ver informações detalhadas
redis-cli INFO

# Ver uso de memória
redis-cli INFO memory

# Ver clientes conectados
redis-cli CLIENT LIST
```

---

## 🛠️ Ferramentas GUI Locais

### 1. Redis Insight (Melhor)
```bash
# Download
https://redis.com/redis-enterprise/redis-insight/

# Conectar em:
Host: localhost
Port: 6379
```

### 2. RedisCommander (Web)
```bash
npm install -g redis-commander
redis-commander
# Acesse: http://localhost:8081
```

### 3. Another Redis Desktop Manager
```bash
# Download
https://github.com/qishibo/AnotherRedisDesktopManager/releases
```

---

## 🧪 Testar com a Aplicação

Após instalar o Redis, configure o `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
```

Testar conexão:

```bash
# Rodar teste de conexão
node test-connections.js

# Ou rodar a aplicação
npm run dev

# Ver filas
redis-cli
> KEYS bull:*
```

---

## 🐛 Troubleshooting

### Redis não inicia

```bash
# Linux - ver logs
sudo journalctl -u redis-server -f

# Ver arquivo de log
sudo tail -f /var/log/redis/redis-server.log

# Verificar se porta está em uso
sudo netstat -tulpn | grep 6379
```

### Connection refused

```bash
# Verificar se está rodando
redis-cli ping

# Linux
sudo systemctl status redis-server

# macOS
brew services list

# Verificar processos
ps aux | grep redis
```

### Porta já em uso

```bash
# Ver o que está usando a porta
sudo lsof -i :6379

# Matar processo
sudo kill -9 PID

# Ou mudar porta no redis.conf
port 6380
```

### Limpar tudo

```bash
# Deletar todos os dados (CUIDADO!)
redis-cli FLUSHALL

# Ou deletar arquivo de persistência
# Linux
sudo rm /var/lib/redis/dump.rdb
sudo rm /var/lib/redis/appendonly.aof
sudo systemctl restart redis-server
```

---

## 📝 Scripts Úteis

### Iniciar Redis Local (start-redis-local.sh)

```bash
#!/bin/bash
echo "Iniciando Redis localmente..."

if command -v redis-server &> /dev/null; then
    redis-server --daemonize yes
    echo "✅ Redis iniciado!"
    redis-cli ping
else
    echo "❌ Redis não está instalado!"
    echo "Instale com: sudo apt install redis-server"
fi
```

### Parar Redis Local (stop-redis-local.sh)

```bash
#!/bin/bash
echo "Parando Redis..."
redis-cli shutdown
echo "✅ Redis parado!"
```

### Status Redis (status-redis.sh)

```bash
#!/bin/bash
if redis-cli ping &> /dev/null; then
    echo "✅ Redis está rodando!"
    redis-cli INFO server | grep redis_version
    redis-cli INFO memory | grep used_memory_human
else
    echo "❌ Redis não está rodando!"
fi
```

---

## 💡 Dicas

✅ Use Docker se tiver problemas no Windows
✅ Habilite senha em produção
✅ Configure persistência (appendonly yes)
✅ Monitore uso de memória
✅ Faça backups periódicos
✅ Use Redis Insight para visualizar dados

---

## 🎯 Quick Start

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install redis-server -y
sudo systemctl start redis-server
redis-cli ping
```

**macOS:**
```bash
brew install redis
brew services start redis
redis-cli ping
```

**Windows (Docker):**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
redis-cli -h localhost ping
```

Pronto! Redis rodando localmente! 🚀
