import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Home.css';

function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const modules = [
    {
      id: 'jobs',
      title: 'Jobs FGTS',
      description: 'Gerenciar jobs de consulta FGTS',
      icon: '📋',
      color: '#3b82f6',
      path: '/jobs'
    },
    {
      id: 'simulations',
      title: 'Simulações',
      description: 'Simulações bancárias',
      icon: '🏦',
      color: '#10b981',
      path: '/simulations'
    },
    {
      id: 'credentials',
      title: 'Credenciais',
      description: 'Gerenciar credenciais bancárias',
      icon: '🔑',
      color: '#f59e0b',
      path: '/credentials'
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Visão geral e estatísticas',
      icon: '📊',
      color: '#8b5cf6',
      path: '/dashboard'
    }
  ];

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-v-large">V</div>
            <span className="logo-text-large">DIGITAL</span>
          </div>
          <div className="user-section">
            <span className="user-name">Olá, {user?.name || 'Usuário'}</span>
            <button onClick={handleLogout} className="btn-logout-home">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="home-main">
        <div className="welcome-section">
          <h1>Bem-vindo ao ROBO-CLT</h1>
          <p>Selecione um módulo para começar</p>
        </div>

        <div className="modules-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="module-card"
              onClick={() => navigate(module.path)}
              style={{ '--module-color': module.color }}
            >
              <div className="module-icon">{module.icon}</div>
              <h2 className="module-title">{module.title}</h2>
              <p className="module-description">{module.description}</p>
              <div className="module-arrow">→</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="home-footer">
        <p>ROBO-CLT © 2025 - Sistema de Automação</p>
      </footer>
    </div>
  );
}

export default Home;
