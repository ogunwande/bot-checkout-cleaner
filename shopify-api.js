const fetch = require('node-fetch');

// Fetch customers with 0 orders (abandoned/bot customers)
async function fetchAbandonedCheckouts(shop, accessToken) {
  const url = `https://${shop}/admin/api/2026-01/graphql.json`;
  
  const query = `
    {
      customers(first: 100) {
        edges {
          node {
            id
            email
            firstName
            lastName
            ordersCount
            defaultAddress {
              address1
              address2
              city
              province
              zip
            }
            createdAt
          }
        }
      }
    }
  `;
  
  try {
    console.log('Fetching customers via GraphQL from:', shop);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const text = await response.text();
    console.log('Raw API Response:', text);

    if (!response.ok) {
      console.error('API Error Status:', response.status);
      throw new Error(`API error: ${response.status}`);
    }

    const data = JSON.parse(text);
    
    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      throw new Error('GraphQL failed: ' + data.errors[0].message);
    }
    
    if (!data.data || !data.data.customers) {
      console.error('Unexpected response structure:', data);
      throw new Error('No customers data in response');
    }
    
    const allCustomers = data.data.customers.edges || [];
    console.log('Total customers found:', allCustomers.length);
    
    // Convert to our format
    const customers = allCustomers.map(edge => {
      const node = edge.node;
      const idParts = node.id.split('/');
      const numericId = idParts[idParts.length - 1];
      
      return {
        id: numericId,
        email: node.email || '',
        customer: {
          id: numericId,
          email: node.email || '',
          first_name: node.firstName || '',
          last_name: node.lastName || '',
          orders_count: node.ordersCount || 0
        },
        shipping_address: node.defaultAddress || {},
        created_at: node.createdAt
      };
    });
    
    // Filter to only those with 0 orders
    const noOrders = customers.filter(c => c.customer.orders_count === 0);
    
    console.log('Customers with 0 orders:', noOrders.length);
    
    return noOrders;
    
  } catch (error) {
    console.error('Error in fetchAbandonedCheckouts:', error);
    throw error;
  }
}

// Delete customer
async function deleteCustomer(shop, accessToken, customerId) {
  const url = `https://${shop}/admin/api/2026-01/graphql.json`;
  
  const gid = `gid://shopify/Customer/${customerId}`;
  
  const mutation = `
    mutation {
      customerDelete(input: {id: "${gid}"}) {
        deletedCustomerId
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    console.log('Deleting customer:', customerId);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation })
    });

    const text = await response.text();
    console.log('Delete response:', text);

    if (!response.ok) {
      return false;
    }

    const data = JSON.parse(text);
    
    if (data.errors) {
      console.error('Delete errors:', data.errors);
      return false;
    }
    
    if (data.data && data.data.customerDelete) {
      const result = data.data.customerDelete;
      
      if (result.userErrors && result.userErrors.length > 0) {
        console.error('User errors:', result.userErrors);
        return false;
      }
      
      if (result.deletedCustomerId) {
        console.log('Successfully deleted:', customerId);
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
}

module.exports = {
  fetchAbandonedCheckouts,
  deleteCustomer
};
