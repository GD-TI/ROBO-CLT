import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/NewJob.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

function NewJob() {
  const [name, setName] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [cpfList, setCpfList] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/bank-credentials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredentials(response.data.filter(c => c.active));
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  };

  // Função para preencher CPF com zeros à esquerda
  const padCPF = (cpf) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.padStart(11, '0'); // Preenche com zeros até ter 11 dígitos
  };

  const addCPF = () => {
    const cpf = padCPF(cpfInput);
    
    if (cpf.length !== 11) {
      alert('CPF inválido');
      return;
    }
    
    if (cpfList.includes(cpf)) {
      alert('CPF já adicionado');
      return;
    }
    
    setCpfList([...cpfList, cpf]);
    setCpfInput('');
  };

  const removeCPF = (cpf) => {
    setCpfList(cpfList.filter(c => c !== cpf));
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    const cpfs = text.split(/[\n,;|\s\t]+/)
      .map(c => padCPF(c)) // Preenche cada CPF com zeros
      .filter(c => c.length === 11);
    
    if (cpfs.length > 0) {
      e.preventDefault();
      const uniqueCpfs = [...new Set([...cpfList, ...cpfs])];
      setCpfList(uniqueCpfs);
      alert(`${cpfs.length} CPF(s) adicionado(s)`);
    }
  };

  const clearAll = () => {
    if (window.confirm('Limpar todos os CPFs?')) {
      setCpfList([]);
    }
  };

  const createJob = async () => {
    if (!name.trim()) {
      alert('Digite um nome para o job');
      return;
    }

    if (cpfList.length === 0) {
      alert('Adicione pelo menos 1 CPF');
      return;
    }

    if (credentials.length === 0) {
      alert('Você precisa ter pelo menos 1 credencial bancária ativa!');
      navigate('/credentials');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/jobs`, 
        { name, cpfs: cpfList },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      alert(`Job "${name}" criado com sucesso!\nProcessamento iniciado em background com ${cpfList.length} CPFs distribuídos entre ${credentials.length} credencial(is).`);
      navigate('/jobs');
    } catch (error) {
      console.error('Erro ao criar job:', error);
      alert(error.response?.data?.error || 'Erro ao criar job');
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (cpf) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div className="new-job-container">
      <div className="new-job-header">
        <button className="btn-back" onClick={() => navigate('/jobs')}>
          ← Voltar
        </button>
        <h1>Criar Novo Job</h1>
      </div>

      <div className="new-job-content">
        {/* Card de informações */}
        <div className="info-card">
          <h3>ℹ️ Informações</h3>
          <div className="info-item">
            <span className="info-label">Credenciais ativas:</span>
            <span className="info-value">{credentials.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">CPFs adicionados:</span>
            <span className="info-value">{cpfList.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Distribuição:</span>
            <span className="info-value">Round-robin automático</span>
          </div>
          
          {credentials.length > 0 && cpfList.length > 0 && (
            <div className="distribution-preview">
              <p><strong>📊 Previsão de distribuição:</strong></p>
              {credentials.map((cred, idx) => {
                const cpfsForThisCred = Math.ceil(cpfList.length / credentials.length);
                return (
                  <div key={cred.id} className="cred-preview">
                    <span>{cred.name}:</span>
                    <span>~{cpfsForThisCred} CPFs</span>
                  </div>
                );
              })}
            </div>
          )}

          {credentials.length === 0 && (
            <div className="warning-box">
              <p>⚠️ Você precisa adicionar credenciais bancárias primeiro!</p>
              <button 
                className="btn-add-credential"
                onClick={() => navigate('/credentials')}
              >
                Adicionar Credenciais
              </button>
            </div>
          )}
        </div>

        {/* Formulário */}
        <div className="form-card">
          <div className="form-group">
            <label>Nome do Job</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lote Dezembro 2024"
              className="input-text"
            />
          </div>

          <div className="form-group">
            <label>Adicionar CPFs</label>
            <div className="cpf-input-group">
              <input
                type="text"
                value={cpfInput}
                onChange={(e) => setCpfInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCPF()}
                onPaste={handlePaste}
                placeholder="Digite ou cole CPFs (pode colar vários de uma vez)"
                className="input-text"
              />
              <button onClick={addCPF} className="btn-add">
                Adicionar
              </button>
            </div>
            <p className="helper-text">
              💡 Cole uma lista de CPFs (separados por linha, vírgula, ponto-e-vírgula ou espaço)
              <br />
              ✅ CPFs com menos de 11 dígitos serão preenchidos com zeros à esquerda automaticamente
            </p>
          </div>

          {/* Lista de CPFs */}
          {cpfList.length > 0 && (
            <div className="cpf-list-section">
              <div className="cpf-list-header">
                <h3>CPFs Adicionados ({cpfList.length})</h3>
                <button onClick={clearAll} className="btn-clear">
                  Limpar Todos
                </button>
              </div>
              
              <div className="cpf-list">
                {cpfList.map((cpf, index) => (
                  <div key={index} className="cpf-item">
                    <span className="cpf-number">{formatCPF(cpf)}</span>
                    <button 
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

          {/* Botão criar */}
          <div className="form-actions">
            <button
              onClick={createJob}
              disabled={loading || !name || cpfList.length === 0 || credentials.length === 0}
              className="btn-create"
            >
              {loading ? '⏳ Criando...' : `🚀 Criar Job (${cpfList.length} CPFs)`}
            </button>
          </div>

          {credentials.length > 0 && (
            <div className="success-note">
              <p>✅ <strong>Processamento em background:</strong></p>
              <p>Após criar o job, você pode fechar esta página. O processamento continuará automaticamente usando suas {credentials.length} credencial(is) ativa(s).</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewJob;