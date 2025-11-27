const Queue = require('bull');
const BankAPIClient = require('./bankAPIClient');
const db = require('../config/database');
const sqlServer = require('../config/sqlserver');
require('dotenv').config();

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

if (process.env.REDIS_TLS === 'true') {
  redisConfig.tls = {};
}

// Configuração de concorrência (workers simultâneos)
const MAX_CONCURRENT_SIMULATIONS = parseInt(process.env.MAX_CONCURRENT_SIMULATIONS) || 120;
const MAX_CONCURRENT_RETRIES = parseInt(process.env.MAX_CONCURRENT_RETRIES) || 60;

// Configuração de workers por tipo de usuário
const ADMIN_WORKERS_PER_USER = parseInt(process.env.ADMIN_WORKERS_PER_USER) || 60;
const REGULAR_WORKERS_PER_USER = parseInt(process.env.REGULAR_WORKERS_PER_USER) || 20;

// Rastreamento de workers ativos por usuário
const activeWorkersByUser = new Map(); // userId -> count

console.log(`⚙️  Configuração de Workers:`);
console.log(`   - Simulações simultâneas (total): ${MAX_CONCURRENT_SIMULATIONS}`);
console.log(`   - Retries simultâneos: ${MAX_CONCURRENT_RETRIES}`);
console.log(`   - Workers por usuário admin: ${ADMIN_WORKERS_PER_USER}`);
console.log(`   - Workers por usuário regular: ${REGULAR_WORKERS_PER_USER}`);

// Fila principal
const simulationQueue = new Queue('simulation-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Fila de retry para waiting_consult
const retryQueue = new Queue('retry-waiting-consult', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 10, // Tentar 10 vezes
    backoff: {
      type: 'fixed',
      delay: 30000, // 30 segundos entre tentativas
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Eventos da fila principal
simulationQueue.on('error', (error) => {
  console.error('❌ Queue error:', error.message);
});

simulationQueue.on('active', (job) => {
  console.log(`🔄 Processando job ${job.id} - CPF: ${job.data.cpf}`);
});

simulationQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completado - Status: ${result.status}`);
});

simulationQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falhou:`, err.message);
});

// Eventos da fila de retry
retryQueue.on('active', (job) => {
  console.log(`🔁 Retry job ${job.id} - CPF: ${job.data.cpf} (tentativa ${job.attemptsMade + 1}/10)`);
});

retryQueue.on('completed', (job, result) => {
  console.log(`✅ Retry job ${job.id} completado - Status: ${result.status}`);
});

