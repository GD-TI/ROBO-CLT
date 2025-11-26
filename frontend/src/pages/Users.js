import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/api';
import '../styles/Credentials.css';

function Users() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'regular',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await userService.list();
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      if (error.response?.status === 403) {
        setError('Acesso negado. Apenas administradores podem acessar esta página.');
      }
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
      await userService.create(formData);
      setSuccess('Usuário criado com sucesso!');
      setFormData({ email: '', password: '', name: '', role: 'regular' });
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este usuário?')) {
      return;
    }

    try {
      await userService.delete(id);
      setSuccess('Usuário removido com sucesso!');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover usuário');
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return <span className="role-badge role-admin">👑 Admin</span>;
    }
    return <span className="role-badge role-regular">👤 Regular</span>;
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
          🏠 Início
        </button>
        <button onClick={() => navigate('/jobs')} className="nav-btn">
          📋 Jobs FGTS
        </button>
        <button onClick={() => navigate('/credentials')} className="nav-btn">
          🔑 Credenciais
        </button>
        <button onClick={() => navigate('/users')} className="nav-btn active">
          👥 Usuários
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="page-header">
          <h2>Gerenciamento de Usuários</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? '✕ Cancelar' : '➕ Adicionar Usuário'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {showForm && (
          <div className="credential-form">
            <h3>Novo Usuário</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="João Silva"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="joao@empresa.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Senha</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="••••••••"
                    minLength="6"
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de Usuário</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="regular">Regular (20 workers)</option>
                    <option value="admin">Admin (60 workers)</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Criando...' : 'Criar Usuário'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading">Carregando usuários...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum usuário cadastrado ainda.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Adicionar Primeiro Usuário
            </button>
          </div>
        ) : (
          <div className="credentials-list">
            {users.map((u) => (
              <div key={u.id} className="credential-card">
                <div className="credential-header">
                  <div>
                    <h3>{u.name}</h3>
                    <span className="partner-id">{u.email}</span>
                  </div>
                  {getRoleBadge(u.role)}
                </div>

                <div className="credential-info">
                  <div className="info-item">
                    <span className="info-label">Workers:</span>
                    <span>{u.role === 'admin' ? '60' : '20'} simultâneos</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Status:</span>
                    <span className={u.active ? 'text-success' : 'text-error'}>
                      {u.active ? '✓ Ativo' : '✕ Inativo'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Criado em:</span>
                    <span>{new Date(u.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <div className="credential-actions">
                  {u.id !== user?.id && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="btn-danger"
                    >
                      🗑️ Remover
                    </button>
                  )}
                  {u.id === user?.id && (
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>
                      (Você não pode deletar sua própria conta)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .role-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
        }
        .role-admin {
          background: #fef3c7;
          color: #92400e;
        }
        .role-regular {
          background: #dbeafe;
          color: #1e40af;
        }
      `}</style>
    </div>
  );
}

export default Users;
