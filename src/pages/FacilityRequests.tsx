import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFacilityRequests } from '../context/FacilityRequestContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, CheckCircle, Mail, Clock, Wrench, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function FacilityRequests() {
  const { user } = useAuth();
  const { facilityRequests, addFacilityRequest, updateFacilityRequestStatus } = useFacilityRequests();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [newRequest, setNewRequest] = useState({ title: '', description: '' });

  const isFacilityAdmin = user?.department === 'Facility';
  
  // Approvers see their own requests, Facility Admin sees all
  const visibleRequests = isFacilityAdmin 
    ? facilityRequests 
    : facilityRequests.filter(req => req.requestedBy === user?.email);

  const pendingOverdueRequests = useMemo(() => {
    if (!isFacilityAdmin) return [];
    const now = new Date();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    return facilityRequests.filter(req => 
      req.status === 'Pending' && 
      (now.getTime() - new Date(req.createdAt).getTime() >= SEVEN_DAYS_MS)
    );
  }, [facilityRequests, isFacilityAdmin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.title || !newRequest.description) return;

    addFacilityRequest({
      title: newRequest.title,
      description: newRequest.description,
      requestedBy: user!.email,
      department: user!.department
    });

    addNotification({
      userId: 'Facility', // Send to facility admins
      title: 'New Facility Request',
      message: `${user?.email} submitted a new facility request: ${newRequest.title}`,
      type: 'info',
      link: '/facility-requests'
    });

    setIsAdding(false);
    setNewRequest({ title: '', description: '' });
  };

  const handleMarkCompleted = (id: string) => {
    updateFacilityRequestStatus(id, 'Completed');
  };

  const handleCreateProcurement = (req: any) => {
    // Navigate to create request page with pre-filled data
    navigate('/requests/new', { 
      state: { 
        prefill: {
          requestType: 'Product Procurement',
          title: `Procurement for: ${req.title}`,
          description: `Requested by ${req.requestedBy} (${req.department}): ${req.description}`,
          facilityRequestId: req.id
        }
      }
    });
  };

  const handleEmailApprover = (email: string, title: string) => {
    navigate('/email', {
      state: {
        composeTo: email,
        composeSubject: `Regarding your facility request: ${title}`
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Facility Requests</h1>
          <p className="text-sm text-stone-500 mt-1">
            {isFacilityAdmin ? 'Manage internal requests from staff, or submit your own.' : 'Submit requests for office supplies or maintenance.'}
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </button>
      </div>

      {pendingOverdueRequests.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-red-800">
                URGENT: {pendingOverdueRequests.length} Pending Request{pendingOverdueRequests.length > 1 ? 's' : ''} Overdue
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  The following request{pendingOverdueRequests.length > 1 ? 's have' : ' has'} not been treated for over a week. Please attend to {pendingOverdueRequests.length > 1 ? 'them' : 'it'} immediately:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {pendingOverdueRequests.map(req => (
                    <li key={req.id} className="font-medium">
                      {req.title} (Requested by {req.requestedBy})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200"
          onSubmit={handleSubmit}
        >
          <h2 className="text-lg font-medium text-stone-900 mb-4">Submit a Request</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700">What do you need?</label>
              <input 
                type="text" 
                required 
                placeholder="e.g., Need new pencils, AC is broken"
                value={newRequest.title} 
                onChange={e => setNewRequest({...newRequest, title: e.target.value})} 
                className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Details</label>
              <textarea 
                required 
                rows={3}
                placeholder="Please provide more details..."
                value={newRequest.description} 
                onChange={e => setNewRequest({...newRequest, description: e.target.value})} 
                className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" 
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border border-stone-300 text-sm font-medium rounded-xl text-stone-700 bg-white hover:bg-stone-50">Cancel</button>
            <button type="submit" className="px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-orange-600 hover:bg-orange-700">Submit Request</button>
          </div>
        </motion.form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        {visibleRequests.length > 0 ? (
          <ul className="divide-y divide-stone-200">
            {visibleRequests.map((req) => (
              <li key={req.id} className="p-6 hover:bg-stone-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                        {req.id}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${
                        req.status === 'Completed' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {req.status === 'Completed' ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <Clock className="w-3.5 h-3.5 mr-1" />}
                        {req.status}
                      </span>
                      <span className="text-xs text-stone-500">
                        {format(new Date(req.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900">{req.title}</h3>
                    <p className="text-sm text-stone-600 mt-1">{req.description}</p>
                    
                    {isFacilityAdmin && (
                      <div className="mt-3 flex items-center text-xs text-stone-500">
                        <span className="font-medium text-stone-700 mr-1">Requested by:</span> 
                        {req.requestedBy} ({req.department})
                      </div>
                    )}
                  </div>
                  
                  {isFacilityAdmin && req.status === 'Pending' && (
                    <div className="flex flex-col gap-2 sm:min-w-[200px]">
                      <button
                        onClick={() => handleMarkCompleted(req.id)}
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-emerald-200 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Mark Completed
                      </button>
                      <button
                        onClick={() => handleCreateProcurement(req)}
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-orange-200 text-xs font-medium rounded-lg text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create Procurement
                      </button>
                      <button
                        onClick={() => handleEmailApprover(req.requestedBy, req.title)}
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-stone-200 text-xs font-medium rounded-lg text-stone-700 bg-white hover:bg-stone-50 transition-colors"
                      >
                        <Mail className="w-4 h-4 mr-1.5" />
                        Email for Clarification
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-12">
            <Wrench className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-stone-900">No requests found</h3>
            <p className="text-stone-500 mt-1">
              {isFacilityAdmin ? 'There are no pending facility requests.' : 'You have not submitted any requests yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
