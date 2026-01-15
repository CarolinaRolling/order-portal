import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUsers, register, updateUser, changeUserPassword, generatePassword, triggerStatusCheck, getLogs, clearOldLogs } from '../utils/api';
import { format } from 'date-fns';
import '../styles/AdminPanel.css';

function AdminPanel({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    company_name: '',
    role: 'client'
  });
  const [editFormData, setEditFormData] = useState({
    email: '',
    company_name: '',
    is_active: true,
    new_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copiedText, setCopiedText] = useState('');

  // Logs state
  const [activeTab, setActiveTab] = useState('users');
  const [logs, setLogs] = useState([]);
  const [logType, setLogType] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logsPagination, setLogsPagination] = useState({ limit: 100, offset: 0, total: 0 });

  useEffect(() => {
    loadUsers();
  }, []);

  // Logs useEffect
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
      
      if (autoRefresh) {
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, logType, autoRefresh, logsPagination.offset]);

  const loadUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Logs functions
  const fetchLogs = async () => {
    try {
      const response = await getLogs(logType, logsPagination.limit, logsPagination.offset);
      setLogs(response.data.logs);
      setLogsPagination(prev => ({ ...prev, total: response.data.total }));
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Clear logs older than 30 days?')) return;
    try {
      const response = await clearOldLogs(30);
      alert(response.data.message);
      fetchLogs();
    } catch (error) {
      alert('Error clearing logs: ' + error.message);
    }
  };

  const getLogTypeColor = (type) => {
    const colors = {
      info: '#3b82f6',
      error: '#ef4444',
      warning: '#f59e0b',
      status_check: '#10b981',
      email: '#8b5cf6',
      auth: '#6366f1'
    };
    return colors[type] || '#6b7280';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await register(formData);
      setFormData({ username: '', password: '', email: '', company_name: '', role: 'client' });
      setShowForm(false);
      setSuccess(`User created! Username: ${formData.username}, Password: ${formData.password}`);
      loadUsers();
      setTimeout(() => setSuccess(''), 10000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
    setEditFormData({
      email: userToEdit.email,
      company_name: userToEdit.company_name || '',
      is_active: userToEdit.is_active,
      new_password: ''
    });
    setShowEditModal(true);
    setError('');
    setSuccess('');
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await updateUser(editingUser.id, {
        email: editFormData.email,
        company_name: editFormData.company_name,
        is_active: editFormData.is_active
      });

      if (editFormData.new_password) {
        await changeUserPassword(editingUser.id, editFormData.new_password);
      }

      setShowEditModal(false);
      setEditingUser(null);
      setSuccess('User updated successfully!');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleGeneratePassword = async () => {
    try {
      const response = await generatePassword();
      setFormData({ ...formData, password: response.data.password });
      setShowPassword(true);
    } catch (err) {
      setError('Failed to generate password');
    }
  };

  const handleGeneratePasswordEdit = async () => {
    try {
      const response = await generatePassword();
      setEditFormData({ ...editFormData, new_password: response.data.password });
    } catch (err) {
      setError('Failed to generate password');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const copyLoginInfo = (username, password) => {
    const loginInfo = `Portal Login Information:
Username: ${username}
Password: ${password}
Login URL: ${window.location.origin}/login

Please keep this information secure and change your password after first login.`;
    
    navigator.clipboard.writeText(loginInfo);
    setCopiedText('login-info');
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      await updateUser(userId, {
        email: userToUpdate.email,
        company_name: userToUpdate.company_name,
        is_active: !currentStatus
      });
      loadUsers();
    } catch (err) {
      setError('Failed to update user status');
    }
  };

  const handleManualCheck = async () => {
    setSuccess('');
    setError('');
    try {
      await triggerStatusCheck();
      setSuccess('Status check triggered! Orders will be updated shortly.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to trigger status check');
    }
  };

  return (
    <div className="admin-panel">
      <nav className="navbar">
        <div className="nav-brand">
          <span className="nav-icon">📦</span>
          <span className="nav-title">Order Portal - Admin</span>
        </div>
        <div className="nav-menu">
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/admin" className="nav-link active">Admin</Link>
          <Link to="/settings" className="nav-link">Settings</Link>
          <span className="nav-user">
            <span className="user-icon">👤</span>
            {user.username}
          </span>
          <button onClick={onLogout} className="logout-btn">Sign Out</button>
        </div>
      </nav>

      <div className="admin-container">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          >
            👥 Users
          </button>
          <button 
            onClick={() => setActiveTab('logs')} 
            className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          >
            📋 Logs
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span>✅</span> {success}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <>
            <header className="admin-header">
              <div>
                <h1>User Management</h1>
                <p className="subtitle">Manage client accounts and permissions</p>
              </div>
              <div className="header-actions">
                <button onClick={handleManualCheck} className="btn-secondary">
                  🔄 Check Statuses Now
                </button>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary">
                  {showForm ? '✕ Cancel' : '+ New User'}
                </button>
              </div>
            </header>

            {showForm && (
              <div className="user-form-card">
                <h3>Create New User</h3>
                <form onSubmit={handleSubmit} className="user-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Username *</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        required
                        placeholder="johndoe"
                      />
                    </div>
                    <div className="form-group">
                      <label>Password *</label>
                      <div className="password-input-group">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          required
                          placeholder="••••••••"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="btn-toggle-password"
                          title="Show/hide password"
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button 
                          type="button" 
                          onClick={handleGeneratePassword}
                          className="btn-generate"
                          title="Generate random password"
                        >
                          🎲 Generate
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                        placeholder="user@company.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Company Name</label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                        placeholder="Must match clientName in inventory!"
                      />
                      <small className="field-hint">⚠️ Must match exactly with inventory clientName</small>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="client">Client</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-submit">Create User</button>
                    {formData.username && formData.password && (
                      <button 
                        type="button" 
                        onClick={() => copyLoginInfo(formData.username, formData.password)}
                        className="btn-copy-info"
                      >
                        {copiedText === 'login-info' ? '✓ Copied!' : '📋 Copy Login Info'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            <div className="users-section">
              <h2>All Users ({users.length})</h2>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h3>No users yet</h3>
                  <p>Create your first user to get started</p>
                </div>
              ) : (
                <div className="users-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className={!u.is_active ? 'inactive-row' : ''}>
                          <td className="username-cell">{u.username}</td>
                          <td>{u.email}</td>
                          <td>{u.company_name || '-'}</td>
                          <td>
                            <span className={`role-badge ${u.role}`}>
                              {u.role === 'admin' ? '🛡️ Admin' : '👤 Client'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{format(new Date(u.created_at), 'MMM dd, yyyy')}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                onClick={() => handleEditUser(u)}
                                className="btn-edit"
                                title="Edit user"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleToggleActive(u.id, u.is_active)}
                                className={u.is_active ? 'btn-deactivate' : 'btn-activate'}
                                title={u.is_active ? 'Deactivate user' : 'Activate user'}
                              >
                                {u.is_active ? '🔒' : '🔓'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="logs-section">
            <div className="logs-header">
              <h2>📋 System Logs</h2>
              <div className="logs-controls">
                <select 
                  value={logType} 
                  onChange={(e) => {
                    setLogType(e.target.value);
                    setLogsPagination(prev => ({ ...prev, offset: 0 }));
                  }}
                  className="log-type-select"
                >
                  <option value="all">All Logs</option>
                  <option value="info">Info</option>
                  <option value="error">Errors</option>
                  <option value="warning">Warnings</option>
                  <option value="status_check">Status Checks</option>
                  <option value="email">Emails</option>
                  <option value="auth">Authentication</option>
                </select>
                
                <label className="auto-refresh-toggle">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <span>Auto-refresh (5s)</span>
                </label>
                
                <button onClick={fetchLogs} className="btn-refresh">
                  🔄 Refresh
                </button>
                
                <button onClick={handleClearLogs} className="btn-clear-logs">
                  🗑️ Clear Old Logs
                </button>
              </div>
            </div>
            
            <div className="logs-stats">
              <span>Total: {logsPagination.total}</span>
              <span>Showing: {logs.length}</span>
            </div>
            
            <div className="logs-container">
              {logs.length === 0 ? (
                <p className="no-logs">No logs found</p>
              ) : (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Message</th>
                      <th>User</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className={`log-row log-${log.log_type}`}>
                        <td className="log-time">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span 
                            className="log-type-badge"
                            style={{ backgroundColor: getLogTypeColor(log.log_type) }}
                          >
                            {log.log_type}
                          </span>
                        </td>
                        <td className="log-message">{log.message}</td>
                        <td>{log.created_by}</td>
                        <td className="log-details">
                          {log.details && (
                            <details>
                              <summary>View</summary>
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {logsPagination.total > logsPagination.limit && (
              <div className="logs-pagination">
                <button 
                  onClick={() => setLogsPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={logsPagination.offset === 0}
                >
                  ← Previous
                </button>
                <span>
                  Page {Math.floor(logsPagination.offset / logsPagination.limit) + 1} of {Math.ceil(logsPagination.total / logsPagination.limit)}
                </span>
                <button 
                  onClick={() => setLogsPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={logsPagination.offset + logsPagination.limit >= logsPagination.total}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* EDIT USER MODAL */}
        {showEditModal && editingUser && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit User: {editingUser.username}</h3>
                <button onClick={() => setShowEditModal(false)} className="btn-close">✕</button>
              </div>
              <form onSubmit={handleUpdateUser} className="edit-form">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={editFormData.company_name}
                    onChange={(e) => setEditFormData({...editFormData, company_name: e.target.value})}
                    placeholder="Must match clientName in inventory!"
                  />
                  <small className="field-hint">⚠️ Must match exactly with inventory clientName</small>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editFormData.is_active}
                      onChange={(e) => setEditFormData({...editFormData, is_active: e.target.checked})}
                    />
                    {' '}Active User
                  </label>
                </div>
                <div className="form-group">
                  <label>New Password (optional)</label>
                  <div className="password-input-group">
                    <input
                      type="text"
                      value={editFormData.new_password}
                      onChange={(e) => setEditFormData({...editFormData, new_password: e.target.value})}
                      placeholder="Leave blank to keep current password"
                    />
                    <button 
                      type="button" 
                      onClick={handleGeneratePasswordEdit}
                      className="btn-generate"
                      title="Generate random password"
                    >
                      🎲 Generate
                    </button>
                  </div>
                  {editFormData.new_password && (
                    <div className="password-display">
                      <span className="password-text">{editFormData.new_password}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(editFormData.new_password, 'password')}
                        className="btn-copy-small"
                      >
                        {copiedText === 'password' ? '✓' : '📋'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-cancel">
                    Cancel
                  </button>
                  <button type="submit" className="btn-save">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
