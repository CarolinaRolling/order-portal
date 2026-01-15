const axios = require('axios');
const { pool } = require('../database/migrate');
const { sendEmail } = require('./emailService');

// Configuration for your Carolina Rolling Inventory API
const INVENTORY_API_URL = process.env.INVENTORY_API_URL || 'https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api';

// Logging helper function
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

/**
 * Check a single order status from your Carolina Rolling Inventory API
 */
async function checkInventoryStatus(poNumber, clientName) {
  try {
    await logEvent('status_check', `Fetching inventory data for PO: ${poNumber}, Client: ${clientName}`);
    
    // First, try to find in shipments
    const shipmentsResponse = await axios.get(`${INVENTORY_API_URL}/shipments`, {
      timeout: 10000
    });

    // Carolina API returns: {data: [...], total: X, limit: Y}
    const shipments = shipmentsResponse.data?.data || [];
    await logEvent('status_check', `Carolina API returned ${shipments.length} shipments`);

    if (shipments.length > 0) {
      const shipment = shipments.find(s => {
        const poMatches = s.clientPurchaseOrderNumber === poNumber;
        const clientMatches = !clientName || s.clientName === clientName || 
                              (s.clientName && s.clientName.toLowerCase().includes(clientName.toLowerCase()));
        return poMatches && clientMatches;
      });

      if (shipment) {
        await logEvent('status_check', `✅ Found shipment match: PO "${shipment.clientPurchaseOrderNumber}" for client "${shipment.clientName}"`, {
          poNumber,
          clientName,
          inventoryClientName: shipment.clientName,
          inventoryStatus: shipment.status
        });
        
        let status = 'pending';
        
        // If found in inventory with any status other than shipped/in-transit, it's received at facility
        if (shipment.status === 'shipped' || shipment.status === 'in_transit' || shipment.status === 'out_for_delivery') {
          status = 'shipped';
        } else {
          // processing, stored, received, pending, preparing, awaiting, delivered, completed, etc.
          // All mean it's at your facility = RECEIVED
          status = 'received';
        }

        return {
          found: true,
          status: status,
          details: {
            id: shipment.id,
            clientName: shipment.clientName,
            clientPurchaseOrderNumber: shipment.clientPurchaseOrderNumber,
            location: shipment.location,
            qrCode: shipment.qrCode,
            description: shipment.description,
            quantity: shipment.quantity,
            updatedAt: shipment.updatedAt,
            originalStatus: shipment.status
          }
        };
      }
    }

    // If not found in shipments, try inbound orders
    const inboundResponse = await axios.get(`${INVENTORY_API_URL}/inbound`, {
      timeout: 10000
    });

    // Carolina API returns: {data: [...], total: X, limit: Y}
    const inboundOrders = inboundResponse.data?.data || [];
    await logEvent('status_check', `Carolina API returned ${inboundOrders.length} inbound orders`);

    if (inboundOrders.length > 0) {
      const inbound = inboundOrders.find(i => {
        const poMatches = i.clientPurchaseOrderNumber === poNumber;
        const clientMatches = !clientName || i.clientName === clientName || 
                              (i.clientName && i.clientName.toLowerCase().includes(clientName.toLowerCase()));
        return poMatches && clientMatches;
      });

      if (inbound) {
        await logEvent('status_check', `✅ Found inbound order match: PO "${inbound.clientPurchaseOrderNumber}" for client "${inbound.clientName}"`, {
          poNumber,
          clientName,
          inventoryClientName: inbound.clientName,
          inventoryStatus: inbound.status
        });
        
        let status = 'pending';
        
        // If found in inventory with any status other than shipped/in-transit, it's received at facility
        if (inbound.status === 'shipped' || inbound.status === 'in_transit') {
          status = 'shipped';
        } else {
          // processing, stored, received, pending, preparing, awaiting, ordered, completed, etc.
          // All mean it's at your facility = RECEIVED
          status = 'received';
        }

        return {
          found: true,
          status: status,
          details: {
            id: inbound.id,
            clientName: inbound.clientName,
            clientPurchaseOrderNumber: inbound.clientPurchaseOrderNumber,
            supplier: inbound.supplier,
            expectedDate: inbound.expectedDate,
            quantity: inbound.quantity,
            description: inbound.description,
            updatedAt: inbound.updatedAt,
            originalStatus: inbound.status
          }
        };
      }
    }

    // Not found in either shipments or inbound orders
    await logEvent('warning', `Order not found in inventory: PO "${poNumber}", Client "${clientName}"`, { poNumber, clientName });
    return { found: false };

  } catch (error) {
    await logEvent('error', `Error checking inventory for PO ${poNumber}`, { 
      poNumber, 
      clientName, 
      error: error.message,
      apiUrl: INVENTORY_API_URL 
    });
    return null;
  }
}

