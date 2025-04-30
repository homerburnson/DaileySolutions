const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Use the API key from environment variables
});

// Export the OpenAI client
module.exports = openai;