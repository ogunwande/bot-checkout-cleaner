const fetch = require('node-fetch');

// Fetch abandoned checkouts from Shopify
async function fetchAbandonedCheckouts(shop, accessToken) {
  // Use the correct API version and endpoint
  const url = `https://${shop}/admin/api/2025-01/checkouts.json`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API Response:', errorText);
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Fetched', data.checkouts?.length || 0, 'checkouts from Shopify');
    return data.checkouts || [];
  } catch (error) {
    console.error('Error fetching checkouts:', error.message);
    throw error;
  }
}

// Delete a checkout from Shopify
async function deleteCheckout(shop, accessToken, checkoutId) {
  const url = `https://${shop}/admin/api/2025-01/checkouts/${checkoutId}.json`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete error:', errorText);
      throw new Error(`Failed to delete checkout: ${response.status}`);
    }

    console.log('Deleted checkout:', checkoutId);
    return true;
  } catch (error) {
    console.error('Error deleting checkout:', error.message);
    return false;
  }
}

module.exports = {
  fetchAbandonedCheckouts,
  deleteCheckout
};
