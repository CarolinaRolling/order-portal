# Setup Guide for Carolina Rolling Inventory Integration

## ⚠️ IMPORTANT: Client Names Must Match!

When users create accounts in the portal, make sure their **company name exactly matches** the `clientName` they use in your inventory system. This ensures accurate order matching.

**Example:**
- Portal user account: Company Name = "Acme Corporation"
- Inventory system: clientName = "Acme Corporation" ✓
- Orders will match correctly!

If they don't match, you can either:
1. Update the company name in the portal (Admin Panel → Users → Edit)
2. Update the clientName in your inventory system
3. Users can also enter a different client name when submitting each order

## ✅ Your API Details

- **App Name**: carolina-rolling-inventory-api
- **URL**: https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com
- **Backend**: Node.js/Express with PostgreSQL
- **Authentication**: None required (direct access)
- **PO Number Field**: `clientPurchaseOrderNumber`
- **Client Name Field**: `clientName`

## 🎯 Smart Matching Feature

The portal now uses **BOTH** PO number AND client name to match orders. This prevents confusion if two different clients happen to have similar purchase order numbers.

**Matching Logic:**
- ✅ PO Number must match exactly (`clientPurchaseOrderNumber`)
- ✅ Client Name must match (`clientName`)
- ✅ Both conditions must be true for a valid match

**Example:**
```
Client A submits: PO "12345" for client "Acme Corp"
Client B submits: PO "12345" for client "Best Co"

Portal will correctly match each order to the right client's inventory!
```

## 🔧 Setup Steps

### 1. Deploy the Portal

The orderService.js file is already configured with your exact field names:
- ✅ `clientPurchaseOrderNumber` - for PO numbers
- ✅ `clientName` - for client matching

No code changes needed! The integration is ready to go.

### 2. Configure Environment Variables

When deploying to Heroku, set:

```bash
# Your inventory API
heroku config:set INVENTORY_API_URL=https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api

# Note: No INVENTORY_API_KEY needed since your API doesn't use authentication

# Other required variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=your-gmail-app-password
heroku config:set EMAIL_FROM=your-email@gmail.com
```

### 2. Update Status Mappings

Check what status values YOU use in your database:
```bash
heroku pg:psql -a carolina-rolling-inventory-api
SELECT DISTINCT status FROM shipments;
SELECT DISTINCT status FROM inbound;
```

Then update the status mapping in `orderService.js` (lines 35-45) to match:
```javascript
// Example: If you use 'completed' instead of 'delivered'
if (shipment.status === 'completed') {
  status = 'received';
}
```

Your portal uses these 4 statuses:
- `'pending'` - Order exists but not processing yet
- `'processing'` - Order is being prepared
- `'shipped'` - Order has been shipped
- `'received'` - Order has been delivered

### 3. Test the Integration

Before going live, test locally:

```bash
# Terminal 1: Start your inventory API (if testing locally)
cd carolina-rolling-inventory-api
npm start

# Terminal 2: Start order portal backend
cd order-portal/backend
npm run dev

# Terminal 3: Check if it connects
curl http://localhost:5000/health
```

Create a test order in the portal with a PO number that exists in your inventory API, then watch the logs.

## 📋 How Clients Will Use It

### Creating Orders with Accurate Matching

When clients submit orders, they provide:

1. **PO Number**: The purchase order number (must match `clientPurchaseOrderNumber` in your inventory)
2. **Client Name**: Their company name (must match `clientName` in your inventory)
3. **Date Required**: When they need the order

**Best Practice:** Set up each client's user account with their company name matching your inventory system. When they submit orders, the portal will auto-fill their company name, ensuring accurate matching.

### Example Setup:

**Step 1 - Admin creates client user:**
- Username: acme_user
- Company Name: "Acme Corporation" ← This should match your inventory!
- Email: contact@acmecorp.com

**Step 2 - Client submits order:**
- PO Number: PO-12345
- Client Name: Auto-fills as "Acme Corporation" from their profile
- Date Required: Jan 30, 2026

**Step 3 - Portal finds match:**
- Searches inventory for:
  - `clientPurchaseOrderNumber = "PO-12345"` AND
  - `clientName = "Acme Corporation"`
