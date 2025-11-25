# 🎨 Frontend - Sistema de Simulação Bancária

## 🚀 Quick Start

### 1. Instalar dependências:
```bash
npm install
```

### 2. Configurar API:

Edite o arquivo `.env`:
```
REACT_APP_API_URL=http://localhost:3000/api
PORT=3001
```

### 3. Rodar:
```bash
npm start
```

Acesse: http://localhost:3001

## 🔑 Login Padrão

- Email: `admin@sistema.com`
- Senha: `admin123`

## 📁 Estrutura

```
src/
├── pages/
│   ├── Login.js          # Página de login
│   ├── Jobs.js           # Lista de jobs
│   ├── NewJob.js         # Criar job
│   └── JobDetails.js     # Detalhes do job
├── styles/
│   ├── Jobs.css
│   ├── NewJob.css
│   └── JobDetails.css
├── contexts/
│   └── AuthContext.js    # Contexto de autenticação
├── components/
│   └── PrivateRoute.js   # Proteção de rotas
├── App.js                # Rotas principais
└── index.js              # Entry point
```

## 🎯 Páginas

- `/login` - Login
- `/jobs` - Lista de jobs
- `/new-job` - Criar novo job
- `/jobs/:id` - Detalhes do job

## ✨ Funcionalidades

- ✅ Sistema de Jobs (lotes de CPFs)
- ✅ Cards estilo V8 Digital
- ✅ Auto-refresh (5s)
- ✅ Exportação CSV
- ✅ Responsivo
- ✅ Autenticação JWT

## 🎨 Tema

Cores principais:
- Cyan: `#22d3ee`
- Verde: `#10b981`
- Vermelho: `#ef4444`
- Azul: `#3b82f6`
