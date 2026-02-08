// Bot detection algorithm

function detectBot(checkout) {
  let totalScore = 0;
  const reasons = [];
  
  // Extract data
  const email = checkout.customer?.email || checkout.email || '';
  const firstName = checkout.customer?.first_name || '';
  const lastName = checkout.customer?.last_name || '';
  const address1 = checkout.shipping_address?.address1 || '';
  const address2 = checkout.shipping_address?.address2 || '';
  const city = checkout.shipping_address?.city || '';
  
  // DETECTION METHOD 1: Address patterns
  const addressScore = detectBotByAddress(address1, address2, city);
  totalScore += addressScore;
  if (addressScore > 0) {
    reasons.push(`Suspicious address pattern (score: ${addressScore})`);
  }
  
  // DETECTION METHOD 2: Email patterns
  const emailScore = detectBotByEmail(email);
  totalScore += emailScore;
  if (emailScore > 0) {
    reasons.push(`Suspicious email pattern (score: ${emailScore})`);
  }
  
  // DETECTION METHOD 3: Name patterns
  const nameScore = detectBotByName(firstName, lastName);
  totalScore += nameScore;
  if (nameScore > 0) {
    reasons.push(`Suspicious name pattern (score: ${nameScore})`);
  }
  
  // Determine if it's a bot
  const isBot = totalScore >= 100;
  const confidence = totalScore >= 150 ? 'very_high' : 
                     totalScore >= 100 ? 'high' : 
                     totalScore >= 70 ? 'medium' : 'low';
  
  return {
    isBot,
    score: totalScore,
    confidence,
    reasons
  };
}

function detectBotByAddress(address1, address2, city) {
  let score = 0;
  const fullAddress = `${address1} ${address2} ${city}`.toLowerCase();
  
  // Pattern 1: "street 10 apt 2"
  if (/street\s*10\s*apt\s*2/.test(fullAddress)) {
    score += 50;
  }
  
  // Pattern 2: "House Number 43" or "Gray Colony"
  if (/house\s*number\s*43/.test(fullAddress) || /gray\s*colony/.test(fullAddress)) {
    score += 45;
  }
  
  // Pattern 3: Bellevue 98006
  if (/bellevue.*98006/.test(fullAddress)) {
    score += 30;
  }
  
  // Pattern 4: Generic "street X apt Y" pattern
  if (/street\s*\d+\s*apt\s*\d+/.test(fullAddress)) {
    score += 35;
  }
  
  return score;
}

function detectBotByEmail(email) {
  let score = 0;
  
  // Pattern 1: Name followed by 2-4 digits
  if (/^[a-z]+\d{2,4}@/i.test(email)) {
    score += 35;
  }
  
  // Pattern 2: Random character strings (10+ chars)
  if (/^[a-z0-9]{10,}@/i.test(email) && !/\d{2,4}@/.test(email)) {
    score += 45;
  }
  
  // Pattern 3: Disposable email domains
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', 'mailinator.com',
    '10minutemail.com', 'throwaway.email', 'yopmail.com'
  ];
  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    score += 30;
  }
  
  return score;
}

function detectBotByName(firstName, lastName) {
  let score = 0;
  
  const fName = firstName.toLowerCase();
  const lName = lastName.toLowerCase();
  
  // Pattern 1: "John Doe"
  if (fName === 'john' && lName === 'doe') {
    score += 50;
  }
  
  // Pattern 2: Both names are numbers
  if (/^\d+$/.test(firstName) && /^\d+$/.test(lastName)) {
    if (firstName === lastName) {
      score += 50; // Identical numbers
    } else {
      score += 35; // Different numbers
    }
  }
  
  // Pattern 3: Random character strings
  if (/^[a-z]{8,}$/i.test(firstName) && /^[a-z]{8,}$/i.test(lastName)) {
    const hasVowels = /[aeiou]/i.test(firstName);
    if (!hasVowels || firstName.length > 12) {
      score += 35;
    }
  }
  
  return score;
}

module.exports = { detectBot };
```

Click **"Commit new file"**

**✋ STOP - File #3 created?**
- ✅ YES → Continue to 2.7
- ❌ NO → Tell me what's wrong

---

### **2.7 - Create Fourth File: .env**

1. Click **"Add file"** → **"Create new file"**
2. Name it: `.env`

**⚠️ IMPORTANT: This file starts with a DOT (.)** 

Type exactly: `.env`

3. **NOW - Open your `shopify-keys.txt` file from your Desktop**
4. **Copy EVERYTHING from that file**
5. **Paste it here**

It should look like:
```
SHOPIFY_API_KEY=your_actual_key_here
SHOPIFY_API_SECRET=your_actual_secret_here
STORE_URL=eleven45ventures.myshopify.com
