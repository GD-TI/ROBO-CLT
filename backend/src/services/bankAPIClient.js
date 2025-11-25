const axios = require('axios');
require('dotenv').config();

// Cache global de logins para evitar múltiplas requisições
const loginCache = new Map();
const LOGIN_CACHE_TTL = 23 * 60 * 60 * 1000; // 23 horas
const LOGIN_RETRY_DELAY = 5000; // 5 segundos entre tentativas
let lastLoginAttempt = 0;

class BankAPIClient {
  constructor(authToken = null) {
    this.authToken = authToken;
    this.bffBaseURL = process.env.BFF_BASE_URL;
    this.v8BaseURL = process.env.V8_BFF_BASE_URL;
    this.defaultConfigId = process.env.DEFAULT_CONFIG_ID;
    this.oauthURL = process.env.OAUTH_URL || 'https://auth.v8sistema.com/oauth/token';
  }

  _getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async login(email, password) {
    try {
      // Criar chave única para cache
      const cacheKey = `${email}:${password}`;
      
      // Verificar se tem login em cache válido
      const cached = loginCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < LOGIN_CACHE_TTL) {
        console.log(`✅ Usando token em cache para ${email}`);
        this.authToken = cached.token;
        return { 
          success: true, 
          token: cached.token,
          data: cached.data,
          fromCache: true
        };
      }

      // Proteção contra rate limit - aguardar entre tentativas
      const now = Date.now();
      const timeSinceLastLogin = now - lastLoginAttempt;
      if (timeSinceLastLogin < LOGIN_RETRY_DELAY) {
        const waitTime = LOGIN_RETRY_DELAY - timeSinceLastLogin;
        console.log(`⏱️  Aguardando ${waitTime}ms para evitar rate limit...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      lastLoginAttempt = Date.now();

      console.log(`🔐 Fazendo login para ${email}...`);

      const params = new URLSearchParams({
        grant_type: 'password',
        username: email,
        password: password,
        audience: 'https://bff.v8sistema.com',
        scope: 'offline_access',
        client_id: 'DHWogdaYmEI8n5bwwxPDzulMlSK7dwIn'
      });

      const response = await axios.post(
        this.oauthURL,
        params.toString(),
        { 
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 30000
        }
      );
      
      if (response.data && response.data.access_token) {
        this.authToken = response.data.access_token;
        
        // Salvar no cache
        loginCache.set(cacheKey, {
          token: response.data.access_token,
          data: response.data,
          timestamp: Date.now()
        });

        console.log(`✅ Login bem-sucedido para ${email}`);
        
        return { 
          success: true, 
          token: response.data.access_token,
          data: response.data,
          fromCache: false
        };
      }
      
      return { success: false, error: 'Token não encontrado na resposta' };
    } catch (error) {
      // Detectar rate limit
      if (error.response?.status === 429 || 
          error.response?.data?.message?.includes('muitas requisições') ||
          error.response?.data?.message?.includes('rate limit')) {
        console.error(`⚠️  RATE LIMIT detectado para login de ${email}`);
        return {
          success: false,
          error: 'Rate limit atingido. Aguarde alguns minutos e tente novamente.',
          rateLimit: true,
          status: 429,
        };
      }

      console.error(`❌ Erro no login de ${email}:`, error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }

  async createConsult(consultData) {
    try {
      const response = await axios.post(
        `${this.bffBaseURL}/private-consignment/consult`,
        consultData,
        { 
          headers: this._getHeaders(),
          timeout: 30000
        }
      );
      
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }

  async authorizeConsult(consultId) {
    try {
      const response = await axios.post(
        `${this.bffBaseURL}/private-consignment/consult/${consultId}/authorize`,
        {},
        { 
          headers: this._getHeaders(),
          timeout: 30000
        }
      );
      
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }

  async getConsultStatus(cpf) {
    try {
      const response = await axios.get(
        `${this.bffBaseURL}/private-consignment/consult/cpf/${cpf}`,
        { 
          headers: this._getHeaders(),
          timeout: 30000
        }
      );
      
      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }

  async preCalculateInstallments(consultId) {
    try {
      const payload = {
        consult_id: consultId,
        config_id: this.defaultConfigId,
      };

      const response = await axios.post(
        `${this.v8BaseURL}/private-consignment/simulation/pre-calculate-installments`,
        payload,
        { 
          headers: this._getHeaders(),
          timeout: 30000
        }
      );

      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }

  findBestInstallment(installments) {
    if (!installments || installments.length === 0) {
      console.log('❌ Nenhuma parcela disponível');
      return null;
    }

    console.log(`📊 Analisando ${installments.length} parcelas disponíveis`);

    // Log das primeiras parcelas para debug
    if (installments.length > 0) {
      console.log('📋 Exemplo de parcela:', JSON.stringify(installments[0], null, 2));
    }

    const best = installments.reduce((best, current) => {
      if (!best) return current;
      
      // Suportar ambos os formatos (camelCase e snake_case)
      const currentDisbursement = parseFloat(
        current.disbursementMaxValue || 
        current.disbursement_max_value || 
        0
      );
      
      const bestDisbursement = parseFloat(
        best.disbursementMaxValue || 
        best.disbursement_max_value || 
        0
      );
      
      return currentDisbursement > bestDisbursement ? current : best;
    }, null);

    if (best) {
      console.log('✅ Melhor parcela selecionada:', {
        numberOfInstallments: best.numberOfInstallments || best.number_of_installments,
        installmentFaceValue: best.installmentFaceValue || best.installment_face_value,
        disbursementMaxValue: best.disbursementMaxValue || best.disbursement_max_value
      });
    }

    return best;
  }

  async createSimulation(consultId, numberOfInstallments, installmentFaceValue) {
    try {
      // Validar parâmetros
      if (!numberOfInstallments) {
        console.error('❌ numberOfInstallments está vazio:', numberOfInstallments);
        return {
          success: false,
          error: 'numberOfInstallments é obrigatório'
        };
      }

      if (!installmentFaceValue) {
        console.error('❌ installmentFaceValue está vazio:', installmentFaceValue);
        return {
          success: false,
          error: 'installmentFaceValue é obrigatório'
        };
      }

      // Garantir que são números válidos
      const numInstallments = parseInt(numberOfInstallments);
      const faceValue = parseFloat(installmentFaceValue);

      if (isNaN(numInstallments) || isNaN(faceValue)) {
        console.error('❌ Valores inválidos:', { numberOfInstallments, installmentFaceValue });
        return {
          success: false,
          error: 'Valores de parcela inválidos'
        };
      }

      if (numInstallments <= 0 || faceValue <= 0) {
        console.error('❌ Valores devem ser positivos:', { numInstallments, faceValue });
        return {
          success: false,
          error: 'Valores devem ser maiores que zero'
        };
      }

      const payload = {
        consult_id: consultId,
        config_id: this.defaultConfigId,
        number_of_installments: numInstallments,
        installment_face_value: faceValue,
      };

      console.log('📤 Enviando simulação:', payload);

      const response = await axios.post(
        `${this.v8BaseURL}/private-consignment/simulation`,
        payload,
        { 
          headers: this._getHeaders(),
          timeout: 30000
        }
      );

      console.log('✅ Simulação criada com sucesso');

      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      console.error('❌ Erro ao criar simulação:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }
}

module.exports = BankAPIClient;