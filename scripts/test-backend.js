/**
 * Test script for backend API
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001';
const TEST_ADDRESS = '0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15'; // Your wallet address

async function testBackendApi() {
  console.log('=============================================');
  console.log('IntelliLend Backend API Test');
  console.log('=============================================');
  
  try {
    // Test user endpoint
    console.log('\nTesting /api/user/:address...');
    const userResponse = await axios.get(`${API_URL}/api/user/${TEST_ADDRESS}`);
    console.log('User data:');
    console.log(JSON.stringify(userResponse.data, null, 2));
    
    // Test market endpoint
    console.log('\nTesting /api/market...');
    const marketResponse = await axios.get(`${API_URL}/api/market`);
    console.log('Market data:');
    console.log(JSON.stringify(marketResponse.data, null, 2));
    
    // Test history endpoint
    console.log('\nTesting /api/history/:address...');
    const historyResponse = await axios.get(`${API_URL}/api/history/${TEST_ADDRESS}`);
    console.log('History data:');
    console.log(JSON.stringify(historyResponse.data, null, 2));
    
    // Test bridge messages endpoint
    console.log('\nTesting /api/bridge/messages/:address...');
    const messagesResponse = await axios.get(`${API_URL}/api/bridge/messages/${TEST_ADDRESS}`);
    console.log('Bridge messages:');
    console.log(JSON.stringify(messagesResponse.data, null, 2));
    
    // Test recommendations endpoint
    console.log('\nTesting /api/recommendations/:address...');
    const recommendationsResponse = await axios.get(`${API_URL}/api/recommendations/${TEST_ADDRESS}`);
    console.log('Recommendations:');
    console.log(JSON.stringify(recommendationsResponse.data, null, 2));
    
    console.log('\n=============================================');
    console.log('All tests completed successfully!');
    console.log('=============================================');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
testBackendApi();
