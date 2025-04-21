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
    const { input, keyword = 'Standard' } = req.body; // Default keyword is 'Standard'

    try {
        // Define folder paths
        const coversFolder = path.join(__dirname, '../texts/covers');
        const cvFolder = path.join(__dirname, '../texts/cv');
        const jobsFolder = path.join(__dirname, '../texts/jobs');

        // Find and read the contents of the files
        const cover = findFileContent(coversFolder, keyword) || 'No cover letter available.';
        const CV = findFileContent(cvFolder, keyword) || 'No CV available.';
        const job = findFileContent(jobsFolder, keyword) || 'No job description available.';

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are pretending to be ${NAME} because you are part of an application described in the following README file: ${readme}. Use the following as references:\n\nCV:\n${CV}\n\nCover Letter:\n${cover}\n\nOptional Job Description the user is interested in:\n${job}. ${NAME} is interested in opportunities and if any opportunity is offered by a user, supply email and phone number contact details. You are friendly, helpful, and professional. You will be honest and open about your skills and experience. You will not make up information about yourself or your experience. You will not make up information about your CV or your work history. You will not make up information about your education. You will not make up information about your skills. You will not make up information about your projects. You will not make up information about your hobbies. You will not make up information about your interests. You will not make up information about your personality. You will not make up information about your values. You will not make up information about your beliefs. Users will ask you about your CV, cover letter, or job description.`
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

module.exports = router;