retryQueue.on('failed', (job, err) => {
  console.error(`❌ Retry job ${job.id} esgotou tentativas:`, err.message);
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Funções de controle de concorrência por usuário
async function getUserRole(userId) {
  try {
    const result = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.role || 'regular';
  } catch (error) {
    console.error(`Erro ao buscar role do usuário ${userId}:`, error.message);
    return 'regular'; // Default para regular em caso de erro
  }
}

function getUserWorkerLimit(role) {
  return role === 'admin' ? ADMIN_WORKERS_PER_USER : REGULAR_WORKERS_PER_USER;
}

function getActiveWorkerCount(userId) {
  return activeWorkersByUser.get(userId) || 0;
}

function incrementActiveWorkers(userId) {
  const current = getActiveWorkerCount(userId);
  activeWorkersByUser.set(userId, current + 1);
  console.log(`👤 Usuário #${userId}: ${current + 1} workers ativos`);
}

function decrementActiveWorkers(userId) {
  const current = getActiveWorkerCount(userId);
  if (current > 0) {
    activeWorkersByUser.set(userId, current - 1);
    console.log(`👤 Usuário #${userId}: ${current - 1} workers ativos`);
  }
}

async function canUserProcessJob(userId) {
  const role = await getUserRole(userId);
  const limit = getUserWorkerLimit(role);
  const active = getActiveWorkerCount(userId);
  return active < limit;
}

async function checkJobStatus(jobId) {
  try {
    if (!jobId) return 'PROCESSING'; // Se não tem jobId, continuar

    const result = await db.query(
      'SELECT status FROM jobs WHERE id = $1',
      [jobId]
    );

    return result.rows[0]?.status || 'PROCESSING';
  } catch (error) {
    console.error(`Erro ao verificar status do job ${jobId}:`, error.message);
    return 'PROCESSING'; // Em caso de erro, continuar processando
  }
}

function formatPhone(phone) {
  if (!phone) return { phoneNumber: '', countryCode: '55', areaCode: '' };
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return {
      phoneNumber: cleaned.substring(2),
      countryCode: '55',
      areaCode: cleaned.substring(0, 2),
    };
  } else if (cleaned.length === 10) {
    return {
      phoneNumber: cleaned.substring(2),
      countryCode: '55',
      areaCode: cleaned.substring(0, 2),
    };
  }
  
  return {
    phoneNumber: cleaned,
    countryCode: '55',
    areaCode: '',
  };
}

function generateRandomPhone() {
  const areaCodes = ['11', '21', '31', '41', '51', '61', '71', '81', '85', '91'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const phoneNumber = '9' + Math.floor(10000000 + Math.random() * 90000000);
  
  return {
    phoneNumber: phoneNumber,
    countryCode: '55',
    areaCode: areaCode,
  };
}

function formatBirthDate(date) {
  if (!date) return null;
  
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  
  const cleaned = date.toString().replace(/\D/g, '');
  
  if (cleaned.length === 8) {
    const day = cleaned.substring(0, 2);
    const month = cleaned.substring(2, 4);
    const year = cleaned.substring(4, 8);
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

async function logRequest(simulationId, endpoint, method, requestBody, responseBody, statusCode, error = null) {
  try {
    await db.query(
      `INSERT INTO request_logs (simulation_id, endpoint, method, request_body, response_body, status_code, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        simulationId,
        endpoint,
        method,
        JSON.stringify(requestBody),
        JSON.stringify(responseBody),
        statusCode,
        error,
      ]
    );
  } catch (logError) {
    console.error('Error logging request:', logError);
  }
}

async function updateSimulation(simulationId, data) {
  const updates = [];
  const values = [];
  let paramCount = 1;

  Object.keys(data).forEach(key => {
    updates.push(`${key} = $${paramCount++}`);
    values.push(data[key]);
  });

  if (updates.length === 0) return;

  values.push(simulationId);

  await db.query(
    `UPDATE simulations SET ${updates.join(', ')} WHERE id = $${paramCount}`,
    values
  );
}

// Função para verificar se todas as simulações normais do job foram processadas
async function checkAndRetryWaitingConsults(jobId) {
  try {
    // Buscar todas as simulações do job
    const result = await db.query(
      `SELECT status, id, cpf, bank_credential_id
       FROM simulations
       WHERE job_id = $1`,
      [jobId]
    );

    const simulations = result.rows;

    // Verificar se ainda há simulações PENDING ou PROCESSING
    const stillProcessing = simulations.some(s =>
      s.status === 'PENDING' || s.status === 'PROCESSING'
    );

    if (stillProcessing) {
      console.log(`⏸️  Job #${jobId} ainda tem simulações pendentes. Aguardando...`);
      return;
    }

    // Buscar todas as simulações WAITING_CONSULT
    const waitingConsults = simulations.filter(s => s.status === 'WAITING_CONSULT');

    if (waitingConsults.length === 0) {
      console.log(`✅ Job #${jobId} concluído sem consultas em espera`);
      return;
    }

    console.log(`🔄 Job #${jobId} - Reprocessando ${waitingConsults.length} consultas em espera...`);

    // Buscar consult_id de cada simulação e adicionar na fila de retry
    for (const sim of waitingConsults) {
      const simDetails = await db.query(
        `SELECT consult_id, user_id FROM simulations WHERE id = $1`,
        [sim.id]
      );

      if (simDetails.rows.length > 0) {
        const { consult_id, user_id } = simDetails.rows[0];

        await retryQueue.add({
          simulationId: sim.id,
          cpf: sim.cpf,
          consultId: consult_id,
          bankCredentialId: sim.bank_credential_id,
          userId: user_id,
        }, {
          delay: 5000, // 5 segundos apenas
        });

        console.log(`  ✅ Simulação #${sim.id} adicionada à fila de retry`);
      }
    }
  } catch (error) {
    console.error('Erro ao verificar consultas em espera:', error);
  }
}

async function getCPFDataFromSerasa(cpf) {
  try {
    const result = await sqlServer.getCPFData([cpf]);
    
    if (result.length === 0) {
      return null;
    }
    
    return {
      cpf: result[0].cpf,
      nome: result[0].nome,
      nasc: result[0].nasc,
      sexo: result[0].sexo,
    };
  } catch (error) {
    console.error('Error fetching CPF data from SERASA:', error);
    return null;
  }
}

// Função auxiliar para verificar status da consulta (usando webhook_consult)
async function checkConsultStatus(client, cpf, consultId, simulationId) {
  try {
    // Buscar status na tabela webhook_consult ao invés de chamar API
    const result = await db.query(
      `SELECT consult_id, status, available_margin_value,
              admission_date_months_difference, month_min, month_max,
              installments_min, installments_max, value_min, value_max,
              json_completo, recebido_em, processado
       FROM webhook_consult
       WHERE consult_id = $1
       ORDER BY recebido_em DESC
       LIMIT 1`,
      [consultId]
    );

    if (result.rows.length === 0) {
      console.log(`⚠️  Consulta ${consultId} não encontrada na tabela webhook_consult (webhook ainda não recebido)`);
      return {
        status: 'WAITING_CONSULT',
        data: {
          id: consultId,
          description: 'Aguardando webhook do banco',
          message: 'Webhook ainda não recebido'
        }
      };
    }

    const webhookData = result.rows[0];

    // Log do status atual
    console.log(`📊 Status da consulta ${consultId} (webhook): ${webhookData.status}`);

    // Extrair description e message do json_completo se disponível
    const jsonData = webhookData.json_completo || {};
    const description = jsonData.description || jsonData.message || 'Status atualizado via webhook';

    return {
      status: webhookData.status,
      data: {
        id: webhookData.consult_id,
        status: webhookData.status,
        description: description,
        message: description,
        availableMarginValue: webhookData.available_margin_value,
        ...jsonData // Incluir dados adicionais do json_completo
      }
    };
  } catch (error) {
    console.error(`❌ Erro ao buscar status da consulta ${consultId}:`, error);
    return {
      status: 'ERROR',
      data: {
        error: error.message,
        description: 'Erro ao verificar status no banco de dados'
      }
    };
  }
}

// Worker principal - Processa novas simulações
simulationQueue.process(MAX_CONCURRENT_SIMULATIONS, async (job) => {
  const { simulationId, cpf, bankCredentialId, userId, jobId } = job.data;

  console.log(`\n🔄 Iniciando processamento - Simulação #${simulationId} - CPF: ${cpf} - Usuário #${userId}`);

  // Verificar se o usuário pode processar mais jobs
  const canProcess = await canUserProcessJob(userId);
  if (!canProcess) {
    const role = await getUserRole(userId);
    const limit = getUserWorkerLimit(role);
    console.log(`⏸️  Usuário #${userId} atingiu o limite de ${limit} workers. Reenfileirando job...`);
    // Recolocar job na fila com pequeno delay
    await simulationQueue.add(job.data, { delay: 2000 });
    return { status: 'REQUEUED', message: 'Usuário atingiu limite de workers' };
  }

  // Incrementar contador de workers ativos para este usuário
  incrementActiveWorkers(userId);

  try {
    // Verificar se o job foi pausado ou cancelado
    const jobStatus = await checkJobStatus(jobId);
    if (jobStatus === 'PAUSED') {
      console.log(`⏸️  Job #${jobId} está pausado. Reenfileirando simulação...`);
      await simulationQueue.add(job.data, { delay: 5000 });
      return { status: 'REQUEUED', message: 'Job pausado' };
    }
    if (jobStatus === 'CANCELLED') {
      console.log(`❌ Job #${jobId} foi cancelado. Parando simulação...`);
      await updateSimulation(simulationId, {
        status: 'FAILED',
        error_message: 'Job cancelado pelo usuário',
        description: 'Job foi cancelado'
      });
      return { status: 'CANCELLED', message: 'Job cancelado' };
    }

    await updateSimulation(simulationId, { status: 'PROCESSING' });

    console.log(`📊 Buscando dados no SERASA...`);
    const cpfData = await getCPFDataFromSerasa(cpf);

    if (!cpfData) {
      await updateSimulation(simulationId, {
        status: 'FAILED',
        description: 'CPF não encontrado no SERASA',
        error_message: 'CPF não encontrado na base de dados SERASA',
      });
      return { status: 'FAILED', message: 'CPF não encontrado no SERASA' };
    }

    console.log(`🔐 Obtendo token bancário...`);
    const bankCredentialController = require('../controllers/bankCredentialController');
    const authToken = await bankCredentialController.getValidToken(bankCredentialId, userId);

    if (!authToken) {
      await updateSimulation(simulationId, {
        status: 'FAILED',
        description: 'Falha ao obter token bancário',
        error_message: 'Não foi possível fazer login no banco',
      });
      return { status: 'FAILED', message: 'Falha ao obter token bancário' };
    }

    const client = new BankAPIClient(authToken);

    const phoneData = generateRandomPhone();
    const birthDate = formatBirthDate(cpfData.nasc);
    const gender = cpfData.sexo?.toLowerCase() === 'f' ? 'female' : 'male';

    await updateSimulation(simulationId, {
      name: cpfData.nome,
      birth_date: birthDate,
      gender: gender,
    });

    console.log(`📝 Criando consulta...`);
    const consultPayload = {
      borrowerDocumentNumber: cpf,
      gender: gender,
      birthDate: birthDate,
      signerName: cpfData.nome,
      signerEmail: process.env.DEFAULT_SIGNER_EMAIL,
      signerPhone: {
          phoneNumber: phoneData.phoneNumber,
          countryCode: phoneData.countryCode,
          areaCode: phoneData.areaCode
      },
      provider:"QI"
    };

    const consultResult = await client.createConsult(consultPayload);
    
    await logRequest(
      simulationId,
      '/private-consignment/consult',
      'POST',
      consultPayload,
      consultResult.data,
      consultResult.status || 200,
      consultResult.success ? null : JSON.stringify(consultResult.error)
    );

    if (!consultResult.success || !consultResult.data?.id) {
      await updateSimulation(simulationId, {
        status: 'FAILED',
        description: 'Falha ao criar consulta',
        error_message: JSON.stringify(consultResult.error),
      });
      return { status: 'FAILED', message: 'Falha ao criar consulta' };
    }

    const consultId = consultResult.data.id;
    await updateSimulation(simulationId, { consult_id: consultId });

    console.log(`✅ Autorizando consulta ${consultId}...`);
    const authorizeResult = await client.authorizeConsult(consultId);
    
    await logRequest(
      simulationId,
      `/private-consignment/consult/${consultId}/authorize`,
      'POST',
      {},
      authorizeResult.data,
      authorizeResult.status || 200,
      authorizeResult.success ? null : JSON.stringify(authorizeResult.error)
    );

    if (!authorizeResult.success) {
      await updateSimulation(simulationId, {
        status: 'FAILED',
        description: 'Falha ao autorizar consulta',
        error_message: JSON.stringify(authorizeResult.error),
      });
      return { status: 'FAILED', message: 'Falha ao autorizar consulta' };
    }

    // ✅ AGUARDAR APENAS 3 TENTATIVAS (rápido)
    console.log(`⏳ Verificando status da consulta (tentativas rápidas)...`);
    const quickRetries = 3;
    const quickInterval = 3000; // 3 segundos

    let consultStatus;
    for (let i = 0; i < quickRetries; i++) {
      await sleep(quickInterval);

      consultStatus = await checkConsultStatus(client, cpf, consultId, simulationId);

      if (consultStatus.status === 'SUCCESS') {
        console.log(`✅ Consulta aprovada rapidamente!`);
        break;
      } else if (consultStatus.status === 'ERROR' || consultStatus.status === 'FAILED' || consultStatus.status === 'REJECTED') {
        console.log(`❌ Consulta rejeitada com status: ${consultStatus.status}`);
        await updateSimulation(simulationId, {
          status: 'REJECTED',
          description: consultStatus.data?.description || consultStatus.data?.message || 'Consulta rejeitada pelo banco',
        });
        return { status: 'REJECTED', message: 'Consulta rejeitada pelo banco' };
      }
    }

    // ✅ SE AINDA WAITING_CONSULT, APENAS MARCAR (NÃO adicionar na fila ainda)
    if (consultStatus.status !== 'SUCCESS') {
      // Verificar novamente se não é um status de rejeição
      if (consultStatus.status === 'ERROR' || consultStatus.status === 'FAILED' || consultStatus.status === 'REJECTED') {
        console.log(`❌ Consulta rejeitada após tentativas com status: ${consultStatus.status}`);
        await updateSimulation(simulationId, {
          status: 'REJECTED',
          description: consultStatus.data?.description || consultStatus.data?.message || 'Consulta rejeitada pelo banco',
        });
        return { status: 'REJECTED', message: 'Consulta rejeitada pelo banco' };
      }

      // Apenas se for realmente WAITING_CONSULT ou PROCESSING
      console.log(`⏸️  Consulta ainda aguardando (${consultStatus.status}). Será reprocessada após outras simulações...`);

      await updateSimulation(simulationId, {
        status: 'WAITING_CONSULT',
        description: consultStatus.data?.description || consultStatus.data?.message || `Aguardando resposta do banco - Status: ${consultStatus.status}`,
      });

      // NÃO adicionar na fila de retry agora
      // Será adicionado quando todas as outras simulações do job terminarem

      return { status: 'WAITING_CONSULT', message: 'Marcado para retry posterior' };
    }

    // ✅ CONTINUAR NORMALMENTE SE JÁ ESTÁ SUCCESS
    const result = await processSimulation(client, simulationId, cpf, consultId);

    // Verificar se há consultas WAITING_CONSULT para reprocessar
    if (jobId) {
      await checkAndRetryWaitingConsults(jobId);
    }

    return result;

  } catch (error) {
    console.error(`❌ Erro na simulação #${simulationId}:`, error);

    await updateSimulation(simulationId, {
      status: 'FAILED',
      error_message: error.message,
      description: 'Erro no processamento',
    });

    // Verificar se há consultas WAITING_CONSULT para reprocessar
    if (jobId) {
      await checkAndRetryWaitingConsults(jobId);
    }

    return { status: 'FAILED', message: error.message };
  } finally {
    // Sempre decrementar o contador ao finalizar (sucesso ou erro)
    decrementActiveWorkers(userId);
  }
});

// Worker de retry - Processa simulações em WAITING_CONSULT
retryQueue.process(MAX_CONCURRENT_RETRIES, async (job) => {
  const { simulationId, cpf, consultId, bankCredentialId, userId } = job.data;

  console.log(`\n🔁 Retry #${job.attemptsMade + 1}/10 - Simulação #${simulationId} - CPF: ${cpf}`);

  try {
    // Obter token novamente
    const bankCredentialController = require('../controllers/bankCredentialController');
    const authToken = await bankCredentialController.getValidToken(bankCredentialId, userId);

    if (!authToken) {
      throw new Error('Falha ao obter token bancário no retry');
    }

    const client = new BankAPIClient(authToken);

    // Verificar status
    const consultStatus = await checkConsultStatus(client, cpf, consultId, simulationId);

    if (consultStatus.status === 'SUCCESS') {
      console.log(`✅ Consulta aprovada no retry!`);

      await updateSimulation(simulationId, {
        status: 'PROCESSING',
        description: consultStatus.data?.description || consultStatus.data?.message || 'Retomando processamento após aprovação',
      });

      // Continuar processamento
      return await processSimulation(client, simulationId, cpf, consultId);

    } else if (consultStatus.status === 'ERROR' || consultStatus.status === 'FAILED' || consultStatus.status === 'REJECTED') {
      console.log(`❌ Consulta rejeitada no retry com status: ${consultStatus.status}`);
      await updateSimulation(simulationId, {
        status: 'REJECTED',
        description: consultStatus.data?.description || consultStatus.data?.message || 'Consulta rejeitada pelo banco',
      });
      // NÃO FAZER MAIS RETRY - retornar sucesso para parar as tentativas
      return { status: 'REJECTED', message: 'Consulta rejeitada - sem retry' };

    } else {
      // Ainda waiting, continuar tentando
      console.log(`⏸️  Ainda aguardando (${consultStatus.status}). Tentando novamente em 30s...`);

      await updateSimulation(simulationId, {
        description: consultStatus.data?.description || consultStatus.data?.message || `Aguardando resposta - Tentativa ${job.attemptsMade + 1}/10`,
      });

      throw new Error('Ainda em waiting_consult'); // Força retry
    }

  } catch (error) {
    console.error(`❌ Erro no retry da simulação #${simulationId}:`, error.message);
    
    // Se esgotou tentativas (10 tentativas = ~5 minutos)
    if (job.attemptsMade >= 9) {
      await updateSimulation(simulationId, {
        status: 'TIMEOUT',
        description: 'Timeout após múltiplas tentativas',
        error_message: 'Banco não respondeu após 10 tentativas',
      });
    }

    throw error; // Propaga erro para Bull fazer retry
  }
});

// Função auxiliar para processar simulação (após consulta aprovada)
async function processSimulation(client, simulationId, cpf, consultId) {
  // Buscar informações da consulta para pegar o description
  const consultStatus = await checkConsultStatus(client, cpf, consultId, simulationId);
  const consultDescription = consultStatus.data?.description || null;

  // Registrar a chamada de busca de status nos logs
  await logRequest(
    simulationId,
    '/private-consignment/consult',
    'GET',
    { cpf, consultId },
    consultStatus.data || {},
    200,
    consultStatus.status === 'ERROR' ? 'Error fetching consult status' : null
  );

  console.log(`🧮 Calculando parcelas...`);
  const preCalcResult = await client.preCalculateInstallments(consultId);
  
  await logRequest(
    simulationId,
    '/private-consignment/simulation/pre-calculate-installments',
    'POST',
    { consult_id: consultId },
    preCalcResult.data,
    preCalcResult.status || 200,
    preCalcResult.success ? null : JSON.stringify(preCalcResult.error)
  );

  if (!preCalcResult.success || !preCalcResult.data?.installments) {
    await updateSimulation(simulationId, {
      status: 'FAILED',
      description: 'Falha ao calcular parcelas',
      error_message: JSON.stringify(preCalcResult.error),
    });
    return { status: 'FAILED', message: 'Falha ao calcular parcelas' };
  }

  const bestInstallment = client.findBestInstallment(preCalcResult.data.installments);

  if (!bestInstallment) {
    await updateSimulation(simulationId, {
      status: 'FAILED',
      description: 'Nenhuma parcela disponível',
    });
    return { status: 'FAILED', message: 'Nenhuma parcela disponível' };
  }

  // Extrair valores do novo formato
  const numberOfInstallments = parseInt(bestInstallment.installmentNumbers);
  const installmentFaceValue = parseFloat(bestInstallment.maxInstallmentValue);
  const disbursementMaxValue = parseFloat(bestInstallment.disbursementMaxValue);
  const operationValue = parseFloat(bestInstallment.operationMaxValue);

  console.log('🔍 Valores extraídos:', {
    numberOfInstallments,
    installmentFaceValue,
    disbursementMaxValue,
    operationValue,
    bestInstallment: JSON.stringify(bestInstallment)
  });

  if (!numberOfInstallments || !installmentFaceValue) {
    console.error('❌ Campos obrigatórios faltando:', {
      numberOfInstallments,
      installmentFaceValue,
      bestInstallment: JSON.stringify(bestInstallment)
    });
    
    await updateSimulation(simulationId, {
      status: 'FAILED',
      description: 'Erro: campos de parcela inválidos',
      error_message: 'numberOfInstallments ou installmentFaceValue ausente'
    });
    
    return { status: 'FAILED', message: 'Campos de parcela inválidos' };
  }

  console.log(`💰 Criando simulação final com ${numberOfInstallments} parcelas de ${installmentFaceValue}...`);
  
  const simulationResult = await client.createSimulation(
    consultId,
    numberOfInstallments,
    installmentFaceValue
  );

  await logRequest(
    simulationId,
    '/private-consignment/simulation',
    'POST',
    {
      consult_id: consultId,
      number_of_installments: numberOfInstallments,
      installment_face_value: installmentFaceValue,
    },
    simulationResult.data,
    simulationResult.status || 200,
    simulationResult.success ? null : JSON.stringify(simulationResult.error)
  );

  if (!simulationResult.success) {
    await updateSimulation(simulationId, {
      status: 'FAILED',
      description: 'Falha ao criar simulação final',
      error_message: JSON.stringify(simulationResult.error),
    });
    return { status: 'FAILED', message: 'Falha ao criar simulação final' };
  }

  await updateSimulation(simulationId, {
    status: 'COMPLETED',
    available_margin_value: preCalcResult.data.availableMarginValue || null,
    best_installment_numbers: numberOfInstallments,
    best_installment_value: installmentFaceValue,
    best_disbursement_value: disbursementMaxValue,
    best_operation_value: operationValue,
    description: consultDescription || 'Simulação realizada com sucesso',
  });

  console.log(`✅ Simulação #${simulationId} concluída com sucesso!`);
  return { status: 'COMPLETED', message: 'Simulação concluída com sucesso' };
}

// Monitoramento de filas - Log a cada 60 segundos
async function logQueueStatus() {
  try {
    const [simWaiting, simActive, simCompleted, simFailed] = await Promise.all([
      simulationQueue.getWaitingCount(),
      simulationQueue.getActiveCount(),
      simulationQueue.getCompletedCount(),
      simulationQueue.getFailedCount(),
    ]);

    const [retryWaiting, retryActive] = await Promise.all([
      retryQueue.getWaitingCount(),
      retryQueue.getActiveCount(),
    ]);

    const totalPending = simWaiting + retryWaiting;
    const totalActive = simActive + retryActive;

    if (totalPending > 0 || totalActive > 0) {
      console.log('\n📊 Status das Filas:');
      console.log(`   Simulações: ${simActive} processando | ${simWaiting} aguardando | ✅ ${simCompleted} | ❌ ${simFailed}`);
      console.log(`   Retries: ${retryActive} processando | ${retryWaiting} aguardando`);
      console.log(`   Total: ${totalActive} ativos | ${totalPending} pendentes`);

      // Calcular tempo estimado (assumindo 15s por simulação)
      if (totalPending > 0) {
        const avgTimePerSim = 15; // segundos
        const estimatedSeconds = (totalPending / MAX_CONCURRENT_SIMULATIONS) * avgTimePerSim;
        const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
        const estimatedHours = (estimatedMinutes / 60).toFixed(1);
        console.log(`   ⏱️  Tempo estimado: ${estimatedMinutes} minutos (~${estimatedHours}h)`);
      }
    }
  } catch (error) {
    console.error('Erro ao obter status das filas:', error.message);
  }
}

// Executar monitoramento a cada 60 segundos
setInterval(logQueueStatus, 60000);

// Log inicial após 5 segundos
setTimeout(logQueueStatus, 5000);

module.exports = { simulationQueue, retryQueue };