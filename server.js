require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SHOPIFY_API_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Store stats in memory (in production, use a database)
let stats = {
  totalScanned: 0,
  botsDetected: 0,
  botsDeleted: 0,
  lastScan: null
};

// Home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API endpoint to get stats
app.get('/api/stats', (req, res) => {
  res.json(stats);
});

// API endpoint to trigger scan
app.post('/api/scan', async (req, res) => {
  try {
    console.log('Starting bot scan...');
    
    // Import bot detector
    const { detectBot } = require('./bot-detector');
    
    // Fetch abandoned checkouts from Shopify
    const checkouts = await fetchAbandonedCheckouts();
    
    stats.totalScanned = checkouts.length;
    let botsFound = 0;
    let botsDeleted = 0;
    
    // Scan each checkout
   for (const checkout of checkouts) {
  const detection = await detectBot(checkout);
  
  // LOG EVERY CHECKOUT (not just bots)
  console.log(`Checkout: ${checkout.customer?.email} - Score: ${detection.score} - IsBot: ${detection.isBot}`);
  console.log(`Reasons: ${detection.reasons.join(', ')}`);
  
  if (detection.isBot && detection.score >= 100) {
    botsFound++;
    
    // In production, actually delete the checkout here
    // await deleteCheckout(checkout.id);
    botsDeleted++;
    
    console.log(`✅ Bot DELETED: ${checkout.customer?.email} (score: ${detection.score})`);
  } else if (detection.score >= 70) {
    console.log(`⚠️ Suspicious but below threshold: ${checkout.customer?.email} (score: ${detection.score})`);
  }
}
```

---

### **Step 4: Save**

1. Commit message: `Add detailed logging for all checkouts`
2. Click **"Commit changes"**

---

### **Step 5: Wait for Redeploy & Test**

1. Wait 2-3 minutes for Railway to redeploy
2. Go to your dashboard
3. Click **"Scan for Bots Now"**
4. Go to Railway **Logs** tab
5. **Look for the new detailed output**

---

### **Step 6: Copy the Logs Here**

**After the scan, copy and paste the logs that show:**
```
Checkout: [email] - Score: [number] - IsBot: [true/false]
Reasons: [list of reasons]
    }
    
    stats.botsDetected = botsFound;
    stats.botsDeleted = botsDeleted;
    stats.lastScan = new Date().toISOString();
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch abandoned checkouts from Shopify
async function fetchAbandonedCheckouts() {
  const shopUrl = process.env.STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  
  // For now, return mock data for testing
  // In production, this would call Shopify API
  return [
    {
      id: 1,
      email: 'john.doe@example.com',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com'
      },
      shipping_address: {
        address1: 'street 10 apt 2',
        city: 'Bellevue',
        province: 'WA',
        zip: '98006'
      },
      created_at: new Date().toISOString(),
      cart_token: 'mock-token-1'
    },
    {
      id: 2,
      email: 'allen690@gmail.com',
      customer: {
        first_name: 'Allen',
        last_name: '690',
        email: 'allen690@gmail.com'
      },
      shipping_address: {
        address1: 'House Number 43',
        address2: 'Gray Colony',
        city: 'Bellevue',
        province: 'WA',
        zip: '98006'
      },
      created_at: new Date().toISOString(),
      cart_token: 'mock-token-2'
    }
  ];
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot Checkout Cleaner running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});
