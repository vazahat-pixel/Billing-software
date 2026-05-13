import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { ERPInput } from '../../components/forms/FormElements';
import PartyModal from './PartyModal';
import { Search, Plus, Edit2, Trash2, XCircle, UserCheck } from 'lucide-react';

const PartyMaster = () => {
  const { parties, deleteParty } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.group?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
              placeholder="10 digit mobile" 
            />
          </FormField>
        </div>

        <div className="erp-grid-3">
          <FormField label="Email Address">
            <ERPInput 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="billing@firm.com" 
            />
          </FormField>

          <FormField label="GSTIN" error={errors.gstin}>
            <ERPInput 
              name="gstin" 
              value={formData.gstin} 
              onChange={handleChange} 
              placeholder="24AAAAA0000A1Z5" 
              className="uppercase"
            />
          </FormField>

          <FormField label="PAN Card">
            <ERPInput 
              name="pan" 
              value={formData.pan} 
              onChange={handleChange} 
              placeholder="ABCDE1234F" 
              className="uppercase"
            />
          </FormField>
        </div>

        <div className="erp-grid-2">
          <FormField label="Full Address / Billing Address">
            <ERPInput 
              name="address" 
              value={formData.address} 
              onChange={handleChange} 
              placeholder="Plot No, Street, Landmark, City..." 
            />
          </FormField>

          <FormField label="State / Region">
            <ERPSelect 
              name="state" 
              value={formData.state} 
              onChange={handleChange} 
              options={states} 
            />
          </FormField>
        </div>

        <div className="erp-grid-2">
          <div className="erp-form-container bg-slate-50 border-dashed m-0">
             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4">Financial Settings</h4>
             <div className="erp-grid-2">
                <FormField label="Opening Balance (₹)">
                  <ERPInput 
                    type="number" 
                    name="openingBalance" 
                    value={formData.openingBalance} 
                    onChange={handleChange} 
                  />
                </FormField>

                <FormField label="Credit Limit (₹)">
                  <ERPInput 
                    type="number" 
                    name="creditLimit" 
                    value={formData.creditLimit} 
                    onChange={handleChange} 
                  />
                </FormField>
             </div>
          </div>
          
          <div className="erp-form-container bg-slate-50 border-dashed m-0">
             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4">Bank Details</h4>
             <div className="erp-grid-2">
                <FormField label="Bank Account Number">
                  <ERPInput name="bankAcc" placeholder="Account Number" />
                </FormField>
                <FormField label="IFSC Code">
                  <ERPInput name="ifsc" placeholder="IFSC" className="uppercase" />
                </FormField>
             </div>
          </div>
        </div>

        <div className="erp-grid-2">
          <div className="erp-form-container bg-slate-50 border-dashed m-0">
             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4">Contact Persons</h4>
             <div className="erp-grid-2">
                <FormField label="Contact Person 1">
                  <ERPInput name="cp1" placeholder="Name" />
                </FormField>
                <FormField label="Contact Person 1 Mobile">
                  <ERPInput name="cp1m" placeholder="Mobile" />
                </FormField>
             </div>
          </div>
          
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 self-center">
             <p className="text-xs text-indigo-700 leading-relaxed">
               <strong>Note:</strong> Opening balance will be reflected in the Ledger immediately. 
               Credit limit will warn the user during Sales Invoice if the party exceeds the allowed debt.
             </p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PartyMaster;
