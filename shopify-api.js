// Fetch abandoned checkouts from Shopify
async function fetchAbandonedCheckouts(shop, accessToken) {
  const url = `https://${shop}/admin/api/2024-01/checkouts.json?status=open`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
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
async function deleteCheckout(shop, accessToken, checkoutToken) {
  const url = `https://${shop}/admin/api/2024-01/checkouts/${checkoutToken}.json`;
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete checkout: ${response.status}`);
    }

    console.log('Deleted checkout:', checkoutToken);
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
