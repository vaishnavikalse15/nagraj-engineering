const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../../build')));

// Use environment variable for MongoDB (Railway) or fallback to local
const MONGODB_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/nagraj-hrms';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB (Nagraj Industries)'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  console.log('💡 Make sure MongoDB is running or MONGODB_URL is set');
});

// ========== USER SCHEMA ==========
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'ceo', 'hr', 'production_head', 'contractor', 'super_admin'], required: true },
  phone: { type: String, default: '' },
  source: { type: String, default: 'system' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ========== WORKER SCHEMA ==========
const workerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: String,
  gender: String,
  applicationId: String,
  userType: { type: String, default: 'worker' },
  department: String,
  designation: String,
  dailyRate: Number,
  salary: Number,
  aadhar: String,
  aadharBase64: String,
  aadharFileName: String,
  mobile: { type: String, required: true },
  phone: String,
  dateOfBirth: String,
  joiningDate: String,
  status: { type: String, default: 'pending_production' },
  stage: String,
  punchCode: { type: String, unique: true, sparse: true },
  contractor: String,
  contractorName: String,
  registeredBy: String,
  registeredByRole: String,
  registeredDate: String,
  address: String,
  password: String,
  createdAt: { type: Date, default: Date.now },
  company: { type: String, default: 'NAGRAJ INDUSTRIES' },
  category: String,
  subDept: String,
  ceoApprovedBy: String,
  ceoApprovedDate: Date,
  bondYears: Number,
  esiPfPercentage: Number,
  applyESI: Boolean,
  hrFinalizedBy: String,
  hrFinalizedDate: Date,
  finalSalary: Number,
  bankAccount: String,
  pfNumber: String
}, { strict: false });

const Worker = mongoose.model('Worker', workerSchema);

