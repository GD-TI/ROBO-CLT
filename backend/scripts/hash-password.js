#!/usr/bin/env node

/**
 * Script para gerar hash bcrypt de senhas
 *
 * Uso:
 *   node scripts/hash-password.js minhasenha123
 *   node scripts/hash-password.js
 */

const bcrypt = require('bcrypt');

// Pegar senha da linha de comando ou solicitar input
const senha = process.argv[2];

if (!senha) {
  console.error('❌ Erro: Forneça uma senha como argumento');
  console.log('\nUso:');
  console.log('  node scripts/hash-password.js minhasenha123');
  console.log('\nExemplo:');
  console.log('  node scripts/hash-password.js admin123');
  process.exit(1);
}

// Gerar hash
bcrypt.hash(senha, 10)
  .then(hash => {
    console.log('\n✅ Hash gerado com sucesso!\n');
    console.log('Senha original:', senha);
    console.log('Hash bcrypt:', hash);
    console.log('\n📋 SQL para criar usuário:\n');
    console.log(`INSERT INTO users (email, password_hash, name, role, active)`);
    console.log(`VALUES ('email@exemplo.com', '${hash}', 'Nome do Usuário', 'admin', true);`);
    console.log('\n');
  })
  .catch(error => {
    console.error('❌ Erro ao gerar hash:', error.message);
    process.exit(1);
  });
