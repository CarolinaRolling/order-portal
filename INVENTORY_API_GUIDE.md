# Inventory API Integration Guide

This file explains how to customize the order status checking to work with YOUR specific Heroku inventory app.

## Understanding the Integration

The portal checks your inventory app's API every 5 minutes to see if orders have shipped or been received. To make this work, you need to customize the `checkInventoryStatus()` function in `backend/services/orderService.js`.

## What You Need to Know About Your Inventory API

Before customizing, gather this information about your inventory app:

1. **Base URL**: e.g., `https://my-inventory.herokuapp.com/api`
2. **Endpoint for checking orders**: e.g., `/orders`, `/shipments`, `/deliveries`
3. **Authentication method**: API key in header? Bearer token? Basic auth?
4. **Query parameters**: How do you search? By PO number? By client?
5. **Response structure**: What does a successful response look like?
6. **Status values**: What statuses does your API return?

## Example Customizations

### Example 1: Simple REST API

If your inventory app has a simple endpoint like:
```
GET /api/orders?po_number=PO-123&client_name=Acme Corp
Authorization: Bearer YOUR-API-KEY
```

And returns:
```json
{
  "success": true,
  "order": {
    "po_number": "PO-123",
    "status": "shipped",
    "tracking": "1Z999AA10123456784"
  }
}
```

Then customize like this:
```javascript
async function checkInventoryStatus(poNumber, clientName) {
  try {
    const response = await axios.get(`${INVENTORY_API_URL}/orders`, {
      headers: {
        'Authorization': `Bearer ${INVENTORY_API_KEY}`
      },
      params: {
        po_number: poNumber,
        client_name: clientName
      }
    });

    if (response.data.success && response.data.order) {
      const order = response.data.order;
      
      // Map your statuses to portal statuses
      const statusMap = {
        'pending': 'pending',
        'processing': 'processing',
        'shipped': 'shipped',
        'delivered': 'received',
        'received': 'received'
      };

      return {
        found: true,
        status: statusMap[order.status] || 'pending',
        details: order
      };
    }

    return { found: false };
  } catch (error) {
    console.error(`Error checking inventory:`, error.message);
    return null; // Return null to indicate we couldn't check
  }
}
```

### Example 2: GraphQL API

If your inventory uses GraphQL:

```javascript
async function checkInventoryStatus(poNumber, clientName) {
  try {
    const query = `
      query GetOrder($poNumber: String!, $clientName: String!) {
        order(poNumber: $poNumber, clientName: $clientName) {
          poNumber
          status
          shippedDate
          deliveredDate
        }
      }
    `;

    const response = await axios.post(
      INVENTORY_API_URL,
      {
        query: query,
        variables: { poNumber, clientName }
      },
      {
        headers: {
          'Authorization': `Bearer ${INVENTORY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const order = response.data.data.order;
    
    if (order) {
      let status = 'pending';
      
      if (order.deliveredDate) {
        status = 'received';
      } else if (order.shippedDate) {
        status = 'shipped';
      }

      return { found: true, status, details: order };
    }

    return { found: false };
  } catch (error) {
    console.error(`Error checking inventory:`, error.message);
    return null;
  }
}
```

### Example 3: API with Multiple Endpoints

If you need to check multiple endpoints:

```javascript
async function checkInventoryStatus(poNumber, clientName) {
  try {
    // First, find the order ID
    const searchResponse = await axios.get(`${INVENTORY_API_URL}/search`, {
      headers: { 'X-API-Key': INVENTORY_API_KEY },
      params: { po: poNumber }
    });

    if (!searchResponse.data.orders || searchResponse.data.orders.length === 0) {
      return { found: false };
    }

    const orderId = searchResponse.data.orders[0].id;

    // Then get the full order details
    const orderResponse = await axios.get(
      `${INVENTORY_API_URL}/orders/${orderId}`,
      {
        headers: { 'X-API-Key': INVENTORY_API_KEY }
      }
    );

    const order = orderResponse.data;

    // Determine status based on multiple fields
    let status = 'pending';
    
    if (order.is_delivered) {
      status = 'received';
    } else if (order.tracking_number) {
      status = 'shipped';
    } else if (order.is_processing) {
      status = 'processing';
    }

    return { found: true, status, details: order };
  } catch (error) {
    console.error(`Error checking inventory:`, error.message);
    return null;
  }
}
```

## Testing Your Integration

### Step 1: Test Your API Manually

First, make sure you can query your API:

```bash
# Replace with your actual API details
curl -X GET "https://your-inventory.herokuapp.com/api/orders?po_number=PO-123" \
  -H "Authorization: Bearer YOUR-API-KEY"
```

### Step 2: Test in Development

1. Set up your `.env` file with correct API credentials
2. Add a console.log to see what your API returns:

```javascript
async function checkInventoryStatus(poNumber, clientName) {
  try {
    const response = await axios.get(...);
    
    // ADD THIS LINE TO DEBUG
    console.log('API Response:', JSON.stringify(response.data, null, 2));
    
    // ... rest of your code
  }
}
```

3. Run the backend and trigger a check:
```bash
cd backend
npm run dev
# In another terminal, trigger a check through the API or admin panel
```

### Step 3: Verify Status Mapping

Make sure all your inventory statuses are properly mapped:

```javascript
// Print out what statuses you're seeing
console.log('Original status from API:', order.status);
console.log('Mapped to portal status:', mappedStatus);
```

Portal expects these statuses:
- `'pending'` - Order exists but not yet processing
- `'processing'` - Order is being prepared/packed
- `'shipped'` - Order has been shipped
- `'received'` - Order has been delivered/received

## Common Issues

### Issue: "Order not found" but it exists in inventory

**Solution**: Your query parameters might be wrong. Check:
- Parameter names (is it `po_number`, `po`, or `purchase_order`?)
- Value format (does it need quotes? prefix? suffix?)
- Case sensitivity (PO-123 vs po-123)

### Issue: Status never updates

**Solution**: Check your status mapping:
```javascript
// Add logging
console.log('Status from API:', apiStatus);
console.log('Status after mapping:', portalStatus);

// Make sure your mapping covers all possible statuses
const statusMap = {
  'awaiting_shipment': 'pending',
  'in_transit': 'shipped',
  'delivered': 'received',
  // Add ALL possible statuses from your API
};
```

### Issue: Timeout errors

**Solution**: Increase timeout or check API performance:
```javascript
const response = await axios.get(`${INVENTORY_API_URL}/orders`, {
  headers: {...},
  params: {...},
  timeout: 15000 // Increase from default 10000ms
});
```

## Need Different Behavior?

### Check by Order ID Instead of PO Number

Modify the database and forms to collect order IDs, then:
```javascript
async function checkInventoryStatus(orderId, clientName) {
  const response = await axios.get(`${INVENTORY_API_URL}/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${INVENTORY_API_KEY}` }
  });
  // ... rest of code
}
```

### Add Extra Order Information

Return additional data that will be stored:
```javascript
return {
  found: true,
  status: mappedStatus,
  details: {
    tracking_number: order.tracking,
    carrier: order.carrier,
    estimated_delivery: order.eta
  }
};
```

Then update the database schema to store this extra info.

## Getting Help

1. **Test your API first** with curl or Postman to understand its structure
2. **Add console.log statements** to see exactly what you're getting back
3. **Check Heroku logs** for error messages: `heroku logs --tail`
4. **Verify environment variables** are set: `heroku config`

Remember: Every inventory system is different. The examples above are templates - you'll need to adjust them to match YOUR specific API!