// ========== API ROUTES ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT, mongodb: mongoose.connection.readyState === 1 });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });
    if (!user || user.password !== password.trim()) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.isActive) return res.status(401).json({ error: 'Account disabled' });
    const { password: _, ...userData } = user.toObject();
    res.json({ success: true, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Worker Registration (both endpoints)
app.post('/api/workers', saveWorkerHandler);
app.post('/api/workers/save', saveWorkerHandler);

async function saveWorkerHandler(req, res) {
  try {
    const workerData = req.body;
    if (!workerData.fullName || !workerData.mobile) {
      return res.status(400).json({ error: 'Full name and mobile are required' });
    }
    if (!workerData.punchCode) {
      const last = await Worker.findOne().sort({ createdAt: -1 });
      let nextId = 1001;
      if (last && last.punchCode) nextId = parseInt(last.punchCode) + 1;
      workerData.punchCode = nextId.toString();
    } else {
      const existing = await Worker.findOne({ punchCode: workerData.punchCode });
      if (existing) return res.status(400).json({ error: 'Punch code already exists' });
    }
    if (workerData.aadhar) {
      const existing = await Worker.findOne({ aadhar: workerData.aadhar });
      if (existing) return res.status(400).json({ error: 'Aadhar already registered' });
    }
    workerData.status = workerData.status || 'pending_production';
    workerData.stage = workerData.stage || 'Pending Production Review';
    workerData.company = 'NAGRAJ INDUSTRIES';
    const worker = new Worker(workerData);
    await worker.save();
    res.status(201).json({ success: true, worker, punchCode: worker.punchCode });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      res.status(400).json({ error: `Duplicate value for ${Object.keys(err.keyPattern)[0]}` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
}

app.get('/api/workers', async (req, res) => {
  try {
    const workers = await Worker.find().sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.get('/api/workers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let worker = mongoose.Types.ObjectId.isValid(id) ? await Worker.findById(id) : await Worker.findOne({ punchCode: id });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    updateData.updatedAt = new Date();
    let worker = mongoose.Types.ObjectId.isValid(id)
      ? await Worker.findByIdAndUpdate(id, updateData, { new: true })
      : await Worker.findOneAndUpdate({ punchCode: id }, updateData, { new: true });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/workers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let result = mongoose.Types.ObjectId.isValid(id)
      ? await Worker.findByIdAndDelete(id)
      : await Worker.findOneAndDelete({ punchCode: id });
    if (!result) return res.status(404).json({ error: 'Worker not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== APPROVAL ROUTES ==========
app.put('/api/workers/production-approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { productionHeadName, department, designation, category, dailyRate } = req.body;
    const updateData = {
      department, designation, category, dailyRate,
      salary: (dailyRate || req.body.dailyRate) ? (dailyRate || req.body.dailyRate) * 26 : undefined,
      status: 'pending_ceo',
      stage: 'Pending CEO Approval',
      productionApprovedBy: productionHeadName || 'Production Head',
      productionApprovedDate: new Date().toISOString()
    };
    let worker = mongoose.Types.ObjectId.isValid(id)
      ? await Worker.findByIdAndUpdate(id, updateData, { new: true })
      : await Worker.findOneAndUpdate({ punchCode: id }, updateData, { new: true });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/workers/production-reject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { productionHeadName, rejectionReason } = req.body;
    const updateData = {
      status: 'rejected_by_production',
      stage: `Rejected by Production Head: ${rejectionReason || 'No reason provided'}`,
      productionApprovedBy: productionHeadName || 'Production Head',
      productionApprovedDate: new Date().toISOString()
    };
    let worker = mongoose.Types.ObjectId.isValid(id)
      ? await Worker.findByIdAndUpdate(id, updateData, { new: true })
      : await Worker.findOneAndUpdate({ punchCode: id }, updateData, { new: true });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/workers/production-sendback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { productionHeadName, remarks } = req.body;
    const updateData = {
      status: 'send_back_to_contractor',
      stage: `Sent back by Production: ${remarks || 'Incomplete information'}`,
      productionApprovedBy: productionHeadName || 'Production Head',
      productionApprovedDate: new Date().toISOString()
    };
    let worker = mongoose.Types.ObjectId.isValid(id)
      ? await Worker.findByIdAndUpdate(id, updateData, { new: true })
      : await Worker.findOneAndUpdate({ punchCode: id }, updateData, { new: true });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/workers/ceo-approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyRate, joiningDate, bondYears, esiPfPercentage, applyESI, subDept, category, ceoName } = req.body;
    const monthlySalary = dailyRate ? dailyRate * 26 : undefined;
    const updateData = {
      dailyRate, salary: monthlySalary, joiningDate, bondYears, esiPfPercentage, applyESI, subDept, category,
      status: 'pending_hr', stage: 'Pending HR Finalization',
      ceoApprovedBy: ceoName, ceoApprovedDate: new Date().toISOString()
    };
    let worker = await findWorker(id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    worker = await Worker.findByIdAndUpdate(worker._id, updateData, { new: true });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/workers/ceo-reject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ceoName, reason } = req.body;
    const updateData = {
      status: 'rejected_by_ceo', stage: `Rejected by CEO: ${reason || 'No reason'}`,
      ceoApprovedBy: ceoName, ceoApprovedDate: new Date().toISOString()
    };
    let worker = await findWorker(id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    worker = await Worker.findByIdAndUpdate(worker._id, updateData, { new: true });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.put('/api/workers/ceo-hold/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ceoName, holdReason } = req.body;
    const updateData = {
      status: 'on_hold_ceo', stage: `On Hold: ${holdReason || 'Additional info'}`,
      ceoApprovedBy: ceoName, ceoApprovedDate: new Date().toISOString()
    };
    let worker = await findWorker(id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    worker = await Worker.findByIdAndUpdate(worker._id, updateData, { new: true });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.put('/api/workers/hr-finalize/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hrName, finalSalary, bankAccount, pfNumber } = req.body;
    const updateData = {
      status: 'approved', stage: 'Active Worker',
      hrFinalizedBy: hrName, hrFinalizedDate: new Date().toISOString(),
      finalSalary, bankAccount, pfNumber
    };
    let worker = await findWorker(id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    worker = await Worker.findByIdAndUpdate(worker._id, updateData, { new: true });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function findWorker(id) {
  if (mongoose.Types.ObjectId.isValid(id)) return await Worker.findById(id);
  return await Worker.findOne({ punchCode: id });
}

// ========== USER MANAGEMENT ==========
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { email, password, name, role, phone, source, isActive } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name, role' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    const newUser = new User({
      email: normalizedEmail,
      password: password.trim(),
      name: name.trim(),
      role: role,
      phone: phone || '',
      source: source || 'admin',
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await newUser.save();
    console.log(`✅ New user created: ${normalizedEmail} (${role})`);
    const { password: _, ...userData } = newUser.toObject();
    res.status(201).json({ success: true, user: userData });
  } catch (err) {
    console.error('User creation error:', err);
    if (err.code === 11000) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete Super Admin user' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== DEFAULT USERS ==========
const defaultUsers = [
  { email: 'admin@nagraj.com', password: 'admin123', name: 'Nagraj Admin', role: 'super_admin', phone: '9999999900', source: 'system' },
  { email: 'a', password: 'a123', name: 'Admin User', role: 'super_admin', phone: '', source: 'system' },
  { email: 'ceo', password: 'ceo123', name: 'Nagraj CEO', role: 'ceo', phone: '9999999901', source: 'system' },
  { email: 'h', password: 'h123', name: 'Nagraj HR', role: 'hr', phone: '9999999902', source: 'system' },
  { email: 'ph', password: 'ph123', name: 'Production Head', role: 'production_head', phone: '9999999903', source: 'system' },
  { email: 'c', password: 'c123', name: 'Contractor', role: 'contractor', phone: '9999999904', source: 'system' }
];

const initDefaultUsers = async () => {
  for (const u of defaultUsers) {
    const exists = await User.findOne({ email: u.email.toLowerCase() });
    if (!exists) {
      await new User({ ...u, email: u.email.toLowerCase() }).save();
      console.log(`✅ Default user created: ${u.email}`);
    } else {
      console.log(`ℹ️ Default user already exists: ${u.email}`);
    }
  }
};

// Serve React app for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../build', 'index.html'));
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏭 NAGRAJ INDUSTRIES HRMS Server running on port ${PORT}`);
  console.log(`✅ Default users ready.`);
});

initDefaultUsers().catch(console.error);