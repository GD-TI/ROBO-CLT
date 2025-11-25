import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { simulationService } from '../services/api';
import '../styles/Dashboard.css';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await simulationService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🏦 Simulação Bancária</h1>
        <div className="user-info">
          <span>Olá, {user?.name}</span>
          <button onClick={handleLogout} className="btn-logout">Sair</button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button onClick={() => navigate('/')} className="nav-btn">
          🏠 Início
        </button>
        <button onClick={() => navigate('/jobs')} className="nav-btn">
          📋 Jobs FGTS
        </button>
        <button onClick={() => navigate('/dashboard')} className="nav-btn active">
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
        <h2>Visão Geral</h2>

        {loading ? (
          <div className="loading">Carregando estatísticas...</div>
        ) : stats ? (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.total}</div>
                  <div className="stat-label">Total de Simulações</div>
                </div>
              </div>

              <div className="stat-card success">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.by_status?.COMPLETED || 0}</div>
                  <div className="stat-label">Completadas</div>
                </div>
              </div>

              <div className="stat-card warning">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <div className="stat-value">
                    {(stats.by_status?.PENDING || 0) + (stats.by_status?.PROCESSING || 0)}
                  </div>
                  <div className="stat-label">Em Processamento</div>
                </div>
              </div>

              <div className="stat-card error">
                <div className="stat-icon">❌</div>
                <div className="stat-info">
                  <div className="stat-value">
                    {(stats.by_status?.FAILED || 0) + (stats.by_status?.REJECTED || 0)}
                  </div>
                  <div className="stat-label">Falhas</div>
                </div>
              </div>
            </div>

            {stats.total > 0 && (
              <div className="stats-details">
                <h3>Valores Médios</h3>
                <div className="value-stats">
                  <div className="value-item">
                    <span className="value-label">Desembolso Médio:</span>
                    <span className="value-amount">
                      R$ {stats.avg_disbursement?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="value-item">
                    <span className="value-label">Maior Desembolso:</span>
                    <span className="value-amount">
                      R$ {stats.max_disbursement?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="value-item">
                    <span className="value-label">Menor Desembolso:</span>
                    <span className="value-amount">
                      R$ {stats.min_disbursement?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>Nenhuma estatística disponível ainda.</p>
            <button onClick={() => navigate('/new-simulation')} className="btn-primary">
              Criar Primeira Simulação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
