# 🔴 Como Acessar o Redis do Google Cloud

## ⚠️ Importante: pgAdmin é para PostgreSQL, não Redis!

Para acessar Redis você precisa de ferramentas específicas para Redis.

---

## 🛠️ Ferramentas para Redis

### 1. Redis Insight (Melhor opção - Interface Gráfica)

**Download**: https://redis.com/redis-enterprise/redis-insight/

**Funcionalidades:**
- ✅ Interface visual moderna
- ✅ Ver keys e valores
- ✅ Executar comandos
- ✅ Monitorar performance
- ✅ Ver estatísticas

**Conectar:**
1. Abrir Redis Insight
2. "Add Redis Database"
3. Configurar (depois do túnel SSH):
   ```
   Host: localhost
   Port: 6379
   Name: Simulacao Redis
   Password: (se tiver)
   ```

---

### 2. Another Redis Desktop Manager (Alternativa Gratuita)

**Download**: https://github.com/qishibo/AnotherRedisDesktopManager/releases

Interface gráfica open-source, similar ao Redis Insight.

---

### 3. redis-cli (Linha de Comando)

**Instalar:**
```bash
# Ubuntu/Debian
sudo apt-get install redis-tools

# Mac
brew install redis

# Windows
# Download: https://github.com/microsoftarchive/redis/releases
```

**Usar:**
```bash
redis-cli -h localhost -p 6379
> PING
PONG
> KEYS *
> INFO
```

---

### 4. RedisCommander (Interface Web)

```bash
npm install -g redis-commander
redis-commander --redis-host localhost --redis-port 6379
```

Acesse: http://localhost:8081

---

## 🌐 Acessar Redis do Google Cloud (de fora)

O Redis do Google Cloud Memorystore só é acessível **dentro da VPC**.

### ✅ Solução: Túnel SSH

Criar um túnel SSH através de uma VM que está na mesma VPC do Redis.

### Passo 1: Editar script de túnel

**Linux/Mac**: Edite `tunnel-redis.sh`
**Windows**: Edite `tunnel-redis.bat`

```bash
VM_NAME="sua-vm"              # Nome da sua VM no Google Cloud
VM_ZONE="us-central1-a"       # Zone da VM
REDIS_IP="10.0.0.3"           # IP interno do Redis Memorystore
REDIS_PORT="6379"
LOCAL_PORT="6379"
```

### Passo 2: Executar túnel

**Linux/Mac:**
```bash
./tunnel-redis.sh
```

**Windows:**
```
tunnel-redis.bat
```

**Ou manualmente:**
```bash
gcloud compute ssh sua-vm \
  --zone=us-central1-a \
  -- -N -L 6379:10.0.0.3:6379
```

### Passo 3: Conectar

Agora o Redis está acessível em `localhost:6379`!

**Teste:**
```bash
redis-cli -h localhost -p 6379
> PING
PONG
```

**Com Redis Insight:**
- Host: `localhost`
- Port: `6379`

---

## 📊 Comandos Úteis no Redis

### Ver filas do Bull
```bash
redis-cli

# Listar todas as keys da fila de simulação
> KEYS bull:simulation-queue:*

# Ver jobs na fila
> LRANGE bull:simulation-queue:wait 0 -1

# Ver jobs ativos
> LRANGE bull:simulation-queue:active 0 -1

# Ver jobs completados
> LRANGE bull:simulation-queue:completed 0 -1

# Ver jobs falhados
> LRANGE bull:simulation-queue:failed 0 -1
```

### Estatísticas
```bash
# Informações gerais
> INFO

# Uso de memória
> INFO memory

# Estatísticas
> INFO stats

# Número total de keys
> DBSIZE

# Ver todas as keys (cuidado em produção!)
> KEYS *
```

### Limpar filas (desenvolvimento)
```bash
# Deletar todas as keys da fila
> DEL bull:simulation-queue:wait
> DEL bull:simulation-queue:active
> DEL bull:simulation-queue:completed
> DEL bull:simulation-queue:failed

# Flush tudo (CUIDADO!)
> FLUSHALL
```

---

## 🔍 Monitorar em Tempo Real

