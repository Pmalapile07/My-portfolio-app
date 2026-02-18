const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Config endpoint to inject Mapbox token safely
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.send(`window.MAPBOX_TOKEN = '${process.env.MAPBOX_TOKEN}';`);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        mapbox_token_set: !!process.env.MAPBOX_TOKEN 
    });
});

// Serve your HTML
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Reverse geocoding endpoint
app.get('/api/geocode/reverse', async (req, res) => {
    try {
        const { lat, lon, type } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        if (!process.env.MAPBOX_TOKEN) {
            return res.status(500).json({ error: 'Mapbox token not configured' });
        }

        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json`;
        
        if (type === 'place') {
            url += '?types=place,locality,neighborhood&language=en';
        } else {
            url += '?types=address&language=en';
        }
        
        url += `&access_token=${process.env.MAPBOX_TOKEN}`;
        
        const response = await axios.get(url);
        
        if (type === 'place') {
            res.json({
                name: response.data.features[0]?.text || null
            });
        } else {
            res.json({
                address: response.data.features[0]?.place_name || null
            });
        }
    } catch (error) {
        console.error('Geocoding error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to geocode',
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Mapbox token configured: ${!!process.env.MAPBOX_TOKEN}`);
});
