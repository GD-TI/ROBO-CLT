# Scripts de Gerenciamento de Usuários

## 📋 Scripts Disponíveis

### 1. `hash-password.js` - Gerar hash de senha

Gera um hash bcrypt de uma senha para uso em SQL.

**Uso:**
```bash
node scripts/hash-password.js <senha>
```

**Exemplo:**
```bash
node scripts/hash-password.js minhasenha123
```

**Saída:**
```
✅ Hash gerado com sucesso!

Senha original: minhasenha123
Hash bcrypt: $2b$10$...

📋 SQL para criar usuário:
INSERT INTO users (email, password_hash, name, role, active)
VALUES ('email@exemplo.com', '$2b$10$...', 'Nome do Usuário', 'admin', true);
```

---

### 2. `create-user.js` - Criar usuário no banco

Cria um usuário diretamente no banco de dados com senha criptografada.

**Uso:**
```bash
node scripts/create-user.js <email> <senha> <nome> [role]
```

**Parâmetros:**
- `email` - Email do usuário
- `senha` - Senha em texto plano (será criptografada automaticamente)
- `nome` - Nome completo (entre aspas se tiver espaços)
- `role` - Tipo: `admin` ou `regular` (padrão: `regular`)

**Exemplos:**

Criar usuário admin:
```bash
node scripts/create-user.js suporte@grupodigitalsf.com.br SenhaSegura2024 "Suporte Grupo Digital" admin
```

Criar usuário regular:
```bash
node scripts/create-user.js joao@empresa.com senha123 "João Silva"
```

**Saída:**
```
🔐 Criptografando senha...
💾 Criando usuário no banco de dados...

✅ Usuário criado com sucesso!

ID: 1
Email: suporte@grupodigitalsf.com.br
Nome: Suporte Grupo Digital
Role: 👑 Admin
Ativo: ✓
Criado em: 2024-01-15T10:30:00.000Z
```

---

## 🔐 Segurança

- Todas as senhas são criptografadas usando bcrypt com salt rounds = 10
- Os scripts verificam se o usuário já existe antes de criar
- Recomenda-se usar senhas fortes com letras, números e caracteres especiais

---

## 📝 Notas

- Certifique-se de que o arquivo `.env` está configurado corretamente
- O banco de dados deve estar rodando e acessível
- Use `psql` para executar comandos SQL manualmente se preferir
