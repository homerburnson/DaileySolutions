const OpenAI = require('openai');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo'; // Default to gpt-3.5-turbo if not set
const NAME = process.env.NAME || 'Random Bot'; // Default to Bot

// Helper function to find and read a file based on a keyword
const findFileContent = (folderPath, keyword) => {
    const files = fs.readdirSync(folderPath);
    const matchingFile = files.find(file => file.includes(keyword));
    if (matchingFile) {
        const filePath = path.join(folderPath, matchingFile);
        return fs.readFileSync(filePath, 'utf8');
    }
    return null; // Return null if no matching file is found
};

// Read the README.md file
const readmePath = path.join(__dirname, '../../README.md');
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : 'No README file available.';

router.post('/openai', async (req, res) => {
    const { input } = req.body;

    // Decode the base64-encoded keyword from the session
    let keyword = 'Standard'; // Default to 'Standard'
    if (req.session.keyword) {
        try {
            keyword = req.session.keyword;
        } catch (error) {
            console.error('Error setting keyword:', error);
            keyword = 'Standard'; // Fallback to default if decoding fails
        }
    }

    console.log(`Decoded keyword: ${keyword}`); // Log the decoded keyword for debugging

    try {
        // Define folder paths
        const bioFolder = path.join(__dirname, '../texts/bio');
        const companyFolder = path.join(__dirname, '../texts/company');
        const coversFolder = path.join(__dirname, '../texts/covers');
        const cvFolder = path.join(__dirname, '../texts/cv');
        const jobsFolder = path.join(__dirname, '../texts/jobs');
        const userFolder = path.join(__dirname, '../texts/user');

        // Find and read the contents of the files
        const cover = findFileContent(coversFolder, keyword) || 'No cover letter available.';
        const CV = findFileContent(cvFolder, keyword) || 'No CV available.';
        const job = findFileContent(jobsFolder, keyword) || 'No job description available.';
        const bio = findFileContent(bioFolder, keyword) || findFileContent(bioFolder, 'Standard');
        const company = findFileContent(companyFolder, keyword) || 'an unknown company (please ask for details).';
        const user = findFileContent(userFolder, keyword) || 'an unknown user (please ask for a name if needed)';

        if (keyword == 'Standard') {
            // Default initial prompt
            initialPrompt = `Hello! I'm a digital 'twin' of ${NAME}. Feel free to ask me anything!`;
        }
        else {
            // Custom initial prompt based on the keyword
            initialPrompt = `Hello! I'm a digital 'twin' of ${NAME}. I understand you probably work with or for ${keyword} - can I check who you are and how I can help today? This conversation is not logged :)`;
        }

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are roleplaying as ${NAME}, using the context from the following references:

                                README: ${readme}

                                CV: ${CV}

                                Cover Letter: ${cover}

                                ${NAME}'s Biography: ${bio}

                                Optional Job Description: ${job}

                                Optional User: ${user}

                                Optional Company: ${company}

                            You're chatting with ${user} (check who the user is if necessary), who may be interested ${NAME}'s profile, CV and Bio and/or recruiting them for ${company}. Always respond as if you are ${NAME}, speaking naturally and conversationally.

                            Keep answers concise and professional, while being friendly and helpful. Share honest and accurate details—never invent or exaggerate information about:

                                Skills, experience, education

                                Work history or projects

                                Hobbies, interests, personality, values, or beliefs

                            If someone offers an opportunity, provide your email and phone number.`
                },
                {
                    role: "assistant",
                    content: initialPrompt // Initial prompt sent by the assistant
                },
                {
                    role: "user",
                    content: input
                }
            ]
        });

        // Extract the content from the OpenAI response
        const messageContent = response.choices[0].message.content;

        // Log the response for debugging
        console.log('OpenAI Response:', messageContent);

        // Send the extracted content back to the client
        res.json({ response: messageContent });
    } catch (error) {
        if (error instanceof OpenAI.APIError) {
            console.error(error.status);  // e.g. 401
            console.error(error.message); // e.g. The authentication token you passed was invalid...
            console.error(error.code);    // e.g. 'invalid_api_key'
            console.error(error.type);    // e.g. 'invalid_request_error'
            console.log(req.body);
        } else {
            // Non-API error
            console.log(error);
        }
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

router.get('/initial-prompt', (req, res) => {
    // Retrieve the keyword from the session
    const keyword = req.session.keyword || 'Standard';

    console.log(`Keyword for initial prompt: ${keyword}`); // Log the keyword for debugging

    // Set the initial prompt based on the keyword
    let initialPrompt;
    if (keyword === 'Standard') {
        // Default initial prompt
        initialPrompt = `Hello! 👋 I'm a digital 'twin' of ${NAME}. Feel free to ask me anything! 😊`;
    }
    else {
        // Custom initial prompt based on the keyword
        initialPrompt = `Hello! 👋 I'm a digital 'twin' of ${NAME}. I understand you likely work with or for ${keyword} - can I check who you are and how I can help today? This conversation is not logged 😊`;
    }

    // Send the initial prompt back to the client
    res.json({ initialPrompt });
});

module.exports = router;