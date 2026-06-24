const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');

const app = express();
app.use(express.json({ limit: '50mb' }));

// ========== CONFIGURATION ==========
const DATA_DIR = path.join(__dirname, 'data');
const USER_DATA_ROOT = path.join(__dirname, 'user-data');
const JWT_SECRET = process.env.JWT_SECRET || 'lagrange_super_secret_key_change_me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

// ========== FONCTIONS UTILITAIRES ==========
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, defaultVal = {}) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        return defaultVal;
    } catch (e) {
        console.error('Erreur lecture JSON:', file, e);
        return defaultVal;
    }
}

function writeJSON(file, data) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getUserDataDir(userId) {
    const dir = path.join(USER_DATA_ROOT, String(userId));
    ensureDir(dir);
    return dir;
}

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

// ========== UTILISATEURS ==========
let users = [];
const usersFile = path.join(DATA_DIR, 'users.json');

function loadUsers() {
    if (fs.existsSync(usersFile)) {
        users = readJSON(usersFile, []);
        const adminExists = users.find(u => u.email === 'admin@lagrange.com');
        if (!adminExists) {
            users.push({
                id: 1,
                email: 'admin@lagrange.com',
                password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
                fullName: 'Administrateur',
                role: 'super_admin',
                createdAt: new Date().toISOString()
            });
            writeJSON(usersFile, users);
        }
    } else {
        users = [{
            id: 1,
            email: 'admin@lagrange.com',
            password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
            fullName: 'Administrateur',
            role: 'super_admin',
            createdAt: new Date().toISOString()
        }];
        writeJSON(usersFile, users);
    }
}
loadUsers();

// ========== MIDDLEWARES ==========
function auth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token invalide' });
    }
}

function adminAuth(req, res, next) {
    auth(req, res, () => {
        if (req.userRole !== 'admin' && req.userRole !== 'super_admin') {
            return res.status(403).json({ error: 'Accès admin requis' });
        }
        next();
    });
}

