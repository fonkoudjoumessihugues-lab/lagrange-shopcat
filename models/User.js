const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'vendor', 'admin', 'super_admin'], default: 'user' },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    phone: { type: String, default: null },
    cni: { type: String, default: null },
    address: { type: String, default: null },
    hireDate: { type: Date, default: null },
    commission: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