/**
 * Alternative: Check by QR code if that's what clients will provide
 */
async function checkInventoryByQR(qrCode) {
  try {
    const response = await axios.get(`${INVENTORY_API_URL}/shipments/qr/${qrCode}`, {
      timeout: 10000
    });

    if (response.data) {
      const shipment = response.data;
      let status = 'pending';
      
      if (shipment.status === 'delivered' || shipment.status === 'received') {
        status = 'received';
      } else if (shipment.status === 'shipped' || shipment.status === 'in_transit') {
        status = 'shipped';
      } else if (shipment.status === 'processing') {
        status = 'processing';
      }

      return {
        found: true,
        status: status,
        details: shipment
      };
    }

    return { found: false };
  } catch (error) {
    await logEvent('error', `Error checking by QR ${qrCode}`, { qrCode, error: error.message });
    return null;
  }
}

/**
 * Check all pending/shipped orders and update their statuses
 * @param {string} clientFilter - Optional company name to filter orders by (for client users)
 */
async function checkOrderStatuses(clientFilter = null) {
  const client = await pool.connect();
  
  try {
    // Build query with optional client filter
    // Check ALL orders so status can go backwards (e.g. received → shipped)
    let query = `SELECT o.*, u.email, u.company_name as user_company_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE 1=1`;
    
    const params = [];
    if (clientFilter) {
      query += ` AND u.company_name = $1`;
      params.push(clientFilter);
      await logEvent('status_check', `Filtering orders for client: ${clientFilter}`, { clientFilter });
    }
    
    query += ` ORDER BY o.id`;
    
    const result = await client.query(query, params);

    await logEvent('status_check', `Found ${result.rows.length} orders to check`, { 
      count: result.rows.length,
      clientFilter: clientFilter || 'all'
    });

    if (result.rows.length === 0) {
      await logEvent('info', 'No orders to check');
      return;
    }

    for (const order of result.rows) {
      await logEvent('status_check', `🔍 Checking: PO "${order.po_number}" for client "${order.client_name}"`, {
        orderId: order.id,
        poNumber: order.po_number,
        clientName: order.client_name,
        currentStatus: order.status
      });
      
      const inventoryStatus = await checkInventoryStatus(order.po_number, order.client_name);

      if (inventoryStatus === null) {
        // API error - skip this order
        await logEvent('warning', `Could not check order ${order.po_number} - API error`, { orderId: order.id });
        continue;
      }

      if (!inventoryStatus.found) {
        // Order not found in inventory - no change
        await logEvent('info', `Order ${order.po_number} not found in inventory yet`, { 
          orderId: order.id,
          poNumber: order.po_number,
          clientName: order.client_name
        });
        await client.query(
          'UPDATE orders SET last_checked = CURRENT_TIMESTAMP WHERE id = $1',
          [order.id]
        );
        continue;
      }

      // Check if status changed
      if (inventoryStatus.status !== order.status) {
        await logEvent('status_check', `✅ Order status changed: ${order.status} → ${inventoryStatus.status}`, {
          orderId: order.id,
          poNumber: order.po_number,
          oldStatus: order.status,
          newStatus: inventoryStatus.status,
          inventoryDetails: inventoryStatus.details
        });

        // Update order status
        await client.query(
          `UPDATE orders 
           SET status = $1, last_checked = CURRENT_TIMESTAMP, 
               last_status_change = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [inventoryStatus.status, order.id]
        );

        // Log status change
        await client.query(
          'INSERT INTO status_history (order_id, old_status, new_status) VALUES ($1, $2, $3)',
          [order.id, order.status, inventoryStatus.status]
        );

        // Send email notification to user
        if (order.email) {
          await sendStatusChangeEmail(order, inventoryStatus.status, inventoryStatus.details);
          await logEvent('email', `Status change email sent to ${order.email}`, {
            orderId: order.id,
            poNumber: order.po_number,
            newStatus: inventoryStatus.status
          });
        }
      } else {
        // Status unchanged - just update last_checked
        await logEvent('info', `Order ${order.po_number} status unchanged: ${order.status}`, {
          orderId: order.id,
          status: order.status
        });
        await client.query(
          'UPDATE orders SET last_checked = CURRENT_TIMESTAMP WHERE id = $1',
          [order.id]
        );
      }
    }

    await logEvent('status_check', `✅ Status check completed: Checked ${result.rows.length} orders`, {
      ordersChecked: result.rows.length,
      clientFilter: clientFilter || 'all'
    });
  } catch (error) {
    await logEvent('error', 'Error checking order statuses', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Send status change notification email
 */
async function sendStatusChangeEmail(order, newStatus, details) {
  const statusMessages = {
    'received': 'has been received at our facility',
    'shipped': 'has been shipped to you'
  };

  const subject = `Order Update: PO #${order.po_number}`;
  
  let detailsHtml = '';
  if (details) {
    detailsHtml = `
      <h3>Additional Details:</h3>
      <ul>
        ${details.clientName ? `<li><strong>Client Name (from inventory):</strong> ${details.clientName}</li>` : ''}
        ${details.clientPurchaseOrderNumber ? `<li><strong>PO Number (from inventory):</strong> ${details.clientPurchaseOrderNumber}</li>` : ''}
        ${details.location ? `<li><strong>Location:</strong> ${details.location}</li>` : ''}
        ${details.qrCode ? `<li><strong>QR Code:</strong> ${details.qrCode}</li>` : ''}
        ${details.quantity ? `<li><strong>Quantity:</strong> ${details.quantity}</li>` : ''}
        ${details.description ? `<li><strong>Description:</strong> ${details.description}</li>` : ''}
        ${details.originalStatus ? `<li><strong>Inventory Status:</strong> ${details.originalStatus}</li>` : ''}
      </ul>
    `;
  }

  const message = `
    <h2>Order Status Update</h2>
    <p>Your order <strong>${order.po_number}</strong> ${statusMessages[newStatus] || 'status has been updated'}.</p>
    
    <h3>Order Details:</h3>
    <ul>
      <li><strong>PO Number:</strong> ${order.po_number}</li>
      <li><strong>Client Name:</strong> ${order.client_name || 'N/A'}</li>
      <li><strong>New Status:</strong> ${newStatus.toUpperCase()}</li>
      <li><strong>Date Required:</strong> ${new Date(order.date_required).toLocaleDateString()}</li>
    </ul>
    
    ${detailsHtml}
    
    <p>You can view your order details by logging into the portal.</p>
  `;

  await sendEmail(order.email, subject, message);
}

/**
 * Check for orders approaching due date and send alerts
 */
async function sendDelayAlerts() {
  const client = await pool.connect();
  
  try {
    await logEvent('email', 'Starting delay alerts check');
    
    // Get alert threshold from settings
    const settingsResult = await client.query(
      "SELECT setting_value FROM email_settings WHERE setting_key = 'alert_days_threshold'"
    );
    const daysThreshold = parseInt(settingsResult.rows[0]?.setting_value || '5');

    // Get orders that are not received and due within threshold
    const result = await client.query(
      `SELECT o.*, u.email, u.company_name as user_company_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.status != 'received'
       AND o.date_required <= CURRENT_DATE + INTERVAL '${daysThreshold} days'
       AND o.date_required >= CURRENT_DATE
       ORDER BY o.date_required`
    );

    if (result.rows.length === 0) {
      await logEvent('info', 'No delayed orders to alert about');
      return;
    }

    await logEvent('email', `Found ${result.rows.length} orders approaching due date`, {
      count: result.rows.length,
      daysThreshold
    });

    // Get alert recipients
    const recipientsResult = await client.query(
      'SELECT email FROM alert_recipients WHERE is_active = true'
    );
    const recipients = recipientsResult.rows.map(r => r.email);

    if (recipients.length === 0) {
      await logEvent('warning', 'No alert recipients configured - skipping admin alerts');
    }

    // Group orders by user
    const ordersByUser = {};
    for (const order of result.rows) {
      if (!ordersByUser[order.email]) {
        ordersByUser[order.email] = [];
      }
      ordersByUser[order.email].push(order);
    }

    // Send alerts to each client
    for (const [userEmail, orders] of Object.entries(ordersByUser)) {
      await sendDelayAlertEmail(userEmail, orders, daysThreshold);
    }

    // Send summary to admin recipients
    if (recipients.length > 0) {
      await sendAdminDelayAlert(recipients, result.rows, daysThreshold);
    }

    await logEvent('email', '✅ Delay alerts sent successfully', {
      clientsSent: Object.keys(ordersByUser).length,
      adminsSent: recipients.length
    });
  } catch (error) {
    await logEvent('error', 'Error sending delay alerts', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Send delay alert email to client
 */
async function sendDelayAlertEmail(userEmail, orders, daysThreshold) {
  const subject = `⚠️ Order Delivery Alert - ${orders.length} Order(s) Not Received`;
  
  const ordersList = orders.map(order => {
    const daysUntilDue = Math.ceil((new Date(order.date_required) - new Date()) / (1000 * 60 * 60 * 24));
    return `
      <li>
        <strong>PO #${order.po_number}</strong><br>
        Status: ${order.status.toUpperCase()}<br>
        Due Date: ${new Date(order.date_required).toLocaleDateString()} 
        <span style="color: ${daysUntilDue <= 2 ? '#e74c3c' : '#f39c12'};">
          (${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} remaining)
        </span><br>
        Client: ${order.client_name || 'N/A'}
      </li>
    `;
  }).join('');

  const message = `
    <h2>⚠️ Order Delivery Alert</h2>
    <p>The following order(s) have not been received and are due within ${daysThreshold} days:</p>
    
    <ul style="line-height: 2;">
      ${ordersList}
    </ul>
    
    <p>Please check on the status of these orders to ensure timely delivery.</p>
    <p>You can view more details by logging into the portal.</p>
  `;

  await sendEmail(userEmail, subject, message);
}

/**
 * Send summary delay alert to admin recipients
 */
async function sendAdminDelayAlert(recipients, orders, daysThreshold) {
  const subject = `Admin Alert: ${orders.length} Order(s) Not Received`;
  
  const ordersList = orders.map(order => {
    const daysUntilDue = Math.ceil((new Date(order.date_required) - new Date()) / (1000 * 60 * 60 * 24));
    return `
      <li>
        <strong>PO #${order.po_number}</strong> - ${order.user_company_name || 'Unknown Company'}<br>
        Status: ${order.status.toUpperCase()}<br>
        Due: ${new Date(order.date_required).toLocaleDateString()} (${daysUntilDue} days)<br>
        Client Email: ${order.email}
      </li>
    `;
  }).join('');

  const message = `
    <h2>Admin: Order Delivery Alert Summary</h2>
    <p>${orders.length} order(s) have not been received and are due within ${daysThreshold} days:</p>
    
    <ul style="line-height: 2.5;">
      ${ordersList}
    </ul>
    
    <p>Clients have been notified automatically.</p>
  `;

  // Send to all admin recipients
  for (const recipient of recipients) {
    await sendEmail(recipient, subject, message);
  }
}

module.exports = {
  checkOrderStatuses,
  sendDelayAlerts,
  checkInventoryStatus,
  checkInventoryByQR
};
