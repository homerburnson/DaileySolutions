const express = require('express');
const router = express.Router();
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

router.post('/generate', async (req, res) => {
    const userInput = req.body.input;

    try {
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: userInput,
            max_tokens: 150,
        });

        res.json({ output: response.data.choices[0].text.trim() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while generating the response.' });
    }
});

module.exports = router;