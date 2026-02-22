const express=require('express');const cors=require('cors');const axios=require('axios');const path=require('path');const mongoose=require('mongoose');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const rateLimit=require('express-rate-limit');const helmet=require('helmet');const mongoSanitize=require('express-mongo-sanitize');const xss=require('xss-clean');const compression=require('compression');const {body,validationResult}=require('express-validator');
const app=express();const port=process.env.PORT||3000;const JWT_SECRET=process.env.JWT_SECRET||'your-super-secret-jwt-key-change-this';const SALT_ROUNDS=10;

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet());app.use(mongoSanitize());app.use(xss());app.use(compression());
const limiter=rateLimit({windowMs:15*60*1000,max:100,message:'Too many requests from this IP'});
app.use('/api',limiter);
const authLimiter=rateLimit({windowMs:60*60*1000,max:10,message:'Too many auth attempts'});
app.use('/api/auth',authLimiter);

app.use(cors({origin:process.env.CLIENT_URL||'*',credentials:true}));
app.use(express.json({limit:'10mb'}));app.use(express.static(__dirname));

// ========== WINSTON LOGGER ==========
const logger=winston.createLogger({level:'info',format:winston.format.json(),transports:[new winston.transports.File({filename:'error.log',level:'error'}),new winston.transports.File({filename:'combined.log'})]});
if(process.env.NODE_ENV!=='production'){logger.add(new winston.transports.Console({format:winston.format.simple()}));}

// ========== MONGODB CONNECTION ==========
const MONGODB_URI=process.env.MONGODB_URI||'mongodb://localhost:27017/taskmart';
mongoose.connect(MONGODB_URI,{useNewUrlParser:true,useUnifiedTopology:true}).then(()=>console.log('✅ Connected to MongoDB')).catch(err=>console.error('❌ MongoDB connection error:',err));

// ========== SCHEMAS ==========
const taskSchema=new mongoose.Schema({location:{type:String,required:true},coordinates:String,streetName:String,when:{type:String,enum:['now','later']},scheduledDate:String,scheduledTime:String,taskDescription:{type:String,required:true},budgetType:{type:String,enum:['fixed','open']},budgetAmount:Number,paymentMethod:{type:String,enum:['cash','online']},moreDetails:String,images:[String],userId:{type:String,required:true},status:{type:String,enum:['draft','posted','in-progress','completed','active','cancelled'],default:'posted'},createdAt:{type:Date,default:Date.now}});
taskSchema.index({userId:1,status:1,createdAt:-1});
const Task=mongoose.model('Task',taskSchema);

const userSchema=new mongoose.Schema({name:{type:String,required:true},email:{type:String,required:true,unique:true,lowercase:true},password:{type:String,required:true,select:false},role:{type:String,enum:['poster','helper','admin'],default:'poster'},initials:String,emailVerified:{type:Boolean,default:false},photoUploaded:{type:Boolean,default:false},adminVerified:{type:Boolean,default:false},profileImage:String,suspended:{type:Boolean,default:false},suspendedAt:Date,suspendedBy:String,suspensionReason:String,banned:{type:Boolean,default:false},bannedAt:Date,bannedBy:String,banReason:String,lastLogin:Date,refreshToken:String,passwordResetToken:String,passwordResetExpires:Date,emailVerificationToken:String,createdAt:{type:Date,default:Date.now}});
userSchema.index({email:1,role:1});
const User=mongoose.model('User',userSchema);

const errorLogSchema=new mongoose.Schema({timestamp:{type:Date,default:Date.now,index:true},errorType:String,errorMessage:String,stackTrace:String,route:String,userId:String,userEmail:String,method:String,ip:String,userAgent:String,resolved:{type:Boolean,default:false,index:true}});
const ErrorLog=mongoose.model('ErrorLog',errorLogSchema);

const failedLoginSchema=new mongoose.Schema({email:{type:String,required:true,index:true},ip:String,userAgent:String,timestamp:{type:Date,default:Date.now,index:true}});
const FailedLogin=mongoose.model('FailedLogin',failedLoginSchema);

