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

// Função auxiliar para verificar status da consulta
async function checkConsultStatus(client, cpf, consultId, simulationId) {
  const statusResult = await client.getConsultStatus(cpf);
  
  if (!statusResult.success) {
    return { status: 'ERROR', data: null };
  }

  const consults = statusResult.data?.data || statusResult.data || [];
  const currentConsult = consults.find(c => c.id === consultId);

  if (!currentConsult) {
    return { status: 'NOT_FOUND', data: null };
  }

  // Log do status atual
  console.log(`📊 Status da consulta ${consultId}: ${currentConsult.status}`);

  return {
    status: currentConsult.status,
    data: currentConsult
  };
}

// Worker principal - Processa novas simulações
simulationQueue.process(5, async (job) => {
  const { simulationId, cpf, bankCredentialId, userId } = job.data;

  console.log(`\n🔄 Iniciando processamento - Simulação #${simulationId} - CPF: ${cpf}`);

  try {
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
      } else if (consultStatus.status === 'ERROR' || consultStatus.status === 'FAILED') {
        await updateSimulation(simulationId, {
          status: 'REJECTED',
          description: consultStatus.data?.description || 'Consulta rejeitada',
        });
        return { status: 'REJECTED', message: 'Consulta rejeitada pelo banco' };
      }
    }

    // ✅ SE AINDA WAITING_CONSULT, MARCAR E ADICIONAR NA FILA DE RETRY
    if (consultStatus.status !== 'SUCCESS') {
      console.log(`⏸️  Consulta ainda aguardando (${consultStatus.status}). Adicionando à fila de retry...`);
      
      await updateSimulation(simulationId, {
        status: 'WAITING_CONSULT',
        description: `Aguardando resposta do banco - Status: ${consultStatus.status}`,
      });

      // Adicionar na fila de retry
      await retryQueue.add({
        simulationId,
        cpf,
        consultId,
        bankCredentialId,
        userId,
      }, {
        delay: 30000, // Primeira tentativa em 30 segundos
      });

      return { status: 'WAITING_CONSULT', message: 'Adicionado à fila de retry' };
    }

    // ✅ CONTINUAR NORMALMENTE SE JÁ ESTÁ SUCCESS
    return await processSimulation(client, simulationId, cpf, consultId);

  } catch (error) {
    console.error(`❌ Erro na simulação #${simulationId}:`, error);
    
    await updateSimulation(simulationId, {
      status: 'FAILED',
      error_message: error.message,
      description: 'Erro no processamento',
    });

    return { status: 'FAILED', message: error.message };
  }
});

// Worker de retry - Processa simulações em WAITING_CONSULT
retryQueue.process(3, async (job) => {
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
        description: 'Retomando processamento após aprovação',
      });

      // Continuar processamento
      return await processSimulation(client, simulationId, cpf, consultId);

    } else if (consultStatus.status === 'ERROR' || consultStatus.status === 'FAILED') {
      await updateSimulation(simulationId, {
        status: 'REJECTED',
        description: consultStatus.data?.description || 'Consulta rejeitada',
      });
      return { status: 'REJECTED', message: 'Consulta rejeitada no retry' };

    } else {
      // Ainda waiting, continuar tentando
      console.log(`⏸️  Ainda aguardando (${consultStatus.status}). Tentando novamente em 30s...`);
      
      await updateSimulation(simulationId, {
        description: `Aguardando resposta - Tentativa ${job.attemptsMade + 1}/10`,
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

module.exports = { simulationQueue, retryQueue };