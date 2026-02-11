const fetch = require('node-fetch');

// Fetch abandoned checkouts using GraphQL Admin API
async function fetchAbandonedCheckouts(shop, accessToken) {
  const url = `https://${shop}/admin/api/2026-01/graphql.json`;
  
  const query = `
    query GetAbandonedCheckouts {
      checkouts(first: 250) {
        edges {
          node {
            id
            email
            createdAt
            updatedAt
            customer {
              id
              email
              firstName
              lastName
            }
            shippingAddress {
              address1
              address2
              city
              province
              zip
              country
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }
  `;
  
  try {
    console.log('Fetching checkouts via GraphQL from:', shop);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GraphQL API Error Response:', errorText);
      throw new Error(`Shopify GraphQL API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      throw new Error('GraphQL query failed: ' + data.errors[0].message);
    }
    
    // Transform GraphQL response to match our expected format
    const checkouts = data.data.checkouts.edges.map(edge => {
      const node = edge.node;
      
      // Extract numeric ID from GraphQL global ID (gid://shopify/Checkout/12345)
      const checkoutId = node.id.split('/').pop();
      
      return {
        id: checkoutId,
        email: node.email,
        customer: node.customer ? {
          id: node.customer.id.split('/').pop(), // Extract numeric customer ID
          email: node.customer.email,
          first_name: node.customer.firstName,
          last_name: node.customer.lastName
        } : null,
        shipping_address: node.shippingAddress,
        created_at: node.createdAt,
        updated_at: node.updatedAt
      };
    });
    
    console.log('✅ Successfully fetched', checkouts.length, 'checkouts via GraphQL');
    return checkouts;
    
  } catch (error) {
    console.error('❌ Error fetching checkouts:', error.message);
    throw error;
  }
}

// Delete customer using GraphQL Admin API
async function deleteCustomer(shop, accessToken, customerId) {
  const url = `https://${shop}/admin/api/2026-01/graphql.json`;
  
  // Convert numeric ID to GraphQL global ID format
  const customerGid = `gid://shopify/Customer/${customerId}`;
  
  const mutation = `
    mutation DeleteCustomer($id: ID!) {
      customerDelete(input: {id: $id}) {
        deletedCustomerId
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const variables = {
    id: customerGid
  };
  
  try {
    console.log('🗑️ Attempting to delete customer via GraphQL:', customerId);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        query: mutation,
        variables: variables
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GraphQL delete error response:', errorText);
      throw new Error(`Failed to delete customer: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      return false;
    }
    
    // Check for user errors (validation errors)
    const userErrors = data.data.customerDelete.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error('❌ User Errors:', JSON.stringify(userErrors, null, 2));
      return false;
    }

    const deletedId = data.data.customerDelete.deletedCustomerId;
    if (deletedId) {
      console.log('✅ Successfully deleted customer:', customerId);
      return true;
    } else {
      console.log('⚠️ Delete mutation returned no error but also no deleted ID');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error deleting customer:', error.message);
    return false;
  }
}

module.exports = {
  fetchAbandonedCheckouts,
  deleteCustomer
};
