const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
    fromShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    toShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transfer', transferSchema);
