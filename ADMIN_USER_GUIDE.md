# Admin User Guide

## 🔐 Admin Login

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`
- URL: `https://your-portal-name.herokuapp.com/login`

⚠️ **IMPORTANT**: Change the default admin password immediately after first login!

## 📋 Admin Features

### 1. Create New Client Users

**Navigation**: Admin Panel → "New User" button

**Steps:**
1. Click "New User" button
2. Fill in the form:
   - **Username**: Client's login username (e.g., `acme_user`)
   - **Password**: 
     - Type manually, OR
     - Click "🎲 Generate" for a random secure password
     - Click 👁️ icon to show/hide password
   - **Email**: Client's email address (for notifications)
   - **Company Name**: ⚠️ **MUST match exactly** with `clientName` in your inventory system
   - **Role**: Select "Client" (or "Admin" for additional administrators)

3. Click "Create User"
4. **Copy Login Info**: Click "📋 Copy Login Info" to copy credentials to clipboard
5. **Send to Client**: Paste into email and send to your client

**Example Email Template:**
```
Subject: Your Order Portal Login

Hello [Client Name],

Here are your login credentials for our Order Portal:

Username: acme_user
Password: Abc123!@#XYZ
Login URL: https://your-portal.herokuapp.com/login

Please keep this information secure and change your password after first login.

Best regards,
[Your Name]
```

### 2. Edit Existing Users

**Navigation**: Admin Panel → Find user → Click "✏️ Edit"

**What You Can Edit:**
- ✅ Email address
- ✅ Company name (remember: must match inventory `clientName`)
- ✅ Active/Inactive status
- ✅ Password (optional - leave blank to keep current)

**Password Reset:**
1. Click "✏️ Edit" on any user
2. In the "New Password" field:
   - Type a new password manually, OR
   - Click "🎲 Generate" for a random password
3. The new password appears below - click "📋" to copy it
4. Click "Save Changes"
5. Send the new password to the client

**Use Cases:**
- Client forgot password → Reset password and email them new one
- Client changed email → Update email address
- Client company name changed → Update to match inventory
- Temporarily disable user → Uncheck "Active User"

### 3. Activate/Deactivate Users

**Quick Toggle**: Click the 🔒/🔓 button next to any user

- 🔒 **Deactivate**: User cannot login (but data is preserved)
- 🔓 **Activate**: Re-enable login access

**When to Use:**
- Client contract ended → Deactivate
- Payment issues → Temporarily deactivate
- Bring back former client → Reactivate

### 4. Email Alert Recipients

**Navigation**: Settings → Email Alert Recipients

**Purpose**: Who receives delay alert emails (when orders are late)

**Steps:**
1. Enter email address
2. Click "Add Recipient"
3. Emails will be sent to all active recipients

**Best Practice**: Add yourself and any managers who need to know about delays.

### 5. System Settings

**Navigation**: Settings

**Configurable Settings:**
- **Alert Threshold**: Days before due date to send alerts (default: 5 days)
- **Check Frequency**: How often to check inventory (default: 5 minutes)

**System Information Display:**
- Status check frequency
- Daily alert times (9 AM and 5 PM)
- Number of active recipients
- Current alert threshold

### 6. Manual Status Check

**Navigation**: Admin Panel → "🔄 Check Statuses Now"

**Purpose**: Immediately check all orders against inventory (instead of waiting for scheduled check)

**When to Use:**
- Just updated orders in Android app
- Testing the integration
- Client asks for immediate update
- Troubleshooting

### 7. View All Orders

**Navigation**: Dashboard

**Admin View Shows:**
- All orders from all clients
- Company name for each order
- Full order details and status

**Client View Shows:**
- Only their own orders

## 🎯 Common Admin Tasks

### Task: Set Up New Client

1. **Get Info**: Ask client for company name and email
2. **Verify Name**: Make sure it matches what you use in inventory app
3. **Create User**:
   - Admin Panel → New User
   - Username: `clientname_user` (your choice)
   - Generate password
   - Email: client's email
   - Company Name: **Exact match** to inventory `clientName`
   - Role: Client
4. **Copy Credentials**: Click "📋 Copy Login Info"
5. **Email Client**: Send credentials via secure email
6. **Test**: Have client login and submit test order

### Task: Reset Client Password

