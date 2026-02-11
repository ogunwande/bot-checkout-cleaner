require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { saveToken, getToken } = require('./token-store');
const { fetchAbandonedCheckouts, deleteCustomer } = require('./shopify-api');

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

// OAuth - Install app
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  
  if (!shop) {
    return res.status(400).send('Missing shop parameter. Use: /auth?shop=yourstore.myshopify.com');
  }
  
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  
  // Updated scopes for GraphQL: read_customers, write_customers
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=read_customers,write_customers&state=${state}&redirect_uri=${redirectUri}`;
  
  req.session.state = state;
  req.session.shop = shop;
  
  res.redirect(authUrl);
});

// OAuth callback - Exchange code for access token
app.get('/auth/callback', async (req, res) => {
  const { code, state, shop } = req.query;
  
  if (state !== req.session.state) {
    return res.status(403).send('Invalid state parameter - possible CSRF attack');
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
      // Save token to storage
      await saveToken(shop, data.access_token);
      
      // Save to session
      req.session.accessToken = data.access_token;
      req.session.shop = shop;
      
      console.log('✅ Token saved for:', shop);
      console.log('🔑 ACCESS TOKEN:', data.access_token);
      
      res.redirect('/');
    } else {
      console.error('Failed to get access token:', data);
      res.status(500).send('Failed to get access token');
    }
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// Main dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Get current stats
app.get('/api/stats', (req, res) => {
  res.json(stats);
});

// Debug endpoint - check stored tokens
app.get('/api/debug-tokens', async (req, res) => {
  try {
    const { getTokens } = require('./token-store');
    const tokens = await getTokens();
    res.json({
      tokensFound: Object.keys(tokens).length,
      shops: Object.keys(tokens),
      hasEleven45: !!tokens['eleven45ventures.myshopify.com'],
      tokenPreview: tokens['eleven45ventures.myshopify.com'] ? 
        tokens['eleven45ventures.myshopify.com'].accessToken.substring(0, 20) + '...' : 
        'No token'
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Main scan endpoint - detect and delete bot customers
app.post('/api/scan', async (req, res) => {
  try {
    console.log('');
    console.log('=== 🤖 Starting Bot Scan ===');
    console.log('Timestamp:', new Date().toISOString());
    
    let checkouts;
    let shop = req.session.shop || 'eleven45ventures.myshopify.com';
    let accessToken = req.session.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
    
    // Try to get token from storage if not in session
    if (!accessToken) {
      console.log('No token in session or env, checking storage...');
      accessToken = await getToken(shop);
      if (accessToken) {
        console.log('✅ Found token in storage for:', shop);
      }
    }
    
    // Fetch real checkouts or use test data
    if (accessToken && shop) {
      console.log('📡 Fetching REAL checkouts from Shopify via GraphQL...');
      try {
        checkouts = await fetchAbandonedCheckouts(shop, accessToken);
        console.log('✅ Successfully fetched', checkouts.length, 'real abandoned checkouts');
      } catch (error) {
        console.error('❌ Failed to fetch from Shopify:', error.message);
        console.log('⚠️ Falling back to test data');
        checkouts = await fetchTestCheckouts();
      }
    } else {
      console.log('⚠️ No store connected - using test data');
      checkouts = await fetchTestCheckouts();
    }
    
    stats.totalScanned = checkouts.length;
    let botsFound = 0;
    let botsDeleted = 0;
    
    console.log('');
    console.log('--- Analyzing Checkouts ---');
    
    // Analyze each checkout for bot patterns
    for (const checkout of checkouts) {
      try {
        const email = checkout.email || checkout.customer?.email;
        const customerId = checkout.customer?.id;
        
        console.log('');
        console.log('📧 Checkout:', email);
        console.log('👤 Customer ID:', customerId || 'N/A');
        
        // Run bot detection
        const detection = await detectBot(checkout);
        
        console.log('🎯 Bot Score:', detection.score);
        console.log('🤖 Is Bot:', detection.isBot);
        if (detection.reasons.length > 0) {
          console.log('📋 Reasons:', detection.reasons.join(', '));
        }
        
        // If bot detected with high confidence (score >= 70)
        if (detection.isBot && detection.score >= 70) {
          botsFound++;
          
          // Delete the bot customer if we have access token and customer ID
          if (accessToken && shop && customerId) {
            console.log('🚨 BOT DETECTED - Attempting to delete customer...');
            const deleted = await deleteCustomer(shop, accessToken, customerId);
            
            if (deleted) {
              botsDeleted++;
              console.log('✅ DELETED BOT CUSTOMER:', email, '| Score:', detection.score);
            } else {
              console.log('❌ Failed to delete customer:', email);
            }
          } else {
            console.log('🤖 BOT DETECTED (test mode - not deleting):', email);
          }
        } else {
          console.log('✅ Clean checkout:', email);
        }
        
      } catch (error) {
        console.log('❌ ERROR analyzing checkout:', error.message);
      }
    }
    
    // Update stats
    stats.botsDetected = botsFound;
    stats.botsDeleted = botsDeleted;
    stats.lastScan = new Date().toISOString();
    
    console.log('');
    console.log('=== 📊 Scan Complete ===');
    console.log('Total scanned:', stats.totalScanned);
    console.log('Bots detected:', stats.botsDetected);
    console.log('Bot customers deleted:', stats.botsDeleted);
    console.log('Clean checkouts:', stats.totalScanned - stats.botsDetected);
    console.log('');
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('');
    console.error('❌ SCAN ERROR:', error.message);
    console.error('');
    res.status(500).json({ error: error.message });
  }
});

// Bot detection algorithm
async function detectBot(checkout) {
  let score = 0;
  const reasons = [];

  const email = checkout.email || checkout.customer?.email || '';
  const firstName = checkout.customer?.first_name || '';
  const lastName = checkout.customer?.last_name || '';
  const address = checkout.shipping_address?.address1 || '';

  // EMAIL PATTERN CHECKS
  
  // Check for 3+ consecutive numbers in email
  if (/\d{3,}@/.test(email)) {
    score += 30;
    reasons.push('Email has 3+ consecutive numbers');
  }
  
  // Check for generic Gmail pattern (letters+numbers@gmail.com)
  if (/^[a-z]+\d+@gmail\.com$/i.test(email)) {
    score += 25;
    reasons.push('Generic Gmail pattern (name+numbers)');
  }
  
  // Check for very short email username (less than 4 chars before @)
  const emailUsername = email.split('@')[0] || '';
  if (emailUsername.length > 0 && emailUsername.length < 4) {
    score += 15;
    reasons.push('Suspiciously short email username');
  }

  // NAME PATTERN CHECKS
  
  // Check if name contains numbers
  if (/\d/.test(firstName) || /\d/.test(lastName)) {
    score += 20;
    reasons.push('Name contains numbers');
  }
  
  // Check for single character names
  if (firstName.length === 1 || lastName.length === 1) {
    score += 15;
    reasons.push('Single character name');
  }

  // ADDRESS PATTERN CHECKS
  
  // Check for generic/templated addresses
  if (/house number|apartment|apt \d+|street \d+|building \d+/i.test(address)) {
    score += 15;
    reasons.push('Generic/templated address');
  }
  
  // Check for very short addresses (less than 5 characters)
  if (address.length > 0 && address.length < 5) {
    score += 10;
    reasons.push('Suspiciously short address');
  }

  return { 
    isBot: score >= 40, // Bot threshold: 40+ points
    score: score, 
    reasons: reasons 
  };
}

// Test data for when no real store is connected
async function fetchTestCheckouts() {
  return [
    {
      id: '1',
      email: 'john.doe@example.com',
      customer: {
        id: '12345',
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe'
      },
      shipping_address: {
        address1: '123 Main Street',
        city: 'Bellevue',
        province: 'WA',
        zip: '98006'
      },
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      email: 'allen690@gmail.com',
      customer: {
        id: '67890',
        email: 'allen690@gmail.com',
        first_name: 'Allen',
        last_name: '690'
      },
      shipping_address: {
        address1: 'House Number 43',
        address2: 'Gray Colony',
        city: 'Bellevue',
        province: 'WA',
        zip: '98006'
      },
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      email: 'test123@gmail.com',
      customer: {
        id: '11111',
        email: 'test123@gmail.com',
        first_name: 'Test',
        last_name: '123'
      },
      shipping_address: {
        address1: 'apt 2 street 5',
        city: 'Seattle',
        province: 'WA',
        zip: '98101'
      },
      created_at: new Date().toISOString()
    }
  ];
}

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🤖 ===================================');
  console.log('   Bot Checkout Cleaner - GraphQL');
  console.log('   Port:', PORT);
  console.log('   Status: Running');
  console.log('===================================');
  console.log('');
});