// ========== AUTHENTIFICATION ==========
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== INSCRIPTION PUBLIQUE (CORRIGÉE) ==========
app.post('/api/auth/register', (req, res) => {
    try {
        const { email, password, fullName, role = 'user' } = req.body;
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email déjà utilisé' });
        }
        const newUser = {
            id: generateId(),
            email,
            password: bcrypt.hashSync(password, 10),
            fullName,
            role: role || 'user',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        writeJSON(usersFile, users);
        getUserDataDir(newUser.id);

        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.fullName,
                role: newUser.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', auth, (req, res) => {
    try {
        const user = users.find(u => u.id === req.userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        res.json({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== ADMIN - GESTION DES UTILISATEURS ==========
app.get('/api/admin/users', adminAuth, (req, res) => {
    try {
        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            createdAt: u.createdAt
        }));
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', adminAuth, (req, res) => {
    try {
        const { email, password, fullName, role = 'user' } = req.body;
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email déjà utilisé' });
        }
        const newUser = {
            id: generateId(),
            email,
            password: bcrypt.hashSync(password, 10),
            fullName,
            role: role || 'user',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        writeJSON(usersFile, users);
        getUserDataDir(newUser.id);
        res.json({ success: true, user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName, role: newUser.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (userId === 1) {
            return res.status(400).json({ error: 'Impossible de supprimer l\'administrateur principal' });
        }
        users = users.filter(u => u.id !== userId);
        writeJSON(usersFile, users);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', adminAuth, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { fullName, role } = req.body;
        const user = users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        if (fullName) user.fullName = fullName;
        if (role) user.role = role;
        writeJSON(usersFile, users);
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== BOUTIQUES ==========
app.get('/api/shops', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        const shops = readJSON(path.join(userDir, 'shops.json'), []);
        res.json(shops);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shops', auth, (req, res) => {
    try {
        const { name, address, phone } = req.body;
        const userDir = getUserDataDir(req.userId);
        const shops = readJSON(path.join(userDir, 'shops.json'), []);
        const newShop = {
            id: generateId(),
            name,
            address: address || '',
            phone: phone || '',
            createdAt: new Date().toISOString()
        };
        shops.push(newShop);
        writeJSON(path.join(userDir, 'shops.json'), shops);
        res.json(newShop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shops/:id', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        let shops = readJSON(path.join(userDir, 'shops.json'), []);
        shops = shops.filter(s => s.id !== parseInt(req.params.id));
        writeJSON(path.join(userDir, 'shops.json'), shops);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== PRODUITS ==========
app.get('/api/products', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const filtered = products.filter(p => p.shopId === parseInt(shopId));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', auth, (req, res) => {
    try {
        const { name, sellingPrice, quantity, alertThreshold, shopId, barcode, expiryDate, image } = req.body;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const newProduct = {
            id: generateId(),
            name,
            sellingPrice: sellingPrice || 0,
            quantity: quantity || 0,
            alertThreshold: alertThreshold || 5,
            shopId,
            barcode: barcode || '',
            expiryDate: expiryDate || null,
            image: image || null,
            createdAt: new Date().toISOString()
        };
        products.push(newProduct);
        writeJSON(path.join(userDir, 'products.json'), products);

        if (newProduct.quantity <= newProduct.alertThreshold) {
            const alerts = readJSON(path.join(userDir, 'alerts.json'), []);
            alerts.push({
                id: generateId(),
                shopId,
                type: 'low_stock',
                title: 'Stock faible',
                message: 'Stock de ' + newProduct.name + ' est à ' + newProduct.quantity + ' (seuil: ' + newProduct.alertThreshold + ')',
                read: false,
                createdAt: new Date().toISOString()
            });
            writeJSON(path.join(userDir, 'alerts.json'), alerts);
        }

        res.json(newProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        let products = readJSON(path.join(userDir, 'products.json'), []);
        products = products.filter(p => p.id !== parseInt(req.params.id));
        writeJSON(path.join(userDir, 'products.json'), products);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products/:id/restock', auth, (req, res) => {
    try {
        const { quantity } = req.body;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
        product.quantity += quantity;
        writeJSON(path.join(userDir, 'products.json'), products);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id/variants', auth, (req, res) => {
    try {
        const { variants, expiryDate } = req.body;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
        product.variants = variants || [];
        if (expiryDate) product.expiryDate = expiryDate;
        writeJSON(path.join(userDir, 'products.json'), products);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products/:id/photo', auth, (req, res) => {
    try {
        const { image } = req.body;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const product = products.find(p => p.id === parseInt(req.params.id));
        if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
        product.image = image;
        writeJSON(path.join(userDir, 'products.json'), products);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== VENTES ==========
app.post('/api/sales', auth, (req, res) => {
    try {
        const { productId, quantity, shopId, customPrice, customerName, paymentMethod } = req.body;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);

        const product = products.find(p => p.id === productId && p.shopId === shopId);
        if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
        if (product.quantity < quantity) return res.status(400).json({ error: 'Stock insuffisant' });

        const unitPrice = customPrice || product.sellingPrice;
        const total = unitPrice * quantity;

        product.quantity -= quantity;
        writeJSON(path.join(userDir, 'products.json'), products);

        const sale = {
            id: generateId(),
            productId,
            productName: product.name,
            quantity,
            unitPrice,
            total,
            shopId,
            customerName: customerName || 'Client',
            sellerId: req.userId,
            sellerName: users.find(u => u.id === req.userId)?.fullName || 'Inconnu',
            paymentMethod: paymentMethod || 'cash',
            date: new Date().toISOString(),
            cancelled: false
        };
        sales.push(sale);
        writeJSON(path.join(userDir, 'sales.json'), sales);

        const invoices = readJSON(path.join(userDir, 'invoices.json'), []);
        const invoiceNumber = 'INV-' + String(generateId()).slice(-6);
        const invoice = {
            id: generateId(),
            invoiceNumber,
            saleId: sale.id,
            sale,
            total,
            createdAt: new Date().toISOString()
        };
        invoices.push(invoice);
        writeJSON(path.join(userDir, 'invoices.json'), invoices);

        if (product.quantity <= product.alertThreshold) {
            const alerts = readJSON(path.join(userDir, 'alerts.json'), []);
            alerts.push({
                id: generateId(),
                shopId,
                type: 'low_stock',
                title: 'Stock faible',
                message: 'Stock de ' + product.name + ' est à ' + product.quantity + ' (seuil: ' + product.alertThreshold + ')',
                read: false,
                createdAt: new Date().toISOString()
            });
            writeJSON(path.join(userDir, 'alerts.json'), alerts);
        }

        let perfMessage = '';
        const totalSalesToday = sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length;
        if (totalSalesToday >= 10) perfMessage = '🎉 Excellent ! Déjà ' + totalSalesToday + ' ventes aujourd\'hui !';
        else if (totalSalesToday >= 5) perfMessage = '💪 Bonne journée ! ' + totalSalesToday + ' ventes déjà.';
        else if (totalSalesToday >= 3) perfMessage = '👍 Pas mal, continuez !';

        res.json({ success: true, sale, performanceMessage: perfMessage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sales', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        const filtered = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
        res.json(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales/:id/cancel', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        const sale = sales.find(s => s.id === parseInt(req.params.id));
        if (!sale) return res.status(404).json({ error: 'Vente non trouvée' });
        if (sale.cancelled) return res.status(400).json({ error: 'Vente déjà annulée' });

        const saleDate = new Date(sale.date);
        const now = new Date();
        const diffMinutes = (now - saleDate) / 60000;
        if (req.userRole !== 'admin' && req.userRole !== 'super_admin' && diffMinutes > 15) {
            return res.status(400).json({ error: 'Délai de 15 minutes dépassé' });
        }

        sale.cancelled = true;
        writeJSON(path.join(userDir, 'sales.json'), sales);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== FACTURES ==========
app.get('/api/invoices', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const invoices = readJSON(path.join(userDir, 'invoices.json'), []);
        const filtered = invoices.filter(i => i.sale?.shopId === parseInt(shopId));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/:saleId/pdf', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        const invoices = readJSON(path.join(userDir, 'invoices.json'), []);
        const invoice = invoices.find(i => i.saleId === parseInt(req.params.saleId));
        if (!invoice) return res.status(404).json({ error: 'Facture non trouvée' });

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=facture_' + invoice.invoiceNumber + '.pdf');
        doc.pipe(res);

        const config = readJSON(path.join(DATA_DIR, 'config.json'), {
            companyName: 'Lagrange Shop',
            address: 'Votre adresse',
            phone: 'Votre téléphone',
            email: 'contact@lagrange.com',
            taxRate: 0
        });

        doc.fontSize(18).text(config.companyName, { align: 'center' });
        doc.fontSize(10).text(config.address, { align: 'center' });
        doc.fontSize(10).text('Tél: ' + config.phone + ' | Email: ' + config.email, { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text('FACTURE N° ' + invoice.invoiceNumber, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text('Date: ' + new Date(invoice.createdAt).toLocaleDateString('fr-FR'));
        doc.text('Client: ' + invoice.sale.customerName);
        doc.moveDown();
        doc.fontSize(10).text('Produit: ' + invoice.sale.productName);
        doc.text('Quantité: ' + invoice.sale.quantity);
        doc.text('Prix unitaire: ' + invoice.sale.unitPrice.toLocaleString() + ' FCFA');
        doc.moveDown();
        doc.fontSize(12).text('Total: ' + invoice.total.toLocaleString() + ' FCFA', { align: 'right' });
        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== DÉPENSES ==========
app.get('/api/expenses', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
        const filtered = expenses.filter(e => e.shopId === parseInt(shopId));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', auth, (req, res) => {
    try {
        const { category, amount, date, description, shopId } = req.body;
        const userDir = getUserDataDir(req.userId);
        const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
        const newExpense = {
            id: generateId(),
            category,
            amount,
            date: date || new Date().toISOString().split('T')[0],
            description: description || '',
            shopId,
            createdAt: new Date().toISOString()
        };
        expenses.push(newExpense);
        writeJSON(path.join(userDir, 'expenses.json'), expenses);
        res.json(newExpense);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/expenses/:id', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        let expenses = readJSON(path.join(userDir, 'expenses.json'), []);
        expenses = expenses.filter(e => e.id !== parseInt(req.params.id));
        writeJSON(path.join(userDir, 'expenses.json'), expenses);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== FOURNISSEURS ==========
app.get('/api/suppliers', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
        const filtered = suppliers.filter(s => s.shopId === parseInt(shopId));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/suppliers', auth, (req, res) => {
    try {
        const { name, contact, phone, email, address, shopId } = req.body;
        const userDir = getUserDataDir(req.userId);
        const suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
        const newSupplier = {
            id: generateId(),
            name,
            contact: contact || '',
            phone: phone || '',
            email: email || '',
            address: address || '',
            shopId,
            createdAt: new Date().toISOString()
        };
        suppliers.push(newSupplier);
        writeJSON(path.join(userDir, 'suppliers.json'), suppliers);
        res.json(newSupplier);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/suppliers/:id', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        let suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
        suppliers = suppliers.filter(s => s.id !== parseInt(req.params.id));
        writeJSON(path.join(userDir, 'suppliers.json'), suppliers);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== BONS DE COMMANDE ==========
app.get('/api/purchase-orders', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
        const filtered = orders.filter(o => o.shopId === parseInt(shopId));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/purchase-orders', auth, (req, res) => {
    try {
        const { supplierId, products, notes, shopId } = req.body;
        const userDir = getUserDataDir(req.userId);
        const orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
        const suppliers = readJSON(path.join(userDir, 'suppliers.json'), []);
        const supplier = suppliers.find(s => s.id === supplierId);

        const total = products.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);
        const order = {
            id: generateId(),
            orderNumber: 'CMD-' + String(generateId()).slice(-6),
            supplierId,
            supplierName: supplier?.name || 'Inconnu',
            products,
            total,
            notes: notes || '',
            shopId,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        orders.push(order);
        writeJSON(path.join(userDir, 'purchase-orders.json'), orders);
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/purchase-orders/:id/receive', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        const orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const order = orders.find(o => o.id === parseInt(req.params.id));
        if (!order) return res.status(404).json({ error: 'Commande non trouvée' });

        order.status = 'received';

        order.products.forEach(po => {
            const product = products.find(p => p.id === po.productId && p.shopId === order.shopId);
            if (product) {
                product.quantity += po.quantity;
            }
        });
        writeJSON(path.join(userDir, 'products.json'), products);
        writeJSON(path.join(userDir, 'purchase-orders.json'), orders);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/purchase-orders/:id/cancel', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        const orders = readJSON(path.join(userDir, 'purchase-orders.json'), []);
        const order = orders.find(o => o.id === parseInt(req.params.id));
        if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
        order.status = 'cancelled';
        writeJSON(path.join(userDir, 'purchase-orders.json'), orders);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== TRANSFERTS ==========
app.post('/api/transfers', auth, (req, res) => {
    try {
        const { fromShopId, toShopId, productId, quantity, shopId } = req.body;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const transfers = readJSON(path.join(userDir, 'transfers.json'), []);
        const shops = readJSON(path.join(userDir, 'shops.json'), []);

        const fromProduct = products.find(p => p.id === productId && p.shopId === fromShopId);
        if (!fromProduct) return res.status(400).json({ error: 'Produit non trouvé dans la boutique source' });
        if (fromProduct.quantity < quantity) return res.status(400).json({ error: 'Stock insuffisant' });

        fromProduct.quantity -= quantity;
        const toProduct = products.find(p => p.id === productId && p.shopId === toShopId);
        if (toProduct) {
            toProduct.quantity += quantity;
        } else {
            const newProduct = { ...fromProduct, id: generateId(), shopId: toShopId, quantity };
            products.push(newProduct);
        }

        writeJSON(path.join(userDir, 'products.json'), products);

        const fromShop = shops.find(s => s.id === fromShopId);
        const toShop = shops.find(s => s.id === toShopId);
        transfers.push({
            id: generateId(),
            fromShopId,
            toShopId,
            fromShopName: fromShop?.name || 'Inconnue',
            toShopName: toShop?.name || 'Inconnue',
            productId,
            productName: fromProduct.name,
            quantity,
            date: new Date().toISOString()
        });
        writeJSON(path.join(userDir, 'transfers.json'), transfers);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transfers', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const transfers = readJSON(path.join(userDir, 'transfers.json'), []);
        const filtered = transfers.filter(t => t.fromShopId === parseInt(shopId) || t.toShopId === parseInt(shopId));
        res.json(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== VENDEURS ==========
app.post('/api/vendors', auth, (req, res) => {
    try {
        const { email, fullName, phone, cni, address, commission, shopId } = req.body;
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email déjà utilisé' });
        }
        const tempPassword = Math.random().toString(36).slice(-8);
        const newVendor = {
            id: generateId(),
            email,
            password: bcrypt.hashSync(tempPassword, 10),
            fullName,
            phone: phone || '',
            cni: cni || '',
            address: address || '',
            role: 'vendor',
            commission: commission || 0,
            shopId,
            createdAt: new Date().toISOString()
        };
        users.push(newVendor);
        writeJSON(usersFile, users);
        getUserDataDir(newVendor.id);
        res.json({ success: true, message: 'Vendeur invité avec succès', tempPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vendors', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const vendors = users.filter(u => u.role === 'vendor' && u.shopId === parseInt(shopId));
        res.json(vendors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/vendors/:id', auth, (req, res) => {
    try {
        users = users.filter(u => u.id !== parseInt(req.params.id));
        writeJSON(usersFile, users);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== ALERTES ==========
app.get('/api/alerts', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const alerts = readJSON(path.join(userDir, 'alerts.json'), []);
        const filtered = alerts.filter(a => a.shopId === parseInt(shopId));
        res.json(filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/alerts/:id/read', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        let alerts = readJSON(path.join(userDir, 'alerts.json'), []);
        const index = alerts.findIndex(a => a.id === parseInt(req.params.id));
        if (index !== -1) alerts[index].read = true;
        writeJSON(path.join(userDir, 'alerts.json'), alerts);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== DASHBOARD ==========
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const dailySales = shopSales.filter(s => new Date(s.date) >= today).length;
        const yesterdaySales = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
        const weeklySales = shopSales.filter(s => new Date(s.date) >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)).length;
        const monthlySales = shopSales.filter(s => new Date(s.date).getMonth() === today.getMonth()).length;

        const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
        const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = revenue - totalExpenses;

        const lowStock = shopProducts.filter(p => p.quantity <= p.alertThreshold && p.quantity > 0).length;
        const outOfStock = shopProducts.filter(p => p.quantity === 0).length;

        const salesEvolution = yesterdaySales > 0 ? ((dailySales - yesterdaySales) / yesterdaySales * 100) : 0;

        const dailyChart = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const count = shopSales.filter(s => new Date(s.date).toDateString() === d.toDateString()).length;
            dailyChart.push({ date: d.toLocaleDateString('fr-FR', { weekday: 'short' }), count });
        }

        const productQty = {};
        shopSales.forEach(s => productQty[s.productId] = (productQty[s.productId] || 0) + s.quantity);
        const topProducts = Object.entries(productQty)
            .map(([id, qty]) => ({ id: parseInt(id), quantitySold: qty }))
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, 5)
            .map(p => ({ ...p, name: shopProducts.find(pr => pr.id === p.id)?.name || 'Inconnu' }));

        const sellerRevenue = {};
        shopSales.forEach(s => sellerRevenue[s.sellerId] = (sellerRevenue[s.sellerId] || 0) + s.total);
        const topSellers = Object.entries(sellerRevenue)
            .map(([id, rev]) => ({ id: parseInt(id), revenue: rev }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
            .map(s => ({ ...s, name: users.find(u => u.id === s.id)?.fullName || 'Inconnu' }));

        res.json({
            dailySales,
            yesterdaySales,
            weeklySales,
            monthlySales,
            revenue,
            totalExpenses,
            netProfit,
            lowStockCount: lowStock,
            outOfStockCount: outOfStock,
            salesEvolution,
            dailyChart,
            topProducts,
            topSellers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/advanced-stats', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const expenses = readJSON(path.join(userDir, 'expenses.json'), []);

        const shopSales = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
        const shopProducts = products.filter(p => p.shopId === parseInt(shopId));
        const shopExpenses = expenses.filter(e => e.shopId === parseInt(shopId));

        const totalSalesCount = shopSales.length;
        const totalRevenue = shopSales.reduce((sum, s) => sum + s.total, 0);
        const averageCart = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
        const conversionRate = Math.min(100, Math.round((totalSalesCount / (totalSalesCount + 10)) * 100));

        const productProfit = {};
        shopSales.forEach(s => {
            const cost = shopProducts.find(p => p.id === s.productId)?.costPrice || s.unitPrice * 0.7;
            const profit = s.total - (cost * s.quantity);
            productProfit[s.productId] = (productProfit[s.productId] || 0) + profit;
        });
        let mostProfitableProduct = null;
        let maxProfit = 0;
        Object.entries(productProfit).forEach(([id, profit]) => {
            if (profit > maxProfit) {
                maxProfit = profit;
                const p = shopProducts.find(pr => pr.id === parseInt(id));
                mostProfitableProduct = { name: p?.name || 'Inconnu', profit };
            }
        });

        const monthlySales = {};
        shopSales.forEach(s => {
            const month = new Date(s.date).toLocaleString('fr-FR', { month: 'long' });
            monthlySales[month] = (monthlySales[month] || 0) + s.total;
        });

        const monthlyTarget = 1000000;
        const currentMonthRevenue = shopSales.filter(s => new Date(s.date).getMonth() === new Date().getMonth())
            .reduce((sum, s) => sum + s.total, 0);
        const targetProgress = Math.min(100, Math.round((currentMonthRevenue / monthlyTarget) * 100));

        res.json({
            averageCart,
            conversionRate,
            mostProfitableProduct,
            monthlySales,
            monthlyTarget,
            currentMonthRevenue,
            targetProgress
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/payment-stats', auth, (req, res) => {
    try {
        const { shopId } = req.query;
        const userDir = getUserDataDir(req.userId);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        const shopSales = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);

        const paymentStats = {};
        shopSales.forEach(s => {
            const method = s.paymentMethod || 'cash';
            paymentStats[method] = (paymentStats[method] || 0) + s.total;
        });
        res.json(paymentStats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== IA ==========
app.post('/api/ai/ask', auth, (req, res) => {
    try {
        const { question, shopId } = req.body;
        const lower = question.toLowerCase();
        const userDir = getUserDataDir(req.userId);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const expenses = readJSON(path.join(userDir, 'expenses.json'), []);

        const shopSales = sales.filter(s => s.shopId === shopId && !s.cancelled);
        const shopProducts = products.filter(p => p.shopId === shopId);
        const shopExpenses = expenses.filter(e => e.shopId === shopId);

        let answer = '';

        if ((lower.includes('aujourd') || lower.includes('jour')) && (lower.includes('vente') || lower.includes('vendu'))) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const todayCount = shopSales.filter(s => new Date(s.date) >= today).length;
            const yesterdayCount = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
            answer = "Aujourd'hui : " + todayCount + " vente(s). Hier : " + yesterdayCount + " vente(s).";
        } else if (lower.includes('hier') && (lower.includes('vente') || lower.includes('vendu'))) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const count = shopSales.filter(s => new Date(s.date) >= yesterday && new Date(s.date) < today).length;
            answer = "Hier : " + count + " vente(s).";
        } else if (lower.includes('produit') && lower.includes('plus vendu')) {
            const productQty = {};
            shopSales.forEach(s => productQty[s.productId] = (productQty[s.productId] || 0) + s.quantity);
            if (Object.keys(productQty).length === 0) answer = 'Aucune vente enregistree.';
            else {
                const topId = Object.keys(productQty).reduce((a, b) => productQty[a] > productQty[b] ? a : b);
                const product = shopProducts.find(p => p.id === parseInt(topId));
                answer = "Produit le plus vendu : " + (product?.name || 'Inconnu') + " (" + productQty[topId] + " unites).";
            }
        } else if (lower.includes('meilleur vendeur') || lower.includes('top vendeur')) {
            const sellerSalesMap = {};
            shopSales.forEach(s => sellerSalesMap[s.sellerId] = (sellerSalesMap[s.sellerId] || 0) + s.total);
            if (Object.keys(sellerSalesMap).length === 0) answer = 'Aucune vente enregistree.';
            else {
                const topId = Object.keys(sellerSalesMap).reduce((a, b) => sellerSalesMap[a] > sellerSalesMap[b] ? a : b);
                const seller = users.find(u => u.id === parseInt(topId));
                answer = "Meilleur vendeur : " + (seller?.fullName || 'Inconnu') + " (" + sellerSalesMap[topId].toLocaleString() + " FCFA).";
            }
        } else if (lower.includes('commander') || lower.includes('stock') || lower.includes('reapprovisionner')) {
            const low = shopProducts.filter(p => p.quantity <= p.alertThreshold);
            if (low.length === 0) answer = 'Stock suffisant pour tous les produits.';
            else answer = "Produits a reapprovisionner : " + low.map(p => p.name + " (" + p.quantity + " restants)").join(', ');
        } else if (lower.includes('depense') || lower.includes('depenses')) {
            const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
            answer = "Total des depenses : " + totalExpenses.toLocaleString() + " FCFA.";
        } else if (lower.includes('benefice') || lower.includes('profit')) {
            const revenue = shopSales.reduce((sum, s) => sum + s.total, 0);
            const totalExpenses = shopExpenses.reduce((sum, e) => sum + e.amount, 0);
            const profit = revenue - totalExpenses;
            answer = "Benefice net : " + profit.toLocaleString() + " FCFA (CA: " + revenue.toLocaleString() + " FCFA - Depenses: " + totalExpenses.toLocaleString() + " FCFA)";
        } else if (lower.includes('prediction') || lower.includes('demain')) {
            if (shopSales.length < 7) answer = 'Pas assez de donnees (minimum 7 jours).';
            else {
                const dailyTotals = {};
                shopSales.forEach(sale => {
                    const date = new Date(sale.date).toISOString().split('T')[0];
                    dailyTotals[date] = (dailyTotals[date] || 0) + sale.total;
                });
                const values = Object.values(dailyTotals);
                const last7Avg = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
                const prediction = Math.round(last7Avg * 1.05);
                answer = "Prediction demain : ~" + prediction.toLocaleString() + " FCFA.";
            }
        } else {
            answer = "Je reponds aux questions sur : Ventes (aujourd'hui, hier), Produit plus vendu, Meilleur vendeur, Stock, Depenses, Benefice, Prediction. Ex: 'Combien de ventes aujourd'hui ?'";
        }

        res.json({ answer });
    } catch (err) {
        console.error('Erreur IA:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== EXPORT ==========
app.get('/api/export/sales', auth, async (req, res) => {
    try {
        const { shopId, format = 'csv' } = req.query;
        const userDir = getUserDataDir(req.userId);
        const sales = readJSON(path.join(userDir, 'sales.json'), []);
        const shopSales = sales.filter(s => s.shopId === parseInt(shopId) && !s.cancelled);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ventes');
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Produit', key: 'product', width: 20 },
            { header: 'Client', key: 'customer', width: 20 },
            { header: 'Vendeur', key: 'seller', width: 20 },
            { header: 'Quantite', key: 'quantity', width: 10 },
            { header: 'Prix unitaire', key: 'unitPrice', width: 15 },
            { header: 'Total', key: 'total', width: 15 },
            { header: 'Moyen paiement', key: 'paymentMethod', width: 15 }
        ];
        shopSales.forEach(s => worksheet.addRow({
            date: new Date(s.date).toLocaleDateString('fr-FR'),
            product: s.productName,
            customer: s.customerName,
            seller: s.sellerName,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            total: s.total,
            paymentMethod: s.paymentMethod || 'cash'
        }));
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=ventes.csv');
            await workbook.csv.write(res);
        } else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=ventes.xlsx');
            await workbook.xlsx.write(res);
        }
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export/products', auth, async (req, res) => {
    try {
        const { shopId, format = 'csv' } = req.query;
        const userDir = getUserDataDir(req.userId);
        const products = readJSON(path.join(userDir, 'products.json'), []);
        const shopProducts = products.filter(p => p.shopId === parseInt(shopId));
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Produits');
        worksheet.columns = [
            { header: 'Nom', key: 'name', width: 20 },
            { header: 'Stock', key: 'quantity', width: 10 },
            { header: 'Prix vente', key: 'sellingPrice', width: 15 },
            { header: 'Seuil alerte', key: 'alertThreshold', width: 12 },
            { header: 'Date peremption', key: 'expiryDate', width: 15 }
        ];
        shopProducts.forEach(p => worksheet.addRow({
            name: p.name,
            quantity: p.quantity,
            sellingPrice: p.sellingPrice,
            alertThreshold: p.alertThreshold,
            expiryDate: p.expiryDate || '-'
        }));
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=produits.csv');
            await workbook.csv.write(res);
        } else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=produits.xlsx');
            await workbook.xlsx.write(res);
        }
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export/expenses', auth, async (req, res) => {
    try {
        const { shopId, format = 'csv' } = req.query;
        const userDir = getUserDataDir(req.userId);
        const expenses = readJSON(path.join(userDir, 'expenses.json'), []);
        const shopExpenses = expenses.filter(e => e.shopId === parseInt(shopId));
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Depenses');
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 20 },
            { header: 'Categorie', key: 'category', width: 20 },
            { header: 'Montant', key: 'amount', width: 15 },
            { header: 'Description', key: 'description', width: 30 }
        ];
        shopExpenses.forEach(e => worksheet.addRow({
            date: new Date(e.date).toLocaleDateString('fr-FR'),
            category: e.category,
            amount: e.amount,
            description: e.description
        }));
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=depenses.csv');
            await workbook.csv.write(res);
        } else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=depenses.xlsx');
            await workbook.xlsx.write(res);
        }
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export/user-data', auth, (req, res) => {
    try {
        const userDir = getUserDataDir(req.userId);
        const archive = archiver('zip', { zlib: { level: 9 } });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=donnees_' + req.userId + '_' + new Date().toISOString().split('T')[0] + '.zip');
        archive.pipe(res);
        archive.directory(userDir, false);
        archive.finalize();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== CONFIG FACTURE ==========
let adminConfig = readJSON(path.join(DATA_DIR, 'config.json'), {
    companyName: 'Lagrange Shop',
    address: 'Votre adresse',
    phone: 'Votre téléphone',
    email: 'contact@lagrange.com',
    taxRate: 0,
    currency: 'FCFA'
});

app.get('/api/invoice-config', auth, (req, res) => {
    res.json(adminConfig);
});

app.post('/api/invoice-config', auth, (req, res) => {
    try {
        adminConfig = { ...adminConfig, ...req.body };
        writeJSON(path.join(DATA_DIR, 'config.json'), adminConfig);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== ROUTES STATIQUES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ========== SANTE ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        users: users.length,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// ========== DÉMARRAGE ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Lagrange Shop Manager v3.0');
    console.log('📍 http://localhost:' + PORT);
    console.log('🔐 Connexion : http://localhost:' + PORT + '/auth.html');
    console.log('📁 Données admin : ' + DATA_DIR);
    console.log('📁 Données utilisateur : ' + USER_DATA_ROOT);
    console.log('✅ Serveur prêt !\n');
});

module.exports = app;
