require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy if behind a reverse proxy (Render, Vercel, etc.)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate Limiter for Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

// Authentication Middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized access. Please log in.' });
}

// Routes
app.post('/api/login', loginLimiter, (req, res) => {
    const { password } = req.body;
    const sharedPassword = process.env.SHARED_PASSWORD || 'sonora2026';

    if (password === sharedPassword) {
        req.session.authenticated = true;
        return res.json({ success: true, message: 'Login successful' });
    }
    
    res.status(401).json({ success: false, error: 'Incorrect shared password.' });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.json({ authenticated: true });
    }
    res.json({ authenticated: false });
});

// Jamendo Dynamic Search & Catalogue API Endpoint
app.get('/api/music', requireAuth, async (req, res) => {
    try {
        const query = req.query.search || '';
        const genre = req.query.genre || '';
        const clientId = process.env.JAMENDO_CLIENT_ID || '';
        
        // Build API URL based on user input
        let url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=100&order=popularity_total&audioformat=mp32`;
        
        if (query) {
            url += `&search=${encodeURIComponent(query)}`;
        }
        if (genre) {
            url += `&tags=${encodeURIComponent(genre)}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching music:', error);
        res.status(500).json({ error: 'Failed to fetch music catalogue' });
    }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Sonora server running on port ${PORT}`);
});
