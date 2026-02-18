const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Middleware to set proper headers for all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use(express.json());
app.use(express.static(__dirname));

// Config endpoint to inject Mapbox token safely
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.header('Cache-Control', 'no-cache');
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

// Serve your HTML with proper headers
app.get('/', (req, res) => {
    res.header('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy for Mapbox GL JS (to avoid CORS)
app.get('/mapbox-gl.js', (req, res) => {
    axios({
        method: 'get',
        url: 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js',
        responseType: 'stream'
    }).then(response => {
        res.header('Content-Type', 'application/javascript');
        response.data.pipe(res);
    }).catch(error => {
        res.status(500).send('Error loading Mapbox GL JS');
    });
});

// Proxy for Mapbox GL CSS
app.get('/mapbox-gl.css', (req, res) => {
    axios({
        method: 'get',
        url: 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css',
        responseType: 'stream'
    }).then(response => {
        res.header('Content-Type', 'text/css');
        response.data.pipe(res);
    }).catch(error => {
        res.status(500).send('Error loading Mapbox GL CSS');
    });
});

// Reverse geocoding endpoint
app.get('/api/geocode/reverse', async (req, res) => {
    // Set CORS headers for this endpoint
    res.header('Access-Control-Allow-Origin', '*');
    
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

// Proxy for Mapbox tiles and resources
app.get('/mapbox/:path(*)', async (req, res) => {
    const mapboxPath = req.params.path;
    const mapboxUrl = `https://api.mapbox.com/${mapboxPath}${req.url.includes('?') ? '' : '?'}${req.url.includes('?') ? '&' : ''}access_token=${process.env.MAPBOX_TOKEN}`;
    
    try {
        const response = await axios({
            method: req.method,
            url: mapboxUrl,
            responseType: 'stream',
            headers: {
                'Accept': req.headers['accept'] || '*/*'
            }
        });
        
        // Forward appropriate headers
        if (response.headers['content-type']) {
            res.header('Content-Type', response.headers['content-type']);
        }
        res.header('Access-Control-Allow-Origin', '*');
        
        response.data.pipe(res);
    } catch (error) {
        console.error('Mapbox proxy error:', error.message);
        res.status(error.response?.status || 500).send('Mapbox proxy error');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Mapbox token configured: ${!!process.env.MAPBOX_TOKEN}`);
    console.log(`CORS enabled for all origins`);
});
