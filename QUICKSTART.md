# 🚀 Quick Start Deployment Guide

## Step 1: Configure Your Inventory API

Before deploying, you MUST update `backend/services/orderService.js` to work with your existing Heroku inventory app.

### What to Update:

1. **API Endpoint Structure**: Change the axios call to match your inventory app's API
2. **Authentication**: Update the authorization header format
3. **Status Mapping**: Map your inventory statuses to portal statuses (pending, processing, shipped, received)

Example changes needed:

```javascript
// YOUR CURRENT API MIGHT LOOK LIKE:
// GET /api/inventory/orders?po=PO-123&client=Company

// UPDATE THE FUNCTION TO MATCH:
async function checkInventoryStatus(poNumber, clientName) {
  const response = await axios.get(`${INVENTORY_API_URL}/inventory/orders`, {
    headers: {
      'X-API-Key': INVENTORY_API_KEY,  // Your auth method
    },
    params: {
      po: poNumber,           // Your parameter name
      client: clientName       // Your parameter name
    }
  });
  
  // Map YOUR statuses:
  const statusMap = {
    'in_warehouse': 'pending',
    'out_for_delivery': 'shipped',
    'completed': 'received'
  };
  
  return {
    found: true,
    status: statusMap[response.data.current_status] || 'pending'
  };
}
```

## Step 2: Set Up Email (Gmail Recommended)

### Get Gmail App Password:
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Click "App passwords"
4. Generate password for "Mail"
5. Copy the 16-character password (e.g., "abcd efgh ijkl mnop")

## Step 3: Deploy to Heroku

### One-Time Setup:
```bash
# Install Heroku CLI (if not already installed)
# Visit: https://devcenter.heroku.com/articles/heroku-cli

# Navigate to project
cd order-portal

# Login to Heroku
heroku login

# Create new app
heroku create your-portal-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini
```

### Configure Environment:
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)

# YOUR INVENTORY APP
heroku config:set INVENTORY_API_URL=https://your-inventory-app.herokuapp.com/api
heroku config:set INVENTORY_API_KEY=your-actual-api-key

# EMAIL (use your Gmail app password)
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=abcdefghijklmnop
heroku config:set EMAIL_FROM=your-email@gmail.com
```

### Deploy:
```bash
# Initialize git (if needed)
git init
git add .
git commit -m "Initial deployment"

# Deploy
git push heroku main

# Set up database
heroku run npm run migrate

# Open app
heroku open
```

## Step 4: First Login

1. Visit your app URL
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. **IMMEDIATELY CHANGE THIS PASSWORD!** (create a new admin account and delete the default)

## Step 5: Configure System

### Add Email Recipients:
1. Go to Settings
2. Add email addresses that should receive delay alerts
3. Save

### Create Client Users:
1. Go to Admin Panel
2. Click "New User"
3. Fill in details:
   - Username (client will use this to login)
   - Password (share securely with client)
   - Email (for notifications)
   - Company Name
   - Role: "Client"

## Step 6: Test the System

### Test Status Checking:
1. Have a client submit an order with a PO number that exists in your inventory app
2. Click "Check Statuses Now" in admin panel
3. Watch the order status update
4. Check Heroku logs: `heroku logs --tail`

### Test Email Alerts:
1. Create an order with a due date 4 days from now
2. Wait until 9 AM or 5 PM for the automated check
3. Or trigger manually by restarting: `heroku restart`

## 📍 Important URLs

After deployment, your app will be at:
- **Portal**: https://your-portal-name.herokuapp.com
- **Login**: https://your-portal-name.herokuapp.com/login
- **Admin**: https://your-portal-name.herokuapp.com/admin
- **Settings**: https://your-portal-name.herokuapp.com/settings

## 🔍 Monitoring

```bash
# View logs in real-time
heroku logs --tail

# Check status check logs
heroku logs --tail | grep "scheduled"

# View database
heroku pg:psql

# Restart app (triggers immediate status check)
heroku restart
```

## ⚠️ Common Issues

### "Cannot find module"
```bash
# Make sure all dependencies installed
heroku run npm run install-backend
```

### Emails not sending
- Double-check EMAIL_PASS is the app password, not your regular Gmail password
- Verify 2-factor auth is enabled on Gmail
- Check logs: `heroku logs --tail | grep "Email"`

### Status checks not working
- Verify your inventory API URL is correct
- Check that `orderService.js` matches your API structure
- Test your API manually with curl or Postman first

### Frontend shows white screen
- Check build logs: `heroku logs --tail | grep "build"`
- Verify NODE_ENV=production: `heroku config:get NODE_ENV`

## 🎯 Next Steps

1. **Customize branding**: Edit colors in `frontend/src/styles/App.css`
2. **Adjust check frequency**: Edit cron schedule in `backend/server.js`
3. **Add more admins**: Create admin users in the admin panel
4. **Set up monitoring**: Use Heroku metrics or Papertrail addon

## 📞 Need Help?

- Check the main README.md for detailed documentation
- View Heroku logs for error messages
- Test your inventory API separately to ensure it works
- Verify all environment variables are set: `heroku config`

---

**Remember**: Your inventory API integration is custom to your setup. The `orderService.js` file must be edited to match YOUR API's structure, parameters, and response format.