1. Admin Panel → Find user → "✏️ Edit"
2. Click "🎲 Generate" in New Password field
3. Copy the generated password (click 📋)
4. Click "Save Changes"
5. Email new password to client
6. Ask client to change password after login

### Task: Fix Company Name Mismatch

**Symptom**: Client's orders never update status

**Solution**:
1. Check inventory: What `clientName` do you use for this client?
2. Admin Panel → Find user → "✏️ Edit"
3. Update "Company Name" to match inventory exactly
4. Click "Save Changes"
5. Click "🔄 Check Statuses Now" to test

### Task: Troubleshoot Order Not Updating

1. **Check Inventory**:
   - Does order exist with correct `clientPurchaseOrderNumber`?
   - Does `clientName` match user's company name?

2. **Check Portal**:
   - Admin Panel → Click "🔄 Check Statuses Now"
   - Check Heroku logs for matching messages

3. **Verify Logs**:
   ```bash
   heroku logs --tail -a your-portal-name
   ```
   Look for:
   ```
   🔍 Checking: PO "PO-123" for client "Acme Corp"
   ✅ Found shipment match: PO "PO-123" for client "Acme Corp"
   ```

## 🔒 Security Best Practices

### For Admin Account:
1. ✅ Change default password immediately
2. ✅ Use a strong, unique password
3. ✅ Don't share admin credentials
4. ✅ Create separate admin accounts for other managers

### For Client Accounts:
1. ✅ Generate random passwords (don't use simple ones)
2. ✅ Send credentials via secure email
3. ✅ Encourage clients to change password after first login
4. ✅ Disable inactive accounts

### Password Guidelines:
- Minimum 6 characters (but longer is better)
- Mix of uppercase, lowercase, numbers, symbols
- Use the "🎲 Generate" button for best security
- Never reuse passwords

## 📊 Monitoring & Reports

### Check System Health:
1. Dashboard → View order statistics
2. Admin Panel → See active users count
3. Settings → Verify email recipients configured

### View Activity:
```bash
# View recent activity
heroku logs --tail -a your-portal-name

# Filter for status checks
heroku logs --tail -a your-portal-name | grep "Checking"

# Filter for errors
heroku logs --tail -a your-portal-name | grep "error"
```

## 🆘 Common Issues & Solutions

### Issue: Can't Login as Admin
**Solution**: Use default credentials (admin/admin123) or reset via database

### Issue: Client Can't Login
**Solution**: 
1. Check if account is Active (not deactivated)
2. Reset password and send new credentials
3. Verify username is correct

### Issue: Orders Not Updating
**Solution**:
1. Verify company name matches inventory
2. Check PO number exists in inventory
3. Run manual status check
4. Check Heroku logs for errors

### Issue: Emails Not Sending
**Solution**:
1. Settings → Verify recipients added
2. Check email configuration in Heroku config vars
3. Test with manual status check

### Issue: Can't Edit User
**Solution**: Refresh page and try again, or check browser console for errors

## 💡 Tips & Best Practices

1. **Company Names**: Keep a list of each client's company name to ensure consistency
2. **Password Management**: Use a password manager to store generated passwords before sending
3. **Regular Checks**: Periodically review active users and deactivate unused accounts
4. **Alert Recipients**: Add multiple email addresses to ensure someone sees delay alerts
5. **Test Orders**: Create test orders for new clients to verify integration
6. **Documentation**: Keep a record of client usernames and company names
7. **Communication**: Send welcome emails with clear instructions for first login

## 🎓 Training New Clients

**Step 1**: Send credentials email
**Step 2**: Send quick start guide:
```
1. Go to [portal URL]
2. Login with provided credentials
3. Click "New Order"
4. Enter:
   - PO Number (from your purchase order)
   - Date Required
   - Client Name (auto-fills)
5. Submit order
6. Check status anytime on dashboard
7. Receive email updates automatically
```

**Step 3**: Follow up after first order to ensure it's working

---

## 📞 Need Help?

- **Technical Issues**: Check CAROLINA_SETUP_GUIDE.md
- **Deployment**: Check QUICKSTART.md
- **Client Matching**: Check CLIENT_NAME_MATCHING.md
- **Logs**: `heroku logs --tail -a your-portal-name`

**Remember**: You're the admin - you have full control over all users, orders, and settings!
