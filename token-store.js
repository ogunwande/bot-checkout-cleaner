const fs = require('fs').promises;
const path = require('path');

const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// Initialize tokens file if it doesn't exist
async function initTokensFile() {
  try {
    await fs.access(TOKENS_FILE);
  } catch {
    await fs.writeFile(TOKENS_FILE, JSON.stringify({}));
  }
}

// Save access token for a shop
async function saveToken(shop, accessToken) {
  await initTokensFile();
  const tokens = await getTokens();
  tokens[shop] = {
    accessToken,
    installedAt: new Date().toISOString()
  };
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  console.log('Saved token for:', shop);
}

// Get access token for a shop
async function getToken(shop) {
  await initTokensFile();
  const tokens = await getTokens();
  return tokens[shop]?.accessToken || null;
}

// Get all tokens
async function getTokens() {
  await initTokensFile();
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

module.exports = {
  saveToken,
  getToken,
  getTokens
};
