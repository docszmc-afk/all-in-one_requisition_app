import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVendors } from '../context/VendorContext';
import { useAuth } from '../context/AuthContext';
import { useProcurement } from '../context/ProcurementContext';
import { motion } from 'framer-motion';
import { Plus, Building2, Phone, Mail, MapPin, Users, History, X } from 'lucide-react';
import { format } from 'date-fns';

export default function Vendors() {
  const { vendors, addVendor } = useVendors();
  const { requests } = useProcurement();
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'Lab/Store' as 'Lab/Store' | 'Facility' | 'Both',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });

  const isFacility = user?.department === 'Facility';
  const visibleVendors = vendors.filter(v => 
    v.category === 'Both' || 
    (isFacility ? v.category === 'Facility' : v.category === 'Lab/Store')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVendor(newVendor);
    setIsAdding(false);
    setNewVendor({ name: '', category: 'Lab/Store', contactPerson: '', phone: '', email: '', address: '' });
  };

  const getVendorHistory = (vendor: any) => {
    return requests.filter(req => 
      req.status === 'Approved' && 
      (
        req.splitSupplier === vendor.name || 
        (req.items && req.items.some(item => item.supplier === vendor.name)) ||
        (req.dieselDetails && req.dieselDetails.vendorId === vendor.id) ||
        (req.dieselDetails && req.dieselDetails.vendorId === 'manual' && req.dieselDetails.manualVendorName === vendor.name) ||
        (req.paymentDetails && req.paymentDetails.payee === vendor.name) ||
        (req.histologyDetailsList && req.histologyDetailsList.some(detail => detail.outsourceService === vendor.name))
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Vendors</h1>
          <p className="text-sm text-stone-500 mt-1">Manage your approved vendors and suppliers.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </button>
      </div>

      {isAdding && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200"
          onSubmit={handleSubmit}
        >
          <h2 className="text-lg font-medium text-stone-900 mb-4">Add New Vendor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700">Vendor Name *</label>
              <input type="text" required value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Category *</label>
              <select value={newVendor.category} onChange={e => setNewVendor({...newVendor, category: e.target.value as any})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border">
                <option value="Lab/Store">Lab/Store</option>
                <option value="Facility">Facility</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Contact Person</label>
              <input type="text" value={newVendor.contactPerson} onChange={e => setNewVendor({...newVendor, contactPerson: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Phone</label>
              <input type="tel" value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Email</label>
              <input type="email" value={newVendor.email} onChange={e => setNewVendor({...newVendor, email: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Address</label>
              <input type="text" value={newVendor.address} onChange={e => setNewVendor({...newVendor, address: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border border-stone-300 text-sm font-medium rounded-xl text-stone-700 bg-white hover:bg-stone-50">Cancel</button>
            <button type="submit" className="px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-orange-600 hover:bg-orange-700">Save Vendor</button>
          </div>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleVendors.map(vendor => (
          <div key={vendor.id} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-xl text-orange-600 mr-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">{vendor.name}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-800">
                    {vendor.category}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-stone-600">
              {vendor.contactPerson && <p className="flex items-center"><Users className="w-4 h-4 mr-2 text-stone-400"/> {vendor.contactPerson}</p>}
              {vendor.phone && <p className="flex items-center"><Phone className="w-4 h-4 mr-2 text-stone-400"/> {vendor.phone}</p>}
              {vendor.email && <p className="flex items-center"><Mail className="w-4 h-4 mr-2 text-stone-400"/> {vendor.email}</p>}
              {vendor.address && <p className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-stone-400"/> {vendor.address}</p>}
            </div>
            <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setSelectedVendor(vendor)}
                className="inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
              >
                <History className="w-4 h-4 mr-1.5" />
                View Purchase History
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase History Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{selectedVendor.name}</h3>
                <p className="text-sm text-stone-500 mt-1">Purchase History & Transactions</p>
              </div>
              <button
                onClick={() => setSelectedVendor(null)}
                className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {getVendorHistory(selectedVendor).length > 0 ? (
                <div className="space-y-4">
                  {getVendorHistory(selectedVendor).map(req => (
                    <div key={req.id} className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                            {req.id}
                          </span>
                          <span className="text-xs text-stone-500">
                            {format(new Date(req.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <h4 className="font-medium text-stone-900">{req.title}</h4>
                        <p className="text-sm text-stone-500">{req.requestType}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-600">
                          ₦{(req.totalAmount || 0).toLocaleString()}
                        </div>
                        <Link to={`/requests/${req.id}`} className="text-sm font-medium text-orange-600 hover:text-orange-700 mt-1 inline-block">
                          View Details &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-stone-900">No Purchase History</h3>
                  <p className="text-stone-500 mt-1">There are no approved requests associated with this vendor yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
