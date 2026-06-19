const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

// Stores per-company dynamic module/submenu/field access config set by super admin
const CompanyModuleConfigSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    modules: {
        type: Map,
        of: Boolean,
        default: () => ({
            sales: true, purchase: true, jobWork: true, accounting: true,
            gst: true, inventory: true, reports: true, masters: true, utilities: true
        })
    },
    subMenus: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    fields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ...configMetaSchema
}, { timestamps: true });

module.exports = mongoose.model('CompanyModuleConfig', CompanyModuleConfigSchema);
