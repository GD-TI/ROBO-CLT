import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { simulationService } from '../services/api';
import '../styles/Simulations.css';

function Simulations() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [searchCPF, setSearchCPF] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadSimulations();
    const interval = setInterval(loadSimulations, 5000); // Atualizar a cada 5 segundos
    return () => clearInterval(interval);
  }, [filter, searchCPF, page]);

  const loadSimulations = async () => {
    try {
      const params = {
        page,
        limit: 20,
      };
      if (filter) params.status = filter;
      if (searchCPF) params.cpf = searchCPF.replace(/\D/g, '');

      const response = await simulationService.list(params);
      setSimulations(response.data.simulations);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Erro ao carregar simulações:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { label: 'Pendente', class: 'status-pending' },
      PROCESSING: { label: 'Processando', class: 'status-processing' },
      COMPLETED: { label: 'Concluída', class: 'status-completed' },
      FAILED: { label: 'Falhou', class: 'status-failed' },
      REJECTED: { label: 'Rejeitada', class: 'status-rejected' },
      TIMEOUT: { label: 'Timeout', class: 'status-timeout' },
    };
    const statusInfo = statusMap[status] || { label: status, class: '' };
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  const handleViewDetails = (id) => {
    navigate(`/simulations/${id}`);
  };

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
          📊 Dashboard
        </button>
        <button onClick={() => navigate('/credentials')} className="nav-btn">
          🔑 Credenciais
        </button>
        <button onClick={() => navigate('/simulations')} className="nav-btn active">
          📋 Simulações
        </button>
        <button onClick={() => navigate('/new-simulation')} className="nav-btn btn-primary">
          ➕ Nova Simulação
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="page-header">
          <h2>Simulações</h2>
          <button onClick={loadSimulations} className="btn-secondary">
            🔄 Atualizar
          </button>
        </div>

        <div className="filters">
          <div className="filter-group">
            <label>Filtrar por Status:</label>
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="PENDING">Pendente</option>
              <option value="PROCESSING">Processando</option>
              <option value="COMPLETED">Concluída</option>
              <option value="FAILED">Falhou</option>
              <option value="REJECTED">Rejeitada</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Buscar CPF:</label>
            <input
              type="text"
              value={searchCPF}
              onChange={(e) => { setSearchCPF(e.target.value); setPage(1); }}
              placeholder="Digite o CPF"
              maxLength="11"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">Carregando simulações...</div>
        ) : simulations.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma simulação encontrada.</p>
            <button onClick={() => navigate('/new-simulation')} className="btn-primary">
              Criar Primeira Simulação
            </button>
          </div>
        ) : (
          <>
            <div className="simulations-table">
              <table>
                <thead>
                  <tr>
                    <th>CPF</th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Desembolso</th>
                    <th>Parcelas</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((sim) => (
                    <tr key={sim.id}>
                      <td>{sim.cpf}</td>
                      <td>{sim.name || '-'}</td>
                      <td>{getStatusBadge(sim.status)}</td>
                      <td>
                        {sim.best_disbursement_value 
                          ? `R$ ${parseFloat(sim.best_disbursement_value).toFixed(2)}`
                          : '-'
                        }
                      </td>
                      <td>
                        {sim.best_installment_numbers 
                          ? `${sim.best_installment_numbers}x`
                          : '-'
                        }
                      </td>
                      <td>{new Date(sim.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <button 
                          onClick={() => handleViewDetails(sim.id)}
                          className="btn-link"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn-secondary"
                >
                  ← Anterior
                </button>
                <span className="page-info">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <button 
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="btn-secondary"
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Simulations;
