import React, { useState, useMemo } from 'react';
import { useProcurement } from '../context/ProcurementContext';
import { useAuth, MOCK_USERS } from '../context/AuthContext';
import { format } from 'date-fns';
import { CheckCircle, FileText, Search, CreditCard, Mail, Paperclip, BarChart3, TrendingUp, PieChart as PieChartIcon, Download, RefreshCw } from 'lucide-react';
import { Attachment } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { useEmail } from '../context/EmailContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

export default function AccountingSuite() {
  const { requests, markAsPaid, requestAccountNumber } = useProcurement();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { sendEmail } = useEmail();
  const [activeTab, setActiveTab] = useState<'requests' | 'analytics'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  
  // For invoice upload
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Filter completed requests
  const completedRequests = useMemo(() => {
    return requests.filter(req => req.status === 'Approved' && req.requestType !== 'Leave Request');
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return completedRequests.filter(req => {
      const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            req.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDepartment === 'All' || req.department === selectedDepartment;
      return matchesSearch && matchesDept;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [completedRequests, searchTerm, selectedDepartment]);

  const departments = ['All', ...Array.from(new Set(completedRequests.map(r => r.department)))];

  // Analytics Data
  const expenditureByDepartment = useMemo(() => {
    const data: Record<string, number> = {};
    completedRequests.forEach(req => {
      if (req.paymentStatus === 'Paid') {
        data[req.department] = (data[req.department] || 0) + req.totalAmount;
      }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [completedRequests]);

  const expenditureByItem = useMemo(() => {
    const data: Record<string, { count: number, total: number }> = {};
    completedRequests.forEach(req => {
      if (req.paymentStatus === 'Paid' && req.items) {
        req.items.forEach(item => {
          if (!data[item.name]) data[item.name] = { count: 0, total: 0 };
          data[item.name].count += item.quantity;
          data[item.name].total += (item.estimatedCost * item.quantity);
        });
      }
    });
    return Object.entries(data).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [completedRequests]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, requestId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment: Attachment = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          data: reader.result as string
        };
        markAsPaid(requestId, attachment);
        setUploadingFor(null);
        
        const req = requests.find(r => r.id === requestId);
        if (req) {
          addNotification({
            userId: req.createdBy,
            title: 'Payment Made',
            message: `Payment has been made for your request ${req.id}.`,
            type: 'success',
            link: `/requests/${req.id}`
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMarkAsPaid = (requestId: string) => {
    markAsPaid(requestId);
    const req = requests.find(r => r.id === requestId);
    if (req) {
      addNotification({
        userId: req.createdBy,
        title: 'Payment Made',
        message: `Payment has been made for your request ${req.id}.`,
        type: 'success',
        link: `/requests/${req.id}`
      });
    }
  };

  const handleRequestAccount = (requestId: string) => {
    requestAccountNumber(requestId);
    const req = requests.find(r => r.id === requestId);
    if (req && user) {
      addNotification({
        userId: req.createdBy,
        title: 'Account Number Requested',
        message: `Accounts department has requested an account number for ${req.id}.`,
        type: 'warning',
        link: `/requests/${req.id}`
      });

      const creatorUser = MOCK_USERS.find(u => u.email === req.createdBy);
      if (creatorUser) {
        sendEmail({
          senderId: user.id,
          toIds: [creatorUser.id],
          ccIds: [],
          bccIds: [],
          subject: `Account Number Required for Request ${req.id}`,
          body: `Hello,\n\nThe Accounts department requires an account number to process payment for your request: ${req.title} (${req.id}).\n\nPlease provide the necessary account details so we can proceed with the payment.\n\nThank you,\nAccounts Department`,
          attachments: []
        });
      }
    }
  };

  if (user?.email !== 'acct.zankli@gmail.com' && user?.department !== 'Accounts') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-stone-900">Access Denied</h2>
        <p className="mt-2 text-stone-500">You do not have permission to view the accounting suite.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Accounting Suite</h1>
          <p className="text-stone-500 mt-1">Manage payments, invoices, and expenditure analytics.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('refresh_data'))}
          className="inline-flex items-center justify-center px-4 py-2 border border-stone-200 text-sm font-medium rounded-xl shadow-sm text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mb-8">
        <div className="border-b border-stone-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('requests')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" />
                Completed Requests
              </div>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Expenditure Analytics
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'requests' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, title, or creator..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {filteredRequests.map(request => (
                  <div key={request.id} className="border border-stone-200 rounded-xl p-4 hover:border-orange-300 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium text-stone-500">{request.id}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
                            {request.department}
                          </span>
                          {request.paymentStatus === 'Paid' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Pending Payment
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-stone-900">{request.title}</h3>
                        <p className="text-sm text-stone-500 mt-1">
                          Created by {request.createdBy} on {format(new Date(request.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <div className="text-xl font-bold text-stone-900">
                          ₦{(request.totalAmount || 0).toLocaleString()}
                        </div>
                        <div className="flex gap-2 mt-4">
                          {!request.paymentStatus && !request.accountNumberRequested && (
                            <button
                              onClick={() => handleRequestAccount(request.id)}
                              className="px-3 py-1.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 flex items-center gap-1"
                            >
                              <Mail className="w-4 h-4" /> Request Account No.
                            </button>
                          )}
                          {!request.paymentStatus && (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(request.id)}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-1"
                              >
                                <CheckCircle className="w-4 h-4" /> Mark Paid
                              </button>
                              <div className="relative">
                                <input
                                  type="file"
                                  id={`invoice-${request.id}`}
                                  className="hidden"
                                  accept=".pdf,image/*"
                                  onChange={(e) => handleFileUpload(e, request.id)}
                                />
                                <label
                                  htmlFor={`invoice-${request.id}`}
                                  className="px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 flex items-center gap-1 cursor-pointer"
                                >
                                  <Paperclip className="w-4 h-4" /> Paid + Invoice
                                </label>
                              </div>
                            </>
                          )}
                          {request.paymentStatus === 'Paid' && request.paymentInvoice && (
                            <a
                              href={request.paymentInvoice.data}
                              download={request.paymentInvoice.name}
                              className="px-3 py-1.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 flex items-center gap-1"
                            >
                              <Download className="w-4 h-4" /> View Invoice
                            </a>
                          )}
                          {request.paymentStatus === 'Paid' && !request.paymentInvoice && (
                            <div className="relative">
                              <input
                                type="file"
                                id={`invoice-upload-${request.id}`}
                                className="hidden"
                                accept=".pdf,image/*"
                                onChange={(e) => handleFileUpload(e, request.id)}
                              />
                              <label
                                htmlFor={`invoice-upload-${request.id}`}
                                className="px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 flex items-center gap-1 cursor-pointer"
                              >
                                <Paperclip className="w-4 h-4" /> Upload Invoice
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredRequests.length === 0 && (
                  <div className="text-center py-12 text-stone-500">
                    No completed requests found matching your criteria.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                  <h3 className="text-lg font-semibold text-stone-900 mb-6 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-orange-500" />
                    Expenditure by Department
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenditureByDepartment}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {expenditureByDepartment.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                  <h3 className="text-lg font-semibold text-stone-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    Top 10 Items by Expenditure
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={expenditureByItem}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(value) => `₦${value.toLocaleString()}`} />
                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                        <Bar dataKey="total" fill="#f97316" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
