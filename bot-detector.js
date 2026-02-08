// Bot detection algorithm

function detectBot(checkout) {
  let totalScore = 0;
  const reasons = [];
  
  const email = checkout.customer?.email || checkout.email || '';
  const firstName = checkout.customer?.first_name || '';
  const lastName = checkout.customer?.last_name || '';
  const address1 = checkout.shipping_address?.address1 || '';
  const address2 = checkout.shipping_address?.address2 || '';
  const city = checkout.shipping_address?.city || '';
  
  const addressScore = detectBotByAddress(address1, address2, city);
  totalScore += addressScore;
  if (addressScore > 0) {
    reasons.push(`Suspicious address pattern (score: ${addressScore})`);
  }
  
  const emailScore = detectBotByEmail(email);
  totalScore += emailScore;
  if (emailScore > 0) {
    reasons.push(`Suspicious email pattern (score: ${emailScore})`);
  }
  
  const nameScore = detectBotByName(firstName, lastName);
  totalScore += nameScore;
  if (nameScore > 0) {
    reasons.push(`Suspicious name pattern (score: ${nameScore})`);
  }
  
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
  
  if (/street\s*10\s*apt\s*2/.test(fullAddress)) {
    score += 50;
  }
  
  if (/house\s*number\s*43/.test(fullAddress) || /gray\s*colony/.test(fullAddress)) {
    score += 45;
  }
  
  if (/bellevue.*98006/.test(fullAddress)) {
    score += 30;
  }
  
  if (/street\s*\d+\s*apt\s*\d+/.test(fullAddress)) {
    score += 35;
  }
  
  return score;
}

function detectBotByEmail(email) {
  let score = 0;
  
  if (/^[a-z]+\d{2,4}@/i.test(email)) {
    score += 35;
  }
  
  if (/^[a-z0-9]{10,}@/i.test(email) && !/\d{2,4}@/.test(email)) {
    score += 45;
  }
  
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
  
  if (fName === 'john' && lName === 'doe') {
    score += 50;
  }
  
  if (/^\d+$/.test(firstName) && /^\d+$/.test(lastName)) {
    if (firstName === lastName) {
      score += 50;
    } else {
      score += 35;
    }
  }
  
  if (/^[a-z]{8,}$/i.test(firstName) && /^[a-z]{8,}$/i.test(lastName)) {
    const hasVowels = /[aeiou]/i.test(firstName);
    if (!hasVowels || firstName.length > 12) {
      score += 35;
    }
  }
  
  return score;
}

module.exports = { detectBot };
