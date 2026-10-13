import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import { HOME } from './routes.js';
import { Login, Register, Forgot, Reset } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Session from './pages/Session.jsx';
import Teacher from './pages/Teacher.jsx';
import Vocab from './pages/Vocab.jsx';
import Agency from './pages/Agency.jsx';
import Exam from './pages/Exam.jsx';
import { AdminUsers, AdminCourses, AdminTracking, AdminMisc, AdminStudents, AdminAgency, AdminExams } from './pages/Admin.jsx';

const home = HOME;

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Chargement…</p>;
  if (!user) return <Navigate to="/" replace />; // la connexion se fait depuis la page d'accueil
  if (!roles.includes(user.role)) return <Navigate to={home[user.role]} replace />;
  return <Layout>{children}</Layout>;
}

// Pages publiques (connexion, inscription…) : si on est déjà connecté, on va directement dans son espace
function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Chargement…</p>;
  if (user) return <Navigate to={home[user.role]} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/inscription" element={<Public><Register /></Public>} />
      <Route path="/forgot" element={<Public><Forgot /></Public>} />
      <Route path="/reset" element={<Reset />} />
      <Route path="/espace" element={<Guard roles={['student']}><Dashboard /></Guard>} />
      <Route path="/seance/:id" element={<Guard roles={['student']}><Session /></Guard>} />
      <Route path="/vocabulaire" element={<Guard roles={['student']}><Vocab /></Guard>} />
      <Route path="/agence" element={<Guard roles={['student']}><Agency /></Guard>} />
      <Route path="/examen" element={<Guard roles={['student']}><Exam /></Guard>} />
      <Route path="/examen/:id" element={<Guard roles={['student']}><Exam /></Guard>} />
      <Route path="/prof" element={<Guard roles={['teacher']}><Teacher /></Guard>} />
      <Route path="/admin/suivi" element={<Guard roles={['admin']}><AdminTracking /></Guard>} />
      <Route path="/admin/utilisateurs" element={<Guard roles={['admin']}><AdminUsers /></Guard>} />
      <Route path="/admin/cours" element={<Guard roles={['admin']}><AdminCourses /></Guard>} />
      <Route path="/admin/ecole" element={<Guard roles={['admin']}><AdminMisc /></Guard>} />
      <Route path="/admin/examens" element={<Guard roles={['admin']}><AdminExams /></Guard>} />
      <Route path="/admin/oraux" element={<Guard roles={['admin']}><Teacher /></Guard>} />
      <Route path="/admin/etudiants" element={<Guard roles={['admin']}><AdminStudents /></Guard>} />
      <Route path="/admin/agence" element={<Guard roles={['admin']}><AdminAgency /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
