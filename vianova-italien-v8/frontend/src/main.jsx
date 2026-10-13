import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { UIProvider } from './ui.jsx';
import { LangProvider } from './i18n.jsx';
import './styles.css';
import './exam.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthProvider><LangProvider><UIProvider><App /></UIProvider></LangProvider></AuthProvider></BrowserRouter>
);
