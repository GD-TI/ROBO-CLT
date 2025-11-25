# Configuração do Redis no Google Cloud

## Google Cloud Memorystore (Redis)

### 1. Criar Instância Redis no Google Cloud

```bash
gcloud redis instances create simulacao-redis \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_6_x \
    --tier=basic
```

Ou pela Console:
1. Acesse: https://console.cloud.google.com/memorystore/redis
2. Clique em "Criar Instância"
3. Configure:
   - Nome: `simulacao-redis`
   - Tier: Basic (desenvolvimento) ou Standard (produção)
   - Capacidade: 1 GB (ou conforme necessidade)
   - Região: mesma da sua aplicação
   - Versão: Redis 6.x

### 2. Obter Informações da Instância

```bash
gcloud redis instances describe simulacao-redis --region=us-central1
```

Anote:
- **host**: IP interno (ex: `10.0.0.3`)
- **port**: geralmente `6379`
- **AUTH enabled**: se autenticação está habilitada

### 3. Configurar no .env

**Redis Básico (sem autenticação):**
```env
REDIS_HOST=10.0.0.3
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
```

**Redis com Autenticação:**
```env
REDIS_HOST=10.0.0.3
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_aqui
REDIS_TLS=false
```

**Redis com TLS/SSL:**
```env
REDIS_HOST=10.0.0.3
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_aqui
REDIS_TLS=true
```

### 4. Conectividade

#### Opção A: VM no Google Cloud (mesma VPC)
Se sua aplicação roda em uma VM do Google Cloud na mesma VPC:
- ✅ Conecta direto usando IP interno
- ✅ Sem necessidade de configuração adicional

#### Opção B: Acesso Externo (desenvolvimento local)
Se está desenvolvendo localmente:

**1. Configure Cloud SQL Proxy:**
```bash
# Instalar gcloud SDK
curl https://sdk.cloud.google.com | bash

# Autenticar
gcloud auth login

# Criar túnel SSH para VM
gcloud compute ssh sua-vm --zone=us-central1-a -- -L 6379:10.0.0.3:6379
```

**2. No .env local:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
```

#### Opção C: Bastion Host
```bash
# SSH com port forwarding
ssh -L 6379:10.0.0.3:6379 user@bastion-host-ip
```

### 5. Testar Conexão

**Teste direto (se na mesma VPC):**
```bash
redis-cli -h 10.0.0.3 -p 6379
PING
# Deve retornar: PONG
```

**Com senha:**
```bash
redis-cli -h 10.0.0.3 -p 6379 -a sua_senha
AUTH sua_senha
PING
```

**Teste pela aplicação:**
```bash
node test-connections.js
```

### 6. Firewall / VPC

Certifique-se que:
- ✅ Sua VM/App está na mesma VPC do Redis
- ✅ Regras de firewall permitem tráfego na porta 6379
- ✅ Service Networking está habilitado

**Verificar conectividade:**
```bash
# Na VM onde roda a aplicação
telnet 10.0.0.3 6379
```

### 7. Monitoramento

**Ver métricas:**
```bash
gcloud redis instances describe simulacao-redis --region=us-central1
```

**Logs:**
```bash
gcloud logging read "resource.type=redis_instance" --limit 50
```

**Console:**
- https://console.cloud.google.com/memorystore/redis/instances

### 8. Backup e Recuperação

**Criar snapshot:**
```bash
gcloud redis instances export simulacao-redis \
    --destination=gs://seu-bucket/backup-redis.rdb \
    --region=us-central1
```

**Restaurar:**
```bash
gcloud redis instances import simulacao-redis \
    --source=gs://seu-bucket/backup-redis.rdb \
    --region=us-central1
```

### 9. Custos

- **Basic Tier**: ~$0.0475/GB/hora
- **Standard Tier**: ~$0.095/GB/hora (replicação)
- Transferência de dados adicional

**Exemplo (1GB Basic):**
- ~$35/mês

### 10. Melhores Práticas

✅ **Use Basic** para desenvolvimento
✅ **Use Standard** para produção (alta disponibilidade)
✅ **Mesma região** que a aplicação
✅ **Habilite AUTH** em produção
✅ **Configure alertas** de memória
✅ **Monitore latência**
✅ **Faça backups** periódicos

### Troubleshooting

**Erro: Connection timeout**
```
→ Verifique VPC e firewall
→ Confirme que está na mesma rede
→ Teste: telnet 10.0.0.3 6379
```

**Erro: Authentication failed**
```
→ Verifique REDIS_PASSWORD no .env
→ Confirme AUTH habilitado na instância
```

**Erro: TLS handshake failed**
```
→ Se TLS habilitado, use REDIS_TLS=true
→ Certifique-se que certificados estão corretos
```

## Alternativas ao Memorystore

### Redis Labs (Cloud)
```env
REDIS_HOST=redis-12345.c123.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=sua_senha
REDIS_TLS=true
```

### Upstash (Serverless)
```env
REDIS_HOST=us1-modern-firefly-12345.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha
REDIS_TLS=true
```

### Railway.app
```env
REDIS_HOST=containers-us-west-123.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha
REDIS_TLS=false
```

## Configuração Completa

Seu `.env` final deve ficar assim:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=simulacao_bancaria
DB_USER=postgres
DB_PASSWORD=senha

# Redis Google Cloud
REDIS_HOST=10.0.0.3
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

# SQL Server
SQLSERVER_HOST=ip_do_servidor
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=SERASA
SQLSERVER_USER=usuario
SQLSERVER_PASSWORD=senha

# JWT & Encryption
JWT_SECRET=chave_super_secreta
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# APIs
BFF_BASE_URL=https://bff.v8sistema.com
V8_BFF_BASE_URL=https://v8-bff-prod.yellowisland-b252a8a0.eastus.azurecontainerapps.io
DEFAULT_CONFIG_ID=c51e2ded-15c7-4de8-b4d4-fa147092d8af
DEFAULT_SIGNER_EMAIL=contato@empresa.com

# Configs
MAX_CONCURRENT_SIMULATIONS=5
CONSULT_STATUS_RETRY_INTERVAL=3000
CONSULT_STATUS_MAX_RETRIES=60
```

Pronto! Agora sua aplicação está configurada para usar Redis no Google Cloud! 🚀
