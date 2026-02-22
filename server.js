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

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmart';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Connection event listeners
mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

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
  images: [{ type: String }],
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
  role: { type: String, enum: ['poster', 'helper', 'admin'], default: 'poster' },
  initials: { type: String },
  emailVerified: { type: Boolean, default: true },
  photoUploaded: { type: Boolean, default: false },
  adminVerified: { type: Boolean, default: true },
  profileImage: { type: String, default: null },
  suspended: { type: Boolean, default: false },
  suspendedAt: { type: Date },
  suspendedBy: { type: String },
  suspensionReason: { type: String },
  banned: { type: Boolean, default: false },
  bannedAt: { type: Date },
  bannedBy: { type: String },
  banReason: { type: String },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ========== ERROR LOG SCHEMA ==========
const errorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  errorType: { type: String, required: true },
  errorMessage: { type: String, required: true },
  stackTrace: { type: String },
  route: { type: String },
  userId: { type: String },
  userEmail: { type: String },
  method: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  resolved: { type: Boolean, default: false }
});

const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);

// ========== FAILED LOGIN SCHEMA ==========
const failedLoginSchema = new mongoose.Schema({
  email: { type: String, required: true },
  ip: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const FailedLogin = mongoose.model('FailedLogin', failedLoginSchema);

// ========== ADMIN ACTIVITY LOG SCHEMA ==========
const adminActivitySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  adminId: { type: String, required: true },
  adminEmail: { type: String, required: true },
  action: { type: String, required: true },
  targetType: { type: String, enum: ['user', 'task', 'verification', 'report', 'system'] },
  targetId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String }
});

const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivitySchema);

