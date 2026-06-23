const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerName: { type: String, required: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    recommendedPrice: { type: Number, default: 0 },
    customerName: { type: String, default: 'Client' },
    date: { type: Date, default: Date.now },
    cancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null }
});

module.exports = mongoose.model('Sale', saleSchema);
