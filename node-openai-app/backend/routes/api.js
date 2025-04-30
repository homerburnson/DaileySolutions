const openai = require('../openai');
const express = require('express');
const fs = require('fs'); // Ensure the fs module is imported at the top of the file
const path = require('path');
const router = express.Router();
const logger = require('../logger'); // Import the logger
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { QdrantClient } = require('@qdrant/js-client-rest'); // Import Qdrant client
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME; // Qdrant collection name

const model = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo'; // Default to gpt-3.5-turbo if not set
const NAME = process.env.NAME || 'Random Bot'; // Default to Bot
const MAX_TOKENS = Number(process.env.MAX_TOKENS); // Limit the number of tokens
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE) || 1; // Default temperature

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
    url: process.env.CLUSTERURL || 'http://localhost:6333', // Qdrant instance URL
    apiKey: process.env.DBSECRET || '', // API key for authentication
});

// In-memory store for conversation history
const sessionHistory = {};

// Helper function to get or initialize session history
const getSessionHistory = (sessionId) => {
    if (!sessionHistory[sessionId]) {
        sessionHistory[sessionId] = []; // Initialize an empty history for the session
    }
    return sessionHistory[sessionId];
};

// Helper function to find and read a file based on a keyword
const findFileContent = (folderPath, keyword) => {
    const sanitizedKeyword = keyword.replace(/[^a-zA-Z0-9_-]/g, ''); // Allow only alphanumeric, underscores, and dashes
    const files = fs.readdirSync(folderPath);
    const matchingFile = files.find(file => file.includes(sanitizedKeyword));
    if (matchingFile) {
        const filePath = path.join(folderPath, matchingFile);
        return fs.readFileSync(filePath, 'utf8');
    }
    return null;
};

// Read the README.md file
const readmePath = path.join(__dirname, '../../README.md');
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : 'No README file available.';

