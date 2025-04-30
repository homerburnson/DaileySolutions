const openai = require('../openai');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const logger = require('../logger'); // Import the logger

const model = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo'; // Default to gpt-3.5-turbo if not set
const NAME = process.env.NAME || 'Random Bot'; // Default to Bot
const MAX_TOKENS = Number(process.env.MAX_TOKENS); // Limit the number of tokens
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE) || 1; // Default temperature

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
        // Check if the keyword matches a key in embeddinglinks.json
        const embeddingLinksPath = path.join(__dirname, '../embeddinglinks.json');
        const embeddingLinks = JSON.parse(fs.readFileSync(embeddingLinksPath, 'utf8'));
        const embeddingLink = embeddingLinks.find(link => link.key === keyword);

        let context = '';
        if (embeddingLink) {
            // If a match is found, locate the embedding file
            const embeddingFilePath = path.join(__dirname, '../embeddings', embeddingLink.fileName);
            if (!fs.existsSync(embeddingFilePath)) {
                throw new Error(`Embedding file not found: ${embeddingLink.fileName}`);
            }

            // Read the stored embedding
            const storedEmbeddingData = JSON.parse(fs.readFileSync(embeddingFilePath, 'utf8'));
            const storedEmbedding = storedEmbeddingData.embedding;

            // Generate an embedding for the user input
            const inputEmbeddingResponse = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: input,
            });
            const inputEmbedding = inputEmbeddingResponse.data[0].embedding;

            // Calculate similarity between input embedding and stored embedding
            const similarity = cosineSimilarity(inputEmbedding, storedEmbedding);

            // Use the similarity to generate relevant context
            context = `The input is ${similarity.toFixed(2)} similar to the stored context.`;
        } else {
            // If no match is found, fall back to searching files in /texts folders
            const bioFolder = path.join(__dirname, '../texts/bio');
            const companyFolder = path.join(__dirname, '../texts/company');
            const coversFolder = path.join(__dirname, '../texts/covers');
            const cvFolder = path.join(__dirname, '../texts/cv');
            const jobsFolder = path.join(__dirname, '../texts/jobs');
            const userFolder = path.join(__dirname, '../texts/user');

            const cover = findFileContent(coversFolder, keyword) || 'No cover letter available.';
            const CV = findFileContent(cvFolder, keyword) || 'No CV available.';
            const job = findFileContent(jobsFolder, keyword) || 'No job description available.';
            const bio = findFileContent(bioFolder, keyword) || findFileContent(bioFolder, 'Standard');
            const company = findFileContent(companyFolder, keyword) || 'an unknown company (please ask for details).';
            const user = findFileContent(userFolder, keyword) || 'an unknown user (please ask for a name if needed)';

            context = `Bio: ${bio}\nCV: ${CV}\nCover Letter: ${cover}\nJob Description: ${job}\nCompany: ${company}\nUser: ${user}`;
        }

        // Get the session's conversation history
        const history = getSessionHistory(sessionId);

        // Add the initial system message if the history is empty
        if (history.length === 0) {
            history.push({
                role: "system",
                content: `You are roleplaying as ${NAME}. Use the following context:\n\n${context}`,
            });
        }

        // Add the user's input to the history
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