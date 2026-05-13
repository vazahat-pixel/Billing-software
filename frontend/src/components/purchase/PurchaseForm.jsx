import React from 'react';
import { FormField, ERPInput, ERPSelect } from '../forms/FormElements';

const PurchaseForm = ({ header, onChange, suppliers }) => {
  return (
    <div className="erp-form-container border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-shadow">
      <div className="erp-form-header">
        <h2 className="erp-form-title">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">
            📥
          </div>
          Purchase Header Details
        </h2>
      </div>

      <div className="erp-grid-4">
        <FormField label="Supplier">
          <ERPSelect 
            name="supplierId" 
            value={header.supplierId} 
            onChange={onChange} 
            options={suppliers} 
          />
        </FormField>
        <FormField label="Invoice No">
          <ERPInput name="invoiceNo" value={header.invoiceNo} onChange={onChange} placeholder="Auto-generated" />
        </FormField>
        <FormField label="Date">
          <ERPInput type="date" name="date" value={header.date} onChange={onChange} />
        </FormField>
        <FormField label="Due Date">
          <ERPInput type="date" name="dueDate" value={header.dueDate} onChange={onChange} />
        </FormField>
      </div>

      <div className="erp-grid-3 mt-4">
        <FormField label="Transport Name">
          <ERPInput name="transport" value={header.transport} onChange={onChange} placeholder="e.g. VRL Logistics" />
        </FormField>
        <FormField label="Broker">
          <ERPInput name="broker" value={header.broker} onChange={onChange} placeholder="e.g. Rahul Agency" />
        </FormField>
        <FormField label="LR No / Waybill">
          <ERPInput name="lrNo" value={header.lrNo} onChange={onChange} placeholder="LR-12345" />
        </FormField>
      </div>
    </div>
  );
};

export default PurchaseForm;
