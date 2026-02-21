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

// ========== TASK SCHEMA ==========
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
  status: { type: String, enum: ['draft', 'posted', 'in-progress', 'completed', 'active', 'cancelled'], default: 'posted' },
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// ========== USER SCHEMA ==========
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['poster', 'helper'], default: 'poster' },
  initials: { type: String },
  emailVerified: { type: Boolean, default: true }, // Set to true for now
  photoUploaded: { type: Boolean, default: false },
  adminVerified: { type: Boolean, default: true }, // Set to true for now
  profileImage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Serve config.js with the Mapbox token from your environment variable
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
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

// ========== GEOCODING ENDPOINTS ==========
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
        const { email } = req.query;
        let query = {};
        
        if (email) {
            query = { userId: email };
        }
        
        const tasks = await Task.find(query).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get tasks by user email
app.get('/api/tasks/user/:email', async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.params.email }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching user tasks:', error);
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

// ========== USER API ROUTES ==========

// Get all users (without passwords)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user by email
app.get('/api/users/email/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user by email (query param version)
app.get('/api/users', async (req, res) => {
    try {
        const { email } = req.query;
        if (email) {
            const user = await User.findOne({ email }).select('-password');
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            return res.json([user]); // Return as array for compatibility
        }
        
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create user (signup)
app.post('/api/users', async (req, res) => {
    try {
        const { name, email, password, role, initials } = req.body;
        
        // Check if user exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const userInitials = initials || name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const user = new User({
            name,
            email,
            password, // In production, hash this with bcrypt!
            role: role || 'poster',
            initials: userInitials,
            emailVerified: true,
            adminVerified: true
        });
        
        await user.save();
        
        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update user profile image
app.put('/api/users/:email/profile-image', async (req, res) => {
    try {
        const { profileImage } = req.body;
        
        const user = await User.findOneAndUpdate(
            { email: req.params.email },
            { profileImage, photoUploaded: true },
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error updating profile image:', error);
        res.status(400).json({ error: error.message });
    }
});

// Update user
app.put('/api/users/:email', async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { email: req.params.email },
            req.body,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(400).json({ error: error.message });
    }
});

// Delete user
app.delete('/api/users/:email', async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Also delete all tasks by this user
        await Task.deleteMany({ userId: req.params.email });
        
        res.json({ message: 'User and associated tasks deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== AUTHENTICATION ROUTES ==========

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Simple password check - in production, use bcrypt
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create token (simple version - in production use JWT)
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // Check if user exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const user = new User({
            name,
            email,
            password,
            role: role || 'poster',
            initials,
            emailVerified: true,
            adminVerified: true
        });
        
        await user.save();
        
        // Create token
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json({
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Verify token endpoint
app.get('/api/auth/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Invalid token format' });
    }
    
    try {
        // Simple token verification - in production use JWT
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [email] = decoded.split(':');
        
        const user = await User.findOne({ email }).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        res.json({ valid: true, user });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal that user doesn't exist
            return res.json({ message: 'If the email exists, a reset link will be sent' });
        }
        
        // In production, send email with reset link
        // For now, just return success
        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== START SERVER ==========
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`Mapbox token configured: ${!!process.env.MAPBOX_ACCESS_TOKEN}`);
    console.log(`MongoDB configured: ${!!process.env.MONGODB_URI}`);
    console.log(`✅ User API endpoints available at /api/users`);
    console.log(`✅ Auth endpoints available at /api/auth`);
});
