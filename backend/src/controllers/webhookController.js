const db = require('../config/database');

class WebhookController {
  /**
   * Receber webhook de status de consulta do banco
   * POST /webhook/consult
   */
  async receiveConsultWebhook(req, res) {
    try {
      const payload = req.body;

      console.log('📨 Webhook recebido:', JSON.stringify(payload, null, 2));

      // Validar campos obrigatórios
      if (!payload.id || !payload.status) {
        return res.status(400).json({
          error: 'Campos obrigatórios faltando: id e status são necessários'
        });
      }

      const {
        id,
        status,
        description,
        message
      } = payload;

      // Verificar se webhook já existe
      const existing = await db.query(
        'SELECT id FROM webhook_consult WHERE id = $1',
        [id]
      );

      if (existing.rows.length > 0) {
        // Atualizar webhook existente
        await db.query(
          `UPDATE webhook_consult
           SET status = $1, description = $2, message = $3, payload = $4, updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [status, description || null, message || null, JSON.stringify(payload), id]
        );

        console.log(`✅ Webhook atualizado - Consulta #${id}: ${status}`);
      } else {
        // Inserir novo webhook
        await db.query(
          `INSERT INTO webhook_consult (id, status, description, message, payload)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, status, description || null, message || null, JSON.stringify(payload)]
        );

        console.log(`✅ Webhook inserido - Consulta #${id}: ${status}`);
      }

      // Responder sucesso ao banco
      res.status(200).json({
        success: true,
        message: 'Webhook recebido e processado com sucesso',
        consultId: id,
        status: status
      });

    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      res.status(500).json({
        error: 'Erro ao processar webhook',
        message: error.message
      });
    }
  }

  /**
   * Listar webhooks recebidos (para debug/monitoramento)
   * GET /webhook/consult
   */
  async listConsultWebhooks(req, res) {
    try {
      const { limit = 50, offset = 0, status } = req.query;

      let query = `
        SELECT id, status, description, message, received_at, updated_at
        FROM webhook_consult
      `;
      const params = [];

      if (status) {
        query += ` WHERE status = $1`;
        params.push(status);
      }

      query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      res.json({
        webhooks: result.rows,
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      });

    } catch (error) {
      console.error('❌ Erro ao listar webhooks:', error);
      res.status(500).json({
        error: 'Erro ao listar webhooks',
        message: error.message
      });
    }
  }

  /**
   * Obter webhook específico por ID
   * GET /webhook/consult/:id
   */
  async getConsultWebhook(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT id, status, description, message, payload, received_at, updated_at
         FROM webhook_consult
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Webhook não encontrado',
          consultId: id
        });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('❌ Erro ao buscar webhook:', error);
      res.status(500).json({
        error: 'Erro ao buscar webhook',
        message: error.message
      });
    }
  }
}

module.exports = new WebhookController();
