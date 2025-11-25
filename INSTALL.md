# 📦 Instalação do Sistema V2

## 1️⃣ Pré-requisitos

- Node.js 16+
- PostgreSQL
- Redis
- npm ou yarn

## 2️⃣ Passo a Passo

### Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar .env (copie de .env.example e preencha)
cp .env.example .env
nano .env

# Aplicar schema no PostgreSQL
psql -U postgres -d simulacao_bancaria -f database/schema.sql
psql -U postgres -d simulacao_bancaria -f database/schema-v2.sql

# Iniciar serviços
service postgresql start
service redis-server start

# Rodar backend
npm run dev
```

### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Rodar frontend
npm start
```

## 3️⃣ Acessar

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Login: `admin@sistema.com` / `admin123`

## 4️⃣ Usar o Sistema

1. Fazer login
2. Adicionar credencial bancária (Menu > Credenciais)
3. Criar novo Job (Home > Novo Job)
4. Colar lista de CPFs
5. Aguardar processamento
6. Exportar resultados em CSV

## 5️⃣ Deploy Produção

```bash
# Backend com PM2
npm install -g pm2
cd backend
pm2 start src/server.js --name api-simulacao
pm2 startup
pm2 save

# Frontend build
cd frontend
npm run build

# Servir com nginx (exemplo de config em DEPLOY.md)
```

