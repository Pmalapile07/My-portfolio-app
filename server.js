const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' })); // Increased limit for images
app.use(express.static(__dirname));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Task Schema
const taskSchema = new mongoose.Schema({
  location: { type: String, required: true },
  coordinates: { type: String, default: '' },
  streetName: { type: String, default: '' },
  when: { type: String, enum: ['now', 'later'], default: 'now' },
  scheduledDate: { type: String, default: null },
  scheduledTime: { type: String, default: null },
  taskDescription: { type: String, required: true },
  budgetType: { type: String, enum: ['fixed', 'open'], default: 'fixed' },
  budgetAmount: { type: Number, default: null },
  paymentMethod: { type: String, enum: ['cash', 'online'], default: 'cash' },
  moreDetails: { type: String, default: '' },
  images: [{ type: String }], // Store base64 images
  userId: { type: String, default: 'guest' },
  status: { type: String, enum: ['draft', 'posted', 'in-progress', 'completed'], default: 'posted' },
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// Serve config.js with the Mapbox token from your environment variable
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    // This uses your actual environment variable name: MAPBOX_ACCESS_TOKEN
    res.send(`window.MAPBOX_TOKEN = '${process.env.MAPBOX_ACCESS_TOKEN}';`);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        token_set: !!process.env.MAPBOX_ACCESS_TOKEN,
        mongodb_connected: mongoose.connection.readyState === 1
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

// ========== TASK API ROUTES ==========

// Create a new task
app.post('/api/tasks', async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get a single task by ID
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update a task
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(400).json({ error: error.message });
    }
});

// Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get tasks by status
app.get('/api/tasks/status/:status', async (req, res) => {
    try {
        const tasks = await Task.find({ status: req.params.status }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks by status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`Mapbox token configured: ${!!process.env.MAPBOX_ACCESS_TOKEN}`);
    console.log(`MongoDB configured: ${!!process.env.MONGODB_URI}`);
});