### No redis-cli
```bash
redis-cli

# Ver comandos sendo executados
> MONITOR

# Ver estatísticas em tempo real
> INFO stats
```

### No Redis Insight
- Aba "Browser": Ver keys e valores
- Aba "Workbench": Executar comandos
- Aba "Analysis": Análise de memória
- Aba "Slow Log": Comandos lentos

---

## 🎯 Ver Simulações na Fila

```bash
redis-cli -h localhost -p 6379

# Quantos jobs na fila de espera?
> LLEN bull:simulation-queue:wait

# Ver IDs dos jobs
> LRANGE bull:simulation-queue:wait 0 -1

# Ver detalhes de um job específico
> GET bull:simulation-queue:123

# Ver jobs ativos agora
> LRANGE bull:simulation-queue:active 0 -1

# Quantos completados?
> LLEN bull:simulation-queue:completed
```

---

## 🐛 Troubleshooting

### Erro: Connection refused
```
✅ Verifique se o túnel SSH está ativo
✅ Confirme que está conectando em localhost:6379
✅ Verifique se a VM está rodando
```

### Erro: Authentication required
```
✅ Configure REDIS_PASSWORD no .env
✅ Use -a senha ao conectar: redis-cli -h localhost -p 6379 -a senha
```

### Túnel SSH não conecta
```
✅ Verifique se gcloud está instalado: gcloud version
✅ Faça login: gcloud auth login
✅ Confirme nome e zone da VM: gcloud compute instances list
```

---

## 📝 Exemplo Completo

```bash
# 1. Iniciar túnel
./tunnel-redis.sh

# 2. Em outro terminal, conectar
redis-cli -h localhost -p 6379

# 3. Verificar conexão
> PING
PONG

# 4. Ver filas da aplicação
> KEYS bull:simulation-queue:*
1) "bull:simulation-queue:wait"
2) "bull:simulation-queue:active"
3) "bull:simulation-queue:completed"
4) "bull:simulation-queue:failed"
5) "bull:simulation-queue:id"

# 5. Quantas simulações na fila?
> LLEN bull:simulation-queue:wait
(integer) 15

# 6. Ver jobs ativos
> LRANGE bull:simulation-queue:active 0 -1
1) "123"
2) "124"
3) "125"

# 7. Informações gerais
> INFO server
# Server
redis_version:6.2.14
...

# 8. Uso de memória
> INFO memory
# Memory
used_memory:2048576
used_memory_human:1.95M
...
```

---

## 🎨 Interface Gráfica vs CLI

| Ferramenta | Tipo | Melhor para |
|------------|------|-------------|
| **Redis Insight** | GUI | Visualização, debugging, análise |
| **Another Redis Desktop** | GUI | Alternativa gratuita ao Insight |
| **redis-cli** | CLI | Scripts, automação, rapidez |
| **RedisCommander** | Web | Acesso via navegador |

---

## 💡 Dica: Alias útil

Adicione ao seu `.bashrc` ou `.zshrc`:

```bash
alias redis-local="redis-cli -h localhost -p 6379"
alias redis-tunnel="gcloud compute ssh sua-vm --zone=us-central1-a -- -N -L 6379:10.0.0.3:6379"
```

Uso:
```bash
redis-tunnel &    # Inicia túnel em background
redis-local       # Conecta rapidamente
```

---

## 🔗 Links Úteis

- Redis Insight: https://redis.com/redis-enterprise/redis-insight/
- Another Redis Desktop: https://github.com/qishibo/AnotherRedisDesktopManager
- Comandos Redis: https://redis.io/commands
- Google Cloud Memorystore: https://cloud.google.com/memorystore/docs/redis

---

## ⚡ Quick Start

```bash
# 1. Criar túnel
gcloud compute ssh sua-vm --zone=us-central1-a -- -N -L 6379:10.0.0.3:6379 &

# 2. Conectar
redis-cli -h localhost -p 6379

# 3. Testar
> PING
PONG

# 4. Ver filas
> KEYS bull:*
```

Pronto! Agora você tem acesso visual e via CLI ao Redis do Google Cloud! 🎉
