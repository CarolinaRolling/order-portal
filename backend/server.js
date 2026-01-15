const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const { pool } = require('./database/migrate');
const { checkOrderStatuses, sendDelayAlerts } = require('./services/orderService');
const { sendEmail } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// ==================== LOGGING HELPER ====================

const logEvent = async (logType, message, details = null, createdBy = 'system') => {
  try {
    await pool.query(
      'INSERT INTO system_logs (log_type, message, details, created_by) VALUES ($1, $2, $3, $4)',
      [logType, message, details ? JSON.stringify(details) : null, createdBy]
    );
  } catch (error) {
    console.error('Failed to write log:', error);
  }
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      await logEvent('warning', `Failed login attempt for username: ${username}`, { username }, 'system');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await logEvent('warning', `Failed login attempt (wrong password) for: ${username}`, { username }, 'system');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        companyName: user.company_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logEvent('auth', `User logged in: ${username}`, { userId: user.id, role: user.role }, username);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.company_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    await logEvent('error', 'Login error', { error: error.message }, 'system');
    res.status(500).json({ error: 'Server error' });
  }
});

// Register (Admin only)
app.post('/api/auth/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, email, company_name, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, company_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, company_name`,
      [username, hashedPassword, email, company_name, role || 'client']
    );

    await logEvent('info', `New user created: ${username}`, { userId: result.rows[0].id, role: role || 'client' }, req.user.username);

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    await logEvent('error', 'Registration error', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ORDER ROUTES ====================

// Create/Submit Order
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { po_number, date_required, client_name, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO orders (user_id, po_number, date_required, client_name, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (user_id, po_number) 
       DO UPDATE SET date_required = $3, client_name = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, po_number, date_required, client_name, notes]
    );

    await logEvent('info', `Order created/updated: PO ${po_number}`, { orderId: result.rows[0].id, poNumber: po_number, clientName: client_name }, req.user.username);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Order creation error:', error);
    await logEvent('error', 'Order creation failed', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user's orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? 'SELECT o.*, u.username, u.company_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC'
      : 'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC';
    
    const params = req.user.role === 'admin' ? [] : [req.user.id];
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get orders error:', error);
    await logEvent('error', 'Failed to fetch orders', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? 'SELECT * FROM orders WHERE id = $1'
      : 'SELECT * FROM orders WHERE id = $1 AND user_id = $2';
    
    const params = req.user.role === 'admin' 
      ? [req.params.id]
      : [req.params.id, req.user.id];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get order error:', error);
    await logEvent('error', 'Failed to fetch order', { error: error.message, orderId: req.params.id }, req.user.username);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order
app.put('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { po_number, date_required, notes } = req.body;
    
    // Check if order exists and user has permission
    const checkQuery = req.user.role === 'admin'
      ? 'SELECT * FROM orders WHERE id = $1'
      : 'SELECT * FROM orders WHERE id = $1 AND user_id = $2';
    
    const checkParams = req.user.role === 'admin'
      ? [req.params.id]
      : [req.params.id, req.user.id];
    
    const checkResult = await pool.query(checkQuery, checkParams);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Update the order
    const result = await pool.query(
      `UPDATE orders 
       SET po_number = $1, date_required = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [po_number, date_required, notes, req.params.id]
    );
    
    await logEvent('info', `Order updated: PO ${po_number}`, { 
      orderId: req.params.id, 
      poNumber: po_number,
      changes: { po_number, date_required, notes }
    }, req.user.username);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update order error:', error);
    await logEvent('error', 'Failed to update order', { error: error.message, orderId: req.params.id }, req.user.username);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Delete order
app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? 'DELETE FROM orders WHERE id = $1 RETURNING *'
      : 'DELETE FROM orders WHERE id = $1 AND user_id = $2 RETURNING *';
    
    const params = req.user.role === 'admin'
      ? [req.params.id]
      : [req.params.id, req.user.id];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await logEvent('info', `Order deleted: ID ${req.params.id}`, { orderId: req.params.id }, req.user.username);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    await logEvent('error', 'Failed to delete order', { error: error.message, orderId: req.params.id }, req.user.username);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, company_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    await logEvent('error', 'Failed to fetch users', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, company_name, is_active } = req.body;
    
    const result = await pool.query(
      `UPDATE users SET email = $1, company_name = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING id, username, email, company_name, role, is_active`,
      [email, company_name, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logEvent('info', `User updated: ${result.rows[0].username}`, { userId: req.params.id, changes: { email, company_name, is_active } }, req.user.username);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    await logEvent('error', 'Failed to update user', { error: error.message, userId: req.params.id }, req.user.username);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Change user password (Admin only)
app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const result = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING id, username, email`,
      [hashedPassword, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logEvent('info', `Password changed for user: ${result.rows[0].username}`, { userId: req.params.id }, req.user.username);

    res.json({ 
      message: 'Password updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Password update error:', error);
    await logEvent('error', 'Failed to update password', { error: error.message, userId: req.params.id }, req.user.username);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Generate random password (helper for admin)
app.get('/api/admin/generate-password', authenticateToken, requireAdmin, (req, res) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  res.json({ password });
});

// Get email recipients
app.get('/api/admin/recipients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alert_recipients ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get recipients error:', error);
    await logEvent('error', 'Failed to fetch recipients', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

// Add email recipient
app.post('/api/admin/recipients', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    
    const result = await pool.query(
      'INSERT INTO alert_recipients (email) VALUES ($1) RETURNING *',
      [email]
    );

    await logEvent('info', `Email recipient added: ${email}`, { recipientId: result.rows[0].id }, req.user.username);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Add recipient error:', error);
    await logEvent('error', 'Failed to add recipient', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to add recipient' });
  }
});

// Delete email recipient
app.delete('/api/admin/recipients/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT email FROM alert_recipients WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM alert_recipients WHERE id = $1', [req.params.id]);
    
    if (result.rows.length > 0) {
      await logEvent('info', `Email recipient deleted: ${result.rows[0].email}`, { recipientId: req.params.id }, req.user.username);
    }
    
    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Delete recipient error:', error);
    await logEvent('error', 'Failed to delete recipient', { error: error.message, recipientId: req.params.id }, req.user.username);
    res.status(500).json({ error: 'Failed to delete recipient' });
  }
});

// Get settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    await logEvent('error', 'Failed to fetch settings', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO email_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)]
      );
    }

    await logEvent('info', 'Settings updated', { settings: Object.keys(settings) }, req.user.username);
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    await logEvent('error', 'Failed to update settings', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Manual trigger for status check
app.post('/api/admin/check-statuses', authenticateToken, async (req, res) => {
  try {
    const clientFilter = req.user.role === 'client' ? req.user.companyName : null;
    
    await logEvent('status_check', `Manual status check triggered by ${req.user.username}`, { userRole: req.user.role, clientFilter }, req.user.username);
    
    await checkOrderStatuses(clientFilter);
    res.json({ message: 'Status check triggered successfully' });
  } catch (error) {
    console.error('Manual check error:', error);
    await logEvent('error', 'Status check failed', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to check statuses' });
  }
});

// ==================== LOGS ROUTES ====================

// Get system logs (Admin only)
app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { log_type, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM system_logs';
    let params = [];
    
    if (log_type && log_type !== 'all') {
      query += ' WHERE log_type = $1';
      params.push(log_type);
      query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      params.push(parseInt(limit), parseInt(offset));
    } else {
      query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
      params.push(parseInt(limit), parseInt(offset));
    }
    
    const result = await pool.query(query, params);
    
    // Get total count
    const countQuery = log_type && log_type !== 'all'
      ? 'SELECT COUNT(*) FROM system_logs WHERE log_type = $1'
      : 'SELECT COUNT(*) FROM system_logs';
    const countParams = log_type && log_type !== 'all' ? [log_type] : [];
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Clear old logs (Admin only)
app.delete('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await pool.query(
      `DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '${parseInt(days)} days' RETURNING id`
    );
    
    await logEvent('info', `Cleared ${result.rowCount} logs older than ${days} days`, { deletedCount: result.rowCount }, req.user.username);
    
    res.json({ message: `Deleted ${result.rowCount} log entries`, count: result.rowCount });
  } catch (error) {
    console.error('Clear logs error:', error);
    await logEvent('error', 'Failed to clear logs', { error: error.message }, req.user.username);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// ==================== SCHEDULED JOBS ====================

// Check order statuses every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled status check...');
  await logEvent('status_check', 'Scheduled status check started', null, 'system');
  try {
    await checkOrderStatuses();
    await logEvent('status_check', 'Scheduled status check completed successfully', null, 'system');
  } catch (error) {
    console.error('Scheduled check error:', error);
    await logEvent('error', 'Scheduled status check failed', { error: error.message }, 'system');
  }
});

// Send delay alerts twice daily (9 AM and 5 PM)
cron.schedule('0 9,17 * * *', async () => {
  console.log('Running scheduled delay alert check...');
  await logEvent('email', 'Scheduled delay alerts check started', null, 'system');
  try {
    await sendDelayAlerts();
    await logEvent('email', 'Scheduled delay alerts sent successfully', null, 'system');
  } catch (error) {
    console.error('Scheduled alert error:', error);
    await logEvent('error', 'Scheduled delay alerts failed', { error: error.message }, 'system');
  }
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== SERVE REACT APP ====================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// ==================== START SERVER ====================

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  await logEvent('info', `Server started on port ${PORT}`, { environment: process.env.NODE_ENV || 'development' }, 'system');
});