const adminActivitySchema=new mongoose.Schema({timestamp:{type:Date,default:Date.now,index:true},adminId:String,adminEmail:String,action:String,targetType:{type:String,enum:['user','task','verification','report','system']},targetId:String,details:mongoose.Schema.Types.Mixed,ip:String,userAgent:String});
const AdminActivityLog=mongoose.model('AdminActivityLog',adminActivitySchema);

const reportSchema=new mongoose.Schema({reporterId:{type:String,required:true},reporterEmail:String,reportedUserId:{type:String,required:true},reportedUserEmail:String,reason:String,description:String,status:{type:String,enum:['open','resolved','dismissed'],default:'open',index:true},adminNotes:[String],adminActions:[{action:String,adminId:String,adminEmail:String,timestamp:Date,note:String}],createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}});
const Report=mongoose.model('Report',reportSchema);

const verificationRequestSchema=new mongoose.Schema({userId:{type:String,required:true,unique:true},userEmail:String,userName:String,idType:{type:String,enum:['passport','drivers_license','national_id']},idImage:String,selfieImage:String,status:{type:String,enum:['pending','approved','rejected'],default:'pending',index:true},rejectionReason:String,reviewedBy:String,reviewedAt:Date,createdAt:{type:Date,default:Date.now}});
const VerificationRequest=mongoose.model('VerificationRequest',verificationRequestSchema);

const systemSettingsSchema=new mongoose.Schema({maintenanceMode:{type:Boolean,default:false},devMode:{type:Boolean,default:false},platformFee:{type:Number,default:5,min:0,max:100},registrationsEnabled:{type:Boolean,default:true},updatedBy:String,updatedAt:{type:Date,default:Date.now}});
const SystemSettings=mongoose.model('SystemSettings',systemSettingsSchema);

// ========== ROUTES ==========
app.get('/config.js',(req,res)=>{res.type('application/javascript');res.send(`window.MAPBOX_TOKEN='${process.env.MAPBOX_ACCESS_TOKEN}';`);});
app.get('/admin',(req,res)=>{res.sendFile(path.join(__dirname,'admin.html'));});
app.get('/health',(req,res)=>{res.json({status:'OK',uptime:process.uptime(),timestamp:new Date()});});
app.get('/',(req,res)=>{res.sendFile(path.join(__dirname,'index.html'));});

// ========== ERROR LOGGING ==========
async function logError(error,route,userId=null,req=null){
 try{
  logger.error({message:error.message,stack:error.stack,route,userId});
  const errorLog=new ErrorLog({
   errorType:error.name||'UnknownError',
   errorMessage:error.message||String(error),
   stackTrace:error.stack,
   route,
   userId:userId||req?.user?.id||req?.user?.email||'unknown',
   userEmail:req?.user?.email,
   method:req?.method,
   ip:req?.ip||req?.headers?.['x-forwarded-for']||req?.socket?.remoteAddress,
   userAgent:req?.headers?.['user-agent'],
   resolved:false
  });
  await errorLog.save();
 }catch(e){console.error('Failed to log error:',e);}
}

// ========== DEBUG ROUTES ==========
app.get('/api/debug/test-log',async(req,res)=>{
 try{
  const testError=new Error('TEST DEBUG LOG - '+new Date().toISOString());
  testError.name='TestError';
  await logError(testError,'/debug/test','test-user',req);
  const totalLogs=await ErrorLog.countDocuments();
  const recentLogs=await ErrorLog.find().sort({timestamp:-1}).limit(5);
  res.json({success:true,message:'Test log created',totalLogs,recentLogs:recentLogs.map(l=>({id:l._id,type:l.errorType,message:l.errorMessage,time:l.timestamp}))});
 }catch(error){res.status(500).json({error:error.message});}
});

app.get('/api/debug/check-logs',async(req,res)=>{
 try{
  const logs=await ErrorLog.find().sort({timestamp:-1}).limit(20);
  const count=await ErrorLog.countDocuments();
  res.json({count,logs:logs.map(l=>({id:l._id,type:l.errorType,message:l.errorMessage,time:l.timestamp,route:l.route,userId:l.userId}))});
 }catch(error){res.status(500).json({error:error.message});}
});