// ========== REPORT SCHEMA ==========
const reportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reporterEmail: { type: String, required: true },
  reportedUserId: { type: String, required: true },
  reportedUserEmail: { type: String, required: true },
  reason: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
  adminNotes: [{ type: String }],
  adminActions: [{
    action: String,
    adminId: String,
    adminEmail: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

// ========== VERIFICATION REQUEST SCHEMA ==========
const verificationRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  idType: { type: String, enum: ['passport', 'drivers_license', 'national_id'] },
  idImage: { type: String },
  selfieImage: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);

// ========== SYSTEM SETTINGS SCHEMA ==========
const systemSettingsSchema = new mongoose.Schema({
  maintenanceMode: { type: Boolean, default: false },
  devMode: { type: Boolean, default: false },
  platformFee: { type: Number, default: 5 },
  registrationsEnabled: { type: Boolean, default: true },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// Serve config.js with the Mapbox token
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.send(`window.MAPBOX_TOKEN = '${process.env.MAPBOX_ACCESS_TOKEN}';`);
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
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

// ========== ERROR LOGGING FUNCTION ==========
async function logError(error, route, userId = null, req = null) {
    try {
        console.log('📝 Attempting to log error:', error.message); // Debug console log
        
        const errorLog = new ErrorLog({
            errorType: error.name || 'UnknownError',
            errorMessage: error.message || String(error),
            stackTrace: error.stack,
            route,
            userId: userId || (req?.user?.id) || (req?.user?.email) || 'unknown',
            userEmail: req?.user?.email,
            method: req?.method,
            ip: req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress,
            userAgent: req?.headers?.['user-agent'],
            resolved: false
        });
        
        const saved = await errorLog.save();
        console.log('✅ Error logged successfully. ID:', saved._id);
        
        return saved;
    } catch (logError) {
        console.error('❌ CRITICAL: Failed to log error:', logError);
        // Write to console as last resort
        console.error('Original error that failed to log:', error);
    }
}

// ========== DEBUG ROUTES (For Admin Debug Panel) ==========

// Test log creation
app.get('/api/debug/test-log', async (req, res) => {
    try {
        // Force a test error log
        const testError = new Error('TEST DEBUG LOG - ' + new Date().toISOString());
        testError.name = 'TestError';
        
        await logError(testError, '/debug/test', 'test-user', req);
        
        // Count total logs
        const totalLogs = await ErrorLog.countDocuments();
        const recentLogs = await ErrorLog.find().sort({ timestamp: -1 }).limit(5);
        
        res.json({
            success: true,
            message: 'Test log created',
            totalLogs,
            recentLogs: recentLogs.map(log => ({
                id: log._id,
                type: log.errorType,
                message: log.errorMessage,
                time: log.timestamp,
                route: log.route
            }))
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            stack: error.stack 
        });
    }
});

// Direct database check for error logs
app.get('/api/debug/check-logs', async (req, res) => {
    try {
        const logs = await ErrorLog.find().sort({ timestamp: -1 }).limit(20);
        const count = await ErrorLog.countDocuments();
        
        res.json({
            count,
            logs: logs.map(log => ({
                id: log._id,
                type: log.errorType,
                message: log.errorMessage,
                time: log.timestamp,
                route: log.route,
                userId: log.userId,
                userEmail: log.userEmail
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// MongoDB connection check
app.get('/api/debug/mongo-check', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const errorLogCollection = collections.find(c => c.name === 'errorlogs');
        const failedLoginCollection = collections.find(c => c.name === 'failedlogins');
        
        // Try to count documents in each collection
        let errorCount = 0;
        let failedLoginCount = 0;
        
        if (errorLogCollection) {
            errorCount = await ErrorLog.estimatedDocumentCount();
        }
        
        // Check if FailedLogin model exists
        let failedLoginExists = false;
        try {
            if (mongoose.models.FailedLogin) {
                failedLoginExists = true;
                if (failedLoginCollection) {
                    failedLoginCount = await FailedLogin.estimatedDocumentCount();
                }
            }
        } catch (e) {
            console.log('FailedLogin model not available');
        }
        
        res.json({
            connected: mongoose.connection.readyState === 1,
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            collections: collections.map(c => c.name),
            errorLogExists: !!errorLogCollection,
            errorLogCount: errorCount,
            failedLoginExists: failedLoginExists,
            failedLoginCount: failedLoginCount,
            allModels: Object.keys(mongoose.models)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test failed login endpoint
app.get('/api/debug/test-failed-login', async (req, res) => {
    try {
        // Create a test failed login
        const failedLogin = new FailedLogin({
            email: 'test@example.com',
            ip: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Test Agent',
            timestamp: new Date()
        });
        
        await failedLogin.save();
        
        const count = await FailedLogin.countDocuments();
        const recent = await FailedLogin.find().sort({ timestamp: -1 }).limit(5);
        
        res.json({
            success: true,
            message: 'Test failed login created',
            totalCount: count,
            recent: recent.map(l => ({
                email: l.email,
                ip: l.ip,
                time: l.timestamp
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get failed login attempts (admin only)
app.get('/api/admin/failed-logins', adminAuth, async (req, res) => {
  try {
    const { email, page = 1, limit = 50 } = req.query;
    const query = email ? { email: { $regex: email, $options: 'i' } } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const failedLogins = await FailedLogin.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await FailedLogin.countDocuments(query);
    
    res.json({
      failedLogins,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/failed-logins', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN MIDDLEWARE ==========
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [email] = decoded.split(':');

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    await logError(error, 'adminAuth', null, req);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

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
        await logError(error, '/api/geocode/reverse', null, req);
        res.status(500).json({ error: 'Failed to geocode' });
    }
});

// ========== TASK API ROUTES ==========
app.post('/api/tasks', async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        await logError(error, '/api/tasks', null, req);
        res.status(400).json({ error: error.message });
    }
});

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
        await logError(error, '/api/tasks', null, req);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/user/:email', async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.params.email }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        await logError(error, '/api/tasks/user/:email', null, req);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        await logError(error, '/api/tasks/:id', null, req);
        res.status(500).json({ error: error.message });
    }
});

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
        await logError(error, '/api/tasks/:id', null, req);
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        await logError(error, '/api/tasks/:id', null, req);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/status/:status', async (req, res) => {
    try {
        const tasks = await Task.find({ status: req.params.status }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        await logError(error, '/api/tasks/status/:status', null, req);
        res.status(500).json({ error: error.message });
    }
});

// ========== USER API ROUTES ==========
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        await logError(error, '/api/users', null, req);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/email/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        await logError(error, '/api/users/email/:email', null, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { name, email, password, role, initials } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const userInitials = initials || name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const user = new User({
            name,
            email,
            password,
            role: role || 'poster',
            initials: userInitials,
            emailVerified: true,
            adminVerified: true
        });
        
        await user.save();
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json(userResponse);
    } catch (error) {
        await logError(error, '/api/users', null, req);
        res.status(400).json({ error: error.message });
    }
});

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
        await logError(error, '/api/users/:email/profile-image', null, req);
        res.status(400).json({ error: error.message });
    }
});

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
        await logError(error, '/api/users/:email', null, req);
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/users/:email', async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await Task.deleteMany({ userId: req.params.email });
        
        res.json({ message: 'User and associated tasks deleted successfully' });
    } catch (error) {
        await logError(error, '/api/users/:email', null, req);
        res.status(500).json({ error: error.message });
    }
});

// ========== AUTHENTICATION ROUTES ==========
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            // Log failed login attempt
            await new FailedLogin({
                email,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }).save();
            
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (user.password !== password) {
            // Log failed login attempt
            await new FailedLogin({
                email,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }).save();
            
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({
            token,
            user: userResponse
        });
    } catch (error) {
        await logError(error, '/api/auth/login', null, req);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
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
        
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json({
            token,
            user: userResponse
        });
    } catch (error) {
        await logError(error, '/api/auth/register', null, req);
        res.status(400).json({ error: error.message });
    }
});

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
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [email] = decoded.split(':');
        
        const user = await User.findOne({ email }).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        res.json({ valid: true, user });
    } catch (error) {
        await logError(error, '/api/auth/verify', null, req);
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: 'If the email exists, a reset link will be sent' });
        }
        
        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        await logError(error, '/api/auth/forgot-password', null, req);
        res.status(500).json({ error: error.message });
    }
});

// ========== ADMIN API ROUTES ==========

// Get dashboard stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPosters = await User.countDocuments({ role: 'poster' });
    const totalHelpers = await User.countDocuments({ role: 'helper' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    
    const totalTasks = await Task.countDocuments();
    const activeTasks = await Task.countDocuments({ status: { $in: ['active', 'posted'] } });
    const completedTasks = await Task.countDocuments({ status: 'completed' });
    const cancelledTasks = await Task.countDocuments({ status: 'cancelled' });
    
    const pendingVerifications = await VerificationRequest.countDocuments({ status: 'pending' });
    const totalReports = await Report.countDocuments({ status: 'open' });
    const totalErrors = await ErrorLog.countDocuments({ resolved: false });
    
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('-password');
    const recentTasks = await Task.find().sort({ createdAt: -1 }).limit(5);
    
    res.json({
      users: { total: totalUsers, posters: totalPosters, helpers: totalHelpers, admins: totalAdmins },
      tasks: { total: totalTasks, active: activeTasks, completed: completedTasks, cancelled: cancelledTasks },
      system: { pendingVerifications, totalReports, totalErrors },
      recentUsers,
      recentTasks
    });
  } catch (error) {
    await logError(error, '/api/admin/stats', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get all users (admin)
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (role) query.role = role;
    if (status === 'suspended') query.suspended = true;
    if (status === 'banned') query.banned = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/users', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Update user (admin actions)
app.put('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let update = {};
    let activityDetails = { reason, action };
    
    switch (action) {
      case 'suspend':
        update.suspended = true;
        update.suspendedAt = new Date();
        update.suspendedBy = req.user.email;
        update.suspensionReason = reason;
        break;
      case 'unsuspend':
        update.suspended = false;
        update.suspendedAt = null;
        update.suspendedBy = null;
        update.suspensionReason = null;
        break;
      case 'ban':
        update.banned = true;
        update.bannedAt = new Date();
        update.bannedBy = req.user.email;
        update.banReason = reason;
        break;
      case 'unban':
        update.banned = false;
        update.bannedAt = null;
        update.bannedBy = null;
        update.banReason = null;
        break;
      case 'promote':
        update.role = 'admin';
        break;
      case 'demote':
        update.role = 'poster';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password');
    
    // Log admin activity
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action,
      targetType: 'user',
      targetId: userId,
      details: activityDetails,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    res.json(updatedUser);
  } catch (error) {
    await logError(error, '/api/admin/users/:userId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin)
app.delete('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Log before deleting
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: 'delete_user',
      targetType: 'user',
      targetId: userId,
      details: { reason, userEmail: user.email },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    await Task.deleteMany({ userId: user.email });
    await User.findByIdAndDelete(userId);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await logError(error, '/api/admin/users/:userId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks (admin)
app.get('/api/admin/tasks', adminAuth, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { taskDescription: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get user info for each task
    const tasksWithUser = await Promise.all(tasks.map(async (task) => {
      const user = await User.findOne({ email: task.userId }).select('name email');
      return {
        ...task.toObject(),
        poster: user || { name: 'Unknown', email: task.userId }
      };
    }));
    
    const total = await Task.countDocuments(query);
    
    res.json({
      tasks: tasksWithUser,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/tasks', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Update task (admin)
app.put('/api/admin/tasks/:taskId', adminAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, reason } = req.body;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    let update = {};
    let activityDetails = { reason, action };
    
    switch (action) {
      case 'close':
        update.status = 'cancelled';
        break;
      case 'flag':
        update.flagged = true;
        update.flaggedReason = reason;
        update.flaggedBy = req.user.email;
        update.flaggedAt = new Date();
        break;
      case 'unflag':
        update.flagged = false;
        update.flaggedReason = null;
        update.flaggedBy = null;
        update.flaggedAt = null;
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    const updatedTask = await Task.findByIdAndUpdate(taskId, update, { new: true });
    
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action,
      targetType: 'task',
      targetId: taskId,
      details: activityDetails,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    res.json(updatedTask);
  } catch (error) {
    await logError(error, '/api/admin/tasks/:taskId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Delete task (admin)
app.delete('/api/admin/tasks/:taskId', adminAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: 'delete_task',
      targetType: 'task',
      targetId: taskId,
      details: { reason, taskDescription: task.taskDescription },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    await Task.findByIdAndDelete(taskId);
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    await logError(error, '/api/admin/tasks/:taskId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get verification requests
app.get('/api/admin/verifications', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const verifications = await VerificationRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await VerificationRequest.countDocuments(query);
    
    res.json({
      verifications,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/verifications', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Update verification request
app.put('/api/admin/verifications/:requestId', adminAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, rejectionReason } = req.body;
    
    const verification = await VerificationRequest.findById(requestId);
    if (!verification) {
      return res.status(404).json({ error: 'Verification request not found' });
    }
    
    verification.status = status;
    verification.reviewedBy = req.user.email;
    verification.reviewedAt = new Date();
    
    if (status === 'rejected' && rejectionReason) {
      verification.rejectionReason = rejectionReason;
    }
    
    await verification.save();
    
    // Update user verification status
    if (status === 'approved') {
      await User.findOneAndUpdate(
        { email: verification.userEmail },
        { adminVerified: true }
      );
    }
    
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: `verification_${status}`,
      targetType: 'verification',
      targetId: requestId,
      details: { rejectionReason },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    res.json(verification);
  } catch (error) {
    await logError(error, '/api/admin/verifications/:requestId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get reports
app.get('/api/admin/reports', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Report.countDocuments(query);
    
    res.json({
      reports,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/reports', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Update report
app.put('/api/admin/reports/:reportId', adminAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, note } = req.body;
    
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    report.adminActions.push({
      action,
      adminId: req.user._id,
      adminEmail: req.user.email,
      note
    });
    
    if (action === 'resolve') {
      report.status = 'resolved';
    } else if (action === 'dismiss') {
      report.status = 'dismissed';
    }
    
    if (note) {
      report.adminNotes.push(note);
    }
    
    report.updatedAt = new Date();
    await report.save();
    
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: `report_${action}`,
      targetType: 'report',
      targetId: reportId,
      details: { note },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    res.json(report);
  } catch (error) {
    await logError(error, '/api/admin/reports/:reportId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get error logs
app.get('/api/admin/error-logs', adminAuth, async (req, res) => {
  try {
    const { 
      errorType, 
      userId, 
      startDate, 
      endDate, 
      resolved,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const query = {};
    if (errorType) query.errorType = errorType;
    if (userId) query.userId = userId;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const errorTypes = await ErrorLog.distinct('errorType');
    
    const logs = await ErrorLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ErrorLog.countDocuments(query);
    
    res.json({
      logs,
      errorTypes,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/error-logs', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Mark error as resolved
app.put('/api/admin/error-logs/:logId/resolve', adminAuth, async (req, res) => {
  try {
    const { logId } = req.params;
    
    const log = await ErrorLog.findByIdAndUpdate(
      logId, 
      { resolved: true },
      { new: true }
    );
    
    if (!log) {
      return res.status(404).json({ error: 'Error log not found' });
    }
    
    res.json(log);
  } catch (error) {
    await logError(error, '/api/admin/error-logs/:logId/resolve', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get admin activity logs
app.get('/api/admin/activity-logs', adminAuth, async (req, res) => {
  try {
    const { adminId, action, targetType, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (adminId) query.adminId = adminId;
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await AdminActivityLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await AdminActivityLog.countDocuments(query);
    
    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    await logError(error, '/api/admin/activity-logs', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get system settings
app.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    await logError(error, '/api/admin/settings', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Update system settings
app.put('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const updates = req.body;
    updates.updatedBy = req.user.email;
    updates.updatedAt = new Date();
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings(updates);
    } else {
      Object.assign(settings, updates);
    }
    
    await settings.save();
    
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: 'update_settings',
      targetType: 'system',
      details: updates,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await adminActivity.save();
    
    res.json(settings);
  } catch (error) {
    await logError(error, '/api/admin/settings', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Admin dashboard: http://localhost:${port}/admin`);
    console.log(`🔧 Debug endpoints:`);
    console.log(`   - GET /api/debug/test-log`);
    console.log(`   - GET /api/debug/check-logs`);
    console.log(`   - GET /api/debug/mongo-check`);
    console.log(`   - GET /api/debug/test-failed-login`);
    console.log(`Mapbox token configured: ${!!process.env.MAPBOX_ACCESS_TOKEN}`);
    console.log(`MongoDB configured: ${!!process.env.MONGODB_URI}`);
});
