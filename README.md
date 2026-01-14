# Order Portal Application

A full-stack client portal for tracking purchase orders with automated status checks and email notifications.

## 🚀 Features

- **Client Portal**: Secure login for clients to track their orders
- **Automated Status Checks**: Checks order status every 5 minutes from your Heroku inventory app
- **Email Alerts**: Automatic notifications when orders are delayed (twice daily)
- **Admin Dashboard**: Manage users, email recipients, and system settings
- **Real-time Updates**: Orders automatically update when status changes (pending → shipped → received)
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (provided by Heroku)
- Email account (Gmail recommended) with app password
- Your existing Heroku inventory app with API access

## 🛠️ Local Development Setup

### 1. Clone and Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Backend

Create `backend/.env` file:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/order_portal

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random

# Server
PORT=5000
NODE_ENV=development

# Your Heroku Inventory App
INVENTORY_API_URL=https://your-inventory-app.herokuapp.com/api
INVENTORY_API_KEY=your-inventory-app-api-key

# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_FROM=your-email@gmail.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Important**: For Gmail, you need to use an "App Password", not your regular password:
1. Enable 2-factor authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate a new app password for "Mail"
4. Use that password in EMAIL_PASS

### 3. Set Up Database

```bash
cd backend
node database/migrate.js
```

This creates all necessary tables and a default admin user:
- Username: `admin`
- Password: `admin123`
- **⚠️ Change this password immediately after first login!**

### 4. Configure Your Inventory App Integration

Edit `backend/services/orderService.js` to match your inventory app's API:

```javascript
// Update this function based on your API response structure
async function checkInventoryStatus(poNumber, clientName) {
  const response = await axios.get(`${INVENTORY_API_URL}/orders`, {
    headers: {
      'Authorization': `Bearer ${INVENTORY_API_KEY}`,
    },
    params: {
      po_number: poNumber,
      client_name: clientName
    }
  });
  
  // Map your API's status values to: 'pending', 'processing', 'shipped', 'received'
  // Example:
  if (response.data.status === 'delivered') {
    return { found: true, status: 'received', details: response.data };
  }
  // ... add more mappings
}
```

### 5. Run the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

Visit http://localhost:3000 and log in with admin/admin123

## 🌐 Heroku Deployment

### 1. Prepare for Deployment

```bash
# Initialize git repository (if not already)
git init
git add .
git commit -m "Initial commit"
```

### 2. Create Heroku App

```bash
# Install Heroku CLI first: https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create app
heroku create your-order-portal-name

# Add PostgreSQL database
heroku addons:create heroku-postgresql:mini
```

### 3. Configure Environment Variables

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set INVENTORY_API_URL=https://your-inventory-app.herokuapp.com/api
heroku config:set INVENTORY_API_KEY=your-api-key
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=your-gmail-app-password
heroku config:set EMAIL_FROM=your-email@gmail.com
```

### 4. Deploy

```bash
# Deploy to Heroku
git push heroku main

# Run database migration
heroku run npm run migrate

# Open your app
heroku open
```

### 5. Monitor Logs

```bash
# View real-time logs
heroku logs --tail

# View scheduled job logs
heroku logs --tail | grep "scheduled"
```

## 📱 Using the Application

### For Clients

1. **Login**: Use credentials provided by admin
2. **Submit Order**: Click "New Order" and enter:
   - PO Number
   - Date Required
   - Client Name (optional)
   - Notes (optional)
3. **Track Orders**: Dashboard shows all your orders with current status
4. **Receive Notifications**: Get emails when orders ship or are delayed

### For Admins

1. **User Management** (`/admin`):
   - Create new client accounts
   - Activate/deactivate users
   - View all users

2. **Settings** (`/settings`):
   - Add/remove email alert recipients
   - Configure alert threshold (days before due date)
   - View system information

3. **Manual Status Check**: Click "Check Statuses Now" to trigger immediate check

## 🔄 How It Works

### Automated Status Checks (Every 5 Minutes)

```javascript
// Cron job in server.js
cron.schedule('*/5 * * * *', async () => {
  await checkOrderStatuses(); // Checks all non-received orders
});
```

For each order:
1. Queries your inventory app API with PO number and client name
2. Maps inventory status to portal status
3. Updates database if status changed
4. Sends email notification to client

### Delay Alerts (9 AM and 5 PM Daily)

```javascript
cron.schedule('0 9,17 * * *', async () => {
  await sendDelayAlerts(); // Checks orders approaching due date
});
```

Finds orders that are:
- Not yet received
- Due within X days (configurable in settings)
- Sends alerts to both client and admin recipients

## 🎨 Customization

### Update Branding

Edit frontend colors in `frontend/src/styles/App.css`:

```css
:root {
  --primary-color: #2563eb;  /* Change to your brand color */
  --primary-hover: #1d4ed8;
  /* ... other colors */
}
```

### Modify Status Check Frequency

Edit `backend/server.js`:

```javascript
// Change '*/5 * * * *' to your preferred schedule
// Examples:
// Every 10 minutes: '*/10 * * * *'
// Every 30 minutes: '*/30 * * * *'
// Every hour: '0 * * * *'
cron.schedule('*/5 * * * *', async () => {
  await checkOrderStatuses();
});
```

### Add Custom Order Fields

1. Add columns to database (`database/migrate.js`)
2. Update API endpoints (`backend/server.js`)
3. Add form fields (`frontend/src/pages/Dashboard.js`)
4. Update table display

## 🔒 Security Best Practices

1. **Change default admin password immediately**
2. **Use strong JWT secret**: `openssl rand -hex 32`
3. **Use environment variables** for all secrets (never commit .env)
4. **Enable HTTPS** (Heroku provides this automatically)
5. **Regularly update dependencies**: `npm audit fix`
6. **Use app passwords** for email (not regular passwords)

## 📊 Database Schema

- **users**: Client and admin accounts
- **orders**: Tracked purchase orders
- **alert_recipients**: Email addresses for admin alerts
- **email_settings**: System configuration
- **status_history**: Audit log of status changes

## 🐛 Troubleshooting

### Emails not sending?

- Verify Gmail app password is correct
- Check EMAIL_HOST and EMAIL_PORT
- Test with: `heroku run node backend/services/emailService.js`

### Status checks not working?

- Verify INVENTORY_API_URL and INVENTORY_API_KEY
- Check `orderService.js` matches your API structure
- View logs: `heroku logs --tail`

### Frontend not loading?

- Verify build completed: `heroku logs --tail | grep "build"`
- Check Procfile points to correct location
- Ensure NODE_ENV=production is set

### Database connection issues?

- Verify DATABASE_URL is set: `heroku config:get DATABASE_URL`
- Run migration: `heroku run npm run migrate`

## 📈 Scaling

This application is designed to scale efficiently:

- **Database**: Upgrade Heroku Postgres plan as needed
- **Workers**: Add separate worker dyno for background jobs
- **Performance**: Implements indexes on frequently queried fields
- **Caching**: Can add Redis for session management

## 🤝 Support

For questions about:
- **Setup**: Review this README and check environment variables
- **Customization**: See code comments in relevant files
- **Deployment**: Check Heroku logs (`heroku logs --tail`)
- **API Integration**: Modify `backend/services/orderService.js`

## 📝 License

This is a custom application built for your specific business needs.

---

**Default Admin Credentials**:
- Username: `admin`
- Password: `admin123`
- ⚠️ **CHANGE IMMEDIATELY AFTER FIRST LOGIN**