app.get('/api/debug/mongo-check',async(req,res)=>{
 try{
  const collections=await mongoose.connection.db.listCollections().toArray();
  res.json({
   connected:mongoose.connection.readyState===1,
   database:mongoose.connection.name,
   collections:collections.map(c=>c.name),
   allModels:Object.keys(mongoose.models)
  });
 }catch(error){res.status(500).json({error:error.message});}
});

app.get('/api/debug/test-failed-login',async(req,res)=>{
 try{
  const failedLogin=new FailedLogin({email:'test@example.com',ip:req.ip||'127.0.0.1',userAgent:req.headers['user-agent']||'Test Agent'});
  await failedLogin.save();
  const count=await FailedLogin.countDocuments();
  const recent=await FailedLogin.find().sort({timestamp:-1}).limit(5);
  res.json({success:true,message:'Test failed login created',totalCount:count,recent});
 }catch(error){res.status(500).json({error:error.message});}
});

// ========== ADMIN MIDDLEWARE ==========
const adminAuth=async(req,res,next)=>{
 try{
  const authHeader=req.headers.authorization;
  if(!authHeader) return res.status(401).json({error:'No token provided'});
  const token=authHeader.split(' ')[1];
  const decoded=jwt.verify(token,JWT_SECRET);
  const user=await User.findById(decoded.id);
  if(!user) return res.status(401).json({error:'User not found'});
  if(user.role!=='admin') return res.status(403).json({error:'Admin access required'});
  if(user.suspended||user.banned) return res.status(403).json({error:'Account suspended or banned'});
  req.user=user;
  next();
 }catch(error){await logError(error,'adminAuth',null,req);res.status(401).json({error:'Authentication failed'});}
};

// ========== AUTH MIDDLEWARE ==========
const auth=async(req,res,next)=>{
 try{
  const authHeader=req.headers.authorization;
  if(!authHeader) return res.status(401).json({error:'No token provided'});
  const token=authHeader.split(' ')[1];
  const decoded=jwt.verify(token,JWT_SECRET);
  const user=await User.findById(decoded.id);
  if(!user) return res.status(401).json({error:'User not found'});
  if(user.suspended||user.banned) return res.status(403).json({error:'Account suspended or banned'});
  req.user=user;
  next();
 }catch(error){res.status(401).json({error:'Authentication failed'});}
};

// ========== VALIDATION MIDDLEWARE ==========
const validate=(validations)=>{
 return async(req,res,next)=>{
  await Promise.all(validations.map(validation=>validation.run(req)));
  const errors=validationResult(req);
  if(errors.isEmpty()) return next();
  res.status(400).json({errors:errors.array()});
 };
};

// ========== AUTH ROUTES ==========
app.post('/api/auth/register',authLimiter,validate([
 body('email').isEmail().normalizeEmail(),
 body('password').isLength({min:8}).matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/).withMessage('Password must contain at least 8 characters, one letter, one number, and one special character'),
 body('name').notEmpty().trim().escape()
]),async(req,res)=>{
 try{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  
  const{name,email,password,role}=req.body;
  const existing=await User.findOne({email});
  if(existing) return res.status(400).json({error:'Email already exists'});
  
  const hashedPassword=await bcrypt.hash(password,SALT_ROUNDS);
  const initials=name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  
  const user=new User({
   name,email,password:hashedPassword,
   role:role||'poster',initials,
   emailVerified:false,adminVerified:false
  });
  
  await user.save();
  
  const token=jwt.sign({id:user._id,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'7d'});
  
  const userResponse=user.toObject();
  delete userResponse.password;
  
  res.status(201).json({token,user:userResponse});
 }catch(error){await logError(error,'/api/auth/register',null,req);res.status(500).json({error:error.message});}
});

