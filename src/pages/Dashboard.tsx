import React, { useState, useMemo, useEffect } from 'react';
import { useAuth, MOCK_USERS } from '../context/AuthContext';
import { useProcurement } from '../context/ProcurementContext';
import { useNotifications } from '../context/NotificationContext';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle, 
  TrendingUp,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const { requests, refreshRequests } = useProcurement();
  const { addNotification, notifications } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [expenseView, setExpenseView] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const departments = ['Laboratory', 'Pharmacy', 'Facility', 'IT Support', 'Audit', 'Accounts', 'Billing', 'Chairman', 'Doctors', 'Front Desk', 'HOF', 'MD', 'HR', 'Internal Medicine', 'Nursing', 'Paediatrics', 'Radiology'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const years = useMemo(() => {
    const y = Array.from(new Set(requests.map(r => new Date(r.createdAt).getFullYear()))).sort((a,b) => b-a);
    if (y.length === 0) y.push(new Date().getFullYear());
    return y;
  }, [requests]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRequests();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate expenses
  const expenses = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}; 
    
    requests.forEach(req => {
      if (req.status === 'Approved') {
        const date = new Date(req.createdAt);
        const year = date.getFullYear();
        
        if (year === selectedYear) {
          const month = format(date, 'MMM');
          const dept = req.department || 'Unspecified';
          
          if (!data[dept]) data[dept] = {};
          if (!data[dept][month]) data[dept][month] = 0;
          
          data[dept][month] += (req.totalAmount || 0);
        }
      }
    });
    return data;
  }, [requests, selectedYear]);

  const yearlyExpenses = useMemo(() => {
     const data: Record<string, Record<number, number>> = {};
     requests.forEach(req => {
      if (req.status === 'Approved') {
        const date = new Date(req.createdAt);
        const year = date.getFullYear();
        const dept = req.department || 'Unspecified';
        
        if (!data[dept]) data[dept] = {};
        if (!data[dept][year]) data[dept][year] = 0;
        
        data[dept][year] += (req.totalAmount || 0);
      }
    });
    return data;
  }, [requests]);

  const userRequests = user?.role === 'Creator' 
    ? requests.filter(r => r.department === user.department)
    : user?.role === 'Both'
    ? requests.filter(r => r.department === user.department || (r.workflow && r.workflow.includes(user.id)))
    : requests;

  // Filter and Sort Logic
  const filteredRequests = userRequests.filter(req => {
    const matchesSearch = (req.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.createdBy || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === 'All' || req.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const requestsWithAction = filteredRequests.map(req => {
    const isDynamicWorkflow = req.workflow && req.workflow.length > 0;
    let needsAction = false;

    if (isDynamicWorkflow) {
      needsAction = req.status === 'Pending Approval' && 
                    req.currentApproverIndex !== undefined && 
                    req.workflow![req.currentApproverIndex] === user?.id;
    } else {
      if (user?.department === 'Audit' && req.status === 'Pending Audit') needsAction = true;
      if (user?.department === 'Accounts' && req.status === 'Pending Accounts') needsAction = true;
    }

    return { ...req, needsAction };
  });

  const pendingAudit = userRequests.filter(r => r.status === 'Pending Audit').length;
  const pendingAccounts = userRequests.filter(r => r.status === 'Pending Accounts').length;
  const approved = userRequests.filter(r => r.status === 'Approved').length;
  const rejected = userRequests.filter(r => r.status === 'Rejected').length;
  
  // Calculate Action Required count
  const actionRequiredCount = requestsWithAction.filter(r => r.needsAction).length;

  const totalAmount = userRequests
    .filter(r => r.status === 'Approved')
    .reduce((sum, req) => sum + (req.totalAmount || 0), 0);

  const stats = [
    { name: 'Action Required', value: actionRequiredCount, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { name: 'Pending Audit', value: pendingAudit, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
    { name: 'Pending Accounts', value: pendingAccounts, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Approved', value: approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { name: 'Rejected', value: rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  const sortedRequests = requestsWithAction.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedRequests.length / itemsPerPage);
  const paginatedRequests = sortedRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const overdueInspections = useMemo(() => {
    if (user?.department !== 'Audit') return [];
    
    return requests.filter(r => {
      if (r.status !== 'Approved') return false;
      const eligibleTypes = ['Diesel Request', 'Equipment Request', 'Lab Purchase Order', 'Product Procurement', 'Store Requisition', 'Pharmacy Purchase Order', 'IT Procurement'];
      if (!eligibleTypes.includes(r.requestType || '')) return false;

      const approvalDate = r.approvals?.length ? r.approvals[r.approvals.length - 1].date : r.createdAt;
      const daysSinceApproval = (new Date().getTime() - new Date(approvalDate).getTime()) / (1000 * 3600 * 24);
      if (daysSinceApproval < 7) return false;

      if (r.items && r.items.length > 0) {
        return r.items.some(item => !item.isInspected);
      } else {
        return !r.isInspected;
      }
    });
  }, [requests, user]);

  useEffect(() => {
    if (user?.department === 'Audit' && overdueInspections.length > 0) {
      // Check if we already sent a notification today
      const today = new Date().toISOString().split('T')[0];
      const hasNotifiedToday = notifications.some(n => 
        n.title === 'Overdue Inspections Reminder' && 
        n.createdAt.startsWith(today)
      );

      if (!hasNotifiedToday) {
        addNotification({
          title: 'Overdue Inspections Reminder',
          message: `You have ${overdueInspections.length} approved request(s) pending inspection for over a week.`,
          type: 'warning',
          userId: 'Audit'
        });
      }
    }
  }, [overdueInspections, user, notifications, addNotification]);

  return (
    <div className="space-y-6">
      {overdueInspections.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-orange-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800">
                Overdue Inspections
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p>
                  You have {overdueInspections.length} approved request{overdueInspections.length === 1 ? '' : 's'} pending inspection for over a week. Please review them.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Welcome back, {user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Here's what's happening in {user?.department || 'your'} procurement today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center p-2 border border-stone-200 text-sm font-medium rounded-xl shadow-sm text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-orange-500' : 'text-stone-500'}`} />
          </button>
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
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-stone-400" />
          </div>
          <input
            type="text"
            placeholder="Search requests by title, ID, or creator..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="block w-full pl-10 pr-3 py-2 border border-stone-300 rounded-xl leading-5 bg-white placeholder-stone-500 focus:outline-none focus:placeholder-stone-400 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition duration-150 ease-in-out"
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-5 h-5 text-stone-400" />
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full sm:w-auto pl-3 pr-10 py-2 text-base border-stone-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-xl border bg-white"
          >
            <option value="All">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <Link to={`/requests?status=${encodeURIComponent(stat.name)}`} key={stat.name} className="block">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md transition-shadow h-full cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-stone-900">{stat.value}</h3>
                <p className="text-sm font-medium text-stone-500 mt-1">{stat.name}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Financial Overview */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-stone-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-stone-400" />
            Financial Overview
          </h2>
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button
              onClick={() => setExpenseView('monthly')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${expenseView === 'monthly' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setExpenseView('yearly')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${expenseView === 'yearly' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Yearly
            </button>
          </div>
        </div>

        {expenseView === 'monthly' && (
          <div className="mb-4 flex justify-end">
             <select 
               value={selectedYear} 
               onChange={(e) => setSelectedYear(parseInt(e.target.value))}
               className="block pl-3 pr-10 py-2 text-base border-stone-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"
             >
               {years.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Department</th>
                {expenseView === 'monthly' ? (
                  months.map(m => <th key={m} scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">{m}</th>)
                ) : (
                  years.map(y => <th key={y} scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">{y}</th>)
                )}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {departments.map(dept => (
                <tr key={dept}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">{dept}</td>
                  {expenseView === 'monthly' ? (
                    months.map(m => (
                      <td key={m} className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">
                        {expenses[dept] && expenses[dept][m] ? `₦${expenses[dept][m].toLocaleString()}` : '-'}
                      </td>
                    ))
                  ) : (
                    years.map(y => (
                      <td key={y} className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">
                        {yearlyExpenses[dept] && yearlyExpenses[dept][y] ? `₦${yearlyExpenses[dept][y].toLocaleString()}` : '-'}
                      </td>
                    ))
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-stone-900 text-right">
                    ₦{expenseView === 'monthly' 
                      ? Object.values(expenses[dept] || {}).reduce((a, b) => a + b, 0).toLocaleString()
                      : Object.values(yearlyExpenses[dept] || {}).reduce((a, b) => a + b, 0).toLocaleString()
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">Requests</h2>
              <span className="text-xs text-stone-500">
                Showing {paginatedRequests.length} of {sortedRequests.length}
              </span>
            </div>
            <div className="divide-y divide-stone-100 flex-1">
              {paginatedRequests.length === 0 ? (
                <div className="p-6 text-center text-stone-500 text-sm">
                  No requests found matching your criteria.
                </div>
              ) : (
                paginatedRequests.map((req) => (
                  <Link key={req.id} to={`/requests/${req.id}`} className="block hover:bg-stone-50 transition-colors">
                    <div className={`p-4 sm:p-6 flex items-center justify-between ${req.needsAction ? 'bg-orange-50/50 border-l-4 border-orange-500' : ''}`}>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-stone-900 truncate">
                              {req.title}
                            </p>
                            {req.needsAction && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Action Required
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-stone-900">
                            ₦{(req.totalAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center text-xs text-stone-500">
                          <span className="truncate">{req.id}</span>
                          <span className="mx-2">•</span>
                          <span>{format(new Date(req.createdAt), 'MMM d, yyyy')}</span>
                          <span className="mx-2">•</span>
                          <span className="truncate">{req.department}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap
                          ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 
                            req.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                            req.status === 'Pending Audit' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'}`}
                        >
                          {req.status}
                        </span>
                        {req.status === 'Pending Approval' && req.workflow && req.currentApproverIndex !== undefined && (
                          <span className="text-xs text-stone-500">
                            Waiting on: {MOCK_USERS.find(u => u.id === req.workflow![req.currentApproverIndex!])?.department || 'Approver'}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between bg-stone-50">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed text-stone-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-stone-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed text-stone-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Unattended Requests Box */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="p-4 border-b border-stone-100 bg-orange-50/50">
              <h2 className="text-sm font-semibold text-stone-900 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
                Unattended Requests
              </h2>
            </div>
            <div className="divide-y divide-stone-100 max-h-[300px] overflow-y-auto">
              {sortedRequests.filter(r => r.needsAction).length === 0 ? (
                <div className="p-4 text-center text-stone-500 text-sm">
                  You have no unattended requests.
                </div>
              ) : (
                sortedRequests.filter(r => r.needsAction).slice(0, 5).map((req) => (
                  <Link key={`unattended-${req.id}`} to={`/requests/${req.id}`} className="block hover:bg-stone-50 transition-colors p-4">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium text-stone-900 truncate pr-2">{req.title}</p>
                      <span className="text-xs font-semibold text-stone-900 whitespace-nowrap">
                        ₦{(req.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-stone-500">
                      <span className="truncate">{req.id}</span>
                      <span className="mx-1">•</span>
                      <span>{format(new Date(req.createdAt), 'MMM d')}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            {sortedRequests.filter(r => r.needsAction).length > 5 && (
              <div className="p-3 border-t border-stone-100 bg-stone-50 text-center">
                <Link to="/requests" className="text-xs font-medium text-orange-600 hover:text-orange-700">
                  View all {sortedRequests.filter(r => r.needsAction).length} unattended requests
                </Link>
              </div>
            )}
          </div>

          <Link to="/requests?status=Approved" className="block">
            <div className="bg-orange-600 rounded-2xl shadow-sm p-6 text-white relative overflow-hidden hover:bg-orange-700 transition-colors cursor-pointer">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-black opacity-10 rounded-full blur-xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-orange-100">Approved Spend</h2>
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-4xl font-bold tracking-tight">
                    <span className="text-orange-200 text-2xl mr-1">₦</span>
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-6 pt-6 border-t border-orange-500/50">
                  <p className="text-sm text-orange-100">
                    Total value of approved procurement requests across your visible departments.
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
