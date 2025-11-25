import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { simulationService } from '../services/api';
import '../styles/SimulationDetails.css';

function SimulationDetails() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [simulation, setSimulation] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    loadSimulation();
    loadLogs();
  }, [id]);

  const loadSimulation = async () => {
    try {
      const response = await simulationService.get(id);
      setSimulation(response.data);
    } catch (error) {
      console.error('Erro ao carregar simulação:', error);
      alert('Simulação não encontrada');
      navigate('/simulations');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await simulationService.getLogs(id);
      setLogs(response.data);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { label: 'Pendente', class: 'status-pending', icon: '⏳' },
      PROCESSING: { label: 'Processando', class: 'status-processing', icon: '⚙️' },
      COMPLETED: { label: 'Concluída', class: 'status-completed', icon: '✅' },
      FAILED: { label: 'Falhou', class: 'status-failed', icon: '❌' },
      REJECTED: { label: 'Rejeitada', class: 'status-rejected', icon: '🚫' },
      TIMEOUT: { label: 'Timeout', class: 'status-timeout', icon: '⏱️' },
    };
    const statusInfo = statusMap[status] || { label: status, class: '', icon: '❓' };
    return (
      <span className={`status-badge ${statusInfo.class}`}>
        {statusInfo.icon} {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Carregando detalhes...</div>
      </div>
    );
  }

  if (!simulation) {
    return null;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🏦 Simulação Bancária</h1>
        <div className="user-info">
          <span>Olá, {user?.name}</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="btn-logout">
            Sair
          </button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button onClick={() => navigate('/')} className="nav-btn">
          🏠 Início
        </button>
        <button onClick={() => navigate('/jobs')} className="nav-btn">
          📋 Jobs FGTS
        </button>
        <button onClick={() => navigate('/dashboard')} className="nav-btn">
          📊 Dashboard
        </button>
        <button onClick={() => navigate('/credentials')} className="nav-btn">
          🔑 Credenciais
        </button>
        <button onClick={() => navigate('/simulations')} className="nav-btn">
          🏦 Simulações
        </button>
        <button onClick={() => navigate('/new-simulation')} className="nav-btn btn-primary">
          ➕ Nova Simulação
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="page-header">
          <h2>Detalhes da Simulação</h2>
          <button onClick={() => navigate('/simulations')} className="btn-secondary">
            ← Voltar
          </button>
        </div>

        <div className="details-container">
          <div className="details-section">
            <h3>Informações Gerais</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">CPF:</span>
                <span className="detail-value">{simulation.cpf}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Nome:</span>
                <span className="detail-value">{simulation.name || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value">{getStatusBadge(simulation.status)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Data de Nascimento:</span>
                <span className="detail-value">
                  {simulation.birth_date 
                    ? new Date(simulation.birth_date).toLocaleDateString('pt-BR')
                    : '-'
                  }
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Gênero:</span>
                <span className="detail-value">
                  {simulation.gender === 'male' ? 'Masculino' : simulation.gender === 'female' ? 'Feminino' : '-'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Criada em:</span>
                <span className="detail-value">
                  {new Date(simulation.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {simulation.status === 'COMPLETED' && (
            <div className="details-section success-section">
              <h3>✅ Resultado da Simulação</h3>
              <div className="details-grid">
                <div className="detail-item highlight">
                  <span className="detail-label">Valor de Desembolso:</span>
                  <span className="detail-value big">
                    R$ {parseFloat(simulation.best_disbursement_value).toFixed(2)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Valor da Operação:</span>
                  <span className="detail-value">
                    R$ {parseFloat(simulation.best_operation_value).toFixed(2)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Número de Parcelas:</span>
                  <span className="detail-value">{simulation.best_installment_numbers}x</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Valor da Parcela:</span>
                  <span className="detail-value">
                    R$ {parseFloat(simulation.best_installment_value).toFixed(2)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Margem Disponível:</span>
                  <span className="detail-value">
                    {simulation.available_margin_value
                      ? `R$ ${parseFloat(simulation.available_margin_value).toFixed(2)}`
                      : '-'
                    }
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Partner ID:</span>
                  <span className="detail-value">{simulation.partner_id || '-'}</span>
                </div>
              </div>
              {simulation.description && (
                <div className="description-box success-description">
                  <strong>ℹ️ Retorno do Banco:</strong>
                  <p>{simulation.description}</p>
                </div>
              )}
            </div>
          )}

          {(simulation.status === 'FAILED' || simulation.status === 'REJECTED') && (
            <div className="details-section error-section">
              <h3>❌ Erro</h3>
              <div className="error-details">
                <p><strong>Descrição:</strong> {simulation.description || '-'}</p>
                {simulation.error_message && (
                  <p><strong>Mensagem de Erro:</strong> {simulation.error_message}</p>
                )}
              </div>
            </div>
          )}

          {simulation.consult_id && (
            <div className="details-section">
              <h3>Informações da Consulta</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Consult ID:</span>
                  <span className="detail-value mono">{simulation.consult_id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email Usado:</span>
                  <span className="detail-value">{simulation.signer_email || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Telefone Usado:</span>
                  <span className="detail-value">{simulation.signer_phone || '-'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="details-section">
            <div className="section-header">
              <h3>Logs de Requisições ({logs.length})</h3>
              <button 
                onClick={() => setShowLogs(!showLogs)} 
                className="btn-secondary"
              >
                {showLogs ? 'Ocultar' : 'Mostrar'} Logs
              </button>
            </div>

            {showLogs && (
              <div className="logs-container">
                {logs.length === 0 ? (
                  <p className="empty-logs">Nenhum log disponível</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={log.id} className="log-item">
                      <div className="log-header">
                        <span className="log-number">#{index + 1}</span>
                        <span className={`log-method ${log.method.toLowerCase()}`}>
                          {log.method}
                        </span>
                        <span className="log-endpoint">{log.endpoint}</span>
                        <span className={`log-status status-${Math.floor(log.status_code / 100)}xx`}>
                          {log.status_code}
                        </span>
                        <span className="log-time">
                          {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      {log.error && (
                        <div className="log-error">
                          <strong>Erro:</strong> {log.error}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimulationDetails;
