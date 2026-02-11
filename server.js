require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { saveToken, getToken } = require('./token-store');
const { fetchAbandonedCheckouts, deleteCheckout } = require('./shopify-api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SHOPIFY_API_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

let stats = {
  totalScanned: 0,
  botsDetected: 0,
  botsDeleted: 0,
  lastScan: null
};

app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  
  if (!shop) {
    return res.status(400).send('Missing shop parameter. Use: /auth?shop=yourstore.myshopify.com');
  }
  
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=read_checkouts,write_checkouts&state=${state}&redirect_uri=${redirectUri}`;
  
  req.session.state = state;
  req.session.shop = shop;
  
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state, shop } = req.query;
  
  if (state !== req.session.state) {
    return res.status(403).send('Invalid state parameter');
  }
  
  try {
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code
      })
    });

    const data = await response.json();
    
    if (data.access_token) {
      // SAVE THE TOKEN
      await saveToken(shop, data.access_token);
      
      req.session.accessToken = data.access_token;
      req.session.shop = shop;
      
      console.log('Successfully authenticated and saved token for:', shop);
      res.redirect('/');
    } else {
      res.status(500).send('Failed to get access token');
    }
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.post('/api/scan', async (req, res) => {
  try {
    console.log('=== Starting bot scan ===');
    
    let checkouts;
    let shop = req.session.shop;
    let accessToken = req.session.accessToken;
    
    // Try to get stored token if not in session
    if (!accessToken && shop) {
      accessToken = await getToken(shop);
    }
    
    if (accessToken && shop) {
      console.log('Fetching REAL checkouts from:', shop);
      checkouts = await fetchAbandonedCheckouts(shop, accessToken);
      console.log('Fetched', checkouts.length, 'real abandoned checkouts');
    } else {
      console.log('No store connected - using test data');
      checkouts = await fetchTestCheckouts();
    }
    
    stats.totalScanned = checkouts.length;
    let botsFound = 0;
    let botsDeleted = 0;
    
    for (const checkout of checkouts) {
      try {
        const email = checkout.email || checkout.customer?.email;
        console.log('Analyzing checkout:', email);
        
        const detection = await detectBot(checkout);
        
        console.log('Score:', detection.score, 'Is bot:', detection.isBot);
        
        if (detection.isBot && detection.score >= 70) {
          botsFound++;
          
          // ACTUALLY DELETE THE CHECKOUT
          if (accessToken && shop && checkout.token) {
            const deleted = await deleteCheckout(shop, accessToken, checkout.token);
            if (deleted) {
              botsDeleted++;
              console.log('✅ DELETED BOT:', email, 'Score:', detection.score);
            }
          } else {
            console.log('🤖 BOT DETECTED (test mode):', email);
          }
        }
      } catch (error) {
        console.log('ERROR:', error.message);
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
    res.status(500).json({ error: error.message });
  }
});

// Bot detection function
async function detectBot(checkout) {
  let score = 0;
  const reasons = [];

  const email = checkout.email || checkout.customer?.email || '';
  const firstName = checkout.customer?.first_name || '';
  const lastName = checkout.customer?.last_name || '';
  const address = checkout.shipping_address?.address1 || '';

  if (/\d{3,}@/.test(email)) {
    score += 30;
    reasons.push('Email has 3+ numbers');
  }
  
  if (/^[a-z]+\d+@gmail\.com$/i.test(email)) {
    score += 25;
    reasons.push('Generic Gmail pattern');
  }

  if (/\d/.test(firstName) || /\d/.test(lastName)) {
    score += 20;
    reasons.push('Name has numbers');
  }

  if (/house number|apartment|apt \d+|street \d+/i.test(address)) {
    score += 15;
    reasons.push('Generic address');
  }

  return {
    isBot: score >= 40,
    score: score,
    reasons: reasons
  };
}

async function fetchTestCheckouts() {
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
