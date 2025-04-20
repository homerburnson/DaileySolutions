const OpenAI = require('openai');
const express = require('express');
const router = express.Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo'; // Default to gpt-3.5-turbo if not set

router.post('/openai', async (req, res) => {
    const { input } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
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
        console.error(error.code);  // e.g. 'invalid_api_key'
        console.error(error.type);  // e.g. 'invalid_request_error'
        console.log(req.body);  // e.g. 'invalid_request_error
        } else {
        // Non-API error
        console.log(error);
        }
    }
});

module.exports = router;