import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import NewJob from './pages/NewJob';
import JobDetails from './pages/JobDetails';
import Dashboard from './pages/Dashboard';
import Simulations from './pages/Simulations';
import Credentials from './pages/Credentials';
import Users from './pages/Users';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Rota pública */}
            <Route path="/login" element={<Login />} />

            {/* Página inicial */}
            <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />

            {/* Rotas de Jobs */}
            <Route path="/jobs" element={<PrivateRoute><Jobs /></PrivateRoute>} />
            <Route path="/new-job" element={<PrivateRoute><NewJob /></PrivateRoute>} />
            <Route path="/jobs/:id" element={<PrivateRoute><JobDetails /></PrivateRoute>} />

            {/* Rotas de Dashboard e outros módulos */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/simulations" element={<PrivateRoute><Simulations /></PrivateRoute>} />
            <Route path="/credentials" element={<PrivateRoute><Credentials /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />

            {/* Rota padrão */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
