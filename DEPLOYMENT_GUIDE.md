# Complete Heroku Deployment Guide

## 📋 Prerequisites

Before you start, make sure you have:
- [ ] Heroku account (sign up at https://signup.heroku.com)
- [ ] Heroku CLI installed (https://devcenter.heroku.com/articles/heroku-cli)
- [ ] Git installed
- [ ] Gmail account with app password ready
- [ ] The order-portal folder downloaded to your computer

## 🚀 Step-by-Step Deployment

### Step 1: Install Heroku CLI (if not already installed)

**Windows:**
Download and install from: https://devcenter.heroku.com/articles/heroku-cli

**Mac:**
```bash
brew tap heroku/brew && brew install heroku
```

**Linux:**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

Verify installation:
```bash
heroku --version
# Should show: heroku/x.x.x
```

### Step 2: Login to Heroku

```bash
heroku login
```

This will open a browser window. Click "Log in" to authenticate.

### Step 3: Prepare Your Project

Navigate to your order-portal folder:
```bash
cd /path/to/order-portal
# Example: cd ~/Downloads/order-portal
```

Initialize Git repository (if not already done):
```bash
git init
git add .
git commit -m "Initial commit - Order Portal"
```

### Step 4: Create Heroku App

```bash
# Replace 'your-portal-name' with something unique
heroku create your-portal-name

# Example: heroku create carolina-order-portal
```

**Note:** If the name is taken, Heroku will suggest alternatives. Pick one and remember it!

You'll see output like:
```
Creating ⬢ your-portal-name... done
https://your-portal-name.herokuapp.com/ | https://git.heroku.com/your-portal-name.git
```

### Step 5: Add PostgreSQL Database

```bash
heroku addons:create heroku-postgresql:essential-0

# For free tier (limited):
# heroku addons:create heroku-postgresql:mini
```

Wait for it to provision (about 30 seconds). You'll see:
```
Creating heroku-postgresql:essential-0 on ⬢ your-portal-name... done
```

### Step 6: Set Up Gmail App Password

**IMPORTANT:** You need a Gmail app password, not your regular password!

1. Go to https://myaccount.google.com/security
2. Turn on **2-Step Verification** (if not already on)
3. Go back to Security settings
4. Click **App passwords** (under 2-Step Verification)
5. Select:
   - App: Mail
   - Device: Other (custom name) → type "Order Portal"
6. Click **Generate**
7. Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)
8. **IMPORTANT:** Remove the spaces when you use it: `abcdefghijklmnop`

### Step 7: Configure Environment Variables

Run these commands ONE BY ONE:

```bash
# Basic Configuration
heroku config:set NODE_ENV=production

# JWT Secret (generates a random secure key)
heroku config:set JWT_SECRET=$(openssl rand -hex 32)

# Your Carolina Rolling Inventory API
heroku config:set INVENTORY_API_URL=https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api

# Email Configuration (REPLACE WITH YOUR DETAILS!)
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=abcdefghijklmnop
heroku config:set EMAIL_FROM=your-email@gmail.com
```

**Replace these values:**
- `your-email@gmail.com` → Your actual Gmail address
- `abcdefghijklmnop` → Your Gmail app password (no spaces!)

### Step 8: Verify Environment Variables

```bash
heroku config
```

You should see something like:
```
=== your-portal-name Config Vars
DATABASE_URL:      postgres://...
EMAIL_FROM:        your-email@gmail.com
EMAIL_HOST:        smtp.gmail.com
EMAIL_PASS:        abcdefghijklmnop
EMAIL_PORT:        587
EMAIL_USER:        your-email@gmail.com
INVENTORY_API_URL: https://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com/api
JWT_SECRET:        a1b2c3d4e5f6...
NODE_ENV:          production
```

### Step 9: Deploy to Heroku

```bash
git push heroku main

# If your branch is named 'master' instead:
# git push heroku master
```

This will take 2-5 minutes. You'll see:
```
Enumerating objects...
Counting objects...
Compressing objects...
Writing objects...
remote: Compressing source files... done.
remote: Building source:
remote: -----> Building on the Heroku-22 stack
remote: -----> Using buildpack: heroku/nodejs
remote: -----> Node.js app detected
remote: -----> Installing dependencies
remote: -----> Building dependencies
remote: -----> Build succeeded!
remote: -----> Discovering process types
remote: -----> Launching...
remote: -----> Build succeeded!
remote: Verifying deploy... done.
```

### Step 10: Set Up Database

Run the migration to create database tables:
```bash
heroku run npm run migrate
```

You should see:
```
Running npm run migrate on ⬢ your-portal-name... up, run.1234
✅ Database tables created successfully!
Migration completed
```

### Step 11: Open Your App

```bash
heroku open
```

This opens your portal in a browser. You should see the login page!

### Step 12: First Login

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**⚠️ CRITICAL:** Immediately after logging in:
1. Go to Admin Panel
2. Create a new admin user with a strong password
3. Log out
4. Log in with the new admin user
5. Deactivate or change the default admin password

### Step 13: Create Your First Client User

1. Click **Admin** in the top menu
2. Click **+ New User**
3. Fill in:
   - Username: (e.g., `acme_user`)
   - Password: (strong password to give to client)
   - Email: (client's email address)
   - Company Name: **MUST MATCH** what's in your inventory! (e.g., `Acme Corporation`)
   - Role: Client
4. Click **Create User**

### Step 14: Add Email Recipients for Alerts

1. Click **Settings** in the top menu
2. In the "Email Alert Recipients" section
3. Add your email address (you'll receive delay alerts)
4. Add any other admin emails
5. Click **Add Recipient**

### Step 15: Test the System

**Create a Test Order:**
1. Log out and log in as the client user you created
2. Click **+ New Order**
3. Enter:
   - PO Number: Use a real PO from your inventory (e.g., a clientPurchaseOrderNumber that exists)
   - Date Required: Pick a future date
   - Client Name: Should auto-fill with the company name
4. Click **Submit Order**

**Trigger Status Check:**
1. Log out, log back in as admin
2. Click **Admin** → **Check Statuses Now**
3. Wait 10 seconds

**Check if it worked:**
```bash
heroku logs --tail
```

Look for:
```
🔍 Checking: PO "YOUR-PO" for client "YOUR-CLIENT"
✅ Found shipment match: PO "YOUR-PO" for client "YOUR-CLIENT"
```

If you see this, **SUCCESS!** The integration is working!

## 🔍 Monitoring & Maintenance

### View Real-Time Logs
```bash
heroku logs --tail
```

Press `Ctrl+C` to stop watching logs.

### View Specific Logs
```bash
# Just the latest logs
heroku logs

# Filter for status checks
heroku logs --tail | grep "Checking"

# Filter for errors
heroku logs --tail | grep "Error"
```

### Restart the App
```bash
heroku restart
```

Useful if:
- You changed environment variables
- Something seems stuck
- You want to trigger an immediate status check

### Check App Status
```bash
heroku ps
```

Should show:
```
=== web (Eco): node backend/server.js (1)
web.1: up 2024/01/14 12:34:56 (~ 10m ago)
```

### Update Environment Variables
```bash
# Example: Update email
heroku config:set EMAIL_USER=newemail@gmail.com

# View all variables
heroku config

# Remove a variable
heroku config:unset SOME_VAR
```

## 🐛 Troubleshooting

### Issue: "Application Error" when opening app

**Check logs:**
```bash
heroku logs --tail
```

**Common causes:**
1. Database not migrated → Run: `heroku run npm run migrate`
2. Missing environment variables → Run: `heroku config` and verify all are set
3. Build failed → Check build logs for errors

### Issue: Login page loads but can't log in

**Check database:**
```bash
heroku pg:psql

# In the database prompt:
SELECT * FROM users;
\q
```

If empty, run migration again:
```bash
heroku run npm run migrate
```

### Issue: Email notifications not sending

**Test email config:**
```bash
heroku config:get EMAIL_USER
heroku config:get EMAIL_PASS
```

**Common problems:**
- Not using Gmail app password (regular password won't work)
- App password has spaces (remove them!)
- 2-Step Verification not enabled on Gmail

**Test email manually:**
Log into your portal as admin, create a test order, then click "Check Statuses Now". If the order status changes, an email should send.

### Issue: "Order not found in inventory yet"

**Causes:**
1. PO number doesn't exist in your Carolina inventory
2. Client name doesn't match exactly

**Check logs:**
```bash
heroku logs --tail | grep "Checking"
```

Look at what's being searched:
```
🔍 Checking: PO "PO-123" for client "Acme Corp"
```

Then verify in your inventory that both match exactly.

### Issue: Status never updates

**Check status values:**
```bash
heroku pg:psql -a carolina-rolling-inventory-api

# In the database:
SELECT DISTINCT status FROM shipments;
\q
```

If your status values don't match the mappings in orderService.js, you need to update them.

### Issue: Can't access Heroku app

**Check if app is running:**
```bash
heroku ps

# If it shows "No dynos on ⬢ your-portal-name"
heroku ps:scale web=1
```

### Issue: Need to redeploy after making changes

```bash
git add .
git commit -m "Description of changes"
git push heroku main
```

## 📊 Useful Commands

```bash
# Open app in browser
heroku open

# Open admin dashboard
heroku addons:open postgresql

# See app info
heroku info

# View releases
heroku releases

# Rollback to previous version
heroku rollback

# Scale dynos (if needed)
heroku ps:scale web=1

# Run bash commands
heroku run bash
```

## 🎯 Post-Deployment Checklist

- [ ] App deployed successfully
- [ ] Database migrated
- [ ] Can log in with admin/admin123
- [ ] Created new admin user
- [ ] Changed/deactivated default admin
- [ ] Created test client user
- [ ] Added email recipients
- [ ] Created test order with real PO
- [ ] Triggered status check
- [ ] Verified logs show matching
- [ ] Status updated correctly
- [ ] Email notification received (if status changed)
- [ ] Shared credentials with actual clients

## 🔐 Security Checklist

- [ ] Changed default admin password
- [ ] Using Gmail app password (not regular password)
- [ ] JWT_SECRET is random and secure
- [ ] HTTPS is enabled (automatic on Heroku)
- [ ] Shared client passwords securely (not via email)
- [ ] Set up monitoring/alerts

## 💰 Cost Estimate

**Free Tier:**
- Web dyno: Free (with limitations)
- Database: Free mini tier (10k rows)
- Total: $0/month

**Production (Recommended):**
- Eco dyno: $5/month
- Essential-0 database: $5/month
- Total: ~$10/month

## 🎉 Success!

If you've completed all steps, your order portal is now live at:
```
https://your-portal-name.herokuapp.com
```

Clients can:
- Log in with their credentials
- Submit orders with PO numbers
- Track status automatically
- Receive email notifications

You can:
- Manage users
- Configure email recipients
- Monitor all orders
- Trigger manual checks

The portal automatically checks your Carolina Rolling Inventory API every 5 minutes and sends alerts twice daily!

## 📞 Need Help?

**View logs first:**
```bash
heroku logs --tail
```

**Check specific guides:**
- CAROLINA_SETUP_GUIDE.md - Integration details
- CLIENT_NAME_MATCHING.md - How matching works
- README.md - Full documentation

**Heroku Support:**
https://help.heroku.com/

---

**Remember:** Your inventory API URL is already configured correctly. No changes needed to your Android app or inventory system!
