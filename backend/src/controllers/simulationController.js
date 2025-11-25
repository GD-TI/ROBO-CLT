const db = require('../config/database');
const { simulationQueue } = require('../services/simulationWorker');
const bankCredentialController = require('./bankCredentialController');

class SimulationController {
  async create(req, res) {
    try {
      const { cpf, bank_credential_id } = req.body;
      const userId = req.user.id;

      if (!cpf || !bank_credential_id) {
        return res.status(400).json({ error: 'CPF e bank_credential_id são obrigatórios' });
      }

      if (!/^\d{11}$/.test(cpf)) {
        return res.status(400).json({ error: 'CPF deve conter 11 dígitos' });
      }

      // Verificar se a credencial existe e pertence ao usuário
      const credentialCheck = await db.query(
        'SELECT id FROM bank_credentials WHERE id = $1 AND user_id = $2 AND active = true',
        [bank_credential_id, userId]
      );

      if (credentialCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Credencial bancária não encontrada ou inativa' });
      }

      const result = await db.query(
        `INSERT INTO simulations (user_id, bank_credential_id, cpf, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, bank_credential_id, cpf, status, created_at`,
        [userId, bank_credential_id, cpf, 'PENDING']
      );

      const simulation = result.rows[0];

      await simulationQueue.add(
        {
          simulationId: simulation.id,
          cpf,
          bankCredentialId: bank_credential_id,
          userId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      res.status(201).json(simulation);
    } catch (error) {
      console.error('Create simulation error:', error);
      res.status(500).json({ error: 'Erro ao criar simulação' });
    }
  }

  async createBatch(req, res) {
    try {
      const { cpfs, bank_credential_id } = req.body;
      const userId = req.user.id;

      if (!cpfs || !Array.isArray(cpfs) || cpfs.length === 0) {
        return res.status(400).json({ error: 'CPFs deve ser um array não vazio' });
      }

      if (!bank_credential_id) {
        return res.status(400).json({ error: 'bank_credential_id é obrigatório' });
      }

      const invalidCpfs = cpfs.filter(cpf => !/^\d{11}$/.test(cpf));
      if (invalidCpfs.length > 0) {
        return res.status(400).json({ 
          error: 'Alguns CPFs são inválidos',
          invalid_cpfs: invalidCpfs 
        });
      }

      // Verificar se a credencial existe e pertence ao usuário
      const credentialCheck = await db.query(
        'SELECT id FROM bank_credentials WHERE id = $1 AND user_id = $2 AND active = true',
        [bank_credential_id, userId]
      );

      if (credentialCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Credencial bancária não encontrada ou inativa' });
      }

      const simulations = [];

      for (const cpf of cpfs) {
        const result = await db.query(
          `INSERT INTO simulations (user_id, bank_credential_id, cpf, status)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id, bank_credential_id, cpf, status, created_at`,
          [userId, bank_credential_id, cpf, 'PENDING']
        );

        const simulation = result.rows[0];
        simulations.push(simulation);

        await simulationQueue.add(
          {
            simulationId: simulation.id,
            cpf,
            bankCredentialId: bank_credential_id,
            userId,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: false,
            removeOnFail: false,
          }
        );
      }

      res.status(201).json({
        message: `${simulations.length} simulações criadas com sucesso`,
        simulations,
      });
    } catch (error) {
      console.error('Create batch simulations error:', error);
      res.status(500).json({ error: 'Erro ao criar simulações em lote' });
    }
  }

  async list(req, res) {
    try {
      const userId = req.user.id;
      const { status, cpf, page = 1, limit = 50 } = req.query;

      const offset = (page - 1) * limit;
      let query = `
        SELECT s.*, bc.partner_id as credential_partner_id, bc.name as credential_name
        FROM simulations s
        LEFT JOIN bank_credentials bc ON s.bank_credential_id = bc.id
        WHERE s.user_id = $1
      `;
      const params = [userId];
      let paramCount = 2;

      if (status) {
        query += ` AND s.status = $${paramCount++}`;
        params.push(status);
      }

      if (cpf) {
        query += ` AND s.cpf = $${paramCount++}`;
        params.push(cpf);
      }

      query += ` ORDER BY s.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      const countQuery = `
        SELECT COUNT(*) 
        FROM simulations s
        WHERE s.user_id = $1
        ${status ? 'AND s.status = $2' : ''}
        ${cpf ? `AND s.cpf = $${status ? 3 : 2}` : ''}
      `;
      const countParams = [userId];
      if (status) countParams.push(status);
      if (cpf) countParams.push(cpf);

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        simulations: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('List simulations error:', error);
      res.status(500).json({ error: 'Erro ao listar simulações' });
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await db.query(
        `SELECT s.*, bc.partner_id as credential_partner_id, bc.name as credential_name
         FROM simulations s
         LEFT JOIN bank_credentials bc ON s.bank_credential_id = bc.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Simulação não encontrada' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get simulation error:', error);
      res.status(500).json({ error: 'Erro ao buscar simulação' });
    }
  }

  async getLogs(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const simulation = await db.query(
        'SELECT id FROM simulations WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (simulation.rows.length === 0) {
        return res.status(404).json({ error: 'Simulação não encontrada' });
      }

      const result = await db.query(
        `SELECT id, endpoint, method, request_body, response_body, status_code, error, created_at
         FROM request_logs
         WHERE simulation_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get simulation logs error:', error);
      res.status(500).json({ error: 'Erro ao buscar logs da simulação' });
    }
  }

  async getStats(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `SELECT 
          status,
          COUNT(*) as count
         FROM simulations
         WHERE user_id = $1
         GROUP BY status`,
        [userId]
      );

      const stats = {
        total: 0,
        by_status: {},
      };

      result.rows.forEach(row => {
        stats.by_status[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      const avgResult = await db.query(
        `SELECT 
          AVG(CASE WHEN best_disbursement_value IS NOT NULL THEN best_disbursement_value ELSE 0 END) as avg_disbursement,
          MAX(best_disbursement_value) as max_disbursement,
          MIN(CASE WHEN best_disbursement_value > 0 THEN best_disbursement_value END) as min_disbursement
         FROM simulations
         WHERE user_id = $1 AND status = 'COMPLETED'`,
        [userId]
      );

      if (avgResult.rows.length > 0) {
        stats.avg_disbursement = parseFloat(avgResult.rows[0].avg_disbursement) || 0;
        stats.max_disbursement = parseFloat(avgResult.rows[0].max_disbursement) || 0;
        stats.min_disbursement = parseFloat(avgResult.rows[0].min_disbursement) || 0;
      }

      res.json(stats);
    } catch (error) {
      console.error('Get simulation stats error:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await db.query(
        'DELETE FROM simulations WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Simulação não encontrada' });
      }

      res.json({ message: 'Simulação removida com sucesso' });
    } catch (error) {
      console.error('Delete simulation error:', error);
      res.status(500).json({ error: 'Erro ao remover simulação' });
    }
  }
}

module.exports = new SimulationController();
