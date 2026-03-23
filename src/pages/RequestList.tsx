import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProcurement } from '../context/ProcurementContext';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Search, Filter, ChevronRight, FileText } from 'lucide-react';

export default function RequestList() {
  const { user } = useAuth();
  const { requests } = useProcurement();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'All';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const userRequests = user?.role === 'Creator' 
    ? requests.filter(r => r.department === user.department)
    : user?.role === 'Both'
    ? requests.filter(r => r.department === user.department || (r.workflow && r.workflow.includes(user.id)))
    : requests;

  const filteredRequests = userRequests.filter(req => {
    const matchesSearch = (req.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (req.id?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    let matchesStatus = statusFilter === 'All' || req.status === statusFilter;
    
    if (statusFilter === 'Action Required') {
      const isDynamicWorkflow = req.workflow && req.workflow.length > 0;
      if (isDynamicWorkflow) {
        matchesStatus = req.status === 'Pending Approval' && 
                        req.currentApproverIndex !== undefined && 
                        req.workflow![req.currentApproverIndex] === user?.id;
      } else {
        if (user?.department === 'Audit' && req.status === 'Pending Audit') matchesStatus = true;
        else if (user?.department === 'Accounts' && req.status === 'Pending Accounts') matchesStatus = true;
        else matchesStatus = false;
      }
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Procurement Requests</h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage and track all procurement activities.
          </p>
        </div>
        {(user?.role === 'Creator' || user?.role === 'Both') && (
          <Link
            to="/requests/new"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            New Request
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-stone-400" />
            </div>
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-stone-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-stone-50/50 transition-colors"
            />
          </div>
          
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full sm:w-auto pl-3 pr-10 py-2 text-base border-stone-200 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-xl border bg-stone-50/50"
            >
              <option value="All">All Statuses</option>
              <option value="Action Required">Action Required</option>
              <option value="Draft">Draft</option>
              <option value="Pending Audit">Pending Audit</option>
              <option value="Pending Accounts">Pending Accounts</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Sent Back">Sent Back</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Request ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Details
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Department
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-stone-500">
                    No procurement requests found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req, index) => (
                  <motion.tr 
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">
                      {req.id}
                      {req.items?.some(i => i.flagged) && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title="This request contains flagged items">
                          Flagged
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-stone-900 truncate max-w-xs">{req.title}</div>
                      <div className="text-sm text-stone-500">{format(new Date(req.createdAt), 'MMM d, yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                      {req.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                      <div>₦{(req.totalAmount || 0).toLocaleString()}</div>
                      {req.recommendedAmount !== undefined && req.recommendedAmount !== null && (
                        <div className="text-xs text-orange-600 mt-1 font-bold" title="Auditor Recommended Amount">
                          Rec: ₦{req.recommendedAmount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap
                        ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 
                          req.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                          req.status === 'Pending Audit' || req.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                          req.status === 'Draft' ? 'bg-stone-100 text-stone-800' :
                          'bg-blue-100 text-blue-800'}`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/requests/${req.id}`} className="text-orange-600 hover:text-orange-900 inline-flex items-center">
                        View <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
