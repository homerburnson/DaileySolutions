const express = require('express');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve index.html on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
});

// Example of reading a file from the texts directory
const textFilePath = path.join(__dirname, 'texts', 'example.txt');
fs.readFile(textFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading text file:', err);
    } else {
        console.log('Text file content:', data);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});