app.post('/api/auth/login',authLimiter,validate([
 body('email').isEmail().normalizeEmail(),
 body('password').notEmpty()
]),async(req,res)=>{
 try{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  
  const{email,password}=req.body;
  const user=await User.findOne({email}).select('+password');
  
  if(!user){
   await new FailedLogin({email,ip:req.ip,userAgent:req.headers['user-agent']}).save();
   return res.status(401).json({error:'Invalid credentials'});
  }
  
  const isValidPassword=await bcrypt.compare(password,user.password);
  if(!isValidPassword){
   await new FailedLogin({email,ip:req.ip,userAgent:req.headers['user-agent']}).save();
   return res.status(401).json({error:'Invalid credentials'});
  }
  
  if(user.suspended||user.banned){
   return res.status(403).json({error:'Account suspended or banned'});
  }
  
  user.lastLogin=new Date();
  await user.save();
  
  const token=jwt.sign({id:user._id,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'7d'});
  
  const userResponse=user.toObject();
  delete userResponse.password;
  
  res.json({token,user:userResponse});
 }catch(error){await logError(error,'/api/auth/login',null,req);res.status(500).json({error:error.message});}
});

app.post('/api/auth/logout',auth,async(req,res)=>{
 try{
  res.json({message:'Logged out successfully'});
 }catch(error){res.status(500).json({error:error.message});}
});

app.get('/api/auth/me',auth,async(req,res)=>{
 try{
  const userResponse=req.user.toObject();
  delete userResponse.password;
  res.json(userResponse);
 }catch(error){res.status(500).json({error:error.message});}
});

app.post('/api/auth/refresh',async(req,res)=>{
 try{
  const{token}=req.body;
  if(!token) return res.status(401).json({error:'No token provided'});
  const decoded=jwt.verify(token,JWT_SECRET);
  const user=await User.findById(decoded.id);
  if(!user) return res.status(401).json({error:'User not found'});
  const newToken=jwt.sign({id:user._id,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'7d'});
  res.json({token:newToken});
 }catch(error){res.status(401).json({error:'Invalid token'});}
});

// ========== TASK ROUTES ==========
app.post('/api/tasks',auth,validate([
 body('taskDescription').notEmpty().trim().escape(),
 body('location').notEmpty().trim().escape(),
 body('budgetAmount').optional().isNumeric()
]),async(req,res)=>{
 try{
  const taskData={...req.body,userId:req.user.email};
  const task=new Task(taskData);
  await task.save();
  res.status(201).json(task);
 }catch(error){await logError(error,'/api/tasks',req.user._id,req);res.status(400).json({error:error.message});}
});

