const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    type: { type: String, enum: ['low_stock', 'info', 'warning'], default: 'info' },
    message: { type: String, required: true },
    level: { type: String, enum: ['info', 'warning', 'danger'], default: 'info' },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
