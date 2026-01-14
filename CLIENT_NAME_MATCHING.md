# Client Name Matching - Quick Reference

## ✅ What's Been Configured

Your order portal now uses **dual matching** to ensure accuracy:

### Field Mappings
```javascript
Portal Field          →  Inventory Field
-----------------        ---------------------------
po_number             →  clientPurchaseOrderNumber
client_name           →  clientName
```

### Matching Logic
```javascript
// An order matches if BOTH conditions are true:
1. clientPurchaseOrderNumber === po_number (exact match)
2. clientName === client_name (exact or contains)
```

## 🎯 Why This Matters

**Without client name matching:**
```
Company A: PO-12345 → Might match Company B's PO-12345 ❌
```

**With client name matching:**
```
Company A: PO-12345 + "Acme Corp" → Only matches Acme's PO-12345 ✓
Company B: PO-12345 + "Best Co"   → Only matches Best's PO-12345 ✓
```

## 📝 Setting Up Client Users

When creating user accounts (Admin Panel → New User):

### Example 1: Perfect Match
```
Portal User:
  Username: acme_user
  Company Name: "Acme Corporation"
  
Inventory (what you enter in Android app):
  clientName: "Acme Corporation"
  clientPurchaseOrderNumber: "PO-12345"
  
Result: ✅ Match! Status updates automatically
```

### Example 2: Mismatch (Won't Work)
```
Portal User:
  Company Name: "Acme Corp"
  
Inventory:
  clientName: "Acme Corporation"
  
Result: ❌ No match - names don't match exactly
```

### Example 3: Partial Match (Works!)
```
Portal User:
  Company Name: "Acme"
  
Inventory:
  clientName: "Acme Corporation"
  
Result: ✅ Match! - "Acme" is contained in "Acme Corporation"
```

## 🔍 How to Verify Matching

### Check Heroku Logs
```bash
heroku logs --tail -a your-order-portal-name
```

Look for these messages:
```
🔍 Checking: PO "PO-12345" for client "Acme Corp"
✅ Found shipment match: PO "PO-12345" for client "Acme Corp"
```

If you see:
```
ℹ️  Order PO-12345 not found in inventory yet
```

This means either:
1. The PO number doesn't exist in inventory yet, OR
2. The PO exists but the client name doesn't match

## 🛠️ Troubleshooting Client Name Mismatches

### Option 1: Update Portal User
1. Go to Admin Panel → Users
2. Find the user
3. Edit their "Company Name" to match inventory exactly
4. Wait for next status check (within 5 minutes)

### Option 2: Update Inventory
1. In your Android app, edit the shipment
2. Change `clientName` to match the portal user's company name
3. Save changes
4. Wait for next status check

### Option 3: Per-Order Override
Users can manually enter a different client name when submitting each order if needed. The "Client Name" field in the order form overrides their profile company name.

## 📊 Email Notifications

When orders update, clients receive emails showing:
```
Order Details:
- PO Number: PO-12345
- Client Name: Acme Corporation
- New Status: SHIPPED

Additional Details:
- Client Name (from inventory): Acme Corporation  ← Confirms match
- PO Number (from inventory): PO-12345             ← Confirms match
```

This helps verify the correct order was matched.

## ⚙️ Advanced: Client Name Matching Code

The matching happens in `orderService.js`:

```javascript
const shipment = shipmentsResponse.data.find(s => {
  // Must match PO exactly
  const poMatches = s.clientPurchaseOrderNumber === poNumber;
  
  // Client name can be exact match or partial match
  const clientMatches = !clientName || 
                        s.clientName === clientName || 
                        (s.clientName && s.clientName.toLowerCase()
                         .includes(clientName.toLowerCase()));
  
  // BOTH must be true
  return poMatches && clientMatches;
});
```

## 🎉 Benefits

✅ **No Confusion**: Each client only sees their orders
✅ **Automatic Separation**: Multiple clients can use similar PO numbers safely  
✅ **Better Security**: Clients can't accidentally see other clients' orders
✅ **Accurate Updates**: Right client gets the right status update
✅ **Audit Trail**: Logs show exactly which client/PO combo was matched

---

**Remember**: The client name in the portal must match (or be contained in) the clientName in your inventory system for automatic status updates to work!
