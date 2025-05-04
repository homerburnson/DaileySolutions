require('dotenv').config();
const express = require('express');
// Auth0 configuration
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
};
const { auth, requiresAuth } = require('express-openid-connect');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const logger = require('./logger'); // Import the logger

const app = express();
const PORT = process.env.PORT || 80;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 150, // Limit each IP to 150 requests per windowMs
    message: 'Too many requests, please try again later.',
});

app.use(limiter);

// Middleware for Auth0
app.use(auth(config));

// Configure session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'defaultsecret',
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            maxAge: 60 * 60 * 1000, // 1 hour
        },
    })
);

// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to log all incoming requests
app.use((req, res, next) => {
    const sessionId = req.sessionID || 'unknown-session';
    const keyword = req.session?.keyword || 'Standard';
    const utcTime = new Date().toISOString();

    logger.info(`Session ID: ${sessionId}, Keyword: ${keyword}, Time: ${utcTime}, Method: ${req.method}, URL: ${req.originalUrl}`);
    next();
});

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, '../frontend/public'), { index: false }));

// API routes
app.use('/api', apiRoutes);

app.get('/test-session', (req, res) => {
    const keyword = req.session.keyword || 'No keyword set';
    res.send(`Keyword in session: ${keyword}`);
});

// Serve the index.html file dynamically
app.get('/', (req, res) => {
    const { state } = req.query;

    // Decode the Base64 string from the `state` query parameter
    let keyword = 'Standard'; // Default keyword
    if (state) {
        try {
            keyword = Buffer.from(state, 'base64').toString('utf8');
            req.session.keyword = keyword; // Store the decoded keyword in the session
            logger.info(`Decoded keyword from state: ${keyword}`);
        } catch (error) {
            logger.error(`Failed to decode state parameter: ${error.message}`);
        }
    } else {
        logger.info('No state parameter provided. Using default keyword: Standard');
    }

    const name = process.env.NAME || 'A Default Name'; // Fallback if NAME is not set
    const title = process.env.TITLE || 'Working a default job'; // Fallback if TITLE is not set
    const brand = process.env.BRAND || 'As a default person'; // Fallback if BRAND is not set
    const location = process.env.LOCATION || 'In a Default location'; // Fallback if LOCATION is not set

    res.render('index', { name, title, brand, location, keyword });
});

// Serve the upload.html page on the /uploaddocs route
app.get('/uploaddocs', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../frontend/public', 'upload.html'));
    } else {
        res.send('<h1>You are not logged in</h1><a href="/login">Log in</a>');
    }
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

// Redirect all unhandled routes to the homepage
app.use((req, res) => {
    console.log(`Unhandled route accessed: ${req.originalUrl}. Redirecting to homepage.`);
    res.redirect('/');
});

// Start the server
app.listen(PORT, () => {
    logger.info(`Server is running on ${PORT}`);
});