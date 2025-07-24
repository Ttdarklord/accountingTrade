import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  CreditCard, 
  Users, 
  Receipt, 
  BookOpen,
  FileText,
  Coins,
  Settings,
  LogOut,
  User,
  Shield
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Trades', href: '/trades', icon: TrendingUp },
  { name: 'Positions', href: '/positions', icon: Package },
  { name: 'Bank Accounts', href: '/accounts', icon: CreditCard },
  { name: 'Trading Parties', href: '/parties', icon: Users },
  { name: 'Receipts', href: '/receipts', icon: Receipt },
  { name: 'Statements', href: '/counterparts', icon: FileText },
  { name: 'Journal', href: '/journal', icon: BookOpen },
]

export function Sidebar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <Coins className="h-8 w-8 text-primary-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">Agrivex</span>
        </div>
        
        <div className="mt-8 flex-grow flex flex-col">
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-900 border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            ))}
            
            {/* User Management - Only visible to superadmins */}
            {user?.role === 'superadmin' && (
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-900 border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Settings className="mr-3 h-5 w-5 flex-shrink-0" />
                User Management
              </NavLink>
            )}
          </nav>
        </div>
        
        {/* User info and logout */}
        <div className="flex-shrink-0 border-t border-gray-200">
          {/* User Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username}
                </div>
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user?.role === 'superadmin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user?.role === 'superadmin' && <Shield className="h-2.5 w-2.5 mr-1" />}
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Logout Button */}
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
              Sign Out
            </button>
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div className="font-medium">Currency Trading System</div>
              <div>Toman ⇄ AED Exchange</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 