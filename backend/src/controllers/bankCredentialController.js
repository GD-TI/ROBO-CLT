const crypto = require('crypto');
const db = require('../config/database');
const BankAPIClient = require('../services/bankAPIClient');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

class BankCredentialController {
  async create(req, res) {
    try {
      const { partner_id, name, email, password } = req.body;
      const userId = req.user.id;

      if (!partner_id || !name || !email || !password) {
        return res.status(400).json({ error: 'partner_id, name, email e password são obrigatórios' });
      }

      const encryptedEmail = encrypt(email);
      const encryptedPassword = encrypt(password);

      const result = await db.query(
        `INSERT INTO bank_credentials (user_id, partner_id, name, encrypted_email, encrypted_password)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, partner_id, name, active, created_at`,
        [userId, partner_id, name, encryptedEmail, encryptedPassword]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create credential error:', error);
      res.status(500).json({ error: 'Erro ao criar credencial bancária' });
    }
  }

  async list(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `SELECT id, user_id, partner_id, name, active, 
                CASE WHEN cached_token IS NOT NULL AND token_expires_at > NOW() 
                THEN true ELSE false END as has_valid_token,
                created_at, updated_at
         FROM bank_credentials
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('List credentials error:', error);
      res.status(500).json({ error: 'Erro ao listar credenciais bancárias' });
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await db.query(
        `SELECT id, user_id, partner_id, name, active, 
                CASE WHEN cached_token IS NOT NULL AND token_expires_at > NOW() 
                THEN true ELSE false END as has_valid_token,
                created_at, updated_at
         FROM bank_credentials
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Credencial não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get credential error:', error);
      res.status(500).json({ error: 'Erro ao buscar credencial bancária' });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { partner_id, name, email, password, active } = req.body;
      const userId = req.user.id;

      const credential = await db.query(
        'SELECT id FROM bank_credentials WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (credential.rows.length === 0) {
        return res.status(404).json({ error: 'Credencial não encontrada' });
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (partner_id !== undefined) {
        updates.push(`partner_id = $${paramCount++}`);
        values.push(partner_id);
      }
      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (email !== undefined) {
        updates.push(`encrypted_email = $${paramCount++}`);
        values.push(encrypt(email));
        updates.push(`cached_token = NULL, token_expires_at = NULL`);
      }
      if (password !== undefined) {
        updates.push(`encrypted_password = $${paramCount++}`);
        values.push(encrypt(password));
        updates.push(`cached_token = NULL, token_expires_at = NULL`);
      }
      if (active !== undefined) {
        updates.push(`active = $${paramCount++}`);
        values.push(active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      values.push(id, userId);

      const result = await db.query(
        `UPDATE bank_credentials 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount++} AND user_id = $${paramCount}
         RETURNING id, user_id, partner_id, name, active, created_at, updated_at`,
        values
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update credential error:', error);
      res.status(500).json({ error: 'Erro ao atualizar credencial bancária' });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await db.query(
        'DELETE FROM bank_credentials WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Credencial não encontrada' });
      }

      res.json({ message: 'Credencial removida com sucesso' });
    } catch (error) {
      console.error('Delete credential error:', error);
      res.status(500).json({ error: 'Erro ao remover credencial bancária' });
    }
  }

  async testLogin(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Usar bankCredentialController em vez de this
      const token = await bankCredentialController.getValidToken(id, userId);

      if (!token) {
        return res.status(401).json({ error: 'Falha ao fazer login no banco' });
      }

      res.json({ 
        message: 'Login realizado com sucesso',
        has_token: true 
      });
    } catch (error) {
      console.error('Test login error:', error);
      res.status(500).json({ error: 'Erro ao testar login bancário' });
    }
  }

  async getValidToken(credentialId, userId) {
    const result = await db.query(
      `SELECT encrypted_email, encrypted_password, cached_token, token_expires_at 
       FROM bank_credentials 
       WHERE id = $1 AND user_id = $2 AND active = true`,
      [credentialId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const credential = result.rows[0];

    // Verificar se tem token em cache válido
    if (credential.cached_token && credential.token_expires_at) {
      const expiresAt = new Date(credential.token_expires_at);
      const now = new Date();
      
      // Se o token ainda é válido por mais de 5 minutos, usa ele
      if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
        return credential.cached_token;
      }
    }

    // Token expirado ou não existe, fazer novo login
    const email = decrypt(credential.encrypted_email);
    const password = decrypt(credential.encrypted_password);

    const client = new BankAPIClient();
    const loginResult = await client.login(email, password);

    if (!loginResult.success) {
      console.error('Bank login failed:', loginResult.error);
      return null;
    }

    // Salvar token em cache (válido por 23 horas - deixa margem)
    const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
    
    await db.query(
      `UPDATE bank_credentials 
       SET cached_token = $1, token_expires_at = $2 
       WHERE id = $3`,
      [loginResult.token, expiresAt, credentialId]
    );

    return loginResult.token;
  }
}

// Criar instância para export
const bankCredentialController = new BankCredentialController();

module.exports = bankCredentialController;
