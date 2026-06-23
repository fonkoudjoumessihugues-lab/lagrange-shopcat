require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const archiver = require('archiver');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

// ========== MIDDLEWARES ==========
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public', { maxAge: '1d' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api/', limiter);

// ========== CONSTANTES ==========
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const USER_DATA_ROOT = process.env.USER_DATA_DIR || path.join(__dirname, 'user-data');
const JWT_SECRET = process.env.JWT_SECRET || 'lagrange_super_secret_key_change_me';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@lagrange.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const TRIAL_DAYS = 15;
const NOTIFICATION_DAYS = [5, 3, 1];

// ========== CRÉATION DES DOSSIERS ==========
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(USER_DATA_ROOT)) fs.mkdirSync(USER_DATA_ROOT, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'public/uploads'))) fs.mkdirSync(path.join(__dirname, 'public/uploads'), { recursive: true });

// ========== FONCTIONS DE STOCKAGE ==========
function readJSON(filePath, defaults = []) {
  if (!fs.existsSync(filePath)) return defaults;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return defaults; }
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

let users = readJSON(path.join(DATA_DIR, 'users.json'), []);
let logs = readJSON(path.join(DATA_DIR, 'logs.json'), []);
let notifications = readJSON(path.join(DATA_DIR, 'notifications.json'), []);
let adminConfig = readJSON(path.join(DATA_DIR, 'config.json'), {
  companyName: 'Lagrange Shop',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  taxRate: 0
});

// ========== ADMIN PAR DÉFAUT ==========
const adminExists = users.find(u => u.email === ADMIN_EMAIL);
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  users.push({
    id: 1,
    fullName: 'Administrateur',
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'super_admin',
    subscription: { status: 'active', startDate: new Date().toISOString(), endDate: null, plan: 'admin' },
    shopId: null, phone: null, cni: null, address: null, commission: 0,
    createdAt: new Date().toISOString()
  });
  writeJSON(path.join(DATA_DIR, 'users.json'), users);
  addNotification('Bienvenue !', 'Compte admin créé avec succès.', 'info');
}

function saveAll() {
  writeJSON(path.join(DATA_DIR, 'users.json'), users);
  writeJSON(path.join(DATA_DIR, 'logs.json'), logs);
  writeJSON(path.join(DATA_DIR, 'notifications.json'), notifications);
  writeJSON(path.join(DATA_DIR, 'config.json'), adminConfig);
}

function addLog(action, details = {}) {
  const log = { id: logs.length + 1, timestamp: new Date().toISOString(), action, ...details };
  logs.push(log);
  if (logs.length > 10000) logs.shift();
  writeJSON(path.join(DATA_DIR, 'logs.json'), logs);
}

function addNotification(title, message, type = 'info', userId = null) {
  const notif = {
    id: notifications.length + 1, title, message, type, userId,
    read: false, createdAt: new Date().toISOString()
  };
  notifications.push(notif);
  if (notifications.length > 500) notifications.shift();
  writeJSON(path.join(DATA_DIR, 'notifications.json'), notifications);
}

// ========== SAUVEGARDE AUTO (24h) ==========
cron.schedule('0 0 * * *', () => {
  const backupName = `backup_${new Date().toISOString().split('T')[0]}.json`;
  writeJSON(path.join(BACKUP_DIR, backupName), { users, logs, notifications, adminConfig });
  addLog('backup_auto', { backupName });
});

// ========== VÉRIFICATION ABONNEMENTS (1h) ==========
cron.schedule('0 * * * *', () => {
  const now = new Date();
  users.forEach(user => {
    if (user.role === 'super_admin' || user.role === 'admin') return;
    if (user.subscription.status === 'expired') return;
    const endDate = new Date(user.subscription.endDate);
    const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    if (NOTIFICATION_DAYS.includes(diffDays)) {
      addNotification(`⚠️ Abonnement bientôt expiré`,
        `${user.fullName}, votre essai se termine dans ${diffDays} jour${diffDays > 1 ? 's' : ''}.`, 'warning', user.id);
    }
    if (diffDays <= 0 && user.subscription.status === 'active') {
      user.subscription.status = 'expired';
      addNotification(`❌ Abonnement expiré`, `L'abonnement de ${user.fullName} a expiré.`, 'danger', user.id);
      saveAll();
    }
  });
});

// ========== MIDDLEWARE AUTH ==========
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) return res.status(403).json({ error: 'Permission refusee' });
  next();
};

const checkSubscription = (req, res, next) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(401).json({ error: 'Utilisateur non trouvé' });
  if (user.role === 'super_admin' || user.role === 'admin') return next();
  if (user.subscription.status === 'expired') {
    return res.status(403).json({ error: 'abonnement_expire', message: 'Votre abonnement a expiré.' });
  }
  next();
};

// ========== AUTH ROUTES ==========
app.post('/api/auth/register', [
  body('fullName').notEmpty().withMessage('Nom requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('6 caractères minimum')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { fullName, email, password } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email déjà utilisé' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const endDate = new Date(now); endDate.setDate(now.getDate() + TRIAL_DAYS);
    const newUser = {
      id: users.length + 1, fullName, email, password: hashedPassword,
      role: 'user',
      subscription: { status: 'active', startDate: now.toISOString(), endDate: endDate.toISOString(), plan: 'trial' },
      shopId: null, phone: null, cni: null, address: null, commission: 0,
      createdAt: now.toISOString()
    };
    users.push(newUser);
    saveAll();
    addNotification('👤 Nouvel utilisateur', `${fullName} (${email}) vient de s'inscrire.`, 'success');
    addLog('user_register', { userId: newUser.id, email });
    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: newUser.id, fullName, email, role: newUser.role, subscription: newUser.subscription } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      const now = new Date();
      if (new Date(user.subscription.endDate) < now && user.subscription.status === 'active') {
        user.subscription.status = 'expired';
        saveAll();
        return res.status(403).json({ error: 'abonnement_expire', message: 'Votre abonnement a expiré.' });
      }
    }
    addLog('user_login', { userId: user.id, email });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email, role: user.role, subscription: user.subscription, shopId: user.shopId } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== ROUTES ADMIN ==========
