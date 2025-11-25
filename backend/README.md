# API de Simulação Bancária

API REST completa para gerenciar simulações de consignado em massa com múltiplos usuários e credenciais bancárias.

## 🚀 Início Rápido com Docker (RECOMENDADO)

A forma mais fácil de rodar o sistema é usando Docker:

```bash
# 1. Configure suas credenciais no .env.docker
nano .env.docker

# 2. Inicie tudo
./start-docker.sh         # Linux/Mac
start-docker.bat          # Windows

# 3. Acesse
# API: http://localhost:3000
# Health: http://localhost:3000/health
```

**Leia [DOCKER.md](DOCKER.md) para mais detalhes sobre Docker.**

---

## 📋 Instalação Manual (sem Docker)

### Requisitos

- Node.js 16+
- PostgreSQL 12+
- Redis 6+
- SQL Server (para dados SERASA)

### Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo .env.example para .env
2. Configure as variáveis de ambiente
3. Crie o banco de dados PostgreSQL
4. Execute o schema SQL

```bash
cp .env.example .env
createdb simulacao_bancaria
psql -d simulacao_bancaria -f database/schema.sql
```

## Executar

Desenvolvimento:
```bash
npm run dev
```

Produção:
```bash
npm start
```

## Principais Endpoints

### Autenticação
- POST /api/auth/register - Registrar novo usuário
- POST /api/auth/login - Login (retorna JWT)
- GET /api/auth/me - Informações do usuário autenticado

### Credenciais Bancárias
- POST /api/bank-credentials - Criar credencial (token criptografado)
- GET /api/bank-credentials - Listar credenciais
- GET /api/bank-credentials/:id - Obter credencial
- PUT /api/bank-credentials/:id - Atualizar credencial
- DELETE /api/bank-credentials/:id - Deletar credencial

### Simulações
- POST /api/simulations - Criar simulação única
- POST /api/simulations/batch - Criar simulações em lote
- GET /api/simulations - Listar simulações (com filtros)
- GET /api/simulations/:id - Obter simulação
- GET /api/simulations/:id/logs - Logs detalhados da simulação
- GET /api/simulations/stats - Estatísticas gerais
- DELETE /api/simulations/:id - Deletar simulação

## Exemplo de Uso

1. Registrar usuário:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@example.com","password":"senha123","name":"João Silva"}'
```

2. Adicionar credencial bancária:
```bash
curl -X POST http://localhost:3000/api/bank-credentials \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"partner_id":"7718_D020","name":"Banco Principal","token":"token_banco"}'
```

3. Criar simulações em lote:
```bash
curl -X POST http://localhost:3000/api/simulations/batch \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cpfs":["12345678901","98765432109"],"bank_credential_id":1}'
```

## Fluxo de Processamento Automático

O worker processa cada simulação seguindo este fluxo:

1. Criar consulta no endpoint /private-consignment/consult
2. Autorizar consulta no endpoint /consult/{id}/authorize
3. Verificar status (retry até SUCCESS ou FAILED)
4. Pré-calcular parcelas
5. Selecionar melhor parcela (maior disbursementMaxValue)
6. Criar simulação final

Tudo é feito automaticamente e de forma assíncrona através da fila Bull/Redis.

## Segurança

- Tokens bancários criptografados com AES-256-CBC
- Senhas hasheadas com bcrypt
- Autenticação JWT
- Rate limiting (100 req/15min)
- CORS e Helmet habilitados

## Status das Simulações

- PENDING: Na fila
- PROCESSING: Sendo processada
- COMPLETED: Sucesso
- FAILED: Falhou
- REJECTED: Rejeitada pelo banco
- TIMEOUT: Timeout na consulta

Todos os requests são logados na tabela request_logs para auditoria.
