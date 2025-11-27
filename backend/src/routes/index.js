const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const bankCredentialController = require('../controllers/bankCredentialController');
const simulationController = require('../controllers/simulationController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Rate limiter específico para login (mais rigoroso)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 tentativas de login
  message: 'Muitas tentativas de login, tente novamente em 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rotas públicas de autenticação
router.post('/auth/login', loginLimiter, authController.login);

// Remover registro (sistema de usuário único)
// router.post('/auth/register', authController.register);

// Rotas públicas de webhook (recebe dados do banco)
const webhookController = require('../controllers/webhookController');
router.post('/webhook/consult', webhookController.receiveConsultWebhook);

// Rotas protegidas
router.use(authMiddleware);

// Rotas de usuário
router.get('/auth/me', authController.me);

// Rotas de gerenciamento de usuários (apenas admin)
const userController = require('../controllers/userController');
router.get('/users', userController.list);
router.post('/users', userController.create);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

// Rotas de webhook (monitoramento - protegidas)
router.get('/webhook/consult', webhookController.listConsultWebhooks);
router.get('/webhook/consult/:id', webhookController.getConsultWebhook);
router.put('/webhook/consult/:id/processed', webhookController.markAsProcessed);

// Rotas de credenciais bancárias
router.post('/bank-credentials', bankCredentialController.create);
router.get('/bank-credentials', bankCredentialController.list);
router.get('/bank-credentials/:id', bankCredentialController.get);
router.post('/bank-credentials/:id/test-login', bankCredentialController.testLogin);
router.put('/bank-credentials/:id', bankCredentialController.update);
router.delete('/bank-credentials/:id', bankCredentialController.delete);

// Rotas de JOBS (Sistema novo)
try {
  const jobController = require('../controllers/jobController');
  router.post('/jobs', jobController.create);
  router.get('/jobs', jobController.list);
  router.get('/jobs/stats', jobController.stats);
  router.get('/jobs/:id', jobController.get);
  router.get('/jobs/:id/export', jobController.exportCSV);
  router.put('/jobs/:id/pause', jobController.pause);
  router.put('/jobs/:id/resume', jobController.resume);
  router.put('/jobs/:id/cancel', jobController.cancel);
  router.delete('/jobs/:id', jobController.delete);
  console.log('✅ Rotas de Jobs carregadas');
} catch (error) {
  console.warn('⚠️  jobController não encontrado - Sistema de Jobs não disponível');
}

// Rotas de simulações (manter para compatibilidade)
router.post('/simulations', simulationController.create);
router.post('/simulations/batch', simulationController.createBatch);
router.get('/simulations', simulationController.list);
router.get('/simulations/stats', simulationController.getStats);
router.get('/simulations/:id', simulationController.get);
router.get('/simulations/:id/logs', simulationController.getLogs);
router.delete('/simulations/:id', simulationController.delete);

module.exports = router;
