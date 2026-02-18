const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mapbox API key from environment variable (you already added this in Render)
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

// Proxy for Mapbox styles
app.get('/api/map/style', (req, res) => {
    res.json({
        version: 8,
        name: 'Mapbox Streets',
        sources: {
            'mapbox': {
                type: 'vector',
                url: `mapbox://mapbox.mapbox-streets-v8`
            }
        },
        layers: [{
            id: 'background',
            type: 'background',
            paint: {
                'background-color': '#f8f4f0'
            }
        }]
    });
});

// Reverse geocoding endpoint
app.get('/api/geocode/reverse', async (req, res) => {
    try {
        const { lat, lon, type } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json`;
        
        if (type === 'place') {
            url += '?types=place,locality,neighborhood&language=en';
        } else {
            url += '?types=address&language=en';
        }
        
        url += `&access_token=${MAPBOX_ACCESS_TOKEN}`;
        
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
        console.error('Geocoding error:', error);
        res.status(500).json({ error: 'Failed to geocode' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
