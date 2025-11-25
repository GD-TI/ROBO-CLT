import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/JobDetails.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, COMPLETED, FAILED, PROCESSING

  useEffect(() => {
    loadJobDetails();
    const interval = setInterval(loadJobDetails, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const loadJobDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/jobs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setJob(response.data.job);
      setSimulations(response.data.simulations || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      if (error.response?.status === 404) {
        alert('Job não encontrado');
        navigate('/jobs');
      }
    }
  };

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      window.open(`${API_URL}/jobs/${id}/export?token=${token}`, '_blank');
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#10b981';
      case 'FAILED':
      case 'REJECTED':
      case 'TIMEOUT': return '#ef4444';
      case 'PROCESSING': return '#3b82f6';
      case 'PENDING': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Concluído';
      case 'FAILED': return 'Falhou';
      case 'REJECTED': return 'Rejeitado';
      case 'TIMEOUT': return 'Timeout';
      case 'PROCESSING': return 'Processando';
      case 'PENDING': return 'Pendente';
      default: return status;
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCPF = (cpf) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const filteredSimulations = simulations.filter(sim => {
    if (filter === 'ALL') return true;
    if (filter === 'COMPLETED') return sim.status === 'COMPLETED';
    if (filter === 'FAILED') return ['FAILED', 'REJECTED', 'TIMEOUT'].includes(sim.status);
    if (filter === 'PROCESSING') return ['PROCESSING', 'PENDING'].includes(sim.status);
    return true;
  });

  if (loading) {
    return <div className="loading-container">Carregando detalhes...</div>;
  }

  if (!job) {
    return <div className="loading-container">Job não encontrado</div>;
  }

  const progress = job.total_cpfs > 0 ? Math.round((job.completed_count / job.total_cpfs) * 100) : 0;

  return (
    <div className="job-details-container">
      {/* Header */}
      <div className="details-header">
        <button className="btn-back" onClick={() => navigate('/jobs')}>
          ← Voltar
        </button>
        <h1>{job.name}</h1>
        <button className="btn-export" onClick={exportCSV}>
          📥 Exportar CSV
        </button>
      </div>

      {/* Resumo do Job */}
      <div className="job-summary">
        <div className="summary-card">
          <div className="summary-header">
            <h2>Resumo do Job</h2>
            <span className="job-status" style={{ color: getStatusColor(job.status) }}>
              {getStatusText(job.status)}
            </span>
          </div>

          <div className="progress-section-detail">
            <div className="progress-bar-bg-detail">
              <div 
                className="progress-bar-fill-detail" 
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: getStatusColor(job.status)
                }}
              />
            </div>
            <span className="progress-text-detail">{progress}%</span>
          </div>

          <div className="summary-stats">
            <div className="summary-stat">
              <span className="summary-label">Total de CPFs</span>
              <span className="summary-value">{job.total_cpfs}</span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Concluídos</span>
              <span className="summary-value" style={{ color: '#10b981' }}>
                {job.completed_count}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Sucessos</span>
              <span className="summary-value" style={{ color: '#10b981' }}>
                {job.success_count}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Falhas</span>
              <span className="summary-value" style={{ color: '#ef4444' }}>
                {job.failed_count}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Processando</span>
              <span className="summary-value" style={{ color: '#3b82f6' }}>
                {job.processing_count}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <button 
          className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          Todos ({simulations.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setFilter('COMPLETED')}
        >
          ✅ Concluídos ({job.success_count})
        </button>
        <button 
          className={`filter-btn ${filter === 'FAILED' ? 'active' : ''}`}
          onClick={() => setFilter('FAILED')}
        >
          ❌ Falhas ({job.failed_count})
        </button>
        <button 
          className={`filter-btn ${filter === 'PROCESSING' ? 'active' : ''}`}
          onClick={() => setFilter('PROCESSING')}
        >
          ⏳ Processando ({job.processing_count})
        </button>
      </div>

      {/* Lista de Simulações */}
      <div className="simulations-list">
        <h3>CPFs Processados ({filteredSimulations.length})</h3>
        
        <div className="simulations-grid">
          {filteredSimulations.map((sim) => (
            <div key={sim.id} className="simulation-card">
              <div className="simulation-header">
                <span className="simulation-cpf">{formatCPF(sim.cpf)}</span>
                <span 
                  className="simulation-status"
                  style={{ 
                    backgroundColor: getStatusColor(sim.status),
                    color: 'white'
                  }}
                >
                  {getStatusText(sim.status)}
                </span>
              </div>

              {sim.name && (
                <div className="simulation-name">
                  <strong>Nome:</strong> {sim.name}
                </div>
              )}

              {sim.credential_name && (
                <div className="simulation-credential">
                  <strong>Credencial:</strong> {sim.credential_name}
                </div>
              )}

              {sim.status === 'COMPLETED' && (
                <div className="simulation-results">
                  <div className="result-row">
                    <span>Desembolso:</span>
                    <span className="result-value-highlight">
                      {formatCurrency(sim.best_disbursement_value)}
                    </span>
                  </div>
                  <div className="result-row">
                    <span>Parcelas:</span>
                    <span>{sim.best_installment_numbers || '-'}</span>
                  </div>
                  <div className="result-row">
                    <span>Valor Parcela:</span>
                    <span>{formatCurrency(sim.best_installment_value)}</span>
                  </div>
                  {sim.available_margin_value && (
                    <div className="result-row">
                      <span>Margem:</span>
                      <span>{formatCurrency(sim.available_margin_value)}</span>
                    </div>
                  )}
                </div>
              )}

              {sim.error_message && (
                <div className="simulation-error">
                  <strong>Erro:</strong> {sim.error_message}
                </div>
              )}

              {sim.description && (
                <div className="simulation-description">
                  {sim.description}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredSimulations.length === 0 && (
          <div className="empty-simulations">
            <p>Nenhuma simulação encontrada com este filtro.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobDetails;
