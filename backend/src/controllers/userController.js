const db = require('../config/database');
const bcrypt = require('bcrypt');

class UserController {
  // Listar todos os usuários (apenas admin)
  async list(req, res) {
    try {
      // Verificar se usuário é admin
      const currentUser = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.id]
      );

      if (currentUser.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
      }

      const result = await db.query(
        `SELECT id, email, name, role, active, created_at, updated_at
         FROM users
         ORDER BY created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  }

  // Criar novo usuário (apenas admin)
  async create(req, res) {
    try {
      const { email, password, name, role } = req.body;

      // Verificar se usuário atual é admin
      const currentUser = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.id]
      );

      if (currentUser.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
      }

      // Validar dados
      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Email, senha e nome são obrigatórios'
        });
      }

      // Verificar se email já existe
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: 'Email já cadastrado'
        });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, 10);

      // Criar usuário
      const result = await db.query(
        `INSERT INTO users (email, password_hash, name, role, active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, email, name, role, active, created_at`,
        [email, passwordHash, name, role || 'regular']
      );

      res.status(201).json({
        message: 'Usuário criado com sucesso',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }

  // Atualizar usuário (apenas admin)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { email, name, role, active, password } = req.body;

      // Verificar se usuário atual é admin
      const currentUser = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.id]
      );

      if (currentUser.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
      }

      // Montar query dinâmica
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (role !== undefined) {
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
      }
      if (active !== undefined) {
        updates.push(`active = $${paramIndex++}`);
        values.push(active);
      }
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramIndex++}`);
        values.push(passwordHash);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await db.query(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, name, role, active, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json({
        message: 'Usuário atualizado com sucesso',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  }

  // Deletar usuário (apenas admin)
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Verificar se usuário atual é admin
      const currentUser = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.id]
      );

      if (currentUser.rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
      }

      // Não permitir deletar a si mesmo
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          error: 'Você não pode deletar sua própria conta'
        });
      }

      const result = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
  }
}

module.exports = new UserController();
