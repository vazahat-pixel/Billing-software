import React from 'react';
import useStore from '../../store/useStore';
import { ShieldAlert } from 'lucide-react';

const FeatureGuard = ({ feature, children }) => {
    // Making all fields/sections visible as requested by the user
    return children;

    // Access Denied State
    return (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="p-4 bg-rose-50 text-rose-500 rounded-full mb-4">
                <ShieldAlert size={48} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Module Locked</h2>
            <p className="text-slate-500 text-center mt-2 max-w-sm">
                Your current plan does not include the <span className="font-bold text-indigo-600 uppercase">{feature}</span> module. 
                Please contact your administrator to upgrade.
            </p>
            <button className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
                View Upgrade Options
            </button>
        </div>
    );
};

export default FeatureGuard;
