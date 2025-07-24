import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { Trades } from './pages/Trades'
import { Positions } from './pages/Positions'
import Accounts from './pages/Accounts'
import { Parties } from './pages/Parties'
import Receipts from './pages/Receipts'
import Counterparts from './pages/Counterparts'
import { Journal } from './pages/Journal'
import Login from './pages/Login'
import UserManagement from './pages/UserManagement'

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/positions" element={<Positions />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/parties" element={<Parties />} />
              <Route path="/receipts" element={<Receipts />} />
              <Route path="/counterparts" element={<Counterparts />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/users" element={<UserManagement />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App 