// Sanitize input to remove potentially harmful characters or patterns
const sanitizeInput = (input) => {
    return input.replace(/[^a-zA-Z0-9 .,!?'"-]/g, '').trim();
};

// Sanitize output to remove potentially harmful content from the LLM's response
const sanitizeOutput = (output) => {
    return output.replace(/<script.*?>.*?<\/script>/gi, '').trim();
};

router.post('/openai', async (req, res) => {
    const sessionId = req.sessionID || 'unknown-session';
    const keyword = req.session.keyword || 'Standard';
    const utcTime = new Date().toISOString();
    const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME;

    logger.info(`Session ID: ${sessionId}, Keyword: ${keyword}, Time: ${utcTime}, Route: /openai`);

    let { input, temperature } = req.body;

    // Validate and sanitize input
    if (!input || typeof input !== 'string') {
        logger.warn(`Session ID: ${sessionId}, Invalid input provided.`);
        return res.status(400).json({ error: 'Invalid input provided.' });
    }
    input = sanitizeInput(input);

    // Validate temperature
    if (temperature === undefined || typeof temperature !== 'number' || temperature < 0 || temperature > 1) {
        temperature = DEFAULT_TEMPERATURE; // Use default temperature if invalid or not provided
    }

    logger.info(`Session ID: ${sessionId}, Temperature: ${temperature}, Input: ${input}`);

    try {
        // Generate embedding for the user query
        logger.info('Generating embedding for user query...');
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
        const queryEmbedding = await embeddings.embedQuery(input);

        if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
            logger.error('Invalid query embedding:', queryEmbedding);
            return res.status(500).json({ error: 'Failed to generate a valid embedding for the query.' });
        }
        logger.info('Embedding generated for user query.');
        console.log('Query embedding:', queryEmbedding);

        // Log the queryEmbedding to a file
        const embeddingLogPath = path.join(__dirname, '../logs/query_embeddings.log');
        const logEntry = `Session ID: ${sessionId}, Time: ${new Date().toISOString()}, Query Embedding: ${JSON.stringify(queryEmbedding)}\n`;

        fs.appendFile(embeddingLogPath, logEntry, (err) => {
            if (err) {
                logger.error('Failed to log query embedding to file:', err);
            } else {
                logger.info('Query embedding logged to file successfully.');
            }
        });

        // Query Qdrant for the two most similar embeddings
        logger.info('Sending search request to Qdrant:', {
            collection_name: COLLECTION_NAME,
            vector: queryEmbedding,
            filter: {
                must: [
                    { key: 'key', match: { value: keyword } },
                ],
            },
            limit: 2,
            with_payload: true, // Ensure payload is included in the response
        });

        const searchResults = await qdrantClient.search({
            collection_name: COLLECTION_NAME,
            vector: queryEmbedding,
            filter: {
                must: [
                    { key: 'key', match: { value: keyword } },
                ]
            },
            limit: 2, // Retrieve the top 2 most similar embeddings
            with_payload: true, // Include payload in the response
        });

        if (!searchResults || !Array.isArray(searchResults)) {
            logger.error('Invalid response from Qdrant:', searchResults);
            return res.status(500).json({ error: 'Failed to retrieve similar embeddings from Qdrant.' });
        }

        if (searchResults.length === 0) {
            logger.warn('No similar embeddings found in Qdrant.');
            return res.status(404).json({ error: 'No relevant context found for the query.' });
        }

        // Extract the text of the two most similar chunks
        const contextChunks = searchResults.map(result => result.payload.chunk_text);
        logger.info(`Retrieved ${contextChunks.length} similar chunks from Qdrant.`);

        // Prepare the context for OpenAI
        const context = contextChunks.join('\n\n');
        logger.info('Context prepared for OpenAI prompt.');

        // Get the session's conversation history
        const history = getSessionHistory(sessionId);

        // Add the context and user input to the conversation history
        history.push({
            role: "system",
            content: `Use the following context to answer the user's query:\n\n${context}`,
        });
        history.push({
            role: "user",
            content: input,
        });

        // Log the conversation history before making the API call
        logger.info(`Session ID: ${sessionId}, Conversation History: ${JSON.stringify(history, null, 2)}`);

        // Call OpenAI API with the conversation history
        const response = await openai.chat.completions.create({
            model: model,
            max_tokens: MAX_TOKENS,
            temperature: temperature,
            messages: history, // Pass the conversation history
        });

        // Extract the content from the OpenAI response
        const messageContent = response.choices[0].message.content;

        // Add the assistant's response to the history
        history.push({
            role: "assistant",
            content: messageContent,
        });

        // Sanitize the LLM's response
        const sanitizedResponse = sanitizeOutput(messageContent);

        // Log the response for debugging
        logger.info(`Session ID: ${sessionId}, OpenAI Response: ${sanitizedResponse}`);

        // Send the sanitized content back to the client
        res.json({ response: sanitizedResponse });
    } catch (error) {
        logger.error(`Session ID: ${sessionId}, Error: ${error.message}`);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// Helper function to calculate cosine similarity
const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
};

router.get('/initial-prompt', (req, res) => {
    const sessionId = req.sessionID || 'unknown-session';
    const keyword = req.session.keyword || 'Standard';
    const utcTime = new Date().toISOString();

    logger.info(`Session ID: ${sessionId}, Keyword: ${keyword}, Time: ${utcTime}, Route: /initial-prompt`);

    let initialPrompt;
    if (keyword === 'Standard') {
        initialPrompt = `Hello! 👋 I'm a digital 'twin' of ${NAME}. Feel free to ask me anything! 😊`;
    } else {
        initialPrompt = `Hello! 👋 I'm a digital 'twin' of ${NAME}. I understand you likely work with ${keyword}. How can I help today?😊`;
    }

    logger.info(`Session ID: ${sessionId}, Initial Prompt: ${initialPrompt}`);
    res.json({ initialPrompt });
});

module.exports = router;