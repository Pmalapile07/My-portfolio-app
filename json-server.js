const jsonServer = require('json-server');
const cors = require('cors');

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

const PORT = process.env.PORT || 3001; // Use different port from main server

// Enable CORS for all origins
server.use(cors());

// Use default middlewares (logger, static, cors)
server.use(middlewares);

// Parse body
server.use(jsonServer.bodyParser);

// Add timestamps to POST requests
server.use((req, res, next) => {
  if (req.method === 'POST') {
    req.body.createdAt = new Date().toISOString();
    req.body.updatedAt = new Date().toISOString();
  }
  next();
});

// ========== USERS ENDPOINTS ==========
server.get('/api/users', (req, res) => {
  const db = router.db;
  const { email, role } = req.query;
  
  let users = db.get('users').value() || [];
  
  if (email) {
    users = users.filter(u => u.email === email);
  }
  
  if (role) {
    users = users.filter(u => u.role === role);
  }
  
  // Remove passwords from response
  const usersWithoutPasswords = users.map(({ password, ...user }) => user);
  
  res.json(usersWithoutPasswords);
});

server.get('/api/users/:id', (req, res) => {
  const db = router.db;
  const user = db.get('users').find({ id: req.params.id }).value();
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

server.get('/api/users/email/:email', (req, res) => {
  const db = router.db;
  const user = db.get('users').find({ email: req.params.email }).value();
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

server.post('/api/users', (req, res) => {
  const db = router.db;
  const userData = req.body;
  
  // Check if user exists
  const existingUser = db.get('users').find({ email: userData.email }).value();
  if (existingUser) {
    return res.status(400).json({ error: 'Email already exists' });
  }
  
  const newUser = {
    id: Date.now().toString(),
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.get('users').push(newUser).write();
  
  const { password, ...userWithoutPassword } = newUser;
  res.status(201).json(userWithoutPassword);
});

server.put('/api/users/:id', (req, res) => {
  const db = router.db;
  const updates = req.body;
  updates.updatedAt = new Date().toISOString();
  
  // Don't allow password update through this endpoint
  delete updates.password;
  
  const user = db.get('users').find({ id: req.params.id }).assign(updates).write();
  
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

server.delete('/api/users/:id', (req, res) => {
  const db = router.db;
  db.get('users').remove({ id: req.params.id }).write();
  
  // Also remove associated helper data if exists
  db.get('helpers').remove({ userId: req.params.id }).write();
  
  res.json({ message: 'User deleted successfully' });
});

// ========== HELPERS ENDPOINTS ==========
server.get('/api/helpers', (req, res) => {
  const db = router.db;
  const { verified, minRating } = req.query;
  
  let helpers = db.get('helpers').value() || [];
  
  if (verified !== undefined) {
    const isVerified = verified === 'true';
    helpers = helpers.filter(h => h.verified === isVerified);
  }
  
  if (minRating) {
    helpers = helpers.filter(h => (h.rating || 0) >= parseFloat(minRating));
  }
  
  // Add user details to each helper
  const users = db.get('users').value() || [];
  const helpersWithUsers = helpers.map(helper => {
    const user = users.find(u => u.id === helper.userId);
    if (!user) return null;
    
    const { password, ...userWithoutPassword } = user;
    return {
      ...helper,
      user: userWithoutPassword
    };
  }).filter(h => h !== null);
  
  res.json(helpersWithUsers);
});

server.get('/api/helpers/:userId', (req, res) => {
  const db = router.db;
  const helper = db.get('helpers').find({ userId: req.params.userId }).value();
  
  if (!helper) {
    return res.status(404).json({ error: 'Helper not found' });
  }
  
  const user = db.get('users').find({ id: helper.userId }).value();
  const { password, ...userWithoutPassword } = user;
  
  res.json({
    ...helper,
    user: userWithoutPassword
  });
});

server.post('/api/helpers', (req, res) => {
  const db = router.db;
  const helperData = req.body;
  
  // Check if helper already exists
  const existingHelper = db.get('helpers').find({ userId: helperData.userId }).value();
  if (existingHelper) {
    return res.status(400).json({ error: 'Helper already exists' });
  }
  
  const newHelper = {
    id: Date.now().toString(),
    ...helperData,
    rating: 0,
    completedTasks: 0,
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.get('helpers').push(newHelper).write();
  res.status(201).json(newHelper);
});

server.put('/api/helpers/:userId', (req, res) => {
  const db = router.db;
  const updates = req.body;
  updates.updatedAt = new Date().toISOString();
  
  const helper = db.get('helpers').find({ userId: req.params.userId }).assign(updates).write();
  res.json(helper);
});

// ========== TASKS ENDPOINTS ==========
server.get('/api/tasks', (req, res) => {
  const db = router.db;
  const { posterEmail, posterId, helperId, status, category } = req.query;
  
  let tasks = db.get('tasks').value() || [];
  
  if (posterEmail) {
    tasks = tasks.filter(t => t.posterEmail === posterEmail);
  }
  
  if (posterId) {
    tasks = tasks.filter(t => t.posterId === posterId);
  }
  
  if (helperId) {
    tasks = tasks.filter(t => t.helperId === helperId);
  }
  
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }
  
  if (category) {
    tasks = tasks.filter(t => t.category && t.category.toLowerCase().includes(category.toLowerCase()));
  }
  
  // Add user details to tasks
  const users = db.get('users').value() || [];
  const helpers = db.get('helpers').value() || [];
  
  const tasksWithDetails = tasks.map(task => {
    const poster = users.find(u => u.id === task.posterId || u.email === task.posterEmail);
    const helper = task.helperId ? users.find(u => u.id === task.helperId || u.email === task.helperId) : null;
    const helperDetails = task.helperId ? helpers.find(h => h.userId === task.helperId) : null;
    
    return {
      ...task,
      poster: poster ? { 
        name: poster.name, 
        email: poster.email, 
        initials: poster.initials,
        profileImage: poster.profileImage 
      } : null,
      helper: helper ? { 
        name: helper.name, 
        email: helper.email, 
        initials: helper.initials,
        skills: helperDetails?.skills,
        rating: helperDetails?.rating
      } : null
    };
  });
  
  // Sort by newest first
  tasksWithDetails.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });
  
  res.json(tasksWithDetails);
});

server.post('/api/tasks', (req, res) => {
  const db = router.db;
  const taskData = req.body;
  
  const newTask = {
    id: Date.now().toString(),
    ...taskData,
    status: taskData.status || 'open',
    applications: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.get('tasks').push(newTask).write();
  res.status(201).json(newTask);
});

server.get('/api/tasks/:id', (req, res) => {
  const db = router.db;
  const task = db.get('tasks').find({ id: req.params.id }).value();
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  // Add user details
  const users = db.get('users').value() || [];
  const helpers = db.get('helpers').value() || [];
  
  const poster = users.find(u => u.id === task.posterId || u.email === task.posterEmail);
  const helper = task.helperId ? users.find(u => u.id === task.helperId || u.email === task.helperId) : null;
  const helperDetails = task.helperId ? helpers.find(h => h.userId === task.helperId) : null;
  
  const taskWithDetails = {
    ...task,
    poster: poster ? { 
      name: poster.name, 
      email: poster.email, 
      initials: poster.initials,
      profileImage: poster.profileImage 
    } : null,
    helper: helper ? { 
      name: helper.name, 
      email: helper.email, 
      initials: helper.initials,
      skills: helperDetails?.skills,
      rating: helperDetails?.rating
    } : null
  };
  
  res.json(taskWithDetails);
});

server.put('/api/tasks/:id', (req, res) => {
  const db = router.db;
  const updates = req.body;
  updates.updatedAt = new Date().toISOString();
  
  const task = db.get('tasks').find({ id: req.params.id }).assign(updates).write();
  res.json(task);
});

server.delete('/api/tasks/:id', (req, res) => {
  const db = router.db;
  db.get('tasks').remove({ id: req.params.id }).write();
  
  // Also remove associated applications
  db.get('applications').remove({ taskId: req.params.id }).write();
  
  res.json({ message: 'Task deleted successfully' });
});

// ========== APPLICATIONS / OFFERS ENDPOINTS ==========
server.get('/api/applications', (req, res) => {
  const db = router.db;
  const { taskId, helperId, status } = req.query;
  
  let applications = db.get('applications').value() || [];
  
  if (taskId) {
    applications = applications.filter(a => a.taskId === taskId);
  }
  
  if (helperId) {
    applications = applications.filter(a => a.helperId === helperId);
  }
  
  if (status) {
    applications = applications.filter(a => a.status === status);
  }
  
  // Add helper details
  const users = db.get('users').value() || [];
  const helpers = db.get('helpers').value() || [];
  
  const applicationsWithDetails = applications.map(app => {
    const helper = users.find(u => u.id === app.helperId || u.email === app.helperId);
    const helperDetails = helpers.find(h => h.userId === app.helperId);
    
    return {
      ...app,
      helper: helper ? {
        name: helper.name,
        email: helper.email,
        initials: helper.initials,
        profileImage: helper.profileImage,
        skills: helperDetails?.skills,
        rating: helperDetails?.rating
      } : null
    };
  });
  
  res.json(applicationsWithDetails);
});

server.post('/api/applications', (req, res) => {
  const db = router.db;
  const applicationData = req.body;
  
  const task = db.get('tasks').find({ id: applicationData.taskId }).value();
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  // Check if helper already applied
  const existingApplication = db.get('applications')
    .find({ taskId: applicationData.taskId, helperId: applicationData.helperId })
    .value();
    
  if (existingApplication) {
    return res.status(400).json({ error: 'You have already applied to this task' });
  }
  
  const newApplication = {
    id: Date.now().toString(),
    ...applicationData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.get('applications').push(newApplication).write();
  
  // Update task's applications array
  task.applications = task.applications || [];
  task.applications.push(newApplication.id);
  db.get('tasks').find({ id: applicationData.taskId }).assign(task).write();
  
  res.status(201).json(newApplication);
});

server.put('/api/applications/:id', (req, res) => {
  const db = router.db;
  const { id } = req.params;
  const { status, counterAmount } = req.body;
  
  const application = db.get('applications').find({ id }).value();
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  
  application.status = status;
  application.updatedAt = new Date().toISOString();
  
  if (counterAmount) {
    application.counterAmount = counterAmount;
  }
  
  db.get('applications').find({ id }).assign(application).write();
  
  // If accepted, update task status and assign helper
  if (status === 'accepted') {
    const task = db.get('tasks').find({ id: application.taskId }).value();
    if (task) {
      task.status = 'assigned';
      task.helperId = application.helperId;
      task.updatedAt = new Date().toISOString();
      db.get('tasks').find({ id: application.taskId }).assign(task).write();
    }
  }
  
  res.json(application);
});

server.delete('/api/applications/:id', (req, res) => {
  const db = router.db;
  const { id } = req.params;
  
  const application = db.get('applications').find({ id }).value();
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  
  // Remove from task's applications array
  const task = db.get('tasks').find({ id: application.taskId }).value();
  if (task && task.applications) {
    task.applications = task.applications.filter(appId => appId !== id);
    db.get('tasks').find({ id: application.taskId }).assign(task).write();
  }
  
  db.get('applications').remove({ id }).write();
  res.json({ message: 'Application deleted successfully' });
});

// ========== STATS ENDPOINT ==========
server.get('/api/stats', (req, res) => {
  const db = router.db;
  
  const users = db.get('users').value() || [];
  const helpers = db.get('helpers').value() || [];
  const tasks = db.get('tasks').value() || [];
  const applications = db.get('applications').value() || [];
  
  const stats = {
    users: {
      total: users.length,
      posters: users.filter(u => u.role === 'poster').length,
      helpers: users.filter(u => u.role === 'helper').length,
      admins: users.filter(u => u.role === 'admin').length,
      verified: users.filter(u => u.adminVerified).length
    },
    helpers: {
      total: helpers.length,
      verified: helpers.filter(h => h.verified).length,
      averageRating: helpers.reduce((sum, h) => sum + (h.rating || 0), 0) / (helpers.length || 1),
      totalCompletedTasks: helpers.reduce((sum, h) => sum + (h.completedTasks || 0), 0)
    },
    tasks: {
      total: tasks.length,
      open: tasks.filter(t => t.status === 'open').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    },
    applications: {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      accepted: applications.filter(a => a.status === 'accepted').length,
      rejected: applications.filter(a => a.status === 'rejected').length
    }
  };
  
  res.json(stats);
});

// ========== SEARCH ENDPOINTS ==========
server.get('/api/search/tasks', (req, res) => {
  const db = router.db;
  const { q, lat, lng, radius } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  let tasks = db.get('tasks').value() || [];
  
  // Filter by search query
  const query = q.toLowerCase();
  tasks = tasks.filter(task => 
    (task.category && task.category.toLowerCase().includes(query)) ||
    (task.description && task.description.toLowerCase().includes(query)) ||
    (task.address && task.address.toLowerCase().includes(query))
  );
  
  // Filter by status
  tasks = tasks.filter(task => task.status === 'open');
  
  // Filter by location if provided
  if (lat && lng && radius) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxDistance = parseFloat(radius);
    
    tasks = tasks.filter(task => {
      if (!task.location || !task.location.lat || !task.location.lng) return false;
      
      const distance = calculateDistance(
        userLat, userLng,
        task.location.lat, task.location.lng
      );
      
      return distance <= maxDistance;
    });
  }
  
  res.json(tasks);
});

// Helper function to calculate distance between coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ========== HEALTH CHECK ==========
server.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/users',
      '/api/helpers',
      '/api/tasks',
      '/api/applications',
      '/api/stats',
      '/api/search/tasks'
    ]
  });
});

// Use default router for other endpoints
server.use('/api', router);

// Error handling middleware
server.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ JSON Server is running on port ${PORT}`);
  console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
  console.log('\n📚 Available endpoints:');
  console.log('   👤 Users:');
  console.log(`     - GET    /api/users`);
  console.log(`     - GET    /api/users/:id`);
  console.log(`     - GET    /api/users/email/:email`);
  console.log(`     - POST   /api/users`);
  console.log(`     - PUT    /api/users/:id`);
  console.log(`     - DELETE /api/users/:id`);
  console.log('\n   🦸 Helpers:');
  console.log(`     - GET    /api/helpers`);
  console.log(`     - GET    /api/helpers/:userId`);
  console.log(`     - POST   /api/helpers`);
  console.log(`     - PUT    /api/helpers/:userId`);
  console.log('\n   📋 Tasks:');
  console.log(`     - GET    /api/tasks`);
  console.log(`     - GET    /api/tasks/:id`);
  console.log(`     - POST   /api/tasks`);
  console.log(`     - PUT    /api/tasks/:id`);
  console.log(`     - DELETE /api/tasks/:id`);
  console.log('\n   📝 Applications:');
  console.log(`     - GET    /api/applications`);
  console.log(`     - POST   /api/applications`);
  console.log(`     - PUT    /api/applications/:id`);
  console.log(`     - DELETE /api/applications/:id`);
  console.log('\n   🔍 Search:');
  console.log(`     - GET    /api/search/tasks?q=query&lat=&lng=&radius=`);
  console.log('\n   📊 Stats:');
  console.log(`     - GET    /api/stats`);
  console.log(`   🏥 Health:`);
  console.log(`     - GET    /api/health`);
});
