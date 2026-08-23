import { Outlet } from 'react-router-dom';
import { Navbar } from './components/ui/Navbar';
import { useAuth } from './context/AuthContext';

export function App() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-lime-400 selection:text-zinc-950">
      <Navbar user={user} />
      <Outlet />
    </div>
  );
}

export default App;
