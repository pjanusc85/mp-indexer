import dotenv from 'dotenv';
import alchemyCronHandler from './api/alchemy-cron.js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Mock request and response objects
const mockReq = {
  url: '/api/alchemy-cron',
  headers: {
    host: 'localhost:3000'
  }
};

const mockRes = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log(`Status: ${this.statusCode}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    process.exit(0);
  }
};

console.log('🚀 Running alchemy-cron handler manually...');
console.log('⏰ Started at:', new Date().toISOString());

// Execute the handler
alchemyCronHandler(mockReq, mockRes).catch(error => {
  console.error('❌ Error running handler:', error);
  process.exit(1);
});