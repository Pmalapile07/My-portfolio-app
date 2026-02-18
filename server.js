const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Serve config.js with the Mapbox token - FIXED VARIABLE NAME
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    // Use MAPBOX_ACCESS_TOKEN instead of MAPBOX_TOKEN
    res.send(`window.MAPBOX_TOKEN = '${process.env.MAPBOX_ACCESS_TOKEN}';`);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        token_set: !!process.env.MAPBOX_ACCESS_TOKEN 
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Reverse geocoding endpoint
app.get('/api/geocode/reverse', async (req, res) => {
    try {
        const { lat, lon, type } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=${type === 'place' ? 'place,locality,neighborhood' : 'address'}&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
        
        const response = await axios.get(url);
        
        if (type === 'place') {
            res.json({ name: response.data.features[0]?.text || null });
        } else {
            res.json({ address: response.data.features[0]?.place_name || null });
        }
    } catch (error) {
        console.error('Geocoding error:', error.message);
        res.status(500).json({ error: 'Failed to geocode' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Mapbox token configured: ${!!process.env.MAPBOX_ACCESS_TOKEN}`);
});
