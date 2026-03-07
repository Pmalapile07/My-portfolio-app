const jsonServer = require('json-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

const PORT = process.env.JSON_SERVER_PORT || 3001;
const JWT_SECRET = 'taskmart-test-secret-2024';

// Enable CORS
server.use(cors());

// Use default middlewares (logger, static, cors)
server.use(middlewares);

// Parse body
server.use(jsonServer.bodyParser);

// ========== AUTH ENDPOINTS ==========
server.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, skills } = req.body;
    const db = router.db;
    
    // Check if user exists
    const existingUser = db.get('users').find({ email }).value();
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role: role || 'poster',
      phone,
      initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      createdAt: new Date().toISOString()
    };
    
    // Save to db.json
    db.get('users').push(newUser).write();
    
    // If helper, save helper details
    if (role === 'helper' && skills && skills.length > 0) {
      const newHelper = {
        userId: newUser.id,
        skills: skills,
        rating: 0,
        completedTasks: 0,
        verified: false,
        createdAt: new Date().toISOString()
      };
      db.get('helpers').push(newHelper).write();
    }
    
    // Generate token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = router.db;
    
    // Find user
    const user = db.get('users').find({ email }).value();
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TASK ENDPOINTS ==========
server.get('/api/tasks', (req, res) => {
  try {
    const db = router.db;
    const { status, posterId, helperId } = req.query;
    
    let tasks = db.get('tasks').value() || [];
    
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    
    if (posterId) {
      tasks = tasks.filter(t => t.posterId === posterId);
    }
    
    if (helperId) {
      tasks = tasks.filter(t => t.helperId === helperId);
    }
    
    // Add user details to tasks
    const users = db.get('users').value() || [];
    const helpers = db.get('helpers').value() || [];
    
    const tasksWithDetails = tasks.map(task => {
      const poster = users.find(u => u.id === task.posterId);
      const helper = task.helperId ? users.find(u => u.id === task.helperId) : null;
      const helperDetails = task.helperId ? helpers.find(h => h.userId === task.helperId) : null;
      
      return {
        ...task,
        poster: poster ? { name: poster.name, email: poster.email, initials: poster.initials } : null,
        helper: helper ? { name: helper.name, email: helper.email, initials: helper.initials, skills: helperDetails?.skills } : null
      };
    });
    
    res.json(tasksWithDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.post('/api/tasks', (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.get('/api/tasks/:id', (req, res) => {
  try {
    const db = router.db;
    const task = db.get('tasks').find({ id: req.params.id }).value();
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Add user details
    const users = db.get('users').value() || [];
    const helpers = db.get('helpers').value() || [];
    
    const poster = users.find(u => u.id === task.posterId);
    const helper = task.helperId ? users.find(u => u.id === task.helperId) : null;
    const helperDetails = task.helperId ? helpers.find(h => h.userId === task.helperId) : null;
    
    const taskWithDetails = {
      ...task,
      poster: poster ? { name: poster.name, email: poster.email, initials: poster.initials } : null,
      helper: helper ? { name: helper.name, email: helper.email, initials: helper.initials, skills: helperDetails?.skills } : null
    };
    
    res.json(taskWithDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.put('/api/tasks/:id', (req, res) => {
  try {
    const db = router.db;
    const updates = req.body;
    
    updates.updatedAt = new Date().toISOString();
    
    const task = db.get('tasks').find({ id: req.params.id }).assign(updates).write();
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.delete('/api/tasks/:id', (req, res) => {
  try {
    const db = router.db;
    db.get('tasks').remove({ id: req.params.id }).write();
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== OFFER/APPLICATION ENDPOINTS ==========
server.post('/api/tasks/:taskId/applications', (req, res) => {
  try {
    const db = router.db;
    const { taskId } = req.params;
    const applicationData = req.body;
    
    const task = db.get('tasks').find({ id: taskId }).value();
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const newApplication = {
      id: Date.now().toString(),
      taskId,
      ...applicationData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    db.get('applications').push(newApplication).write();
    
    // Update task's applications array
    task.applications = task.applications || [];
    task.applications.push(newApplication.id);
    db.get('tasks').find({ id: taskId }).assign(task).write();
    
    res.status(201).json(newApplication);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.get('/api/tasks/:taskId/applications', (req, res) => {
  try {
    const db = router.db;
    const { taskId } = req.params;
    
    const applications = db.get('applications').filter({ taskId }).value();
    
    // Add helper details
    const users = db.get('users').value() || [];
    const helpers = db.get('helpers').value() || [];
    
    const applicationsWithDetails = applications.map(app => {
      const helper = users.find(u => u.id === app.helperId);
      const helperDetails = helpers.find(h => h.userId === app.helperId);
      
      return {
        ...app,
        helper: helper ? {
          name: helper.name,
          email: helper.email,
          initials: helper.initials,
          skills: helperDetails?.skills,
          rating: helperDetails?.rating
        } : null
      };
    });
    
    res.json(applicationsWithDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.put('/api/applications/:id', (req, res) => {
  try {
    const db = router.db;
    const { id } = req.params;
    const { status } = req.body;
    
    const application = db.get('applications').find({ id }).value();
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    application.status = status;
    application.updatedAt = new Date().toISOString();
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER ENDPOINTS ==========
server.get('/api/users', (req, res) => {
  try {
    const db = router.db;
    const users = db.get('users').value() || [];
    
    // Remove passwords
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    
    res.json(usersWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.get('/api/users/:id', (req, res) => {
  try {
    const db = router.db;
    const user = db.get('users').find({ id: req.params.id }).value();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password, ...userWithoutPassword } = user;
    
    // If helper, get helper details
    let helperDetails = null;
    if (user.role === 'helper') {
      helperDetails = db.get('helpers').find({ userId: user.id }).value();
    }
    
    res.json({
      ...userWithoutPassword,
      helperDetails
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.get('/api/users/email/:email', (req, res) => {
  try {
    const db = router.db;
    const user = db.get('users').find({ email: req.params.email }).value();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.put('/api/users/:id', (req, res) => {
  try {
    const db = router.db;
    const updates = req.body;
    
    // Don't allow password update through this endpoint
    delete updates.password;
    
    const user = db.get('users').find({ id: req.params.id }).assign(updates).write();
    
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== HELPER ENDPOINTS ==========
server.get('/api/helpers', (req, res) => {
  try {
    const db = router.db;
    const helpers = db.get('helpers').value() || [];
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.get('/api/helpers/:userId', (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.put('/api/helpers/:userId', (req, res) => {
  try {
    const db = router.db;
    const updates = req.body;
    
    const helper = db.get('helpers').find({ userId: req.params.userId }).assign(updates).write();
    
    res.json(helper);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== STATS ENDPOINT ==========
server.get('/api/stats', (req, res) => {
  try {
    const db = router.db;
    
    const users = db.get('users').value() || [];
    const tasks = db.get('tasks').value() || [];
    const helpers = db.get('helpers').value() || [];
    
    const stats = {
      users: {
        total: users.length,
        posters: users.filter(u => u.role === 'poster').length,
        helpers: users.filter(u => u.role === 'helper').length
      },
      tasks: {
        total: tasks.length,
        open: tasks.filter(t => t.status === 'open').length,
        assigned: tasks.filter(t => t.status === 'assigned').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      },
      helpers: {
        total: helpers.length,
        verified: helpers.filter(h => h.verified).length
      }
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use default router for other endpoints
server.use('/api', router);

server.listen(PORT, () => {
  console.log(`✅ JSON Server running on port ${PORT}`);
  console.log(`📝 API URL: http://localhost:${PORT}/api`);
  console.log(`📚 Resources:`);
  console.log(`   - Users: http://localhost:${PORT}/api/users`);
  console.log(`   - Helpers: http://localhost:${PORT}/api/helpers`);
  console.log(`   - Tasks: http://localhost:${PORT}/api/tasks`);
  console.log(`   - Applications: http://localhost:${PORT}/api/applications`);
  console.log(`🔐 Auth endpoints:`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
});
