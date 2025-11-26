#!/usr/bin/env node

/**
 * Script para criar usuário diretamente no banco de dados
 *
 * Uso:
 *   node scripts/create-user.js <email> <senha> <nome> [role]
 *
 * Exemplos:
 *   node scripts/create-user.js admin@empresa.com senha123 "Admin Geral" admin
 *   node scripts/create-user.js user@empresa.com senha123 "João Silva" regular
 */

const bcrypt = require('bcrypt');
const db = require('../src/config/database');

const [email, senha, nome, role = 'regular'] = process.argv.slice(2);

if (!email || !senha || !nome) {
  console.error('❌ Erro: Parâmetros faltando\n');
  console.log('Uso:');
  console.log('  node scripts/create-user.js <email> <senha> <nome> [role]\n');
  console.log('Parâmetros:');
  console.log('  email  - Email do usuário (ex: admin@empresa.com)');
  console.log('  senha  - Senha em texto plano (será criptografada)');
  console.log('  nome   - Nome completo (entre aspas se tiver espaços)');
  console.log('  role   - Tipo de usuário: admin ou regular (padrão: regular)\n');
  console.log('Exemplos:');
  console.log('  node scripts/create-user.js admin@empresa.com senha123 "Admin Geral" admin');
  console.log('  node scripts/create-user.js user@empresa.com senha123 "João Silva"');
  process.exit(1);
}

// Validar role
if (role !== 'admin' && role !== 'regular') {
  console.error('❌ Erro: role deve ser "admin" ou "regular"');
  process.exit(1);
}

async function createUser() {
  try {
    // Verificar se usuário já existe
    const existingUser = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.error(`❌ Erro: Usuário com email ${email} já existe!`);
      console.log('\n💡 Se deseja alterar a senha, use:');
      console.log(`   UPDATE users SET password_hash = 'novo_hash' WHERE email = '${email}';`);
      process.exit(1);
    }

    // Gerar hash da senha
    console.log('🔐 Criptografando senha...');
    const passwordHash = await bcrypt.hash(senha, 10);

    // Inserir usuário
    console.log('💾 Criando usuário no banco de dados...');
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, name, role, active, created_at`,
      [email, passwordHash, nome, role]
    );

    const user = result.rows[0];

    console.log('\n✅ Usuário criado com sucesso!\n');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Nome:', user.name);
    console.log('Role:', user.role === 'admin' ? '👑 Admin' : '👤 Regular');
    console.log('Ativo:', user.active ? '✓' : '✗');
    console.log('Criado em:', user.created_at);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  }
}

createUser();
