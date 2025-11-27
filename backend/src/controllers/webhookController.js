const db = require('../config/database');

class WebhookController {
  /**
   * Receber webhook de status de consulta do banco
   * POST /webhook/consult
   *
   * Formato esperado do payload:
   * {
   *   "type": "CONSULT_STATUS_UPDATE",
   *   "timestamp": "2024-01-15T10:30:00Z",
   *   "consult_id": "consulta-123",
   *   "status": "SUCCESS",
   *   "available_margin_value": "5000.00",
   *   "admission_date_months_difference": 24,
   *   "month_min": 1,
   *   "month_max": 96,
   *   "installments_min": 1,
   *   "installments_max": 96,
   *   "value_min": 100.00,
   *   "value_max": 50000.00,
   *   ...outros campos
   * }
   */
  async receiveConsultWebhook(req, res) {
    try {
      const payload = req.body;

      console.log('📨 Webhook recebido:', JSON.stringify(payload, null, 2));

      // Validar campos obrigatórios
      if (!payload.consult_id || !payload.status) {
        return res.status(400).json({
          error: 'Campos obrigatórios faltando: consult_id e status são necessários'
        });
      }

      const {
        type,
        timestamp: timestamp_event,
        consult_id,
        status,
        available_margin_value,
        admission_date_months_difference,
        month_min,
        month_max,
        installments_min,
        installments_max,
        value_min,
        value_max
      } = payload;

      // SEMPRE inserir novo webhook (não atualizar o existente)
      // Mantém histórico de todas as mudanças de status
      await db.query(
        `INSERT INTO webhook_consult (
          type, timestamp_event, consult_id, status,
          available_margin_value, admission_date_months_difference,
          month_min, month_max, installments_min, installments_max,
          value_min, value_max, json_completo, recebido_em, processado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, false)`,
        [
          type || null,
          timestamp_event || null,
          consult_id,
          status,
          available_margin_value || null,
          admission_date_months_difference || null,
          month_min || null,
          month_max || null,
          installments_min || null,
          installments_max || null,
          value_min || null,
          value_max || null,
          JSON.stringify(payload)
        ]
      );

      console.log(`✅ Webhook inserido - Consulta #${consult_id}: ${status}`);

      // Responder sucesso ao banco
      res.status(200).json({
        success: true,
        message: 'Webhook recebido e processado com sucesso',
        consultId: consult_id,
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
      const { limit = 50, offset = 0, status, processado } = req.query;

      let query = `
        SELECT id, consult_id, status, available_margin_value,
               month_min, month_max, installments_min, installments_max,
               value_min, value_max, recebido_em, processado
        FROM webhook_consult
      `;
      const params = [];
      const conditions = [];

      if (status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (processado !== undefined) {
        conditions.push(`processado = $${params.length + 1}`);
        params.push(processado === 'true');
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY recebido_em DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
   * Obter webhook específico por consult_id
   * GET /webhook/consult/:id
   */
  async getConsultWebhook(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT id, type, timestamp_event, consult_id, status,
                available_margin_value, admission_date_months_difference,
                month_min, month_max, installments_min, installments_max,
                value_min, value_max, json_completo, recebido_em, processado
         FROM webhook_consult
         WHERE consult_id = $1
         ORDER BY recebido_em DESC
         LIMIT 1`,
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

  /**
   * Marcar webhook como processado
   * PUT /webhook/consult/:id/processed
   */
  async markAsProcessed(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE webhook_consult
         SET processado = true
         WHERE consult_id = $1
         RETURNING id, consult_id, status, processado`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Webhook não encontrado',
          consultId: id
        });
      }

      res.json({
        success: true,
        message: 'Webhook marcado como processado',
        webhook: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Erro ao marcar webhook como processado:', error);
      res.status(500).json({
        error: 'Erro ao marcar webhook como processado',
        message: error.message
      });
    }
  }
}

module.exports = new WebhookController();
