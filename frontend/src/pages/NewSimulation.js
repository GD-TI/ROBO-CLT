import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { simulationService, credentialService } from '../services/api';
import '../styles/NewSimulation.css';

function NewSimulation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState([]);
  const [selectedCredential, setSelectedCredential] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [cpfList, setCpfList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const response = await credentialService.list();
      const activeCredentials = response.data.filter(c => c.active);
      setCredentials(activeCredentials);
      if (activeCredentials.length > 0) {
        setSelectedCredential(activeCredentials[0].id);
      }
    } catch (error) {
      setError('Erro ao carregar credenciais');
    } finally {
      setLoadingCredentials(false);
    }
  };

  const formatCPF = (value) => {
    return value.replace(/\D/g, '').slice(0, 11);
  };

  const addCPF = () => {
    const cpf = formatCPF(cpfInput);
    
    if (cpf.length !== 11) {
      setError('CPF deve ter 11 dígitos');
      return;
    }

    if (cpfList.includes(cpf)) {
      setError('CPF já adicionado');
      return;
    }

    setCpfList([...cpfList, cpf]);
    setCpfInput('');
    setError('');
  };

  const removeCPF = (cpf) => {
    setCpfList(cpfList.filter(c => c !== cpf));
  };

  const handlePasteMultiple = (e) => {
    const pastedText = e.clipboardData.getData('text');
    const cpfs = pastedText
      .split(/[\n,;|\s]+/)
      .map(cpf => formatCPF(cpf))
      .filter(cpf => cpf.length === 11);

    if (cpfs.length > 0) {
      e.preventDefault();
      const uniqueCpfs = [...new Set([...cpfList, ...cpfs])];
      setCpfList(uniqueCpfs);
      setCpfInput('');
      setSuccess(`${cpfs.length} CPF(s) adicionado(s)`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCredential) {
      setError('Selecione uma credencial bancária');
      return;
    }

    if (cpfList.length === 0) {
      setError('Adicione pelo menos um CPF');
      return;
    }

    setSubmitting(true);

    try {
      if (cpfList.length === 1) {
        await simulationService.create({
          cpf: cpfList[0],
          bank_credential_id: parseInt(selectedCredential),
        });
        setSuccess('Simulação criada com sucesso!');
      } else {
        await simulationService.createBatch({
          cpfs: cpfList,
          bank_credential_id: parseInt(selectedCredential),
        });
        setSuccess(`${cpfList.length} simulações criadas com sucesso!`);
      }

      setTimeout(() => {
        navigate('/simulations');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar simulação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCPF();
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
        <button onClick={() => navigate('/new-simulation')} className="nav-btn btn-primary active">
          ➕ Nova Simulação
        </button>
      </nav>

      <div className="dashboard-content">
        <h2>Nova Simulação</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {loadingCredentials ? (
          <div className="loading">Carregando...</div>
        ) : credentials.length === 0 ? (
          <div className="empty-state">
            <p>Você precisa cadastrar uma credencial bancária primeiro.</p>
            <button onClick={() => navigate('/credentials')} className="btn-primary">
              Ir para Credenciais
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="simulation-form">
            <div className="form-group">
              <label>Credencial Bancária</label>
              <select
                value={selectedCredential}
                onChange={(e) => setSelectedCredential(e.target.value)}
                required
              >
                {credentials.map((cred) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.name} ({cred.partner_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>CPFs para Simular</label>
              <div className="cpf-input-group">
                <input
                  type="text"
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onPaste={handlePasteMultiple}
                  placeholder="Digite ou cole CPFs (apenas números)"
                  maxLength="11"
                />
                <button type="button" onClick={addCPF} className="btn-secondary">
                  Adicionar
                </button>
              </div>
              <small className="form-hint">
                💡 Dica: Cole múltiplos CPFs separados por linha, vírgula ou espaço
              </small>
            </div>

            {cpfList.length > 0 && (
              <div className="cpf-list">
                <div className="cpf-list-header">
                  <strong>{cpfList.length} CPF(s) adicionado(s)</strong>
                  <button 
                    type="button" 
                    onClick={() => setCpfList([])} 
                    className="btn-link"
                  >
                    Limpar todos
                  </button>
                </div>
                <div className="cpf-items">
                  {cpfList.map((cpf, index) => (
                    <div key={index} className="cpf-item">
                      <span>{cpf}</span>
                      <button 
                        type="button" 
                        onClick={() => removeCPF(cpf)}
                        className="btn-remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={submitting || cpfList.length === 0} 
              className="btn-primary btn-large"
            >
              {submitting 
                ? 'Processando...' 
                : `Criar ${cpfList.length === 1 ? 'Simulação' : `${cpfList.length} Simulações`}`
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default NewSimulation;
