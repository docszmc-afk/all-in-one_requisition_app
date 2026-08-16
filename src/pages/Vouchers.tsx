import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVouchers } from '../context/VoucherContext';
import { useNotifications } from '../context/NotificationContext';
import { sendEmailNotification } from '../lib/emailjs';
import { uploadFile } from '../lib/storage';
import { toast } from 'sonner';
import SignaturePad from '../components/SignaturePad';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, Search, Filter, ShieldAlert, FileText, 
  CheckCircle, XCircle, Clock, AlertTriangle, 
  DollarSign, Send, ArrowRight, Paperclip, Download,
  ChevronLeft, ChevronRight, Edit
} from 'lucide-react';
import { Voucher } from '../types';

export default function Vouchers() {
  const { user } = useAuth();
  const { vouchers, approvals, loading, createVoucher, updateVoucherStatus, queryVoucher, updateVoucherContent, addApproval } = useVouchers();
  const { addNotification } = useNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayee, setFilterPayee] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState<'approve' | 'account' | 'query' | 'details' | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'password_stamp' | 'drawn_signature' | null>(null);

  // Form states
  const [newVoucher, setNewVoucher] = useState({
    title: '', description: '', amount_requested: '', payee_name: '', memo: ''
  });
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [comments, setComments] = useState('');
  const [finalAmount, setFinalAmount] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Role Checks
  const isCreator = user?.department === 'Facility' || user?.department === 'IT Support';
  const isApprover = user?.email === 'zanklihr@gmail.com' || user?.email === 'docs.zmc@gmail.com';
  const isAccounts = user?.department === 'Accounts';
  const isAudit = user?.department === 'Audit';

  const uniquePayees = Array.from(new Set(vouchers.map(v => v.payee_name))).sort();
  const statuses = ['pending', 'approved', 'rejected', 'sent_back', 'final_payable', 'negotiated'];

  const filteredVouchers = vouchers.filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = v.title.toLowerCase().includes(searchLower) ||
           v.payee_name.toLowerCase().includes(searchLower) ||
           v.department.toLowerCase().includes(searchLower) ||
           v.status.toLowerCase().includes(searchLower);
           
    const matchesPayee = filterPayee === 'All' || v.payee_name === filterPayee;
    const matchesStatus = filterStatus === 'All' || v.status === filterStatus;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const voucherDate = new Date(v.created_at).getTime();
      if (startDate) {
        matchesDate = matchesDate && voucherDate >= new Date(startDate).getTime();
      }
      if (endDate) {
        // End of day
        matchesDate = matchesDate && voucherDate <= new Date(endDate).getTime() + 86400000;
      }
    }
    
    return matchesSearch && matchesPayee && matchesStatus && matchesDate;
  });

  const totalPages = Math.ceil(filteredVouchers.length / itemsPerPage);
  const paginatedVouchers = filteredVouchers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsUploading(true);
    let attachment_url = null;
    try {
      if (fileToUpload) {
        attachment_url = await uploadFile(fileToUpload);
      }

      await createVoucher({
        title: newVoucher.title,
        description: newVoucher.description,
        amount_requested: Number(newVoucher.amount_requested),
        payee_name: newVoucher.payee_name,
        department: user.department,
        creator_email: user.email,
        memo: newVoucher.memo,
        attachment_url: attachment_url,
        status: 'pending'
      });
      toast.success('Voucher created successfully');
      setIsCreateModalOpen(false);
      setNewVoucher({ title: '', description: '', amount_requested: '', payee_name: '', memo: '' });
      setFileToUpload(null);

      // Notify approvers
      addNotification({
        userId: 'zanklihr@gmail.com',
        title: 'Pending Voucher',
        message: `A new payment voucher (${newVoucher.title}) requires your approval.`,
        type: 'info',
        link: '/vouchers'
      });
      addNotification({
        userId: 'docs.zmc@gmail.com',
        title: 'Pending Voucher',
        message: `A new payment voucher (${newVoucher.title}) requires your approval.`,
        type: 'info',
        link: '/vouchers'
      });

    } catch (error) {
      toast.error('Failed to create voucher');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedVoucher) return;
    
    setIsUploading(true);
    let attachment_url = selectedVoucher.attachment_url;
    try {
      if (fileToUpload) {
        attachment_url = await uploadFile(fileToUpload);
      }

      await updateVoucherContent(selectedVoucher.id, {
        title: newVoucher.title,
        description: newVoucher.description,
        amount_requested: Number(newVoucher.amount_requested),
        payee_name: newVoucher.payee_name,
        memo: newVoucher.memo,
        attachment_url: attachment_url,
        status: 'pending'
      });
      toast.success('Voucher updated and resubmitted successfully');
      setIsEditModalOpen(false);
      setSelectedVoucher(null);
      setNewVoucher({ title: '', description: '', amount_requested: '', payee_name: '', memo: '' });
      setFileToUpload(null);

      // Notify approvers again
      addNotification({
        userId: 'zanklihr@gmail.com',
        title: 'Pending Voucher',
        message: `A resubmitted payment voucher (${newVoucher.title}) requires your approval.`,
        type: 'info',
        link: '/vouchers'
      });
      addNotification({
        userId: 'docs.zmc@gmail.com',
        title: 'Pending Voucher',
        message: `A resubmitted payment voucher (${newVoucher.title}) requires your approval.`,
        type: 'info',
        link: '/vouchers'
      });
    } catch (error) {
      toast.error('Failed to update voucher');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApproveAction = async (status: 'approved' | 'rejected' | 'sent_back') => {
    if (status === 'approved' && !signaturePreview) {
      toast.error('You must sign or stamp to approve');
      return;
    }
    if (!selectedVoucher || !user) return;
    try {
      await updateVoucherStatus(selectedVoucher.id, status, user.email, comments);
      if (status === 'approved' && signaturePreview && signatureType) {
        await addApproval({ voucher_id: selectedVoucher.id, user_email: user.email, role: user.department, signature_type: signatureType, signature_data: signaturePreview });
      }
      toast.success(`Voucher marked as ${status}`);
      setActionModalOpen(null);
      
      if (status === 'sent_back') {
        addNotification({
          userId: selectedVoucher.creator_email,
          title: 'Voucher Sent Back',
          message: `Your voucher (${selectedVoucher.title}) was sent back for revision.`,
          type: 'warning',
          link: '/vouchers'
        });
      } else if (status === 'approved') {
         addNotification({
          userId: 'Accounts',
          title: 'Voucher Approved',
          message: `A voucher (${selectedVoucher.title}) has been approved and is ready for processing.`,
          type: 'success',
          link: '/vouchers'
        });
      }

      setSelectedVoucher(null);
      setComments('');
    } catch (error) {
      toast.error('Failed to update voucher');
    }
  };

  const handleAccountAction = async (status: 'final_payable' | 'negotiated') => {
    if (!signaturePreview) {
      toast.error('You must sign or stamp to process');
      return;
    }
    if (!selectedVoucher || !user) return;
    try {
      await updateVoucherStatus(
        selectedVoucher.id, 
        status, 
        undefined, 
        comments, 
        Number(finalAmount)
      );
      if (signaturePreview && signatureType) {
        await addApproval({ voucher_id: selectedVoucher.id, user_email: user.email, role: 'Accounts', signature_type: signatureType, signature_data: signaturePreview });
      }
      toast.success(`Voucher processed successfully`);
      setActionModalOpen(null);
      
      addNotification({
          userId: selectedVoucher.creator_email,
          title: 'Voucher Processed',
          message: `Your voucher (${selectedVoucher.title}) has been processed by Accounts.`,
          type: 'success',
          link: '/vouchers'
      });

      setSelectedVoucher(null);
      setComments('');
      setFinalAmount('');
    } catch (error) {
      toast.error('Failed to process voucher');
    }
  };

  const handleQuery = async () => {
    if (!selectedVoucher) return;
    try {
      await queryVoucher(selectedVoucher.id, comments);
      
      // Send email to creator and add in-app notification
      addNotification({
        userId: selectedVoucher.creator_email,
        title: 'Voucher Queried',
        message: `Your voucher (${selectedVoucher.title}) has been queried by Audit.\n\nNotes: ${comments}`,
        type: 'error',
        link: '/vouchers'
      });
      
      toast.success('Voucher queried and creator notified');
      setActionModalOpen(null);
      setSelectedVoucher(null);
      setComments('');
    } catch (error) {
      toast.error('Failed to query voucher');
    }
  };

  const handleBulkApprove = async () => {
    if (!user) return;
    try {
      const promises = selectedVoucherIds.map(id => 
        updateVoucherStatus(id, 'approved', user.email, 'Bulk approved')
      );
      await Promise.all(promises);
      toast.success(`${selectedVoucherIds.length} vouchers marked as approved`);
      setSelectedVoucherIds([]);
    } catch (error) {
      toast.error('Failed to update some vouchers');
    }
  };

  const handleBulkPrint = () => {
    const doc = new jsPDF('landscape');
    
    // Header
    doc.setFillColor(249, 250, 251);
    doc.rect(0, 0, 297, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text('PAYMENT VOUCHERS LEDGER', 148.5, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 148.5, 28, { align: 'center' });
    doc.text(`Total Vouchers: ${selectedVoucherIds.length}`, 148.5, 34, { align: 'center' });
    
    const tableData = selectedVoucherIds.map(id => {
      const v = vouchers.find(v => v.id === id);
      const aps = approvals.filter(a => a.voucher_id === id);
      if (!v) return [];
      
      const approverNames = aps.map(a => a.user_email.split('@')[0]).join(', ');
      
      return [
        new Date(v.created_at).toLocaleDateString(),
        v.title,
        v.department,
        v.payee_name,
        `N${Number(v.amount_requested).toLocaleString()}`,
        v.status.replace('_', ' ').toUpperCase(),
        approverNames || 'None'
      ];
    }).filter(row => row.length > 0);
    
    autoTable(doc, {
      startY: 48,
      head: [['Date', 'Title', 'Dept', 'Payee', 'Amount', 'Status', 'Approvers']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });
    
    doc.save(`Vouchers_Ledger_${new Date().getTime()}.pdf`);
  };

  const downloadIndividualVoucher = (v: Voucher) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(249, 250, 251);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text('PAYMENT VOUCHER', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Voucher ID: ${v.id.substring(0, 8).toUpperCase()}`, 105, 28, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 33, { align: 'center' });

    // Details Box
    doc.setDrawColor(209, 213, 219);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 48, 182, 60, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    
    // Left column
    doc.text('Title:', 20, 58);
    doc.text('Payee Name:', 20, 68);
    doc.text('Status:', 20, 78);
    doc.text('Creator:', 20, 88);
    doc.text('Department:', 20, 98);
    
    doc.setTextColor(17, 24, 39);
    doc.setFont('', 'bold');
    doc.text(v.title, 50, 58);
    doc.text(v.payee_name, 50, 68);
    doc.text(v.status.replace('_', ' ').toUpperCase(), 50, 78);
    doc.text(v.creator_email, 50, 88);
    doc.text(v.department, 50, 98);
    
    // Right column
    doc.setTextColor(107, 114, 128);
    doc.setFont('', 'normal');
    doc.text('Date:', 120, 58);
    doc.text('Requested:', 120, 68);
    if (v.final_amount !== undefined && v.final_amount !== null) {
      doc.text(v.status === 'negotiated' ? 'Negotiated:' : 'Final Payable:', 120, 78);
    }
    
    doc.setTextColor(17, 24, 39);
    doc.setFont('', 'bold');
    doc.text(new Date(v.created_at).toLocaleDateString(), 150, 58);
    doc.text(`N${Number(v.amount_requested).toLocaleString()}`, 150, 68);
    if (v.final_amount !== undefined && v.final_amount !== null) {
      doc.text(`N${Number(v.final_amount).toLocaleString()}`, 150, 78);
    }
    
    // Description Box
    doc.setFont('', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Description / Reason:', 14, 120);
    
    doc.setTextColor(55, 65, 81);
    const splitDesc = doc.splitTextToSize(v.description, 182);
    doc.text(splitDesc, 14, 128);
    
    let currentY = 128 + (splitDesc.length * 6);
    
    if (v.memo) {
      doc.setTextColor(107, 114, 128);
      doc.text('Memo:', 14, currentY + 10);
      doc.setTextColor(55, 65, 81);
      const splitMemo = doc.splitTextToSize(v.memo, 182);
      doc.text(splitMemo, 14, currentY + 18);
      currentY = currentY + 18 + (splitMemo.length * 6);
    }

    // Approvals Section
    const aps = approvals.filter(a => a.voucher_id === v.id);
    if (aps.length > 0) {
      doc.setFontSize(12);
      doc.setFont('', 'bold');
      doc.setTextColor(31, 41, 55);
      currentY += 15;
      doc.text('Signatures & Approvals', 14, currentY);
      
      currentY += 8;
      
      const sigBoxWidth = 85;
      let xPos = 14;
      
      aps.forEach((ap, index) => {
        if (index > 0 && index % 2 === 0) {
          xPos = 14;
          currentY += 45;
        } else if (index > 0) {
          xPos = 14 + sigBoxWidth + 12;
        }
        
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(xPos, currentY, sigBoxWidth, 40, 2, 2, 'S');
        
        doc.setFontSize(9);
        doc.setFont('', 'bold');
        doc.text(ap.role || 'Approver', xPos + 5, currentY + 7);
        
        doc.setFontSize(8);
        doc.setFont('', 'normal');
        doc.text(ap.user_email, xPos + 5, currentY + 13);
        doc.text(new Date(ap.created_at).toLocaleString(), xPos + 5, currentY + 18);
        
        // Add signature image
        if (ap.signature_data) {
           try {
             doc.addImage(ap.signature_data, 'PNG', xPos + 5, currentY + 22, 40, 15);
           } catch(e) {
             doc.text('[Signature]', xPos + 5, currentY + 30);
           }
        }
      });
    }
    
    doc.save(`Voucher_${v.id.substring(0,8)}.pdf`);
  };

  const toggleVoucherSelection = (id: string) => {
    setSelectedVoucherIds(prev => 
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVoucherIds.length === paginatedVouchers.length) {
      setSelectedVoucherIds([]);
    } else {
      setSelectedVoucherIds(paginatedVouchers.map(v => v.id));
    }
  };

  const getStatusBadge = (status: string, isQueried: boolean) => {
    if (isQueried) {
      return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Queried</span>;
    }
    switch (status) {
      case 'pending': return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">Pending Approval</span>;
      case 'approved': return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Approved (Pending Accounts)</span>;
      case 'rejected': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Rejected</span>;
      case 'sent_back': return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Sent Back</span>;
      case 'final_payable': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Final Payable</span>;
      case 'negotiated': return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">Negotiated Payable</span>;
      default: return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-stone-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center">
            <FileText className="w-6 h-6 mr-3 text-orange-500" />
            Payment Vouchers Ledger
          </h1>
          <p className="text-stone-500 mt-1">Manage and track all facility and IT payment dockets</p>
        </div>
        {isCreator && (
          <button
            onClick={() => {
              setNewVoucher({ title: '', description: '', amount_requested: '', payee_name: '', memo: '' });
              setFileToUpload(null);
              setIsCreateModalOpen(true);
            }}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors flex items-center font-medium shadow-sm w-full md:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Voucher
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex flex-col lg:flex-row items-center gap-4 bg-stone-50/80">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search vouchers by title, payee, or status..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset page on search
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <select
              value={filterPayee}
              onChange={(e) => { setFilterPayee(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm"
            >
              <option value="All">All Payees</option>
              {uniquePayees.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm capitalize"
            >
              <option value="All">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>

            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm"
              />
              <span className="text-stone-400">-</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {selectedVoucherIds.length > 0 && (
          <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center justify-between">
            <span className="text-sm font-medium text-orange-800">
              {selectedVoucherIds.length} voucher(s) selected
            </span>
            <div className="flex gap-2">
              <button 
                onClick={handleBulkPrint}
                className="px-4 py-2 bg-white border border-orange-200 text-orange-700 hover:bg-orange-100 rounded-lg text-sm font-semibold transition-colors"
              >
                Print Selection
              </button>
              {isApprover && (
                <button 
                  onClick={handleBulkApprove}
                  className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Mark as Reviewed
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-6 bg-stone-50/30">
          <div className="mb-4 flex items-center">
            <button 
              onClick={toggleSelectAll}
              className="text-sm font-medium text-stone-600 hover:text-stone-900 flex items-center"
            >
              <div className={`w-4 h-4 mr-2 border rounded flex items-center justify-center ${selectedVoucherIds.length === paginatedVouchers.length && paginatedVouchers.length > 0 ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}>
                {selectedVoucherIds.length === paginatedVouchers.length && paginatedVouchers.length > 0 && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              Select All on Page
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedVouchers.map((v) => (
              <div key={v.id} className={`bg-white border ${selectedVoucherIds.includes(v.id) ? 'border-orange-400 ring-1 ring-orange-400' : 'border-stone-200'} rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col group relative`}>
                <div 
                  className="absolute top-4 left-4 z-10 cursor-pointer"
                  onClick={() => toggleVoucherSelection(v.id)}
                >
                  <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${selectedVoucherIds.includes(v.id) ? 'bg-orange-500 border-orange-500' : 'border-stone-300 bg-white/80'}`}>
                    {selectedVoucherIds.includes(v.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                <div className="p-5 flex-1 pl-12">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs text-stone-500 font-medium flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {new Date(v.created_at).toLocaleDateString()}
                    </div>
                    {getStatusBadge(v.status, v.is_queried)}
                  </div>
                  
                  <h3 className="text-lg font-bold text-stone-800 mb-2 line-clamp-2 leading-tight">{v.title}</h3>
                  <div className="text-xs text-stone-500 mb-5 pb-4 border-b border-stone-100">
                    <span className="font-medium text-stone-700">{v.department}</span> • {v.creator_email}
                  </div>
                  
                  <div className="bg-stone-50 rounded-xl p-3.5 space-y-2.5 border border-stone-100/80">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Payee</span>
                      <span className="font-medium text-stone-800 truncate pl-2 max-w-[60%] text-right">{v.payee_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Requested</span>
                      <span className="font-bold text-stone-800">₦{Number(v.amount_requested).toLocaleString()}</span>
                    </div>
                    {(v.final_amount !== undefined && v.final_amount !== null) && (
                       <div className="flex justify-between text-sm pt-2 mt-1 border-t border-stone-200/60">
                         <span className="text-stone-500 font-medium">{v.status === 'negotiated' ? 'Negotiated Amount' : 'Final Approved'}</span>
                         <span className={`font-bold ${v.status === 'negotiated' ? 'text-purple-600' : 'text-emerald-600'}`}>₦{Number(v.final_amount).toLocaleString()}</span>
                       </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 border-t border-stone-100 bg-stone-50/80 flex flex-wrap justify-end gap-2 mt-auto">
                  {isCreator && v.status === 'sent_back' && (
                    <button 
                      onClick={() => { 
                        setSelectedVoucher(v); 
                        setNewVoucher({ 
                          title: v.title, 
                          description: v.description, 
                          amount_requested: String(v.amount_requested), 
                          payee_name: v.payee_name, 
                          memo: v.memo || '' 
                        });
                        setIsEditModalOpen(true); 
                      }} 
                      className="px-3 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-semibold transition-colors flex items-center"
                    >
                      <Edit className="w-4 h-4 mr-1.5" /> Edit & Resubmit
                    </button>
                  )}
                  {isApprover && v.status === 'pending' && !v.is_queried && (
                    <button onClick={() => { setSelectedVoucher(v); setActionModalOpen('approve'); }} className="px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-semibold transition-colors flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1.5" /> Review
                    </button>
                  )}
                  {isAccounts && v.status === 'approved' && !v.is_queried && (
                    <button onClick={() => { setSelectedVoucher(v); setActionModalOpen('account'); setFinalAmount(v.amount_requested.toString()); }} className="px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-semibold transition-colors flex items-center">
                      <DollarSign className="w-4 h-4 mr-1.5" /> Process Payment
                    </button>
                  )}
                  {isAudit && !v.is_queried && (
                    <button onClick={() => { setSelectedVoucher(v); setActionModalOpen('query'); }} className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors flex items-center">
                      <ShieldAlert className="w-4 h-4 mr-1.5" /> Query
                    </button>
                  )}
                  <button onClick={() => { setSelectedVoucher(v); setActionModalOpen('details'); }} className="px-3 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 rounded-lg text-sm font-medium transition-colors">
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {filteredVouchers.length === 0 && (
             <div className="py-16 text-center text-stone-500 bg-white rounded-2xl border border-dashed border-stone-200 mt-4">
                <FileText className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-lg font-medium text-stone-600">No vouchers found</p>
                <p className="text-sm">Try adjusting your search terms</p>
             </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-10 space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors bg-white shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex space-x-1 px-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-xl font-medium transition-all ${currentPage === i + 1 ? 'bg-stone-800 text-white shadow-md transform scale-105' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors bg-white shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
            <div className="p-4 md:p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/80 shrink-0">
              <h2 className="text-xl font-bold text-stone-800">Create Payment Voucher</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-full transition-colors"><XCircle className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col min-h-0">
              <div className="p-4 md:p-6 space-y-5 overflow-y-auto min-h-0">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Title</label>
                <input required type="text" value={newVoucher.title} onChange={e => setNewVoucher({...newVoucher, title: e.target.value})} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" placeholder="e.g. Generator Diesel Payment" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Description / Reason</label>
                <textarea required value={newVoucher.description} onChange={e => setNewVoucher({...newVoucher, description: e.target.value})} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 h-28 resize-none transition-colors" placeholder="Detailed reason for this payment..." />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Amount Requested (₦)</label>
                  <input required type="number" min="0" step="0.01" value={newVoucher.amount_requested} onChange={e => setNewVoucher({...newVoucher, amount_requested: e.target.value})} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors font-medium text-stone-900" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Payee Name</label>
                  <input required type="text" value={newVoucher.payee_name} onChange={e => setNewVoucher({...newVoucher, payee_name: e.target.value})} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" placeholder="Company or Individual" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Memo (Optional)</label>
                <textarea value={newVoucher.memo} onChange={e => setNewVoucher({...newVoucher, memo: e.target.value})} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 h-20 resize-none transition-colors" placeholder="Additional internal notes..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Supporting Document</label>
                <div className="flex items-center">
                  <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="w-full text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-colors cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                </div>
              </div>
              </div>
              <div className="p-4 md:p-6 pt-4 border-t border-stone-100 flex flex-wrap justify-end gap-2 md:gap-3 shrink-0 bg-stone-50/50">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-2.5 text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 hover:text-stone-900 rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isUploading} className="px-6 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 font-medium transition-colors shadow-md disabled:opacity-70 flex items-center">
                  {isUploading ? (
                    <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"></span> Processing...</>
                  ) : (
                    'Submit Voucher'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal for Sent Back */}
      {isEditModalOpen && selectedVoucher && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
            <div className="p-4 md:p-6 border-b border-stone-100 flex justify-between items-center bg-orange-50/50 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-stone-800">Edit & Resubmit Voucher</h2>
                <p className="text-sm text-orange-700 mt-1 flex items-center"><AlertTriangle className="w-4 h-4 mr-1"/> This voucher was sent back for revision.</p>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setSelectedVoucher(null); }} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-white rounded-full transition-colors"><XCircle className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleEdit} className="flex flex-col min-h-0">
              <div className="p-4 md:p-6 space-y-5 overflow-y-auto min-h-0">
                {/* Show why it was sent back if comments exist */}
                {selectedVoucher.approver_comments && (
                   <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-orange-800 mb-1">Reason for Send Back</h4>
                      <p className="text-sm text-orange-900">{selectedVoucher.approver_comments}</p>
                   </div>
                )}
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Title</label>
                <input required type="text" value={newVoucher.title} onChange={e => setNewVoucher({...newVoucher, title: e.target.value})} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Description / Reason</label>
                <textarea required value={newVoucher.description} onChange={e => setNewVoucher({...newVoucher, description: e.target.value})} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 h-24 resize-none transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Amount Requested (₦)</label>
                  <input required type="number" min="0" step="0.01" value={newVoucher.amount_requested} onChange={e => setNewVoucher({...newVoucher, amount_requested: e.target.value})} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors font-medium text-stone-900" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Payee Name</label>
                  <input required type="text" value={newVoucher.payee_name} onChange={e => setNewVoucher({...newVoucher, payee_name: e.target.value})} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Memo (Optional)</label>
                <textarea value={newVoucher.memo} onChange={e => setNewVoucher({...newVoucher, memo: e.target.value})} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 h-16 resize-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">Update Supporting Document</label>
                <p className="text-xs text-stone-500 mb-2">Leave empty to keep the previously uploaded document.</p>
                <div className="flex items-center">
                  <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} className="w-full text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-colors cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                </div>
              </div>
              </div>
              <div className="p-4 md:p-6 pt-4 border-t border-stone-100 flex flex-wrap justify-end gap-2 md:gap-3 shrink-0 bg-stone-50/50">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setSelectedVoucher(null); }} className="px-6 py-2.5 text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 hover:text-stone-900 rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isUploading} className="px-6 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium transition-colors shadow-md disabled:opacity-70 flex items-center">
                  {isUploading ? (
                    <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"></span> Resubmitting...</>
                  ) : (
                    'Resubmit Voucher'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionModalOpen && selectedVoucher && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
            <div className={`p-4 md:p-6 border-b flex justify-between items-center shrink-0 ${actionModalOpen === 'query' ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100'}`}>
              <h2 className={`text-xl font-bold ${actionModalOpen === 'query' ? 'text-red-800' : 'text-stone-800'}`}>
                {actionModalOpen === 'approve' ? 'Review Voucher' : actionModalOpen === 'account' ? 'Process Payment' : actionModalOpen === 'details' ? 'Voucher Details' : 'Query Voucher'}
              </h2>
              <button onClick={() => { setActionModalOpen(null); setComments(''); }} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-white rounded-full transition-colors"><XCircle className="w-6 h-6"/></button>
            </div>
            
            <div className="p-4 md:p-6 space-y-6 overflow-y-auto min-h-0">
              <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 text-sm space-y-3 shadow-inner">
                <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Title</span> <span className="font-bold text-stone-800">{selectedVoucher.title}</span></div>
                <div className="flex justify-between items-center"><span className="text-stone-500 font-medium">Payee</span> <span className="font-medium text-stone-800">{selectedVoucher.payee_name}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-stone-200/60"><span className="text-stone-500 font-medium">Amount Requested</span> <span className="text-lg font-black text-stone-900">₦{Number(selectedVoucher.amount_requested).toLocaleString()}</span></div>
                {(selectedVoucher.final_amount !== undefined && selectedVoucher.final_amount !== null) && (
                  <div className="flex justify-between items-center pt-2"><span className="text-stone-500 font-medium">{selectedVoucher.status === 'negotiated' ? 'Negotiated Amount' : 'Final Payable Amount'}</span> <span className={`text-lg font-black ${selectedVoucher.status === 'negotiated' ? 'text-purple-600' : 'text-emerald-600'}`}>₦{Number(selectedVoucher.final_amount).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-stone-200/60"><span className="text-stone-500 font-medium">Creator</span> <span className="font-medium text-stone-800">{selectedVoucher.creator_email} <span className="text-stone-400">({selectedVoucher.department})</span></span></div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Description</h3>
                  <p className="text-sm text-stone-700 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm leading-relaxed">{selectedVoucher.description}</p>
                </div>
                {selectedVoucher.memo && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Memo</h3>
                    <p className="text-sm text-stone-700 bg-stone-50 p-4 rounded-2xl border border-stone-100 leading-relaxed">{selectedVoucher.memo}</p>
                  </div>
                )}
                {selectedVoucher.attachment_url && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Supporting Document</h3>
                    <a href={selectedVoucher.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all text-sm font-semibold shadow-sm w-full group">
                      <Paperclip className="w-5 h-5 mr-3 text-stone-400 group-hover:text-orange-500 transition-colors" />
                      View Attached Document
                      <ArrowRight className="w-4 h-4 ml-auto text-stone-400" />
                    </a>
                  </div>
                )}
                
                {/* Comments Section */}
                <div className="space-y-3 pt-2">
                  {selectedVoucher.approver_comments && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Approver Comments</h3>
                      <p className="text-sm text-blue-800 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">{selectedVoucher.approver_comments}</p>
                    </div>
                  )}
                  {selectedVoucher.account_comments && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Account Comments</h3>
                      <p className="text-sm text-emerald-800 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">{selectedVoucher.account_comments}</p>
                    </div>
                  )}
                  {selectedVoucher.query_notes && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Audit Query Notes</h3>
                      <p className="text-sm text-red-800 bg-red-50/50 p-3.5 rounded-xl border border-red-100">{selectedVoucher.query_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {actionModalOpen === 'account' && (
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Final Payable Amount (₦)</label>
                  <input type="number" value={finalAmount} onChange={e => setFinalAmount(e.target.value)} className="w-full px-4 py-3 bg-emerald-50/30 border border-emerald-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold text-lg text-emerald-900 transition-colors" />
                  <p className="text-xs text-stone-500 mt-2">Adjust if negotiated down, otherwise leave as requested amount.</p>
                </div>
              )}

              {(actionModalOpen === 'approve' || actionModalOpen === 'account') && (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <h3 className="text-sm font-bold text-stone-800 mb-4">Required Signature</h3>
                  {signaturePreview ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-white border border-orange-200 rounded-xl flex items-center justify-center min-h-[120px]">
                         <img src={signaturePreview} alt="Signature" className="max-h-24 max-w-full object-contain" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => { setSignaturePreview(null); setSignatureType(null); }}
                        className="text-sm text-red-600 hover:text-red-700 font-medium flex justify-center w-full"
                      >
                        Clear Signature
                      </button>
                    </div>
                  ) : (
                    <SignaturePad 
                      onSave={(data, type) => {
                        setSignaturePreview(data);
                        setSignatureType(type);
                      }} 
                    />
                  )}
                </div>
              )}
              {actionModalOpen !== 'details' && (
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="block text-sm font-semibold text-stone-700">
                      {actionModalOpen === 'query' ? 'Query Notes (Required)' : actionModalOpen === 'approve' ? 'Reason for Rejection/Send Back' : 'Comments / Remarks'}
                    </label>
                    {actionModalOpen !== 'query' && <span className="text-xs text-stone-400">Optional for Approvals</span>}
                  </div>
                  <textarea 
                    value={comments} 
                    onChange={e => setComments(e.target.value)} 
                    className={`w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:ring-2 transition-colors h-28 resize-none ${actionModalOpen === 'query' ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-orange-500 focus:border-orange-500'}`} 
                    placeholder={actionModalOpen === 'query' ? 'Explain exactly what is wrong and what needs fixing...' : 'Add any internal notes for accounts or creator...'}
                  />
                  {actionModalOpen === 'approve' && (
                    <p className="text-xs text-stone-500 mt-2">If rejecting or sending back, you MUST provide a reason above.</p>
                  )}
                </div>
              )}

            </div>
            {/* Action Buttons */}
            <div className="p-4 md:p-6 pt-4 flex flex-wrap justify-end gap-2 md:gap-3 border-t border-stone-100 shrink-0 bg-stone-50/50">
              {actionModalOpen === 'details' && (
                <button 
                  onClick={() => downloadIndividualVoucher(selectedVoucher)}
                  className="px-6 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-semibold transition-colors shadow-md flex items-center mr-auto"
                >
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </button>
              )}
              <button onClick={() => { setActionModalOpen(null); setComments(''); }} className="px-6 py-2.5 text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 hover:text-stone-900 rounded-xl font-medium transition-colors">
                {actionModalOpen === 'details' ? 'Close Window' : 'Cancel'}
              </button>
              
              {actionModalOpen === 'approve' && (
                  <>
                    <button onClick={() => handleApproveAction('rejected')} disabled={!comments.trim()} className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 font-semibold transition-colors disabled:opacity-50">Reject</button>
                    <button onClick={() => handleApproveAction('sent_back')} disabled={!comments.trim()} className="px-5 py-2.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl hover:bg-orange-100 font-semibold transition-colors disabled:opacity-50">Send Back</button>
                    <button onClick={() => handleApproveAction('approved')} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors shadow-md">Approve</button>
                  </>
                )}

                {actionModalOpen === 'account' && (
                  <>
                    <button onClick={() => handleAccountAction('negotiated')} className="px-5 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 font-semibold transition-colors">Mark Negotiated</button>
                    <button onClick={() => handleAccountAction('final_payable')} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold transition-colors shadow-md">Generate Payable</button>
                  </>
                )}

              {actionModalOpen === 'query' && (
                <button onClick={handleQuery} disabled={!comments.trim()} className="px-8 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors shadow-md flex items-center">
                  <Send className="w-4 h-4 mr-2" /> Submit Query
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
