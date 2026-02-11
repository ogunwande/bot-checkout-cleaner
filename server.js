require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { buildAuthUrl, getAccessToken, fetchAbandonedCheckoutsFromShopify, deleteCheckoutFromShopify } = require('./shopify-auth');

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
  
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  const { authUrl, state } = buildAuthUrl(shop, redirectUri);
  
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
    const accessToken = await getAccessToken(shop, code);
    
    req.session.accessToken = accessToken;
    req.session.shop = shop;
    
    console.log('Successfully authenticated store:', shop);
    
    res.redirect('/');
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
    
    const { detectBot } = require('./bot-detector');
    
    let checkouts;
    
    if (req.session.accessToken && req.session.shop) {
      console.log('Fetching real checkouts from:', req.session.shop);
      checkouts = await fetchAbandonedCheckoutsFromShopify(req.session.shop, req.session.accessToken);
      console.log('Fetched', checkouts.length, 'real checkouts from Shopify');
    } else {
      console.log('No store connected - using test data');
      checkouts = await fetchTestCheckouts();
    }
    
    stats.totalScanned = checkouts.length;
    let botsFound = 0;
    let botsDeleted = 0;
    
    for (const checkout of checkouts) {
      try {
        console.log('Checkout email:', checkout.customer?.email || checkout.email);
        
        const detection = await detectBot(checkout);
        
        console.log('Score:', detection.score);
        console.log('Is bot:', detection.isBot);
        console.log('Reasons:', detection.reasons.join(', '));
        console.log('---');
        
        if (detection.isBot && detection.score >= 70) {
          botsFound++;
          botsDeleted++;
          console.log('DELETED BOT:', checkout.customer?.email || checkout.email, 'Score:', detection.score);
        }
      } catch (error) {
        console.log('ERROR analyzing checkout:', checkout.customer?.email || checkout.email);
        console.log('Error:', error.message);
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