app.get('/api/tasks',auth,async(req,res)=>{
 try{
  const{page=1,limit=20,status,search}=req.query;
  const query={userId:req.user.email};
  if(status) query.status=status;
  if(search) query.taskDescription={$regex:search,$options:'i'};
  
  const skip=(parseInt(page)-1)*parseInt(limit);
  const tasks=await Task.find(query).sort({createdAt:-1}).skip(skip).limit(parseInt(limit));
  const total=await Task.countDocuments(query);
  
  res.json({tasks,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/tasks',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/tasks/:id',auth,async(req,res)=>{
 try{
  const task=await Task.findById(req.params.id);
  if(!task) return res.status(404).json({error:'Task not found'});
  if(task.userId!==req.user.email&&req.user.role!=='admin') return res.status(403).json({error:'Access denied'});
  res.json(task);
 }catch(error){await logError(error,'/api/tasks/:id',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/tasks/:id',auth,async(req,res)=>{
 try{
  const task=await Task.findById(req.params.id);
  if(!task) return res.status(404).json({error:'Task not found'});
  if(task.userId!==req.user.email) return res.status(403).json({error:'Access denied'});
  
  Object.assign(task,req.body);
  await task.save();
  res.json(task);
 }catch(error){await logError(error,'/api/tasks/:id',req.user._id,req);res.status(400).json({error:error.message});}
});

app.delete('/api/tasks/:id',auth,async(req,res)=>{
 try{
  const task=await Task.findById(req.params.id);
  if(!task) return res.status(404).json({error:'Task not found'});
  if(task.userId!==req.user.email&&req.user.role!=='admin') return res.status(403).json({error:'Access denied'});
  
  await Task.findByIdAndDelete(req.params.id);
  res.json({message:'Task deleted successfully'});
 }catch(error){await logError(error,'/api/tasks/:id',req.user._id,req);res.status(500).json({error:error.message});}
});

// ========== PUBLIC TASKS ROUTE ==========
app.get('/api/public/tasks',async(req,res)=>{
 try{
  const{page=1,limit=20,status='active'}=req.query;
  const query={status:{$in:['active','posted']}};
  
  const skip=(parseInt(page)-1)*parseInt(limit);
  const tasks=await Task.find(query).sort({createdAt:-1}).skip(skip).limit(parseInt(limit)).select('-__v');
  const total=await Task.countDocuments(query);
  
  res.json({tasks,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){res.status(500).json({error:error.message});}
});

// ========== USER ROUTES ==========
app.get('/api/users/profile',auth,async(req,res)=>{
 try{
  const userResponse=req.user.toObject();
  delete userResponse.password;
  res.json(userResponse);
 }catch(error){res.status(500).json({error:error.message});}
});

app.put('/api/users/profile',auth,validate([
 body('name').optional().trim().escape(),
 body('profileImage').optional().isURL()
]),async(req,res)=>{
 try{
  const updates={};
  if(req.body.name) updates.name=req.body.name;
  if(req.body.profileImage) updates.profileImage=req.body.profileImage;
  
  const user=await User.findByIdAndUpdate(req.user._id,updates,{new:true}).select('-password');
  res.json(user);
 }catch(error){res.status(400).json({error:error.message});}
});

app.post('/api/users/change-password',auth,validate([
 body('currentPassword').notEmpty(),
 body('newPassword').isLength({min:8})
]),async(req,res)=>{
 try{
  const user=await User.findById(req.user._id).select('+password');
  const isValid=await bcrypt.compare(req.body.currentPassword,user.password);
  if(!isValid) return res.status(401).json({error:'Current password is incorrect'});
  
  user.password=await bcrypt.hash(req.body.newPassword,SALT_ROUNDS);
  await user.save();
  
  res.json({message:'Password changed successfully'});
 }catch(error){res.status(400).json({error:error.message});}
});

// ========== ADMIN ROUTES ==========
app.get('/api/admin/stats',adminAuth,async(req,res)=>{
 try{
  const totalUsers=await User.countDocuments();
  const totalPosters=await User.countDocuments({role:'poster'});
  const totalHelpers=await User.countDocuments({role:'helper'});
  const totalAdmins=await User.countDocuments({role:'admin'});
  
  const totalTasks=await Task.countDocuments();
  const activeTasks=await Task.countDocuments({status:{$in:['active','posted']}});
  const completedTasks=await Task.countDocuments({status:'completed'});
  
  const pendingVerifications=await VerificationRequest.countDocuments({status:'pending'});
  const totalReports=await Report.countDocuments({status:'open'});
  const totalErrors=await ErrorLog.countDocuments({resolved:false});
  const totalFailedLogins=await FailedLogin.countDocuments({timestamp:{$gte:new Date(Date.now()-24*60*60*1000)}});
  
  const recentUsers=await User.find().sort({createdAt:-1}).limit(5).select('-password');
  const recentTasks=await Task.find().sort({createdAt:-1}).limit(5);
  
  res.json({
   users:{total:totalUsers,posters:totalPosters,helpers:totalHelpers,admins:totalAdmins},
   tasks:{total:totalTasks,active:activeTasks,completed:completedTasks},
   system:{pendingVerifications,totalReports,totalErrors,totalFailedLogins},
   recentUsers,recentTasks
  });
 }catch(error){await logError(error,'/api/admin/stats',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/users',adminAuth,async(req,res)=>{
 try{
  const{role,status,search,page=1,limit=20}=req.query;
  const query={};
  if(role) query.role=role;
  if(status==='suspended') query.suspended=true;
  if(status==='banned') query.banned=true;
  if(status==='active'){query.suspended=false;query.banned=false;}
  if(search){query.$or=[{name:{$regex:search,$options:'i'}},{email:{$regex:search,$options:'i'}}];}
  
  const skip=(parseInt(page)-1)*parseInt(limit);
  const users=await User.find(query).select('-password').sort({createdAt:-1}).skip(skip).limit(parseInt(limit));
  const total=await User.countDocuments(query);
  
  res.json({users,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/users',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/admin/users/:userId',adminAuth,async(req,res)=>{
 try{
  const{userId}=req.params;const{action,reason}=req.body;
  const user=await User.findById(userId);
  if(!user) return res.status(404).json({error:'User not found'});
  
  let update={};let activityDetails={reason,action};
  switch(action){
   case'suspend':update={suspended:true,suspendedAt:new Date(),suspendedBy:req.user.email,suspensionReason:reason};break;
   case'unsuspend':update={suspended:false,$unset:{suspendedAt:1,suspendedBy:1,suspensionReason:1}};break;
   case'ban':update={banned:true,bannedAt:new Date(),bannedBy:req.user.email,banReason:reason};break;
   case'unban':update={banned:false,$unset:{bannedAt:1,bannedBy:1,banReason:1}};break;
   case'promote':update={role:'admin'};break;
   case'demote':update={role:'poster'};break;
   default:return res.status(400).json({error:'Invalid action'});
  }
  
  const updatedUser=await User.findByIdAndUpdate(userId,update,{new:true}).select('-password');
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action,targetType:'user',targetId:userId,details:activityDetails,ip:req.ip,userAgent:req.headers['user-agent']});
  
  res.json(updatedUser);
 }catch(error){await logError(error,'/api/admin/users/:userId',req.user._id,req);res.status(500).json({error:error.message});}
});

app.delete('/api/admin/users/:userId',adminAuth,async(req,res)=>{
 try{
  const{userId}=req.params;const{reason}=req.body;
  const user=await User.findById(userId);
  if(!user) return res.status(404).json({error:'User not found'});
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action:'delete_user',targetType:'user',targetId:userId,details:{reason,userEmail:user.email},ip:req.ip,userAgent:req.headers['user-agent']});
  
  await Task.deleteMany({userId:user.email});
  await VerificationRequest.deleteMany({userId:user.email});
  await User.findByIdAndDelete(userId);
  
  res.json({message:'User deleted successfully'});
 }catch(error){await logError(error,'/api/admin/users/:userId',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/tasks',adminAuth,async(req,res)=>{
 try{
  const{status,search,userId,page=1,limit=20}=req.query;
  const query={};
  if(status) query.status=status;
  if(userId) query.userId=userId;
  if(search){query.$or=[{taskDescription:{$regex:search,$options:'i'}},{location:{$regex:search,$options:'i'}}];}
  
  const skip=(parseInt(page)-1)*parseInt(limit);
  const tasks=await Task.find(query).sort({createdAt:-1}).skip(skip).limit(parseInt(limit));
  
  const tasksWithUser=await Promise.all(tasks.map(async(task)=>{
   const user=await User.findOne({email:task.userId}).select('name email');
   return{...task.toObject(),poster:user||{name:'Unknown',email:task.userId}};
  }));
  
  const total=await Task.countDocuments(query);
  res.json({tasks:tasksWithUser,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/tasks',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/admin/tasks/:taskId',adminAuth,async(req,res)=>{
 try{
  const{taskId}=req.params;const{action,reason}=req.body;
  const task=await Task.findById(taskId);
  if(!task) return res.status(404).json({error:'Task not found'});
  
  let update={};
  switch(action){
   case'close':update.status='cancelled';break;
   case'flag':update.flagged=true;update.flaggedReason=reason;update.flaggedBy=req.user.email;update.flaggedAt=new Date();break;
   case'unflag':update.flagged=false;update.flaggedReason=null;update.flaggedBy=null;update.flaggedAt=null;break;
   default:return res.status(400).json({error:'Invalid action'});
  }
  
  const updatedTask=await Task.findByIdAndUpdate(taskId,update,{new:true});
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action,targetType:'task',targetId:taskId,details:{reason,action},ip:req.ip,userAgent:req.headers['user-agent']});
  
  res.json(updatedTask);
 }catch(error){await logError(error,'/api/admin/tasks/:taskId',req.user._id,req);res.status(500).json({error:error.message});}
});

app.delete('/api/admin/tasks/:taskId',adminAuth,async(req,res)=>{
 try{
  const{taskId}=req.params;const{reason}=req.body;
  const task=await Task.findById(taskId);
  if(!task) return res.status(404).json({error:'Task not found'});
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action:'delete_task',targetType:'task',targetId:taskId,details:{reason,taskDescription:task.taskDescription},ip:req.ip,userAgent:req.headers['user-agent']});
  
  await Task.findByIdAndDelete(taskId);
  res.json({message:'Task deleted successfully'});
 }catch(error){await logError(error,'/api/admin/tasks/:taskId',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/failed-logins',adminAuth,async(req,res)=>{
 try{
  const{email,page=1,limit=50}=req.query;
  const query=email?{email:{$regex:email,$options:'i'}}:{};
  const skip=(parseInt(page)-1)*parseInt(limit);
  
  const failedLogins=await FailedLogin.find(query).sort({timestamp:-1}).skip(skip).limit(parseInt(limit));
  const total=await FailedLogin.countDocuments(query);
  
  res.json({failedLogins,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/failed-logins',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/error-logs',adminAuth,async(req,res)=>{
 try{
  const{errorType,userId,startDate,endDate,resolved,page=1,limit=50}=req.query;
  const query={};
  if(errorType) query.errorType=errorType;
  if(userId) query.userId=userId;
  if(resolved!==undefined) query.resolved=resolved==='true';
  if(startDate||endDate){query.timestamp={};if(startDate) query.timestamp.$gte=new Date(startDate);if(endDate) query.timestamp.$lte=new Date(endDate);}
  
  const skip=(parseInt(page)-1)*parseInt(limit);
  const errorTypes=await ErrorLog.distinct('errorType');
  const logs=await ErrorLog.find(query).sort({timestamp:-1}).skip(skip).limit(parseInt(limit));
  const total=await ErrorLog.countDocuments(query);
  
  res.json({logs,errorTypes,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/error-logs',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/admin/error-logs/:logId/resolve',adminAuth,async(req,res)=>{
 try{
  const log=await ErrorLog.findByIdAndUpdate(req.params.logId,{resolved:true},{new:true});
  if(!log) return res.status(404).json({error:'Error log not found'});
  res.json(log);
 }catch(error){await logError(error,'/api/admin/error-logs/:logId/resolve',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/verifications',adminAuth,async(req,res)=>{
 try{
  const{status,page=1,limit=20}=req.query;
  const query=status?{status}:{};
  const skip=(parseInt(page)-1)*parseInt(limit);
  
  const verifications=await VerificationRequest.find(query).sort({createdAt:-1}).skip(skip).limit(parseInt(limit));
  const total=await VerificationRequest.countDocuments(query);
  
  res.json({verifications,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/verifications',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/admin/verifications/:requestId',adminAuth,async(req,res)=>{
 try{
  const{requestId}=req.params;const{status,rejectionReason}=req.body;
  const verification=await VerificationRequest.findById(requestId);
  if(!verification) return res.status(404).json({error:'Verification request not found'});
  
  verification.status=status;
  verification.reviewedBy=req.user.email;
  verification.reviewedAt=new Date();
  if(status==='rejected'&&rejectionReason) verification.rejectionReason=rejectionReason;
  await verification.save();
  
  if(status==='approved'){await User.findOneAndUpdate({email:verification.userEmail},{adminVerified:true});}
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action:`verification_${status}`,targetType:'verification',targetId:requestId,details:{rejectionReason},ip:req.ip,userAgent:req.headers['user-agent']});
  
  res.json(verification);
 }catch(error){await logError(error,'/api/admin/verifications/:requestId',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/reports',adminAuth,async(req,res)=>{
 try{
  const{status,page=1,limit=20}=req.query;
  const query=status?{status}:{};
  const skip=(parseInt(page)-1)*parseInt(limit);
  
  const reports=await Report.find(query).sort({createdAt:-1}).skip(skip).limit(parseInt(limit));
  const total=await Report.countDocuments(query);
  
  res.json({reports,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/reports',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/admin/reports/:reportId',adminAuth,async(req,res)=>{
 try{
  const{reportId}=req.params;const{action,note}=req.body;
  const report=await Report.findById(reportId);
  if(!report) return res.status(404).json({error:'Report not found'});
  
  report.adminActions.push({action,adminId:req.user._id,adminEmail:req.user.email,note});
  if(action==='resolve') report.status='resolved';
  else if(action==='dismiss') report.status='dismissed';
  if(note) report.adminNotes.push(note);
  report.updatedAt=new Date();
  await report.save();
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action:`report_${action}`,targetType:'report',targetId:reportId,details:{note},ip:req.ip,userAgent:req.headers['user-agent']});
  
  res.json(report);
 }catch(error){await logError(error,'/api/admin/reports/:reportId',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/activity-logs',adminAuth,async(req,res)=>{
 try{
  const{adminId,action,targetType,page=1,limit=50}=req.query;
  const query={};
  if(adminId) query.adminId=adminId;
  if(action) query.action=action;
  if(targetType) query.targetType=targetType;
  
  const skip=(parseInt(page)-1)*parseInt(limit);
  const logs=await AdminActivityLog.find(query).sort({timestamp:-1}).skip(skip).limit(parseInt(limit));
  const total=await AdminActivityLog.countDocuments(query);
  
  res.json({logs,pagination:{total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))}});
 }catch(error){await logError(error,'/api/admin/activity-logs',req.user._id,req);res.status(500).json({error:error.message});}
});

app.get('/api/admin/settings',adminAuth,async(req,res)=>{
 try{
  let settings=await SystemSettings.findOne();
  if(!settings){settings=new SystemSettings();await settings.save();}
  res.json(settings);
 }catch(error){await logError(error,'/api/admin/settings',req.user._id,req);res.status(500).json({error:error.message});}
});

app.put('/api/admin/settings',adminAuth,async(req,res)=>{
 try{
  const updates={...req.body,updatedBy:req.user.email,updatedAt:new Date()};
  let settings=await SystemSettings.findOne();
  if(!settings) settings=new SystemSettings(updates);
  else Object.assign(settings,updates);
  await settings.save();
  
  await AdminActivityLog.create({adminId:req.user._id,adminEmail:req.user.email,action:'update_settings',targetType:'system',details:updates,ip:req.ip,userAgent:req.headers['user-agent']});
  
  res.json(settings);
 }catch(error){await logError(error,'/api/admin/settings',req.user._id,req);res.status(500).json({error:error.message});}
});

// ========== HEALTH CHECK ==========
app.get('/api/health',(req,res)=>{res.json({status:'ok',timestamp:new Date()});});

// ========== 404 HANDLER ==========
app.use((req,res)=>{res.status(404).json({error:'Route not found'});});

// ========== ERROR HANDLER ==========
app.use((err,req,res,next)=>{
 console.error(err.stack);
 logError(err,req.path,null,req);
 res.status(500).json({error:'Something went wrong'});
});

// ========== START SERVER ==========
app.listen(port,()=>{
 console.log(`🚀 Server running on port ${port}`);
 console.log(`📊 Admin dashboard: http://localhost:${port}/admin`);
 console.log(`🔧 Debug endpoints:`);
 console.log(`   - GET /api/debug/test-log`);
 console.log(`   - GET /api/debug/check-logs`);
 console.log(`   - GET /api/debug/mongo-check`);
 console.log(`   - GET /api/debug/test-failed-login`);
});
