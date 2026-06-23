const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sellingPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    alertThreshold: { type: Number, default: 5 },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    barcode: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
