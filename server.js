const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 3000;

// ========== CLOUDINARY CONFIGURATION ==========
console.log('☁️ Configuring Cloudinary with:');
console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API key length:', process.env.CLOUDINARY_API_KEY?.length);
console.log('API secret length:', process.env.CLOUDINARY_API_SECRET?.length);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Test Cloudinary configuration
cloudinary.api.ping()
  .then(result => console.log('✅ Cloudinary connected successfully'))
  .catch(error => console.error('❌ Cloudinary connection failed:', error));

// ========== MULTER CONFIGURATION (memory storage) ==========
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmart';
mongoose.connect(MONGODB_URI).then(() => console.log('✅ Connected to MongoDB')).catch(err => console.error('❌ MongoDB connection error:', err));

// ========== SCHEMAS ==========
const taskSchema = new mongoose.Schema({
  location: String,
  coordinates: String,
  streetName: String,
  when: { type: String, enum: ['now', 'later'] },
  scheduledDate: String,
  scheduledTime: String,
  taskDescription: String,
  budgetType: { type: String, enum: ['fixed', 'open'] },
  budgetAmount: Number,
  paymentMethod: { type: String, enum: ['cash', 'online'] },
  moreDetails: String,
  images: [String], // Cloudinary URLs
  userId: String,
  userName: String,
  userAvatar: String, // Cloudinary URL of user's profile picture
  status: { type: String, enum: ['draft', 'posted', 'in-progress', 'completed', 'active', 'cancelled'], default: 'posted' },
  createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', taskSchema);

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['poster', 'helper', 'admin'] },
  initials: String,
  emailVerified: { type: Boolean, default: true },
  photoUploaded: { type: Boolean, default: false },
  adminVerified: { type: Boolean, default: false }, // Changed default to false
  profileImage: String, // Cloudinary URL
  profileImagePublicId: String, // For deleting/updating images
  suspended: { type: Boolean, default: false },
  suspendedAt: Date,
  suspendedBy: String,
  suspensionReason: String,
  banned: { type: Boolean, default: false },
  bannedAt: Date,
  bannedBy: String,
  banReason: String,
  lastLogin: Date,
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'not_requested'], default: 'not_requested' },
  verificationRequested: { type: Boolean, default: false },
  verificationRequestedAt: Date,
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const errorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  errorType: String,
  errorMessage: String,
  stackTrace: String,
  route: String,
  userId: String,
  userEmail: String,
  method: String,
  ip: String,
  userAgent: String,
  resolved: { type: Boolean, default: false }
});
const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);

const failedLoginSchema = new mongoose.Schema({
  email: String,
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});
const FailedLogin = mongoose.model('FailedLogin', failedLoginSchema);

const adminActivitySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  adminId: String,
  adminEmail: String,
  action: String,
  targetType: { type: String, enum: ['user', 'task', 'verification', 'report', 'system'] },
  targetId: String,
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
});
const AdminActivityLog = mongoose.model('AdminActivityLog', adminActivitySchema);

const reportSchema = new mongoose.Schema({
  reporterId: String,
  reporterEmail: String,
  reportedUserId: String,
  reportedUserEmail: String,
  reason: String,
  description: String,
  status: { type: String, enum: ['open', 'resolved', 'dismissed'] },
  adminNotes: [String],
  adminActions: [{
    action: String,
    adminId: String,
    adminEmail: String,
    timestamp: Date,
    note: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);

const verificationRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  userName: String,
  userRole: String,
  idType: { type: String, enum: ['passport', 'drivers_license', 'national_id'] },
  idImage: String, // Cloudinary URL
  selfieImage: String, // Cloudinary URL
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: String,
  reviewedBy: String,
  reviewedAt: Date,
  createdAt: { type: Date, default: Date.now },
  notes: String
});
const VerificationRequest = mongoose.model('VerificationRequest', verificationRequestSchema);

const systemSettingsSchema = new mongoose.Schema({
  maintenanceMode: { type: Boolean, default: false },
  devMode: { type: Boolean, default: false },
  platformFee: { type: Number, default: 5 },
  registrationsEnabled: { type: Boolean, default: true },
  updatedBy: String,
  updatedAt: { type: Date, default: Date.now }
});
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// ========== CLOUDINARY UPLOAD HELPER ==========
async function uploadToCloudinary(fileBuffer, folder, publicId = null) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: `taskmart/${folder}`,
      resource_type: 'auto',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }, // Limit size
        { quality: 'auto:good' } // Optimize quality
      ]
    };
    
    if (publicId) {
      uploadOptions.public_id = publicId;
    }
    
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    uploadStream.end(fileBuffer);
  });
}