- Updates status automatically when you update it in Android app

## 🔍 Debugging Tips

### Check if API is accessible:
```bash
curl https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api/shipments
curl https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api/inbound
```

### View portal logs:
```bash
heroku logs --tail -a your-order-portal-name | grep "Checking"
```

You'll see output like:
```
Checking 5 orders against Carolina Rolling Inventory API...
🔍 Checking: PO "PO-123" for client "Acme Corp"
✅ Found shipment match: PO "PO-123" for client "Acme Corp"
✅ Order PO-123 status changed: pending → shipped
🔍 Checking: PO "PO-456" for client "Best Co"
ℹ️  Order PO-456 not found in inventory yet
```

### Common Issues:

**Issue**: "Order not found in inventory yet" even though PO exists
- **Cause 1**: PO number doesn't match exactly
- **Cause 2**: Client name doesn't match between portal and inventory
- **Fix**: Check the logs for what's being searched: `🔍 Checking: PO "..." for client "..."`
  - Compare the client name in the log with what's in your inventory
  - Update either the portal user's company name OR the inventory clientName to match
  - Client names are case-sensitive and must match exactly

**Issue**: Wrong client getting status updates for similar PO numbers
- **Cause**: This shouldn't happen with the new client name matching!
- **Fix**: Verify logs show: `✅ Found shipment match: PO "..." for client "..."`
  - Both PO and client name should match correctly

**Issue**: "Status never updates"
- **Cause**: Status value doesn't match your mapping
- **Fix**: Check what status values your DB uses and update mapping (lines 39-49)

**Issue**: "Could not check order - API error"
- **Cause**: API connection problem
- **Fix**: Check that your inventory API is running: `heroku ps -a carolina-rolling-inventory-api`

## 🎯 Workflow Example

Here's how it works in practice with client name matching:

```
1. Client "Acme Corp" submits order in portal: 
   PO: "PO-123", Client Name: "Acme Corp", due Jan 30
   ↓
2. Portal creates order with status: "pending"
   ↓
3. Every 5 minutes, portal calls:
   GET https://carolina-rolling-inventory-api.../api/shipments
   Searches for: clientPurchaseOrderNumber = "PO-123" 
                 AND clientName = "Acme Corp"
   ↓
4. You scan shipment in Android app for Acme Corp
   Update status to "shipped"
   ↓
5. Next check (within 5 min): 
   Portal finds match: PO "PO-123" + Client "Acme Corp" ✓
   Portal updates order status → "shipped"
   Portal sends email to client: "Your order has shipped!"
   ↓
6. You mark as delivered in Android app
   ↓
7. Next check: Portal updates to "received"
   Client gets email: "Your order has been received!"

📝 Note: If another client "Best Co" also has PO "PO-123", 
         it won't match Acme Corp's order because the 
         client names are different!
```

## 🚀 Deployment Checklist

- [ ] ✅ Field names already configured (clientPurchaseOrderNumber & clientName)
- [ ] Check your status values in database
- [ ] Update status mappings in orderService.js if needed (lines 39-49 and 84-94)
- [ ] Set INVENTORY_API_URL environment variable
- [ ] Set email environment variables
- [ ] Deploy to Heroku
- [ ] Run database migration
- [ ] Create test order with real PO number AND client name from your inventory
- [ ] Click "Check Statuses Now" in admin panel
- [ ] Verify order status updates
- [ ] Check Heroku logs for confirmation: "Found shipment match: PO..."
- [ ] Test with multiple clients to ensure proper matching

## 📞 Need Help?

If you run into issues:

1. **Check your inventory API is running**:
   ```bash
   heroku ps -a carolina-rolling-inventory-api
   ```

2. **View both app logs side by side**:
   ```bash
   # Terminal 1
   heroku logs --tail -a carolina-rolling-inventory-api
   
   # Terminal 2
   heroku logs --tail -a your-order-portal-name
   ```

3. **Test the API manually**:
   ```bash
   curl https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api/shipments | json_pp
   ```

The matching system ensures each client only sees their own orders, even if PO numbers overlap!
