import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { DesktopNavbar, MobileNavbar } from './components/ui/Navbar';
import { PageLoadingFallback } from './components/ui/PageLoadingFallback';
import { useAuth } from './context/AuthContext';

export function App() {
  const { user } = useAuth();
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-zinc-950 text-zinc-50 font-sans selection:bg-lime-400 selection:text-zinc-950 overflow-hidden">
      {/* Desktop Header */}
      <div className="hidden md:block shrink-0 z-30">
        <DesktopNavbar user={user} />
      </div>

      {/* Main Page Viewport Container */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
        <Suspense fallback={<PageLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden shrink-0 z-40">
        <MobileNavbar user={user} />
      </div>
    </div>
  );
}

export default App;

