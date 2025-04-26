require('dotenv').config({ path: '../.env' });
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Auth0 configuration
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: 'http://localhost:3000',
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
};

// Middleware for Auth0
app.use(auth(config));

// Configure session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'your-secret-key', // Use a secure secret key
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set to true if using HTTPS
    })
);

// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, '../frontend/public'), { index : false }));

// API routes
app.use('/api', apiRoutes);

app.get('/test-session', (req, res) => {
    const keyword = req.session.keyword || 'No keyword set';
    res.send(`Keyword in session: ${keyword}`);
});

// Serve index.html on the root route and handle query parameters
app.get('/', (req, res) => {
    console.log('Root route accessed'); // Log when the route is accessed

    // Check if the query parameter exists
    if (req.query.state) {
        console.log(`Query parameter 'state' received: ${req.query.state}`);
    } else {
        console.log('No query parameter "state" received');
    }

    // Decode the base64-encoded state
    let keyword = 'Standard'; // Default to 'Standard'
    if (req.query.state) {
        try {
            keyword = Buffer.from(req.query.state, 'base64').toString('utf8'); // Decode base64 to UTF-8
            console.log(`Decoded keyword: ${keyword}`);
        } catch (error) {
            console.error('Error decoding base64 state:', error);
            keyword = 'Standard'; // Fallback to default if decoding fails
        }
    }

    // Store the decoded keyword in the session
    req.session.keyword = keyword;
    console.log(`Keyword stored in session: ${req.session.keyword}`);

    // Serve the index.html file
    res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
});

// Serve the upload.html page on the /uploaddocs route
app.get('/uploaddocs', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public', 'upload.html'));
});

// Protected routes
app.get('/profile', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        res.send(`<h1>Welcome, ${req.oidc.user.name}</h1><pre>${JSON.stringify(req.oidc.user, null, 2)}</pre>`);
    } else {
        res.send('<h1>You are not logged in</h1><a href="/login">Log in</a>');
    }
});

app.use('/upload', requiresAuth(), uploadRoutes);

app.use('/cv_public', express.static(path.join(__dirname, '../frontend/public/cv_public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
        }
    },
}));

app.get('/cv_public/filename', (req, res) => {
    const cvPublicPath = path.join(__dirname, '../frontend/public/cv_public');

    // Read the files in the cv_public folder
    fs.readdir(cvPublicPath, (err, files) => {
        if (err) {
            console.error('Error reading cv_public folder:', err);
            return res.status(500).json({ error: 'Failed to read cv_public folder.' });
        }

        // Return the first file found (or null if no files exist)
        const filename = files.length > 0 ? files[0] : null;
        res.json({ filename });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});