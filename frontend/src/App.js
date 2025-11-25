import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Jobs from './pages/Jobs';
import NewJob from './pages/NewJob';
import JobDetails from './pages/JobDetails';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Rota pública */}
            <Route path="/login" element={<Login />} />
            
            {/* Rotas protegidas */}
            <Route path="/" element={<PrivateRoute><Navigate to="/jobs" /></PrivateRoute>} />
            <Route path="/jobs" element={<PrivateRoute><Jobs /></PrivateRoute>} />
            <Route path="/new-job" element={<PrivateRoute><NewJob /></PrivateRoute>} />
            <Route path="/jobs/:id" element={<PrivateRoute><JobDetails /></PrivateRoute>} />
            
            {/* Rota padrão */}
            <Route path="*" element={<Navigate to="/jobs" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