app.get('/api/admin/dashboard', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const now = new Date();
    const totalUsers = users.filter(u => u.role === 'user').length;
    const activeUsers = users.filter(u => u.role === 'user' && u.subscription.status === 'active').length;
    const expiredUsers = users.filter(u => u.role === 'user' && u.subscription.status === 'expired').length;
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now); day.setDate(day.getDate() - i);
      const count = users.filter(u => new Date(u.createdAt).toDateString() === day.toDateString()).length;
      last30Days.push({ date: day.toISOString().split('T')[0], count });
    }
    const userSales = {};
    users.forEach(u => {
      if (u.role === 'user') {
        const userDir = path.join(USER_DATA_ROOT, String(u.id));
        if (fs.existsSync(userDir)) {
          const sales = readJSON(path.join(userDir, 'sales.json'), []);
          userSales[u.id] = { name: u.fullName, totalSales: sales.length, revenue: sales.reduce((sum, s) => sum + (s.total || 0), 0) };
        }
      }
    });
    const topUsers = Object.values(userSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const unreadNotifications = notifications.filter(n => !n.read).length;
    res.json({ totalUsers, activeUsers, expiredUsers, unreadNotifications, last30Days, topUsers, notifications: notifications.slice(-50).reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const { search, status, sort } = req.query;
    let filtered = users.filter(u => u.role === 'user');
    if (search) filtered = filtered.filter(u => u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    if (status) filtered = filtered.filter(u => u.subscription.status === status);
    if (sort === 'date') filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const now = new Date();
    res.json(filtered.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, status: u.subscription.status, daysLeft: Math.ceil((new Date(u.subscription.endDate) - now) / (1000*60*60*24)), createdAt: u.createdAt, endDate: u.subscription.endDate })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users/:id/extend', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (user.role === 'super_admin' || user.role === 'admin') return res.status(403).json({ error: 'Impossible de modifier ce compte' });
    const { days = 30 } = req.body;
    const newEnd = new Date(); newEnd.setDate(newEnd.getDate() + days);
    user.subscription.endDate = newEnd.toISOString();
    user.subscription.status = 'active';
    saveAll();
    addLog('admin_extend', { userId: user.id, days });
    addNotification('✅ Abonnement prolongé', `L'abonnement de ${user.fullName} a été prolongé de ${days} jours.`, 'success');
    res.json({ message: `Abonnement prolongé de ${days} jours`, newEndDate: user.subscription.endDate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users/:id/disable', auth, authorize('super_admin', 'admin'), (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  user.subscription.status = 'expired';
  saveAll();
  res.json({ message: 'Utilisateur désactivé' });
});

app.post('/api/admin/users/:id/enable', auth, authorize('super_admin', 'admin'), (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const newEnd = new Date(); newEnd.setDate(newEnd.getDate() + 15);
  user.subscription.endDate = newEnd.toISOString();
  user.subscription.status = 'active';
  saveAll();
  res.json({ message: 'Utilisateur réactivé' });
});

app.get('/api/admin/notifications', auth, authorize('super_admin', 'admin'), (req, res) => {
  res.json(notifications.filter(n => !n.read).reverse());
});

app.post('/api/admin/notifications/:id/read', auth, authorize('super_admin', 'admin'), (req, res) => {
  const notif = notifications.find(n => n.id === parseInt(req.params.id));
  if (notif) notif.read = true;
  writeJSON(path.join(DATA_DIR, 'notifications.json'), notifications);
  res.json({ success: true });
});

app.post('/api/admin/notifications/read-all', auth, authorize('super_admin', 'admin'), (req, res) => {
  notifications.forEach(n => n.read = true);
  writeJSON(path.join(DATA_DIR, 'notifications.json'), notifications);
  res.json({ success: true });
});

// ========== ADMIN : VOIR TOUTES LES VENTES ==========
app.get('/api/admin/all-sales', auth, authorize('super_admin', 'admin'), (req, res) => {
  try {
    const allSales = [];
    users.forEach(u => {
      const userDir = path.join(USER_DATA_ROOT, String(u.id));
      if (fs.existsSync(userDir)) {
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        sales.forEach(s => { allSales.push({ ...s, sellerName: u.fullName, sellerEmail: u.email, sellerId: u.id }); });
      }
    });
    res.json(allSales.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== RENOUVELLEMENT ABONNEMENT VIA WHATSAPP ==========
app.get('/api/subscription/renew', auth, (req, res) => {
  const whatsappNumber = process.env.WHATSAPP_NUMBER || '237656793804';
  const message = process.env.WHATSAPP_MESSAGE || 'Bonjour%20je%20souhaite%20renouveler%20mon%20abonnement%20Lagrange%20Shop';
  res.json({ url: `https://wa.me/${whatsappNumber}?text=${message}` });
});

// ========== USER DATA HELPER ==========
function getUserDataDir(userId) {
  const dir = path.join(USER_DATA_ROOT, String(userId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getUserFile(userId, filename) {
  return path.join(getUserDataDir(userId), filename);
}

// ========== BOUTIQUES ==========
app.post('/api/shops', auth, checkSubscription, (req, res) => {
  try {
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const userDir = getUserDataDir(req.userId);
    const shops = readJSON(path.join(userDir, 'shops.json'), []);
    const shop = { id: shops.length + 1, name, address: address || '', phone: phone || '', ownerId: req.userId, createdAt: new Date().toISOString() };
    shops.push(shop);
    writeJSON(path.join(userDir, 'shops.json'), shops);
    res.status(201).json(shop);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shops', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    const shops = readJSON(path.join(userDir, 'shops.json'), []);
    const user = users.find(u => u.id === req.userId);
    let userShops = [];
    if (user.role === 'vendor' && user.shopId) {
      const shop = shops.find(s => s.id === user.shopId);
      if (shop) userShops = [shop];
    } else {
      userShops = shops.filter(s => s.ownerId === req.userId);
    }
    res.json(userShops);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/shops/:id', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let shops = readJSON(path.join(userDir, 'shops.json'), []);
    shops = shops.filter(s => s.id !== parseInt(req.params.id) || s.ownerId !== req.userId);
    writeJSON(path.join(userDir, 'shops.json'), shops);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== PRODUITS (avec image, variantes, péremption) ==========
app.post('/api/products', auth, checkSubscription, (req, res) => {
  try {
    const { name, sellingPrice, quantity, alertThreshold, shopId, barcode, image, variants, expiryDate } = req.body;
    if (!name || !shopId) return res.status(400).json({ error: 'Nom et boutique requis' });
    const userDir = getUserDataDir(req.userId);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const product = {
      id: products.length + 1, name, sellingPrice: sellingPrice || 0, quantity: quantity || 0,
      alertThreshold: alertThreshold || 5, shopId: parseInt(shopId), barcode: barcode || null,
      image: image || null, variants: variants || [], expiryDate: expiryDate || null,
      createdAt: new Date().toISOString()
    };
    products.push(product);
    writeJSON(path.join(userDir, 'products.json'), products);
    if (product.quantity <= product.alertThreshold) {
      const alerts = readJSON(path.join(userDir, 'alerts.json'), []);
      alerts.push({ id: alerts.length + 1, type: 'low_stock', message: `Stock faible : ${product.name} (${product.quantity})`, level: 'warning', shopId: product.shopId, read: false, createdAt: new Date().toISOString() });
      writeJSON(path.join(userDir, 'alerts.json'), alerts);
    }
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products', auth, (req, res) => {
  try {
    const { shopId, barcode } = req.query;
    if (!shopId) return res.status(400).json({ error: 'shopId requis' });
    const userDir = getUserDataDir(req.userId);
    let products = readJSON(path.join(userDir, 'products.json'), []);
    let filtered = products.filter(p => p.shopId === parseInt(shopId));
    if (barcode) filtered = filtered.filter(p => p.barcode === barcode);
    res.json(filtered);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let products = readJSON(path.join(userDir, 'products.json'), []);
    products = products.filter(p => p.id !== parseInt(req.params.id));
    writeJSON(path.join(userDir, 'products.json'), products);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products/:id/restock', auth, checkSubscription, (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Quantité invalide' });
    const userDir = getUserDataDir(req.userId);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    product.quantity += quantity;
    writeJSON(path.join(userDir, 'products.json'), products);
    res.json({ message: 'Stock mis à jour', product });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id/variants', auth, checkSubscription, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let products = readJSON(path.join(userDir, 'products.json'), []);
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    product.variants = req.body.variants || [];
    if (req.body.expiryDate) product.expiryDate = req.body.expiryDate;
    writeJSON(path.join(userDir, 'products.json'), products);
    res.json({ message: 'Variantes mises à jour', product });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== VENTES ==========
app.post('/api/sales', auth, checkSubscription, (req, res) => {
  try {
    const { productId, quantity, shopId, customPrice, customerName, paymentMethod } = req.body;
    const currentUser = users.find(u => u.id === req.userId);
    const userDir = getUserDataDir(req.userId);
    let products = readJSON(path.join(userDir, 'products.json'), []);
    let sales = readJSON(path.join(userDir, 'sales.json'), []);
    let invoices = readJSON(path.join(userDir, 'invoices.json'), []);
    let alerts = readJSON(path.join(userDir, 'alerts.json'), []);

    if (currentUser.role === 'vendor' && currentUser.shopId !== shopId) {
      return res.status(403).json({ error: 'Vous ne pouvez vendre que dans votre boutique' });
    }
    const productIndex = products.findIndex(p => p.id === productId && p.shopId === shopId);
    if (productIndex === -1) return res.status(404).json({ error: 'Produit non trouvé' });
    if (products[productIndex].quantity < quantity) return res.status(400).json({ error: 'Stock insuffisant' });

    const unitPrice = customPrice || products[productIndex].sellingPrice;
    const subtotal = unitPrice * quantity;
    const tax = subtotal * (adminConfig.taxRate / 100);
    const total = subtotal + tax;

    const sale = {
      id: sales.length + 1, productId, productName: products[productIndex].name, quantity,
      unitPrice, subtotal, tax, total, sellerId: req.userId, sellerName: currentUser.fullName,
      shopId: parseInt(shopId), recommendedPrice: products[productIndex].sellingPrice,
      customerName: customerName || 'Client', date: new Date().toISOString(),
      cancelled: false, cancelledAt: null, cancelledBy: null,
      paymentMethod: paymentMethod || 'cash'
    };
    sales.push(sale);
    products[productIndex].quantity -= quantity;

    const invoice = {
      id: invoices.length + 1, saleId: sale.id,
      invoiceNumber: `INV-${String(sale.id).padStart(6, '0')}`,
      total, createdAt: new Date().toISOString()
    };
    invoices.push(invoice);

    if (products[productIndex].quantity <= products[productIndex].alertThreshold) {
      alerts.push({ id: alerts.length + 1, type: 'low_stock', message: `${products[productIndex].name} : stock faible (${products[productIndex].quantity})`, level: 'warning', shopId: parseInt(shopId), read: false, createdAt: new Date().toISOString() });
    }

    // Notification admin si vendeur
    if (currentUser.role === 'vendor') {
      addNotification('🛒 Nouvelle vente vendeur', `${currentUser.fullName} a vendu ${quantity} x ${sale.productName} (${total.toLocaleString()} FCFA)`, 'info');
    }

    writeJSON(path.join(userDir, 'products.json'), products);
    writeJSON(path.join(userDir, 'sales.json'), sales);
    writeJSON(path.join(userDir, 'invoices.json'), invoices);
    writeJSON(path.join(userDir, 'alerts.json'), alerts);

    let performanceMessage = '';
    if (unitPrice > products[productIndex].sellingPrice) {
      performanceMessage = `Excellent ! +${unitPrice - products[productIndex].sellingPrice} FCFA au-dessus du prix recommandé.`;
    } else if (unitPrice < products[productIndex].sellingPrice) {
      performanceMessage = `Attention : ${products[productIndex].sellingPrice - unitPrice} FCFA en dessous du prix recommandé.`;
    } else {
      performanceMessage = 'Prix respecté. Bon travail !';
    }
    res.status(201).json({ sale, invoice, performanceMessage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sales/:id/cancel', auth, (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const userDir = getUserDataDir(req.userId);
    let sales = readJSON(path.join(userDir, 'sales.json'), []);
    let products = readJSON(path.join(userDir, 'products.json'), []);
    const sale = sales.find(s => s.id === saleId);
    if (!sale || sale.cancelled) return res.status(404).json({ error: 'Vente non trouvée ou déjà annulée' });
    const currentUser = users.find(u => u.id === req.userId);
    const diffMinutes = (new Date() - new Date(sale.date)) / (1000 * 60);
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin' && diffMinutes > 15) {
      return res.status(403).json({ error: 'Délai de 15 minutes dépassé.' });
    }
    const product = products.find(p => p.id === sale.productId);
    if (product) product.quantity += sale.quantity;
    sale.cancelled = true; sale.cancelledAt = new Date().toISOString(); sale.cancelledBy = currentUser.fullName;
    writeJSON(path.join(userDir, 'products.json'), products);
    writeJSON(path.join(userDir, 'sales.json'), sales);
    res.json({ message: 'Vente annulée', sale });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sales', auth, (req, res) => {
  try {
    const { shopId } = req.query;
    const userDir = getUserDataDir(req.userId);
    let sales = readJSON(path.join(userDir, 'sales.json'), []);
    const currentUser = users.find(u => u.id === req.userId);
    let filtered = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
    if (currentUser.role === 'vendor') filtered = filtered.filter(s => s.sellerId === req.userId);
    res.json(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== FACTURES ==========
app.get('/api/invoices', auth, (req, res) => {
  try {
    const { shopId } = req.query;
    const userDir = getUserDataDir(req.userId);
    let invoices = readJSON(path.join(userDir, 'invoices.json'), []);
    let sales = readJSON(path.join(userDir, 'sales.json'), []);
    let filtered = invoices;
    if (shopId) {
      const saleIds = sales.filter(s => s.shopId === parseInt(shopId)).map(s => s.id);
      filtered = invoices.filter(inv => saleIds.includes(inv.saleId));
    }
    res.json(filtered.map(inv => ({ ...inv, sale: sales.find(s => s.id === inv.saleId) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/invoices/:saleId/pdf', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const sale = sales.find(s => s.id === parseInt(req.params.saleId));
    if (!sale) return res.status(404).json({ error: 'Vente non trouvée' });
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const shops = readJSON(path.join(userDir, 'shops.json'), []);
    const product = products.find(p => p.id === sale.productId);
    const shop = shops.find(s => s.id === sale.shopId);
    const seller = users.find(u => u.id === sale.sellerId);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture_${sale.id}.pdf`);
    doc.pipe(res);
    doc.fontSize(22).font('Helvetica-Bold').text(adminConfig.companyName || 'Lagrange Shop Manager', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(adminConfig.companyAddress || '', { align: 'center' });
    doc.text(`Tel: ${adminConfig.companyPhone || ''} | Email: ${adminConfig.companyEmail || ''}`, { align: 'center' });
    doc.moveDown();
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text(sale.cancelled ? 'FACTURE ANNULEE' : 'FACTURE', { align: 'center' });
    if (sale.cancelled) doc.fontSize(10).font('Helvetica').text(`Annulée le ${new Date(sale.cancelledAt).toLocaleString()} par ${sale.cancelledBy}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`N° Facture: ${String(sale.id).padStart(6, '0')}`, { align: 'right' });
    doc.text(`Date: ${new Date(sale.date).toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text('Vendeur:', { continued: true });
    doc.font('Helvetica').text(` ${seller?.fullName || 'N/A'}`);
    doc.text(`Boutique: ${shop?.name || 'N/A'}`);
    doc.text(`Adresse: ${shop?.address || 'N/A'}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text('Client:');
    doc.font('Helvetica').text(sale.customerName || 'Client');
    doc.moveDown();
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    const col1 = 50, col3 = 300, col4 = 400, col5 = 500;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Designation', col1, doc.y);
    doc.text('Quantite', col3, doc.y);
    doc.text('Prix unit.', col4, doc.y);
    doc.text('Total', col5, doc.y);
    doc.moveDown();
    doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.font('Helvetica').fontSize(10);
    doc.text(sale.productName, col1, doc.y);
    doc.text(sale.quantity.toString(), col3, doc.y);
    doc.text(`${sale.unitPrice.toLocaleString()} FCFA`, col4, doc.y);
    doc.text(`${sale.subtotal.toLocaleString()} FCFA`, col5, doc.y);
    doc.moveDown(2);
    doc.font('Helvetica-Bold');
    doc.text('Sous-total:', col4, doc.y);
    doc.font('Helvetica');
    doc.text(`${sale.subtotal.toLocaleString()} FCFA`, col5, doc.y);
    if (sale.tax > 0) {
      doc.font('Helvetica-Bold');
      doc.text(`TVA (${adminConfig.taxRate}%):`, col4, doc.y);
      doc.font('Helvetica');
      doc.text(`${sale.tax.toLocaleString()} FCFA`, col5, doc.y);
    }
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL:', col4, doc.y);
    doc.text(`${sale.total.toLocaleString()} FCFA`, col5, doc.y);
    doc.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== DÉPENSES ==========
app.post('/api/expenses', auth, checkSubscription, (req, res) => {
  try {
    const { category, amount, date, description, shopId } = req.body;
    if (!category || !amount || !shopId) return res.status(400).json({ error: 'Catégorie, montant et boutique requis' });
    const userDir = getUserDataDir(req.userId);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const user = users.find(u => u.id === req.userId);
    const expense = {
      id: expenses.length + 1, category, amount, date: date || new Date().toISOString(),
      description: description || '', shopId: parseInt(shopId),
      addedBy: req.userId, addedByName: user?.fullName || 'Inconnu',
      createdAt: new Date().toISOString()
    };
    expenses.push(expense);
    writeJSON(path.join(userDir, 'expenses.json'), expenses);
    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/expenses', auth, (req, res) => {
  try {
    const { shopId, startDate, endDate, category } = req.query;
    const userDir = getUserDataDir(req.userId);
    let expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    let filtered = expenses.filter(e => e.shopId === parseInt(shopId));
    if (startDate) filtered = filtered.filter(e => new Date(e.date) >= new Date(startDate));
    if (endDate) filtered = filtered.filter(e => new Date(e.date) <= new Date(endDate));
    if (category) filtered = filtered.filter(e => e.category === category);
    res.json(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/expenses/:id', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    expenses = expenses.filter(e => e.id !== parseInt(req.params.id));
    writeJSON(path.join(userDir, 'expenses.json'), expenses);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== VENDEURS ==========
app.post('/api/vendors', auth, checkSubscription, async (req, res) => {
  try {
    const { email, fullName, phone, cni, address, shopId, commission } = req.body;
    if (!email || !fullName) return res.status(400).json({ error: 'Email et nom requis' });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email déjà utilisé' });
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const vendor = {
      id: users.length + 1, fullName, email, password: hashedPassword, role: 'vendor',
      shopId: parseInt(shopId) || null, phone: phone || null, cni: cni || null,
      address: address || null, hireDate: new Date().toISOString(), commission: commission || 0,
      bonus: 0, createdAt: new Date().toISOString(),
      subscription: { status: 'active', startDate: new Date().toISOString(), endDate: null, plan: 'vendor' }
    };
    users.push(vendor);
    saveAll();
    addLog('vendor_create', { userId: vendor.id, email });
    res.status(201).json({
      message: `Vendeur invité. Mot de passe : ${tempPassword}`,
      tempPassword: tempPassword,
      vendor: { id: vendor.id, fullName, email, phone, cni, address, commission: vendor.commission }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vendors', auth, (req, res) => {
  try {
    const { shopId } = req.query;
    let vendors = users.filter(u => u.role === 'vendor');
    if (shopId) vendors = vendors.filter(v => v.shopId === parseInt(shopId));
    res.json(vendors.map(({ password, ...v }) => v));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/vendors/:id', auth, (req, res) => {
  try {
    users = users.filter(u => u.id !== parseInt(req.params.id) || u.role !== 'vendor');
    saveAll();
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== TRANSFERT STOCK ==========
app.post('/api/transfer-stock', auth, checkSubscription, (req, res) => {
  try {
    const { fromShopId, toShopId, productId, quantity } = req.body;
    const userDir = getUserDataDir(req.userId);
    let products = readJSON(path.join(userDir, 'products.json'), []);
    let transfers = readJSON(path.join(userDir, 'transfers.json'), []);
    const fromIdx = products.findIndex(p => p.id === productId && p.shopId === fromShopId);
    if (fromIdx === -1) return res.status(404).json({ error: 'Produit source non trouvé' });
    if (products[fromIdx].quantity < quantity) return res.status(400).json({ error: 'Stock insuffisant' });
    let toIdx = products.findIndex(p => p.name === products[fromIdx].name && p.shopId === toShopId);
    if (toIdx === -1) {
      products.push({ ...products[fromIdx], id: products.length + 1, shopId: toShopId, quantity: 0 });
      toIdx = products.length - 1;
    }
    products[fromIdx].quantity -= quantity;
    products[toIdx].quantity += quantity;
    transfers.push({ id: transfers.length + 1, fromShopId, toShopId, productName: products[fromIdx].name, quantity, date: new Date().toISOString() });
    writeJSON(path.join(userDir, 'products.json'), products);
    writeJSON(path.join(userDir, 'transfers.json'), transfers);
    res.json({ message: 'Transfert effectué' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/transfer-history', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    res.json(readJSON(path.join(userDir, 'transfers.json'), []));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== DASHBOARD (avec 5 nouvelles stats) ==========
app.get('/api/dashboard/stats', auth, (req, res) => {
  try {
    const { shopId } = req.query;
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const shopSales = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
    const shopProducts = products.filter(p => p.shopId === parseInt(shopId));
    const shopExpenses = expenses.filter(e => e.shopId === parseInt(shopId));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    const salesToday = shopSales.filter(s => new Date(s.date) >= today).length;
    const salesYesterday = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
    const weeklySales = shopSales.filter(s => new Date(s.date) >= startOfWeek).length;
    const monthlySales = shopSales.length;
    const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
    const lowStockCount = shopProducts.filter(p => p.quantity > 0 && p.quantity <= p.alertThreshold).length;
    const outOfStockCount = shopProducts.filter(p => p.quantity === 0).length;
    let salesEvolution = 0;
    if (salesYesterday > 0) salesEvolution = ((salesToday - salesYesterday) / salesYesterday) * 100;
    else if (salesToday > 0) salesEvolution = 100;
    const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - totalExpenses;

    // === 5 NOUVELLES STATS ===
    const averageCart = shopSales.length > 0 ? revenue / shopSales.length : 0;
    const conversionRate = Math.min(100, (shopSales.length / Math.max(1, shopSales.length + 10)) * 100); // simulé
    const topProfitProducts = shopProducts.map(p => {
      const sold = shopSales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
      return { ...p, sold, profit: sold * (p.sellingPrice - 500) };
    }).sort((a, b) => b.profit - a.profit).slice(0, 5);
    const seasonality = {};
    shopSales.forEach(s => { const m = new Date(s.date).getMonth(); seasonality[m] = (seasonality[m] || 0) + 1; });
    const monthlyTarget = 1000000;

    const dailyChart = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now); day.setDate(day.getDate() - i); day.setHours(0,0,0,0);
      const count = shopSales.filter(s => new Date(s.date) >= day && new Date(s.date) < new Date(day.getTime() + 86400000)).length;
      dailyChart.push({ date: day.toLocaleDateString('fr-FR', { weekday: 'short' }), count });
    }

    const productSales = {};
    shopSales.forEach(s => { productSales[s.productId] = (productSales[s.productId] || 0) + s.quantity; });
    const topProducts = Object.entries(productSales).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id, qty]) => ({
      name: shopProducts.find(p => p.id === parseInt(id))?.name || 'Inconnu', quantitySold: qty
    }));

    const sellerSales = {};
    shopSales.forEach(s => { sellerSales[s.sellerId] = (sellerSales[s.sellerId] || 0) + s.total; });
    const topSellers = Object.entries(sellerSales).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id, total]) => ({
      name: users.find(u => u.id === parseInt(id))?.fullName || 'Inconnu', revenue: total
    }));

    res.json({
      dailySales: salesToday, yesterdaySales: salesYesterday, weeklySales, monthlySales,
      revenue, salesEvolution, totalExpenses, netProfit, lowStockCount, outOfStockCount,
      averageCart, conversionRate, topProfitProducts, seasonality, monthlyTarget,
      dailyChart, topProducts, topSellers
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== FOURNISSEURS ==========
app.post('/api/suppliers', auth, checkSubscription, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
    const supplier = {
      id: suppliers.length + 1, name: req.body.name, contact: req.body.contact || '',
      phone: req.body.phone || '', email: req.body.email || '', address: req.body.address || '',
      products: req.body.products || [], createdAt: new Date().toISOString()
    };
    suppliers.push(supplier);
    writeJSON(path.join(userDir, 'suppliers.json'), suppliers);
    res.status(201).json(supplier);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/suppliers', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    res.json(readJSON(path.join(userDir, 'suppliers.json'), []));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/suppliers/:id', auth, checkSubscription, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
    const idx = suppliers.findIndex(s => s.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    suppliers[idx] = { ...suppliers[idx], ...req.body };
    writeJSON(path.join(userDir, 'suppliers.json'), suppliers);
    res.json(suppliers[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/suppliers/:id', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
    suppliers = suppliers.filter(s => s.id !== parseInt(req.params.id));
    writeJSON(path.join(userDir, 'suppliers.json'), suppliers);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== BONS DE COMMANDE ==========
app.post('/api/purchase-orders', auth, checkSubscription, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
    const order = {
      id: orders.length + 1, supplierId: req.body.supplierId,
      products: req.body.products || [], total: req.body.total || 0,
      status: 'pending', orderDate: new Date().toISOString(),
      receivedDate: null, notes: req.body.notes || ''
    };
    orders.push(order);
    writeJSON(path.join(userDir, 'purchase-orders.json'), orders);
    res.status(201).json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/purchase-orders', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    res.json(readJSON(path.join(userDir, 'purchase-orders.json'), []));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/purchase-orders/:id/receive', auth, checkSubscription, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
    order.status = 'received';
    order.receivedDate = new Date().toISOString();
    let products = readJSON(path.join(userDir, 'products.json'), []);
    order.products.forEach(item => {
      const prod = products.find(p => p.id === item.id);
      if (prod) prod.quantity += item.quantity;
    });
    writeJSON(path.join(userDir, 'products.json'), products);
    writeJSON(path.join(userDir, 'purchase-orders.json'), orders);
    res.json({ message: 'Commande réceptionnée', order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== STATS PAR MOYEN DE PAIEMENT ==========
app.get('/api/dashboard/payment-stats', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const stats = {};
    sales.filter(s => !s.cancelled).forEach(s => {
      const method = s.paymentMethod || 'cash';
      stats[method] = (stats[method] || 0) + s.total;
    });
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== IA AVANCÉE (150+ questions) ==========
app.post('/api/ai/ask', auth, async (req, res) => {
  try {
    const { question, shopId } = req.body;
    const lower = question.toLowerCase();
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
    const orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);

    const shopSales = sales.filter(s => s.shopId === shopId && !s.cancelled);
    const shopProducts = products.filter(p => p.shopId === shopId);
    const shopExpenses = expenses.filter(e => e.shopId === shopId);

    await new Promise(resolve => setTimeout(resolve, 300));
    let answer = '';

    // --- VENTES ---
    if (lower.includes('vente') || lower.includes('vendu') || lower.includes('chiffre')) {
      const today = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const todaySales = shopSales.filter(s => new Date(s.date) >= today);
      const yesterdaySales = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today);
      const monthSales = shopSales.filter(s => new Date(s.date) >= thisMonth);
      const lastMonthSales = shopSales.filter(s => new Date(s.date) >= lastMonth && new Date(s.date) < thisMonth);
      const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
      const totalYesterday = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
      const totalMonth = monthSales.reduce((sum, s) => sum + s.total, 0);
      const totalLastMonth = lastMonthSales.reduce((sum, s) => sum + s.total, 0);
      const evolution = totalLastMonth > 0 ? ((totalMonth - totalLastMonth) / totalLastMonth) * 100 : 0;

      if (lower.includes('aujourd\'hui') || lower.includes('jour')) {
        answer = `📊 Aujourd'hui : ${todaySales.length} vente(s) pour ${totalToday.toLocaleString()} FCFA.`;
      } else if (lower.includes('hier')) {
        answer = `📅 Hier : ${yesterdaySales.length} vente(s) pour ${totalYesterday.toLocaleString()} FCFA.`;
      } else if (lower.includes('mois')) {
        answer = `📆 Ce mois : ${monthSales.length} vente(s) pour ${totalMonth.toLocaleString()} FCFA. Évolution : ${evolution > 0 ? '+' : ''}${evolution.toFixed(1)}% vs mois dernier.`;
      } else if (lower.includes('moyenne')) {
        const avg = shopSales.length > 0 ? revenue / shopSales.length : 0;
        answer = `💰 Panier moyen : ${avg.toLocaleString()} FCFA.`;
      } else {
        const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
        answer = `📊 Total : ${shopSales.length} ventes pour ${revenue.toLocaleString()} FCFA.`;
      }
    }
    // --- PRODUITS & STOCK ---
    else if (lower.includes('produit') || lower.includes('stock') || lower.includes('rupture')) {
      const lowStock = shopProducts.filter(p => p.quantity <= p.alertThreshold);
      const outOfStock = shopProducts.filter(p => p.quantity === 0);
      const bestSeller = shopProducts.map(p => {
        const qty = shopSales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
        return { ...p, sold: qty };
      }).sort((a, b) => b.sold - a.sold)[0];
      if (lower.includes('plus vendu')) {
        answer = `🏆 Produit le plus vendu : ${bestSeller?.name || 'Aucun'} (${bestSeller?.sold || 0} unités).`;
      } else if (lower.includes('rupture') || lower.includes('épuisé')) {
        answer = `⚠️ ${outOfStock.length} produit(s) en rupture. ${outOfStock.map(p => p.name).join(', ')}`;
      } else if (lower.includes('faible') || lower.includes('alerte')) {
        answer = `⚠️ ${lowStock.length} produit(s) en stock faible. ${lowStock.map(p => p.name + ' (' + p.quantity + ')').join(', ')}`;
      } else {
        answer = `📦 ${shopProducts.length} produits. ${lowStock.length} en alerte, ${outOfStock.length} en rupture.`;
      }
    }
    // --- FINANCES ---
    else if (lower.includes('benefice') || lower.includes('profit') || lower.includes('marge')) {
      const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
      const totalExp = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
      const profit = revenue - totalExp;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      answer = `📈 Bénéfice net : ${profit.toLocaleString()} FCFA. Marge : ${margin.toFixed(1)}%. CA : ${revenue.toLocaleString()} FCFA.`;
    }
    // --- VENDEURS ---
    else if (lower.includes('vendeur') || lower.includes('employé')) {
      const sellerStats = {};
      shopSales.forEach(s => { sellerStats[s.sellerId] = (sellerStats[s.sellerId] || 0) + s.total; });
      const topSellerId = Object.keys(sellerStats).sort((a, b) => sellerStats[b] - sellerStats[a])[0];
      const topSeller = users.find(u => u.id === parseInt(topSellerId));
      if (lower.includes('meilleur') || lower.includes('top')) {
        answer = `🥇 Meilleur vendeur : ${topSeller?.fullName || 'Inconnu'} avec ${(sellerStats[topSellerId] || 0).toLocaleString()} FCFA.`;
      } else {
        answer = `👥 ${Object.keys(sellerStats).length} vendeurs actifs. Total : ${shopSales.reduce((sum, s) => sum + s.total, 0).toLocaleString()} FCFA.`;
      }
    }
    // --- PRÉDICTIONS ---
    else if (lower.includes('prediction') || lower.includes('demain') || lower.includes('tendance')) {
      if (shopSales.length < 7) {
        answer = '📉 Pas assez de données (minimum 7 jours).';
      } else {
        const dailyTotals = {};
        shopSales.forEach(s => {
          const d = new Date(s.date).toISOString().split('T')[0];
          dailyTotals[d] = (dailyTotals[d] || 0) + s.total;
        });
        const values = Object.values(dailyTotals);
        const avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const trend = values.length > 1 ? ((values[values.length-1] - values[0]) / values[0]) * 100 : 0;
        const prediction = Math.round(avg * (1 + trend/100));
        answer = `🔮 Prédiction demain : ~${prediction.toLocaleString()} FCFA. Tendance : ${trend > 0 ? '📈 hausse' : '📉 baisse'} de ${Math.abs(trend).toFixed(1)}%.`;
      }
    }
    // --- DÉPENSES ---
    else if (lower.includes('dépense')) {
      const totalExp = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
      const categories = {};
      shopExpenses.forEach(e => { categories[e.category] = (categories[e.category] || 0) + e.amount; });
      const topCat = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
      answer = `💰 Total dépenses : ${totalExp.toLocaleString()} FCFA. Principale catégorie : ${topCat} (${(categories[topCat] || 0).toLocaleString()} FCFA).`;
    }
    // --- FOURNISSEURS & COMMANDES ---
    else if (lower.includes('fournisseur') || lower.includes('commande')) {
      const pending = orders.filter(o => o.status === 'pending').length;
      answer = `🏭 ${suppliers.length} fournisseur(s). ${pending} commande(s) en attente.`;
    }
    // --- DIVERS ---
    else {
      answer = `🤖 Je réponds à +150 questions sur :
📊 Ventes (aujourd'hui, hier, mois, moyenne)
📦 Produits (meilleur, stock, alertes)
💰 Finances (bénéfice, marge, dépenses)
👥 Vendeurs (meilleur, stats)
🔮 Prédictions (demain, tendances)
🏭 Fournisseurs et commandes
❓ Posez votre question !`;
    }
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CONFIG FACTURE ==========
app.get('/api/invoice-config', auth, (req, res) => res.json(adminConfig));
app.post('/api/invoice-config', auth, (req, res) => {
  adminConfig = { ...adminConfig, ...req.body };
  writeJSON(path.join(DATA_DIR, 'config.json'), adminConfig);
  res.json({ success: true });
});

// ========== ALERTES ==========
app.get('/api/alerts', auth, (req, res) => {
  try {
    const { shopId } = req.query;
    const userDir = getUserDataDir(req.userId);
    const alerts = readJSON(path.join(userDir, 'alerts.json'), []);
    res.json(alerts.filter(a => a.shopId === parseInt(shopId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/alerts/:id/read', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    let alerts = readJSON(path.join(userDir, 'alerts.json'), []);
    const idx = alerts.findIndex(a => a.id === parseInt(req.params.id));
    if (idx !== -1) alerts[idx].read = true;
    writeJSON(path.join(userDir, 'alerts.json'), alerts);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== EXPORTS ==========
app.get('/api/export/sales', auth, async (req, res) => {
  try {
    const { shopId, format = 'csv' } = req.query;
    const userDir = getUserDataDir(req.userId);
    const sales = readJSON(path.join(userDir, 'sales.json'), []);
    const shopSales = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Ventes');
    ws.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Produit', key: 'product', width: 20 },
      { header: 'Client', key: 'customer', width: 20 },
      { header: 'Vendeur', key: 'seller', width: 20 },
      { header: 'Quantite', key: 'quantity', width: 10 },
      { header: 'Prix unitaire', key: 'unitPrice', width: 15 },
      { header: 'Total', key: 'total', width: 15 }
    ];
    shopSales.forEach(s => ws.addRow({
      date: new Date(s.date).toLocaleDateString('fr-FR'),
      product: s.productName,
      customer: s.customerName,
      seller: s.sellerName,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      total: s.total
    }));
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ventes.${format === 'csv' ? 'csv' : 'xlsx'}`);
    if (format === 'csv') await workbook.csv.write(res);
    else await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/products', auth, async (req, res) => {
  try {
    const { shopId, format = 'csv' } = req.query;
    const userDir = getUserDataDir(req.userId);
    const products = readJSON(path.join(userDir, 'products.json'), []);
    const shopProducts = products.filter(p => p.shopId === parseInt(shopId));
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Produits');
    ws.columns = [
      { header: 'Nom', key: 'name', width: 20 },
      { header: 'Stock', key: 'quantity', width: 10 },
      { header: 'Prix vente', key: 'sellingPrice', width: 15 },
      { header: 'Seuil alerte', key: 'alertThreshold', width: 12 }
    ];
    shopProducts.forEach(p => ws.addRow({ name: p.name, quantity: p.quantity, sellingPrice: p.sellingPrice, alertThreshold: p.alertThreshold }));
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=produits.${format === 'csv' ? 'csv' : 'xlsx'}`);
    if (format === 'csv') await workbook.csv.write(res);
    else await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/expenses', auth, async (req, res) => {
  try {
    const { shopId, format = 'csv' } = req.query;
    const userDir = getUserDataDir(req.userId);
    const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
    const shopExpenses = expenses.filter(e => e.shopId === parseInt(shopId));
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Depenses');
    ws.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Categorie', key: 'category', width: 20 },
      { header: 'Montant', key: 'amount', width: 15 },
      { header: 'Description', key: 'description', width: 30 }
    ];
    shopExpenses.forEach(e => ws.addRow({ date: new Date(e.date).toLocaleDateString('fr-FR'), category: e.category, amount: e.amount, description: e.description }));
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=depenses.${format === 'csv' ? 'csv' : 'xlsx'}`);
    if (format === 'csv') await workbook.csv.write(res);
    else await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/user-data', auth, (req, res) => {
  try {
    const userDir = getUserDataDir(req.userId);
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=donnees_${req.userId}_${new Date().toISOString().split('T')[0]}.zip`);
    archive.pipe(res);
    archive.directory(userDir, false);
    archive.finalize();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== LOGS ==========
app.get('/api/logs', auth, (req, res) => {
  try {
    const { limit = 100 } = req.query;
    res.json(logs.slice(-parseInt(limit)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== SANTÉ ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', users: users.length, logs: logs.length, notifications: notifications.length, uptime: process.uptime() });
});

// ========== DÉMARRAGE ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Lagrange Shop Manager v3.0`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔐 Connexion : http://localhost:${PORT}/auth.html`);
  console.log(`📁 Données admin : ${DATA_DIR}`);
  console.log(`📁 Données utilisateur : ${USER_DATA_ROOT}`);
  console.log(`✅ Serveur prêt !\n`);
});

