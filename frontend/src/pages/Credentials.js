import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { credentialService } from '../services/api';
import '../styles/Credentials.css';

function Credentials() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    partner_id: '',
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const response = await credentialService.list();
      setCredentials(response.data);
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await credentialService.create(formData);
      setSuccess('Credencial criada com sucesso!');
      setFormData({ partner_id: '', name: '', email: '', password: '' });
      setShowForm(false);
      loadCredentials();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar credencial');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestLogin = async (id) => {
    try {
      await credentialService.testLogin(id);
      alert('Login testado com sucesso!');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao testar login');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta credencial?')) {
      return;
    }

    try {
      await credentialService.delete(id);
      setSuccess('Credencial removida com sucesso!');
      loadCredentials();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover credencial');
    }
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
        <button onClick={() => navigate('/credentials')} className="nav-btn active">
          🔑 Credenciais
        </button>
        <button onClick={() => navigate('/simulations')} className="nav-btn">
          📋 Simulações
        </button>
        <button onClick={() => navigate('/new-simulation')} className="nav-btn btn-primary">
          ➕ Nova Simulação
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="page-header">
          <h2>Credenciais Bancárias</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? '✕ Cancelar' : '➕ Adicionar Credencial'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {showForm && (
          <div className="credential-form">
            <h3>Nova Credencial</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Partner ID</label>
                  <input
                    type="text"
                    value={formData.partner_id}
                    onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                    required
                    placeholder="7718_D020"
                  />
                </div>

                <div className="form-group">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Banco Principal"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email do Banco</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="usuario@banco.com"
                  />
                </div>

                <div className="form-group">
                  <label>Senha do Banco</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Salvando...' : 'Salvar Credencial'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading">Carregando credenciais...</div>
        ) : credentials.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma credencial bancária cadastrada ainda.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Adicionar Primeira Credencial
            </button>
          </div>
        ) : (
          <div className="credentials-list">
            {credentials.map((credential) => (
              <div key={credential.id} className="credential-card">
                <div className="credential-header">
                  <div>
                    <h3>{credential.name}</h3>
                    <span className="partner-id">Partner ID: {credential.partner_id}</span>
                  </div>
                  <div className={`status-badge ${credential.active ? 'active' : 'inactive'}`}>
                    {credential.active ? '✓ Ativa' : '✕ Inativa'}
                  </div>
                </div>

                <div className="credential-info">
                  <div className="info-item">
                    <span className="info-label">Token válido:</span>
                    <span className={credential.has_valid_token ? 'text-success' : 'text-error'}>
                      {credential.has_valid_token ? '✓ Sim' : '✕ Não'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Criada em:</span>
                    <span>{new Date(credential.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <div className="credential-actions">
                  <button 
                    onClick={() => handleTestLogin(credential.id)} 
                    className="btn-secondary"
                  >
                    🔐 Testar Login
                  </button>
                  <button 
                    onClick={() => handleDelete(credential.id)} 
                    className="btn-danger"
                  >
                    🗑️ Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Credentials;
