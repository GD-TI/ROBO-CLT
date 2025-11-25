import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Jobs.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Auto-refresh a cada 5s
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setJobs(response.data);
      setTotalPages(Math.ceil(response.data.length / 5));
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar jobs:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  const exportCSV = async (jobId) => {
    try {
      const token = localStorage.getItem('token');
      window.open(`${API_URL}/jobs/${jobId}/export?token=${token}`, '_blank');
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm('Tem certeza que deseja deletar este job?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadJobs();
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const getProgressPercentage = (job) => {
    if (job.total_cpfs === 0) return 0;
    return Math.round((job.completed_count / job.total_cpfs) * 100);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#10b981';
      case 'PROCESSING': return '#3b82f6';
      case 'FAILED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'hoje';
    if (diffDays === 1) return 'há 1 dia';
    return `há ${diffDays} dias`;
  };

  const paginatedJobs = jobs.slice((currentPage - 1) * 5, currentPage * 5);

  if (loading) {
    return <div className="loading-container">Carregando jobs...</div>;
  }

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <button
          className="btn-back"
          onClick={() => navigate('/')}
          title="Voltar ao início"
        >
          ← Voltar
        </button>

        <div className="pagination-info">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="nav-button"
          >
            ‹
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="nav-button"
          >
            ›
          </button>
        </div>

        <button
          className="btn-new-job"
          onClick={() => navigate('/new-job')}
        >
          + Nova tarefa
        </button>
      </div>

      <div className="jobs-grid">
        {paginatedJobs.map((job) => {
          const progress = getProgressPercentage(job);
          const statusColor = getStatusColor(job.status);
          
          return (
            <div key={job.id} className="job-card">
              {/* Header com logo */}
              <div className="card-header">
                <div className="logo-container">
                  <div className="logo-v">V</div>
                  <span className="logo-text">DIGITAL</span>
                </div>
              </div>

              {/* Badge FGTS */}
              <div className="badge-fgts">FGTS</div>

              {/* Barra de progresso */}
              <div className="progress-section">
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: `${progress}%`,
                      backgroundColor: statusColor 
                    }}
                  />
                </div>
                <span className="progress-text">{progress}%</span>
              </div>

              {/* Status */}
              <div className="status-row">
                <span className="status-label">Robos {job.completed_count}/{job.total_cpfs}</span>
                <span 
                  className="status-badge"
                  style={{ color: statusColor }}
                >
                  {job.status === 'COMPLETED' ? 'Finalizado' : 
                   job.status === 'PROCESSING' ? 'Processando' : 
                   job.status}
                </span>
              </div>

              {/* Informações */}
              <div className="info-section">
                <div className="info-row">
                  <span className="info-label">Nome:</span>
                  <span className="info-value">{job.name}</span>
                </div>
                
                <div className="info-row">
                  <span className="info-label">Total CPFs:</span>
                  <span className="info-value">{job.total_cpfs}</span>
                </div>
                
                <div className="info-row">
                  <span className="info-label">Credenciais:</span>
                  <span className="info-value">{job.credentials_count || 0}</span>
                </div>
                
                <div className="info-row">
                  <span className="info-label">Criado:</span>
                  <span className="info-value">{formatDate(job.created_at)}</span>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="stats-section">
                <div className="stat-item stat-success">
                  <span className="stat-icon">✅</span>
                  <div className="stat-info">
                    <span className="stat-label">Sucesso</span>
                    <span className="stat-value">{job.success_count}</span>
                  </div>
                </div>
                
                <div className="stat-item stat-error">
                  <span className="stat-icon">❌</span>
                  <div className="stat-info">
                    <span className="stat-label">Falhas</span>
                    <span className="stat-value">{job.failed_count}</span>
                  </div>
                </div>
                
                <div className="stat-item stat-processing">
                  <span className="stat-icon">⏳</span>
                  <div className="stat-info">
                    <span className="stat-label">Processando</span>
                    <span className="stat-value">{job.processing_count}</span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="actions-row">
                <button 
                  className="action-btn"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  title="Visualizar detalhes"
                >
                  <span>👁️</span>
                </button>
                
                <button 
                  className="action-btn"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  title="Editar"
                >
                  <span>✏️</span>
                </button>
                
                <button 
                  className="action-btn action-delete"
                  onClick={() => deleteJob(job.id)}
                  title="Deletar"
                >
                  <span>🗑️</span>
                </button>
                
                <button 
                  className="action-btn"
                  onClick={() => exportCSV(job.id)}
                  title="Exportar CSV"
                >
                  <span>📥</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div className="empty-state">
          <h3>Nenhum job encontrado</h3>
          <p>Crie seu primeiro job para começar!</p>
          <button 
            className="btn-new-job"
            onClick={() => navigate('/new-job')}
          >
            + Nova tarefa
          </button>
        </div>
      )}
    </div>
  );
}

export default Jobs;
