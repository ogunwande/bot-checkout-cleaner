require('dotenv').config();
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SHOPIFY_API_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false
}));

let stats = {
  totalScanned: 0,
  botsDetected: 0,
  botsDeleted: 0,
  lastScan: null
};

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.post('/api/scan', async (req, res) => {
  try {
    console.log('=== Starting bot scan ===');
    
    const { detectBot } = require('./bot-detector');
    const checkouts = await fetchAbandonedCheckouts();
    
    stats.totalScanned = checkouts.length;
    let botsFound = 0;
    let botsDeleted = 0;
    
    for (const checkout of checkouts) {
  try {
    console.log('Checkout email:', checkout.customer?.email);
    
    const detection = await detectBot(checkout);
    
    console.log('Score:', detection.score);
    console.log('Is bot:', detection.isBot);
    console.log('Reasons:', detection.reasons.join(', '));
    console.log('---');
    
    if (detection.isBot && detection.score >= 70) {
      botsFound++;
      botsDeleted++;
      console.log('DELETED BOT:', checkout.customer?.email, 'Score:', detection.score);
    }
  } catch (error) {
    console.log('ERROR analyzing checkout:', checkout.customer?.email);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.log('---');
  }
}
```
      
      if (detection.isBot && detection.score >= 70) {
        botsFound++;
        botsDeleted++;
        console.log('DELETED BOT:', checkout.customer?.email, 'Score:', detection.score);
      }
    }
    
    stats.botsDetected = botsFound;
    stats.botsDeleted = botsDeleted;
    stats.lastScan = new Date().toISOString();
    
    console.log('=== Scan complete ===');
    console.log('Total scanned:', stats.totalScanned);
    console.log('Bots found:', stats.botsDetected);
    console.log('Bots deleted:', stats.botsDeleted);
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('Scan error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

async function fetchAbandonedCheckouts() {
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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
    }
  ];
}

app.listen(PORT, () => {
  console.log('Bot Checkout Cleaner running on port', PORT);
});