// ========== ROUTES ==========
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.MAPBOX_TOKEN='${process.env.MAPBOX_ACCESS_TOKEN}';`);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    token_set: !!process.env.MAPBOX_ACCESS_TOKEN,
    mongodb_connected: mongoose.connection.readyState === 1,
    cloudinary_configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Decode token to get email
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [email] = decoded.split(':');
    
    if (!email) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ========== CLOUDINARY UPLOAD ENDPOINTS ==========
// Upload profile picture
app.post('/api/upload/profile', upload.single('image'), authMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const user = req.user;
    console.log('📧 Uploading profile for user:', user.email);
    
    // Delete old profile image if exists
    if (user.profileImagePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profileImagePublicId);
        console.log('🗑️ Deleted old image:', user.profileImagePublicId);
      } catch (deleteError) {
        console.log('Error deleting old image:', deleteError);
      }
    }
    
    // Upload new image
    console.log('☁️ Uploading to Cloudinary...');
    const result = await uploadToCloudinary(req.file.buffer, 'profiles');
    console.log('✅ Uploaded to Cloudinary:', result.secure_url);
    
    // Update user
    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    user.photoUploaded = true;
    await user.save();
    
    res.json({ 
      url: result.secure_url,
      public_id: result.public_id,
      message: 'Profile picture uploaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    await logError(error, '/api/upload/profile', req.user?._id, req);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Upload task images
app.post('/api/upload/task-image', upload.single('image'), authMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const result = await uploadToCloudinary(req.file.buffer, 'tasks');
    
    res.json({ 
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (error) {
    await logError(error, '/api/upload/task-image', req.user?._id, req);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Upload multiple task images
app.post('/api/upload/task-images', upload.array('images', 5), authMiddleware, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }
    
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.buffer, 'tasks')
    );
    
    const results = await Promise.all(uploadPromises);
    
    res.json({ 
      urls: results.map(r => r.secure_url),
      public_ids: results.map(r => r.public_id)
    });
  } catch (error) {
    await logError(error, '/api/upload/task-images', req.user?._id, req);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Delete image from Cloudinary
app.post('/api/delete-image', authMiddleware, async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ error: 'Public ID is required' });
    }
    
    const result = await cloudinary.uploader.destroy(public_id);
    res.json({ result, message: 'Image deleted successfully' });
  } catch (error) {
    await logError(error, '/api/delete-image', req.user?._id, req);
    res.status(500).json({ error: 'Delete failed: ' + error.message });
  }
});

// ========== ERROR LOGGING ==========
async function logError(error, route, userId = null, req = null) {
  try {
    console.log('📝 Logging error:', error.message);
    const errorLog = new ErrorLog({
      errorType: error.name || 'UnknownError',
      errorMessage: error.message || String(error),
      stackTrace: error.stack,
      route,
      userId: userId || req?.user?._id || req?.user?.email || 'unknown',
      userEmail: req?.user?.email,
      method: req?.method,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      resolved: false
    });
    const saved = await errorLog.save();
    console.log('✅ Error logged:', saved._id);
  } catch (e) {
    console.error('❌ Failed to log error:', e);
  }
}

// ========== DEBUG ROUTES ==========
app.get('/api/debug/test-log', async (req, res) => {
  try {
    const testError = new Error('TEST DEBUG LOG - ' + new Date().toISOString());
    testError.name = 'TestError';
    await logError(testError, '/debug/test', 'test-user', req);
    const totalLogs = await ErrorLog.countDocuments();
    const recentLogs = await ErrorLog.find().sort({ timestamp: -1 }).limit(5);
    res.json({ 
      success: true, 
      message: 'Test log created', 
      totalLogs, 
      recentLogs: recentLogs.map(l => ({ 
        id: l._id, 
        type: l.errorType, 
        message: l.errorMessage, 
        time: l.timestamp 
      })) 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/check-logs', async (req, res) => {
  try {
    const logs = await ErrorLog.find().sort({ timestamp: -1 }).limit(20);
    const count = await ErrorLog.countDocuments();
    res.json({ 
      count, 
      logs: logs.map(l => ({ 
        id: l._id, 
        type: l.errorType, 
        message: l.errorMessage, 
        time: l.timestamp, 
        route: l.route, 
        userId: l.userId 
      })) 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/mongo-check', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const errorLogCollection = collections.find(c => c.name === 'errorlogs');
    const failedLoginCollection = collections.find(c => c.name === 'failedlogins');
    const verificationCollection = collections.find(c => c.name === 'verificationrequests');
    let errorCount = 0, failedLoginCount = 0, verificationCount = 0;
    if (errorLogCollection) errorCount = await ErrorLog.estimatedDocumentCount();
    if (failedLoginCollection) failedLoginCount = await FailedLogin.estimatedDocumentCount();
    if (verificationCollection) verificationCount = await VerificationRequest.estimatedDocumentCount();
    
    res.json({
      connected: mongoose.connection.readyState === 1,
      database: mongoose.connection.name,
      collections: collections.map(c => c.name),
      errorLogExists: !!errorLogCollection,
      errorLogCount: errorCount,
      failedLoginExists: !!failedLoginCollection,
      failedLoginCount: failedLoginCount,
      verificationExists: !!verificationCollection,
      verificationCount: verificationCount,
      allModels: Object.keys(mongoose.models)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/test-failed-login', async (req, res) => {
  try {
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

// ========== ADMIN MIDDLEWARE ==========
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [email] = decoded.split(':');
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = user;
    next();
  } catch (error) {
    await logError(error, 'adminAuth', null, req);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ========== AUTH ROUTES ==========
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      await new FailedLogin({ email, ip: req.ip, userAgent: req.headers['user-agent'] }).save();
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.password !== password) {
      await new FailedLogin({ email, ip: req.ip, userAgent: req.headers['user-agent'] }).save();
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json({ token, user: userResponse });
  } catch (error) {
    await logError(error, '/api/auth/login', null, req);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const user = new User({ 
      name, 
      email, 
      password, 
      role: role || 'poster', 
      initials, 
      emailVerified: true, 
      adminVerified: false, // Default to false for new users
      verificationStatus: 'not_requested',
      verificationRequested: false
    });
    await user.save();
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(201).json({ token, user: userResponse });
  } catch (error) {
    await logError(error, '/api/auth/register', null, req);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });
  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [email] = decoded.split(':');
    const user = await User.findOne({ email }).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ valid: true, user });
  } catch (error) {
    await logError(error, '/api/auth/verify', null, req);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ========== TASK ROUTES ==========
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
    const tasks = await Task.find(email ? { userId: email } : {}).sort({ createdAt: -1 });
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
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    await logError(error, '/api/tasks/:id', null, req);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    await logError(error, '/api/tasks/:id', null, req);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    await logError(error, '/api/tasks/:id', null, req);
    res.status(500).json({ error: error.message });
  }
});

// ========== USER ROUTES ==========
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
    if (!user) return res.status(404).json({ error: 'User not found' });
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
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    const userInitials = initials || name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const user = new User({ 
      name, 
      email, 
      password, 
      role: role || 'poster', 
      initials: userInitials, 
      emailVerified: true, 
      adminVerified: false,
      verificationStatus: 'not_requested',
      verificationRequested: false
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

app.put('/api/users/:email', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: req.params.email }, 
      req.body, 
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    await logError(error, '/api/users/:email', null, req);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:email', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await Task.deleteMany({ userId: req.params.email });
    res.json({ message: 'User and associated tasks deleted successfully' });
  } catch (error) {
    await logError(error, '/api/users/:email', null, req);
    res.status(500).json({ error: error.message });
  }
});

// ========== VERIFICATION REQUEST ROUTES ==========
// User requests verification
app.post('/api/users/:email/verify', authMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    
    // Verify the authenticated user matches the email
    if (req.user.email !== email) {
      return res.status(403).json({ error: 'You can only request verification for your own account' });
    }

    const user = req.user;

    // Check if user has profile image
    if (!user.profileImage) {
      return res.status(400).json({ error: 'Profile image is required for verification' });
    }

    // Check if already verified
    if (user.adminVerified) {
      return res.status(400).json({ error: 'User already verified' });
    }

    // Check if there's already a pending request
    const existingRequest = await VerificationRequest.findOne({ 
      userEmail: email, 
      status: 'pending' 
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Verification request already pending' });
    }

    // Check if rejected recently (you can adjust the time window)
    const rejectedRequest = await VerificationRequest.findOne({ 
      userEmail: email, 
      status: 'rejected' 
    }).sort({ createdAt: -1 });

    if (rejectedRequest) {
      const daysSinceRejection = (new Date() - rejectedRequest.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceRejection < 7) {
        return res.status(400).json({ 
          error: 'Your previous verification was rejected. Please wait 7 days before reapplying.',
          rejectionReason: rejectedRequest.rejectionReason
        });
      }
    }

    // Create verification request using profile image as ID document
    const verificationRequest = new VerificationRequest({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      idType: 'national_id',
      idImage: user.profileImage, // Use profile image as ID document
      status: 'pending',
      createdAt: new Date()
    });

    await verificationRequest.save();

    // Update user status
    user.verificationStatus = 'pending';
    user.verificationRequested = true;
    user.verificationRequestedAt = new Date();
    await user.save();

    res.json({ 
      success: true, 
      message: 'Verification request submitted successfully',
      requestId: verificationRequest._id
    });

  } catch (error) {
    await logError(error, '/api/users/:email/verify', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Get user's verification status
app.get('/api/users/:email/verification-status', authMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    
    if (req.user.email !== email && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = req.user;
    const verificationRequest = await VerificationRequest.findOne({ 
      userEmail: email 
    }).sort({ createdAt: -1 });

    res.json({
      adminVerified: user.adminVerified,
      verificationStatus: user.verificationStatus || 'not_requested',
      verificationRequested: user.verificationRequested || false,
      hasProfileImage: !!user.profileImage,
      currentRequest: verificationRequest ? {
        status: verificationRequest.status,
        submittedAt: verificationRequest.createdAt,
        rejectionReason: verificationRequest.rejectionReason
      } : null
    });

  } catch (error) {
    await logError(error, '/api/users/:email/verification-status', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN ROUTES ==========
app.get('/api/admin/failed-logins', adminAuth, async (req, res) => {
  try {
    const { email, page = 1, limit = 50 } = req.query;
    const query = email ? { email: { $regex: email, $options: 'i' } } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const failedLogins = await FailedLogin.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit));
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
    const unverifiedUsers = await User.countDocuments({ 
      adminVerified: false, 
      role: { $ne: 'admin' } 
    });
    const usersWithPhotos = await User.countDocuments({ 
      profileImage: { $ne: null },
      role: { $ne: 'admin' }
    });
    
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('-password');
    const recentTasks = await Task.find().sort({ createdAt: -1 }).limit(5);
    
    res.json({
      users: { 
        total: totalUsers, 
        posters: totalPosters, 
        helpers: totalHelpers, 
        admins: totalAdmins,
        unverified: unverifiedUsers,
        withPhotos: usersWithPhotos
      },
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

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { role, status, search, verified, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (role) query.role = role;
    if (status === 'suspended') query.suspended = true;
    if (status === 'banned') query.banned = true;
    if (verified === 'true') query.adminVerified = true;
    if (verified === 'false') query.adminVerified = false;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
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

app.get('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Get verification requests for this user
    const verificationRequests = await VerificationRequest.find({ 
      userEmail: user.email 
    }).sort({ createdAt: -1 });
    
    res.json({
      ...user.toObject(),
      verificationRequests
    });
  } catch (error) {
    await logError(error, '/api/admin/users/:userId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, reason, adminVerified, verificationStatus, rejectionReason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    let update = {};
    let activityDetails = { reason, action };
    
    if (action) {
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
    }
    
    // Handle verification status update
    if (adminVerified !== undefined || verificationStatus) {
      update.adminVerified = adminVerified !== undefined ? adminVerified : verificationStatus === 'approved';
      update.verificationStatus = verificationStatus || (adminVerified ? 'approved' : user.verificationStatus);
      
      // If approving, update any pending verification request
      if (update.adminVerified) {
        await VerificationRequest.updateMany(
          { userEmail: user.email, status: 'pending' },
          { 
            status: 'approved', 
            reviewedBy: req.user.email,
            reviewedAt: new Date()
          }
        );
      }
      
      // If rejecting, update the latest pending request
      if (verificationStatus === 'rejected' && rejectionReason) {
        update.rejectionReason = rejectionReason;
        const pendingRequest = await VerificationRequest.findOne({ 
          userEmail: user.email, 
          status: 'pending' 
        }).sort({ createdAt: -1 });
        
        if (pendingRequest) {
          pendingRequest.status = 'rejected';
          pendingRequest.rejectionReason = rejectionReason;
          pendingRequest.reviewedBy = req.user.email;
          pendingRequest.reviewedAt = new Date();
          await pendingRequest.save();
        }
      }
    }
    
    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password');
    
    const adminActivity = new AdminActivityLog({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: action || 'update_verification',
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

app.delete('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
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
    await VerificationRequest.deleteMany({ userEmail: user.email });
    await User.findByIdAndDelete(userId);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await logError(error, '/api/admin/users/:userId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

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
    const tasks = await Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const tasksWithUser = await Promise.all(tasks.map(async (task) => {
      const user = await User.findOne({ email: task.userId }).select('name email profileImage role');
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

app.put('/api/admin/tasks/:taskId', adminAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, reason } = req.body;
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
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

app.delete('/api/admin/tasks/:taskId', adminAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
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

// ========== VERIFICATION REQUESTS ADMIN ROUTES ==========
app.get('/api/admin/verificationrequests', adminAuth, async (req, res) => {
  try {
    const { status, userRole, search, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (userRole) query.userRole = userRole;
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }
    
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
    await logError(error, '/api/admin/verificationrequests', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/verificationrequests/:requestId', adminAuth, async (req, res) => {
  try {
    const verification = await VerificationRequest.findById(req.params.requestId);
    if (!verification) return res.status(404).json({ error: 'Verification request not found' });
    
    // Get user details
    const user = await User.findOne({ email: verification.userEmail }).select('-password');
    
    res.json({
      ...verification.toObject(),
      user
    });
  } catch (error) {
    await logError(error, '/api/admin/verificationrequests/:requestId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/verificationrequests/:requestId', adminAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, rejectionReason } = req.body;
    
    const verification = await VerificationRequest.findById(requestId);
    if (!verification) return res.status(404).json({ error: 'Verification request not found' });
    
    verification.status = status;
    verification.reviewedBy = req.user.email;
    verification.reviewedAt = new Date();
    if (status === 'rejected' && rejectionReason) {
      verification.rejectionReason = rejectionReason;
    }
    await verification.save();
    
    // Update user verification status
    const user = await User.findOne({ email: verification.userEmail });
    if (user) {
      if (status === 'approved') {
        user.adminVerified = true;
        user.verificationStatus = 'approved';
      } else if (status === 'rejected') {
        user.verificationStatus = 'rejected';
        user.rejectionReason = rejectionReason;
      }
      await user.save();
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
    await logError(error, '/api/admin/verificationrequests/:requestId', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

// Also keep the old endpoint for backward compatibility
app.get('/api/admin/verifications', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const verifications = await VerificationRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
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

app.put('/api/admin/verifications/:requestId', adminAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, rejectionReason } = req.body;
    const verification = await VerificationRequest.findById(requestId);
    if (!verification) return res.status(404).json({ error: 'Verification request not found' });
    verification.status = status;
    verification.reviewedBy = req.user.email;
    verification.reviewedAt = new Date();
    if (status === 'rejected' && rejectionReason) verification.rejectionReason = rejectionReason;
    await verification.save();
    if (status === 'approved') {
      await User.findOneAndUpdate({ email: verification.userEmail }, { adminVerified: true });
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

// ========== REPORTS ROUTES ==========
app.get('/api/admin/reports', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reports = await Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
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

app.put('/api/admin/reports/:reportId', adminAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, note } = req.body;
    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.adminActions.push({
      action,
      adminId: req.user._id,
      adminEmail: req.user.email,
      timestamp: new Date(),
      note
    });
    if (action === 'resolve') report.status = 'resolved';
    else if (action === 'dismiss') report.status = 'dismissed';
    if (note) report.adminNotes.push(note);
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

app.get('/api/admin/error-logs', adminAuth, async (req, res) => {
  try {
    const { errorType, userId, startDate, endDate, resolved, page = 1, limit = 50 } = req.query;
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
    const logs = await ErrorLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit));
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

app.put('/api/admin/error-logs/:logId/resolve', adminAuth, async (req, res) => {
  try {
    const { logId } = req.params;
    const log = await ErrorLog.findByIdAndUpdate(logId, { resolved: true }, { new: true });
    if (!log) return res.status(404).json({ error: 'Error log not found' });
    res.json(log);
  } catch (error) {
    await logError(error, '/api/admin/error-logs/:logId/resolve', req.user?._id, req);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/activity-logs', adminAuth, async (req, res) => {
  try {
    const { adminId, action, targetType, page = 1, limit = 50 } = req.query;
    const query = {};
    if (adminId) query.adminId = adminId;
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AdminActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit));
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

app.put('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const updates = req.body;
    updates.updatedBy = req.user.email;
    updates.updatedAt = new Date();
    let settings = await SystemSettings.findOne();
    if (!settings) settings = new SystemSettings(updates);
    else Object.assign(settings, updates);
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
  console.log(`📊 Admin: http://localhost:${port}/admin`);
  console.log(`☁️ Cloudinary configured for: ${process.env.CLOUDINARY_CLOUD_NAME || 'not set'}`);
  console.log(`🔧 Debug endpoints:`);
  console.log(`   - GET /api/debug/test-log`);
  console.log(`   - GET /api/debug/check-logs`);
  console.log(`   - GET /api/debug/mongo-check`);
  console.log(`   - GET /api/debug/test-failed-login`);
});
