const fetch = require('node-fetch');

// Fetch abandoned checkouts from Shopify
async function fetchAbandonedCheckouts(shop, accessToken) {
  const url = `https://${shop}/admin/api/2026-01/checkouts.json`;
  
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

// Delete bot customer from Shopify (THIS IS THE KEY CHANGE!)
async function deleteCustomer(shop, accessToken, customerId) {
  const url = `https://${shop}/admin/api/2026-01/customers/${customerId}.json`;
  
  try {
    console.log('Attempting to delete customer:', customerId);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete customer error:', errorText);
      throw new Error(`Failed to delete customer: ${response.status} ${response.statusText}`);
    }

    console.log('✅ Successfully deleted customer:', customerId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting customer:', error.message);
    return false;
  }
}

module.exports = {
  fetchAbandonedCheckouts,
  deleteCustomer
};
