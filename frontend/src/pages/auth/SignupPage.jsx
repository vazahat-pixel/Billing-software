import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Zap, Building, User, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../utils/api';
import useStore from '../../store/useStore';

const SignupPage = () => {
  const navigate = useNavigate();
  const setAuth = useStore(state => state.setAuth);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/register', {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
        companyName: formData.companyName
      });

      const { token, user } = response.data;
      setAuth({ token, user });
      
      // After signup, redirect to ERP dashboard
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-slate-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]"></div>
        
        <div className="relative z-10 max-w-lg text-center px-10">
          <div className="w-20 h-20 bg-blue-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 mx-auto mb-10 -rotate-12">
             <Building size={40} fill="white" />
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight leading-tight">Scale your textile organization today.</h2>
          <p className="text-slate-400 mt-6 text-lg">
            Join 500+ businesses managing their entire production lifecycle on Stockly.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-[500px] bg-white flex flex-col p-10 lg:p-16 shadow-2xl z-10">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white font-black text-xs">S</div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">Stockly ERP</span>
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Create organization</h1>
          <p className="text-slate-500 text-sm mt-2">Start your 14-day free trial. No credit card required.</p>

          <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
            {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg text-center">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="First Name" 
                placeholder="John" 
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
              <Input 
                label="Last Name" 
                placeholder="Doe" 
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
            
            <Input 
              label="Organization Name" 
              placeholder="e.g. Acme Textiles Ltd" 
              icon={Building}
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
            />
            
            <Input 
              label="Work Email" 
              placeholder="name@company.com" 
              type="email"
              icon={Mail}
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <div className="space-y-1.5">
               <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Create Password</label>
               <input 
                type="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••" 
                required
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-[12px] outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
              />
               <p className="text-[10px] text-slate-400 font-medium">Must be at least 8 characters long.</p>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input type="checkbox" id="terms" required className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <label htmlFor="terms" className="text-xs font-medium text-slate-500 leading-relaxed">
                I agree to the <a href="#" className="text-emerald-600 font-bold hover:underline">Terms of Service</a> and <a href="#" className="text-emerald-600 font-bold hover:underline">Privacy Policy</a>.
              </label>
            </div>

            <Button 
                type="submit" 
                disabled={loading} 
                className="w-full py-2.5 mt-4" 
                icon={loading ? Loader2 : Zap}
            >
                {loading ? 'Initializing...' : 'Initialize Organization'}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50">
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-emerald-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>

        <div className="mt-auto pt-10 text-center text-[11px] font-medium text-slate-400 uppercase tracking-widest">
           <span>© 2026 Stockly Inc.</span>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
