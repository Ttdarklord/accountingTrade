import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  User, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role: 'superadmin' | 'regular';
  is_active: boolean;
  last_login_at?: string;
  last_activity_at?: string;
  created_at: string;
}

interface ActivityLog {
  id: number;
  user_id?: number;
  username: string;
  action: string;
  resource: string;
  details: string;
  ip_address: string;
  success: boolean;
  created_at: string;
}

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create user form state
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'regular' as 'regular' | 'superadmin'
  });

  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false
  });

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') {
      return;
    }
    fetchUsers();
    if (activeTab === 'activity') {
      fetchActivityLogs();
    }
  }, [currentUser, activeTab]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/auth/users'), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await fetch(getApiUrl('/auth/activity-logs?limit=50'), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.data);
      } else {
        throw new Error('Failed to fetch activity logs');
      }
    } catch (err) {
      setError('Failed to load activity logs');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      console.log('Creating user with form data:', createForm);
      
      const response = await fetch(getApiUrl('/auth/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(createForm),
      });

      const data = await response.json();
      console.log('Create user response:', { status: response.status, data });

      if (response.ok) {
        setSuccess('User created successfully');
        setShowCreateModal(false);
        setCreateForm({
          username: '',
          email: '',
          password: '',
          first_name: '',
          last_name: '',
          role: 'regular'
        });
        fetchUsers();
      } else {
        // Show detailed validation errors if available
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((detail: any) => detail.msg).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        } else {
          throw new Error(data.error || 'Failed to create user');
        }
      }
    } catch (err) {
      console.error('Create user error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!selectedUser) return;

    try {
      const response = await fetch(getApiUrl(`/auth/users/${selectedUser.id}/password`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password: passwordForm.password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Password updated successfully');
        setShowPasswordModal(false);
        setPasswordForm({ password: '', confirmPassword: '' });
        setSelectedUser(null);
      } else {
        throw new Error(data.error || 'Failed to update password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(getApiUrl(`/auth/users/${user.id}/toggle`), {
        method: 'PUT',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
        fetchUsers();
      } else {
        throw new Error(data.error || 'Failed to toggle user status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle user status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-gray-600">You need superadmin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Users className="mr-3 h-8 w-8 text-blue-600" />
            User Management
          </h1>
          <p className="mt-2 text-gray-600">Manage users, permissions, and monitor system activity</p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
            <button 
              onClick={() => setError('')}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-green-700">{success}</span>
            <button 
              onClick={() => setSuccess('')}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="inline h-4 w-4 mr-2" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activity'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="inline h-4 w-4 mr-2" />
              Activity Logs
            </button>
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            {/* Create User Button */}
            <div className="mb-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New User
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user.username}
                            </div>
                            <div className="text-sm text-gray-500">@{user.username}</div>
                            {user.email && (
                              <div className="text-sm text-gray-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'superadmin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'superadmin' && <Shield className="h-3 w-3 mr-1" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login_at ? (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatDate(user.last_login_at)}
                          </div>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            className={`${
                              user.is_active 
                                ? 'text-red-600 hover:text-red-900' 
                                : 'text-green-600 hover:text-green-900'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {log.details}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({...createForm, first_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={createForm.last_name}
                    onChange={(e) => setCreateForm({...createForm, last_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.password ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({...showPasswords, password: !showPasswords.password})}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPasswords.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({...createForm, role: e.target.value as 'regular' | 'superadmin'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="regular">Regular User</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Reset Password for {selectedUser.username}
            </h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.password ? 'text' : 'password'}
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({...passwordForm, password: e.target.value})}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({...showPasswords, password: !showPasswords.password})}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPasswords.password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({...showPasswords, confirmPassword: !showPasswords.confirmPassword})}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPasswords.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setSelectedUser(null);
                    setPasswordForm({password: '', confirmPassword: ''});
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement; 