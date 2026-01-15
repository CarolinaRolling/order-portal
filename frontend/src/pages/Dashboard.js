import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, createOrder, deleteOrder, triggerStatusCheck } from '../utils/api';
import { format } from 'date-fns';
import '../styles/Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    po_number: '',
    date_required: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await getOrders();
      setOrders(response.data);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await createOrder({
        po_number: formData.po_number,
        date_required: formData.date_required,
        client_name: user.companyName, // Use user's company name
        notes: formData.notes
      });
      setFormData({ po_number: '', date_required: '', notes: '' });
      setShowForm(false);
      setSuccess('Order created successfully!');
      setTimeout(() => setSuccess(''), 3000);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create order');
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    setError('');
    setSuccess('');
    try {
      await triggerStatusCheck();
      setSuccess('✅ Status check complete! Your orders have been updated.');
      setTimeout(() => setSuccess(''), 3000);
      // Reload orders to show updated statuses
      await loadOrders();
    } catch (error) {
      console.error('Status check error:', error);
      setError('❌ Error checking statuses: ' + (error.response?.data?.error || error.message));
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await deleteOrder(id);
        setSuccess('Order deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
        loadOrders();
      } catch (err) {
        setError('Failed to delete order');
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f39c12',
      processing: '#3498db',
      shipped: '#9b59b6',
      received: '#27ae60'
    };
    return colors[status] || '#95a5a6';
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    received: orders.filter(o => o.status === 'received').length
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-brand">
          <span className="nav-icon">📦</span>
          <span className="nav-title">Order Portal</span>
        </div>
        <div className="nav-menu">
          <span className="nav-user">
            <span className="user-icon">👤</span>
            {user.username} {user.role === 'admin' && '(Admin)'}
          </span>
          {user.role === 'admin' && (
            <>
              <Link to="/admin" className="nav-link">Users</Link>
              <Link to="/settings" className="nav-link">Settings</Link>
            </>
          )}
          <button onClick={onLogout} className="logout-btn">Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <h1>Order Dashboard</h1>
            <p className="subtitle">Track and manage your purchase orders</p>
          </div>
          <div className="header-actions">
            <button 
              onClick={handleRefreshStatus}
              className="btn-refresh"
              disabled={refreshing}
              style={{
                padding: '10px 20px',
                background: refreshing ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                marginRight: '10px',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              🔄 {refreshing ? 'Checking...' : 'Refresh All Statuses'}
            </button>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              {showForm ? '✕ Cancel' : '+ New Order'}
            </button>
          </div>
        </header>

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

        {showForm && (
          <div className="order-form-card">
            <h3>Submit New Order</h3>
            <form onSubmit={handleSubmit} className="order-form">
              <div className="form-row">
                <div className="form-group">
                  <label>PO Number *</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({...formData, po_number: e.target.value})}
                    required
                    placeholder="PO-12345"
                  />
                </div>
                <div className="form-group">
                  <label>Date Required *</label>
                  <input
                    type="date"
                    value={formData.date_required}
                    onChange={(e) => setFormData({...formData, date_required: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Client Name</label>
                <input
                  type="text"
                  value={user.companyName || ''}
                  readOnly
                  style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
                />
                <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                  📌 Auto-filled from your profile
                </small>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional information..."
                  rows="3"
                />
              </div>
              <button type="submit" className="btn-submit">Submit Order</button>
            </form>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card" style={{borderTop: `4px solid ${getStatusColor('pending')}`}}>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card" style={{borderTop: `4px solid ${getStatusColor('shipped')}`}}>
            <div className="stat-value">{stats.shipped}</div>
            <div className="stat-label">Shipped</div>
          </div>
          <div className="stat-card" style={{borderTop: `4px solid ${getStatusColor('received')}`}}>
            <div className="stat-value">{stats.received}</div>
            <div className="stat-label">Received</div>
          </div>
        </div>

        <div className="orders-section">
          <div className="orders-header">
            <h2>Your Orders</h2>
            <div className="filter-buttons">
              <button 
                className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setFilter('pending')}
              >
                Pending
              </button>
              <button 
                className={filter === 'shipped' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setFilter('shipped')}
              >
                Shipped
              </button>
              <button 
                className={filter === 'received' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setFilter('received')}
              >
                Received
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔭</div>
              <h3>No orders found</h3>
              <p>Start by creating your first order</p>
            </div>
          ) : (
            <div className="orders-table">
              <table>
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Client Name</th>
                    <th>Status</th>
                    <th>Date Required</th>
                    <th>Last Checked</th>
                    {user.role === 'admin' && <th>Company</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td className="po-number">{order.po_number}</td>
                      <td>{order.client_name || '-'}</td>
                      <td>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(order.status) }}
                        >
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{format(new Date(order.date_required), 'MMM dd, yyyy')}</td>
                      <td>
                        {order.last_checked 
                          ? format(new Date(order.last_checked), 'MMM dd, HH:mm')
                          : 'Not yet checked'
                        }
                      </td>
                      {user.role === 'admin' && <td>{order.company_name || '-'}</td>}
                      <td>
                        <button 
                          onClick={() => handleDelete(order.id)}
                          className="btn-delete"
                          title="Delete order"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
