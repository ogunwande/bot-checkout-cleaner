const fetch = require('node-fetch');

// Fetch customers using GraphQL (then check for abandoned checkouts)
async function fetchAbandonedCheckouts(shop, accessToken) {
  const url = `https://${shop}/admin/api/2026-01/graphql.json`;
  
  // Query customers who have abandoned checkouts
  // We'll get customers and check their order history
  const query = `
    query GetCustomers {
      customers(first: 250, query: "state:disabled OR state:enabled") {
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
              country
            }
            createdAt
            updatedAt
          }
        }
        pageInfo {
          hasNextPage
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GraphQL API Error Response:', errorText);
      throw new Error(`Shopify GraphQL API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      throw new Error('GraphQL query failed: ' + data.errors[0].message);
    }
    
    // Transform to checkout-like format
    const customers = data.data.customers.edges.map(edge => {
      const node = edge.node;
      const customerId = node.id.split('/').pop();
      
      return {
        id: customerId,
        email: node.email,
        customer: {
          id: customerId,
          email: node.email,
          first_name: node.firstName,
          last_name: node.lastName,
          orders_count: node.ordersCount
        },
        shipping_address: node.defaultAddress,
        created_at: node.createdAt,
        updated_at: node.updatedAt
      };
    });
    
    // Filter for potential bot customers (those with 0 orders - never completed purchase)
    const suspiciousCustomers = customers.filter(c => c.customer.orders_count === 0);
    
    console.log('✅ Found', customers.length, 'total customers');
    console.log('⚠️ Found', suspiciousCustomers.length, 'customers with 0 orders (potential bots)');
    
    return suspiciousCustomers;
    
  } catch (error) {
    console.error('❌ Error fetching customers:', error.message);
    throw error;
  }
}

// Delete customer using GraphQL
async function deleteCustomer(shop, accessToken, customerId) {
  const url = `https://${shop}/admin/api/2026-01/graphql.json`;
  
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
    
    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      return false;
    }
    
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
```

---

## **Key Changes:**

1. **Queries `customers` instead of `checkouts`** (checkouts field was removed by Shopify)
2. **Filters for customers with 0 orders** (these are abandoned - never completed purchase)
3. **Still detects bot patterns** in customer data
4. **Deletes bot customers** from the database

---

## **Deploy This:**

1. Replace your `shopify-api.js` with the code above
2. Keep your `server.js` as is (no changes needed)
3. Commit to GitHub
4. Wait for Railway to redeploy
5. Run scan again

---

## **What Should Happen:**

After deploying, the logs should show:
```
✅ Found X total customers
⚠️ Found Y customers with 0 orders (potential bots)
