const mongoose = require('mongoose');

const invoiceConfigSchema = new mongoose.Schema({
    companyName: { type: String, default: '' },
    companyAddress: { type: String, default: '' },
    companyPhone: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    taxRate: { type: Number, default: 0 }
});

module.exports = mongoose.model('InvoiceConfig', invoiceConfigSchema);
