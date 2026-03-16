import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, MOCK_USERS } from '../context/AuthContext';
import { useProcurement } from '../context/ProcurementContext';
import { useVendors } from '../context/VendorContext';
import { motion } from 'framer-motion';
import { format, formatDistanceStrict } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle, Clock, FileText, User, AlertTriangle, Tag, Edit, RotateCcw, Paperclip, Download, Maximize2, X, FileDown, BellRing, AlertCircle } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { Attachment, ProcurementItem, ProcurementRequest, HistologyDetails } from '../types';
import { pdf } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import RequestPDF from '../components/RequestPDF';
import PdfAnnotator from '../components/PdfAnnotator';
import { numberToWords } from '../utils/numberToWords';

import { useNotifications } from '../context/NotificationContext';
import { useEmail } from '../context/EmailContext';
import { NumericFormat } from 'react-number-format';

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, verifyPassword } = useAuth();
  const { requests, updateRequestStatus, processApproval, voidApprover, updateRequest } = useProcurement();
  const { vendors, addVendor } = useVendors();
  const { addNotification } = useNotifications();
  const { sendEmail } = useEmail();
  const [notes, setNotes] = useState('');
  const [recommendedAmount, setRecommendedAmount] = useState<number | ''>('');
  const [approverSignature, setApproverSignature] = useState<string>('');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidPassword, setVoidPassword] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [isSendingUrgent, setIsSendingUrgent] = useState(false);
  const [hodComment, setHodComment] = useState('');

  const request = requests.find(r => r.id === id);

  const isPdf = previewAttachment && (
    previewAttachment.type.toLowerCase().includes('pdf') || 
    previewAttachment.name.toLowerCase().endsWith('.pdf')
  );

  React.useEffect(() => {
    if (isPdf && previewAttachment?.data) {
      setPdfError(false);
      
      if (previewAttachment.data.startsWith('http')) {
        setPdfUrl(previewAttachment.data);
        return;
      }

      try {
        // Handle both data URI and raw base64
        const base64Data = previewAttachment.data.includes(',') 
          ? previewAttachment.data.split(',')[1] 
          : previewAttachment.data;
          
        // Clean base64 string (remove whitespace)
        const cleanBase64 = base64Data.replace(/\s/g, '');
          
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Error creating PDF blob:', e);
        setPdfUrl(null);
        setPdfError(true);
      }
    } else {
      setPdfUrl(null);
      setPdfError(false);
    }
  }, [previewAttachment, isPdf]);


  const [editableItems, setEditableItems] = useState<ProcurementItem[]>([]);
  const [editableHistologyDetails, setEditableHistologyDetails] = useState<HistologyDetails[]>([]);
  const [isMarketComparerLoading, setIsMarketComparerLoading] = useState(false);

  React.useEffect(() => {
    if (request) {
      if (request.items) {
        setEditableItems(request.items);
      }
      if (request.histologyDetailsList && request.histologyDetailsList.length > 0) {
        setEditableHistologyDetails(request.histologyDetailsList);
      } else if (request.histologyDetails) {
        setEditableHistologyDetails([request.histologyDetails]);
      }
      if (request.recommendedAmount !== undefined) {
        setRecommendedAmount(request.recommendedAmount);
      }
      if (request.leaveDetails?.headOfDepartmentComment) {
        setHodComment(request.leaveDetails.headOfDepartmentComment);
      }
    }
  }, [request]);

  if (!request) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-stone-900">Request Not Found</h2>
        <p className="mt-2 text-stone-500">The procurement request you are looking for does not exist.</p>
        <button onClick={() => navigate('/requests')} className="mt-4 text-orange-600 hover:text-orange-700 font-medium">
          Back to Requests
        </button>
      </div>
    );
  }

  const mockUserId = user ? MOCK_USERS.find(m => m.email === user.email)?.id : undefined;

  const isDynamicWorkflow = request.workflow && request.workflow.length > 0;
  
  const canApproveDynamic = isDynamicWorkflow && 
    request.status === 'Pending Approval' && 
    request.currentApproverIndex !== undefined && 
    (request.workflow![request.currentApproverIndex] === user?.id || request.workflow![request.currentApproverIndex] === mockUserId);

  const canApproveAudit = !isDynamicWorkflow && (user?.role === 'Approver' || user?.role === 'Both') && user.department === 'Audit' && request.status === 'Pending Audit';
  const canApproveAccounts = !isDynamicWorkflow && (user?.role === 'Approver' || user?.role === 'Both') && user.department === 'Accounts' && request.status === 'Pending Accounts';

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      alert('Please provide a reason for voiding.');
      return;
    }
    
    if (voidPassword !== '198713september') {
      alert('Incorrect password.');
      return;
    }

    if (request && request.workflow && request.currentApproverIndex !== undefined) {
      const currentApproverId = request.workflow[request.currentApproverIndex];
      
      // Void the approver
      voidApprover(request.id, currentApproverId, voidReason);
      
      // Send notification/email
      const approver = MOCK_USERS.find(u => u.id === currentApproverId);
      if (approver && user) {
        sendEmail({
          senderId: user.id,
          toIds: [approver.id],
          ccIds: [],
          bccIds: [],
          attachments: [],
          subject: `Approval Voided: ${request.title}`,
          body: `You have been voided from the approval workflow for request "${request.title}".\n\nReason: ${voidReason}\n\nVoided by: ${user.email}`
        });
        
        addNotification({
          userId: approver.id,
          title: 'Approval Voided',
          message: `You were voided from request ${request.id}. Reason: ${voidReason}`,
          type: 'warning'
        });
      }

      setShowVoidModal(false);
      setVoidPassword('');
      setVoidReason('');
    }
  };

  const canVoid = request.status === 'Pending Approval' && (
    (user?.department === 'Facility') ||
    (user?.email === 'labzankli@gmail.com' && (request.requestType === 'Lab Purchase Order' || request.requestType === 'Equipment Request' || request.requestType === 'Histology Payment')) ||
    (user?.email === 'storezankli@gmail.com' && (request.requestType === 'Pharmacy Purchase Order' || request.requestType?.includes('Emergency Drug Purchase')))
  );

  const isStoreEditing = canApproveDynamic && (
    (user?.email === 'storezankli@gmail.com' && request.requestType === 'Lab Purchase Order') ||
    (user?.email === 'labzankli@gmail.com' && request.requestType === 'Equipment Request') ||
    (user?.email === 'storezankli@gmail.com' && request.requestType === 'Pharmacy Purchase Order')
  );
  
  const isAudit1 = user?.email === 'auditorzankli@gmail.com';
  const isAudit2 = user?.email === 'auditor2zankli@gmail.com';
  // If generic audit user (or during development), default to Audit 1 capabilities if in Audit department
  const isGenericAudit = (user?.department === 'Audit' && !isAudit1 && !isAudit2);
  
  const isAuditEditing = (canApproveDynamic && user?.department === 'Audit') || canApproveAudit;

  const handlePhysicalAudit = (auditType: 'audit1' | 'audit2') => {
    if (!request) return;
    
    const now = new Date().toISOString();
    const updates: Partial<ProcurementRequest> = {};
    
    if (auditType === 'audit1') {
      updates.audit1PhysicallySeen = true;
      updates.audit1PhysicallySeenAt = now;
    } else {
      updates.audit2PhysicallySeen = true;
      updates.audit2PhysicallySeenAt = now;
    }
    
    updateRequest(request.id, updates);
  };

  const handleItemChange = (index: number, field: keyof ProcurementItem, value: any) => {
    const newItems = [...editableItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditableItems(newItems);
  };

  const handleHistologyChange = (index: number, field: keyof HistologyDetails, value: any) => {
    const newDetails = [...editableHistologyDetails];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setEditableHistologyDetails(newDetails);
  };

  const handleRunMarketComparer = async () => {
    setIsMarketComparerLoading(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const newItems = [...editableItems];
      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `What is the estimated market price in Nigerian Naira (NGN) for "${item.name}" (Quantity: ${item.quantity}, Unit: ${item.unit || 'N/A'})? Provide a short, concise answer with just the price range or estimate.`,
            config: {
              tools: [{ googleSearch: {} }],
            }
          });
          newItems[i].aiMarketPrice = response.text || 'N/A';
        } catch (e) {
          console.error("Error fetching market price for", item.name, e);
          newItems[i].aiMarketPrice = 'Error fetching price';
        }
      }
      setEditableItems(newItems);
    } catch (error) {
      console.error("Failed to run market comparer", error);
      alert("Failed to run AI Market Comparer. Check your API key.");
    } finally {
      setIsMarketComparerLoading(false);
    }
  };

  const [similarRequests, setSimilarRequests] = useState<ProcurementRequest[]>([]);
  const [showSimilarModal, setShowSimilarModal] = useState(false);

  React.useEffect(() => {
    if (request && request.items) {
      const similar = requests.filter(r => 
        r.id !== request.id && 
        r.status === 'Approved' && // Only compare with approved requests
        r.items?.some(ri => 
          request.items?.some(i => 
            (i.name && i.name.trim().length > 3 && ri.name && ri.name.toLowerCase().includes(i.name.trim().toLowerCase())) ||
            (i.description && i.description.trim().length > 3 && ri.description && ri.description.toLowerCase().includes(i.description.trim().toLowerCase()))
          )
        )
      ).slice(0, 20);
      setSimilarRequests(similar);
    }
  }, [request, requests]);

  const handleAction = (action: 'Approve' | 'Reject' | 'Sent Back') => {
    if (!approverSignature) {
      alert('Please sign before submitting your decision.');
      return;
    }

    let updates: Partial<ProcurementRequest> = {};
    if (isStoreEditing || isAuditEditing) {
      updates = {
        items: editableItems,
        histologyDetailsList: editableHistologyDetails.length > 0 ? editableHistologyDetails : undefined,
        // If it was a single detail originally, we might want to keep it synced, but list is preferred now
        histologyDetails: editableHistologyDetails.length === 1 ? editableHistologyDetails[0] : undefined,
        ...(isAuditEditing && recommendedAmount !== '' ? { recommendedAmount: Number(recommendedAmount) } : {})
      };
    }
    if (isLeave && request.leaveDetails?.headOfDepartmentId === (mockUserId || user?.id)) {
      updates = {
        ...updates,
        leaveDetails: {
          ...request.leaveDetails,
          headOfDepartmentComment: hodComment
        }
      };
    }
    if (Object.keys(updates).length > 0) {
      updateRequest(request.id, updates);
    }

    if (isDynamicWorkflow) {
      const status = action === 'Approve' ? 'Approved' : action === 'Reject' ? 'Rejected' : 'Sent Back';
      
      // Check for Out of Stock items and notify Lab (or creator)
      if (status === 'Approved' && isStoreEditing) {
         const outOfStockItems = editableItems.filter(i => i.availability === 'Out of Stock');
         if (outOfStockItems.length > 0) {
            const labUser = MOCK_USERS.find(u => u.email === 'labzankli@gmail.com');
            if (labUser) {
              sendEmail({
                senderId: user!.id,
                toIds: [labUser.id],
                ccIds: [],
                bccIds: [],
                attachments: [],
                subject: `Items Out of Stock: ${request.title}`,
                body: `The following items are out of stock and were removed from the request ${request.id}:\n\n${outOfStockItems.map(i => `- ${i.name} (Qty: ${i.quantity})`).join('\n')}`
              });
              addNotification({
                userId: labUser.id,
                title: 'Items Out of Stock',
                message: `${outOfStockItems.length} items were marked as Out of Stock in request ${request.id}`,
                type: 'warning',
                link: `/requests/${request.id}`
              });
            }
         }
      }

      processApproval(request.id, mockUserId || user!.id, status, approverSignature, notes, editableItems);
    } else {
      if (canApproveAudit) {
        updateRequestStatus(
          request.id, 
          action === 'Approve' ? 'Pending Accounts' : action === 'Sent Back' ? 'Sent Back' : 'Rejected', 
          notes, 
          'Audit',
          approverSignature
        );
      } else if (canApproveAccounts) {
        updateRequestStatus(
          request.id, 
          action === 'Approve' ? 'Approved' : action === 'Sent Back' ? 'Sent Back' : 'Rejected', 
          notes, 
          'Accounts',
          approverSignature
        );
      }
    }

    navigate('/requests');
  };

  const isHistology = request.requestType === 'Histology Payment';
  const isEmergency = request.requestType?.startsWith('Emergency Drug Purchase');
  const isDiesel = request.requestType === 'Diesel Request';
  const isProductProc = request.requestType === 'Product Procurement';
  const isLeave = request.requestType === 'Leave Request';
  const isStoreReq = request.requestType === 'Store Requisition';
  const isIssueStore = request.requestType === 'Issue From Store';
  const hasItems = request.items && request.items.length > 0;

  const getVendorName = (vendorId?: string, manualName?: string) => {
    if (vendorId === 'manual') return manualName || 'Manual Input';
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.name : 'Unknown Vendor';
  };

  const calculateDuration = (start: string, end: string) => {
    return formatDistanceStrict(new Date(start), new Date(end));
  };

  const handleDownloadPDF = async () => {
    if (!request) return;
    setIsGeneratingPDF(true);
    try {
      // 1. Generate the main PDF
      const blob = await pdf(<RequestPDF request={request} vendors={vendors} />).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      
      // 2. Load the main PDF into pdf-lib
      const mainPdfDoc = await PDFDocument.load(arrayBuffer);
      
      // 3. Process attachments
      if (request.attachments && request.attachments.length > 0) {
        for (const att of request.attachments) {
          if (att.type.includes('pdf') || att.name.toLowerCase().endsWith('.pdf')) {
            try {
              let pdfDocToMerge;
              if (att.data.startsWith('http')) {
                const response = await fetch(att.data);
                const arrayBuffer = await response.arrayBuffer();
                pdfDocToMerge = await PDFDocument.load(arrayBuffer);
              } else {
                // Extract base64 data
                const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
                const cleanBase64 = base64Data.replace(/\s/g, '');
                pdfDocToMerge = await PDFDocument.load(cleanBase64);
              }
              const copiedPages = await mainPdfDoc.copyPages(pdfDocToMerge, pdfDocToMerge.getPageIndices());
              copiedPages.forEach((page) => mainPdfDoc.addPage(page));
            } catch (e) {
              console.error('Failed to merge PDF attachment', e);
            }
          } else if (att.type.includes('image') || att.name.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
            try {
              let imageBytes;
              if (att.data.startsWith('http')) {
                const response = await fetch(att.data);
                imageBytes = new Uint8Array(await response.arrayBuffer());
              } else {
                const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
                const cleanBase64 = base64Data.replace(/\s/g, '');
                imageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
              }
              
              let image;
              if (att.type.includes('png') || att.name.toLowerCase().endsWith('.png') || att.data.startsWith('data:image/png')) {
                image = await mainPdfDoc.embedPng(imageBytes);
              } else {
                image = await mainPdfDoc.embedJpg(imageBytes);
              }
              
              const page = mainPdfDoc.addPage();
              const { width, height } = page.getSize();
              const imgDims = image.scaleToFit(width - 100, height - 100);
              
              page.drawImage(image, {
                x: page.getWidth() / 2 - imgDims.width / 2,
                y: page.getHeight() / 2 - imgDims.height / 2,
                width: imgDims.width,
                height: imgDims.height,
              });
            } catch (e) {
              console.error('Failed to merge image attachment', e);
            }
          }
        }
      }
      
      // 4. Save and download
      const pdfBytes = await mainPdfDoc.save();
      const mergedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(mergedBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Request_${request.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleUrgentReminder = async () => {
    if (!request) return;
    setIsSendingUrgent(true);

    try {
      let targetUserId = '';
      let targetEmail = '';

      if (isDynamicWorkflow && request.workflow && request.currentApproverIndex !== undefined) {
        targetUserId = request.workflow[request.currentApproverIndex];
        const approver = MOCK_USERS.find(u => u.id === targetUserId);
        if (approver) targetEmail = approver.email;
      } else {
        if (request.status === 'Pending Audit') {
          targetUserId = 'Audit';
          // In a real app, we'd find all audit users
        } else if (request.status === 'Pending Accounts') {
          targetUserId = 'Accounts';
        }
      }

      if (targetUserId) {
        addNotification({
          userId: targetUserId,
          title: 'Urgent Request',
          message: `You have an urgent request to sign. Click here to view.`,
          type: 'warning',
          link: `/requests/${request.id}`
        });

        // Also send an email if we have an email address
        if (targetEmail) {
          sendEmail({
            senderId: user!.id,
            toIds: [targetUserId],
            ccIds: [],
            bccIds: [],
            attachments: [],
            subject: `URGENT: Approval Required for ${request.title}`,
            body: `This is an urgent reminder to review and approve the request "${request.title}".\n\nPlease attend to this immediately.`
          });
        }

        alert('Urgent reminder sent successfully!');
      } else {
        alert('Could not determine the current approver.');
      }
    } catch (error) {
      console.error('Error sending urgent reminder:', error);
      alert('Failed to send urgent reminder.');
    } finally {
      setIsSendingUrgent(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="mr-4 p-2 rounded-full hover:bg-stone-200 text-stone-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{request.title}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap
                ${request.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 
                  request.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                  request.status === 'Sent Back' ? 'bg-purple-100 text-purple-800' :
                  request.status === 'Pending Audit' || request.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'}`}
              >
                {request.status}
              </span>
            </div>
            <p className="text-sm text-stone-500 mt-1">Request ID: {request.id}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {(request.status === 'Pending Approval' || request.status === 'Pending Audit' || request.status === 'Pending Accounts') && 
           (request.createdBy === user?.email || ['Laboratory', 'Facility', 'IT Support', 'Pharmacy'].includes(user?.department || '')) && (
            <button
              onClick={handleUrgentReminder}
              disabled={isSendingUrgent}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50"
              title="Send Urgent Reminder to Approver"
            >
              <BellRing className="w-4 h-4 mr-2" />
              {isSendingUrgent ? 'Sending...' : 'Urgent Reminder'}
            </button>
          )}

          {(request.status === 'Sent Back' || request.status === 'Draft') && request.createdBy === user?.email && (
            <button
              onClick={() => navigate(`/requests/edit/${request.id}`)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              {request.status === 'Draft' ? 'Edit Draft' : 'Edit & Resubmit'}
            </button>
          )}
          
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="inline-flex items-center px-4 py-2 border border-stone-200 text-sm font-medium rounded-xl shadow-sm text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4 mr-2 text-stone-500" />
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Similar Requests Alert */}
        {similarRequests.length > 0 && (user?.role === 'Approver' || user?.role === 'Both') && (
          <div className="lg:col-span-3 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Found {similarRequests.length} similar past request(s).
                  <button 
                    onClick={() => setShowSimilarModal(true)} 
                    className="font-medium underline ml-2 hover:text-blue-600"
                  >
                    View Details
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Similar Requests Modal */}
        {showSimilarModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowSimilarModal(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                    <AlertCircle className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Similar Requests</h3>
                    <div className="mt-2 text-left max-h-60 overflow-y-auto">
                      {similarRequests.map(req => (
                        <div key={req.id} className="py-2 border-b border-gray-200 last:border-0">
                          <p className="text-sm font-medium text-gray-900">{req.title} ({req.id})</p>
                          <p className="text-xs text-gray-500">{format(new Date(req.createdAt), 'MMM d, yyyy')} - {req.createdBy}</p>
                          <p className="text-xs text-gray-500 mt-1">Total: ₦{(req.totalAmount || 0).toLocaleString()}</p>
                          <button onClick={() => { setShowSimilarModal(false); navigate(`/requests/${req.id}`); }} className="text-xs text-blue-600 hover:underline mt-1">View Request</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                    onClick={() => setShowSimilarModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-stone-400" />
                Request Details
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-stone-100">
                <div>
                  <h3 className="text-sm font-medium text-stone-500">Request Type</h3>
                  <p className="mt-1 text-sm font-medium text-stone-900 flex items-center">
                    <Tag className="w-4 h-4 mr-1 text-stone-400" />
                    {request.requestType || 'General'}
                  </p>
                </div>
                {request.splitSupplier && (
                  <div>
                    <h3 className="text-sm font-medium text-stone-500">Vendor / Supplier</h3>
                    <p className="mt-1 text-sm font-medium text-stone-900 flex items-center">
                      <Tag className="w-4 h-4 mr-1 text-stone-400" />
                      {request.splitSupplier}
                    </p>
                  </div>
                )}
                {request.urgencyLevel && (
                  <div>
                    <h3 className="text-sm font-medium text-stone-500">Urgency Level</h3>
                    <p className={`mt-1 text-sm font-medium flex items-center ${
                      request.urgencyLevel === 'Critical' ? 'text-red-600' :
                      request.urgencyLevel === 'High' ? 'text-orange-600' :
                      'text-stone-900'
                    }`}>
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      {request.urgencyLevel}
                    </p>
                  </div>
                )}
              </div>

              {request.description && request.description !== request.requestType && (
                <div>
                  <h3 className="text-sm font-medium text-stone-500">
                    {isDiesel || isLeave ? 'Reason' : 'Description / Justification'}
                  </h3>
                  <p className="mt-1 text-sm text-stone-900 whitespace-pre-wrap">{request.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
                <div>
                  <h3 className="text-sm font-medium text-stone-500">Department</h3>
                  <p className="mt-1 text-sm font-medium text-stone-900">{request.department}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-stone-500">Created By</h3>
                  <p className="mt-1 text-sm font-medium text-stone-900 flex items-center">
                    <User className="w-4 h-4 mr-1 text-stone-400" />
                    {request.createdBy}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-stone-500">Date Submitted</h3>
                  <p className="mt-1 text-sm font-medium text-stone-900 flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-stone-400" />
                    {format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isHistology && ((request.histologyDetailsList && request.histologyDetailsList.length > 0) || request.histologyDetails) && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Histology Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Patient Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Hosp No.</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Lab No.</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Outsource Service</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Outsource Bill</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">ZMC Charges</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Receipt/HMO</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Retainership</th>
                      {(isAuditEditing || editableHistologyDetails.some(d => d.audit1RecommendedPrice || d.audit2RecommendedPrice || d.flagged)) && (
                        <>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Audit Rec.</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Audit Note</th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-stone-500 uppercase tracking-wider">Flag</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-stone-200">
                    {editableHistologyDetails.map((detail, index) => (
                      <tr key={index} className={`hover:bg-stone-50 transition-colors ${detail.flagged ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900">{detail.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">{detail.patientName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{detail.hospNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{detail.labNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{detail.outsourceService}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-stone-900">₦{(detail.outsourceBill || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-stone-900">₦{(detail.zmcCharges || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{detail.receiptHmo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{detail.retainership}</td>
                        
                        {(isAuditEditing || detail.audit1RecommendedPrice || detail.audit2RecommendedPrice || detail.flagged) && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {isAuditEditing ? (
                                <NumericFormat
                                  value={isAudit2 ? (detail.audit2RecommendedPrice || '') : (detail.audit1RecommendedPrice || '')}
                                  onValueChange={(values) => handleHistologyChange(index, isAudit2 ? 'audit2RecommendedPrice' : 'audit1RecommendedPrice', values.floatValue || 0)}
                                  thousandSeparator=","
                                  decimalScale={2}
                                  allowNegative={false}
                                  className="w-24 p-1 text-sm border border-stone-300 rounded focus:ring-orange-500 focus:border-orange-500"
                                  placeholder="Rec. Price"
                                />
                              ) : (
                                <span className="text-stone-900 font-medium">
                                  {detail.audit2RecommendedPrice ? `₦${detail.audit2RecommendedPrice.toLocaleString()}` : detail.audit1RecommendedPrice ? `₦${detail.audit1RecommendedPrice.toLocaleString()}` : '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {isAuditEditing ? (
                                <input
                                  type="text"
                                  value={isAudit2 ? (detail.audit2DifferenceReason || '') : (detail.audit1DifferenceReason || '')}
                                  onChange={(e) => handleHistologyChange(index, isAudit2 ? 'audit2DifferenceReason' : 'audit1DifferenceReason', e.target.value)}
                                  className="w-32 p-1 text-sm border border-stone-300 rounded focus:ring-orange-500 focus:border-orange-500"
                                  placeholder="Reason"
                                />
                              ) : (
                                <span className="text-stone-500 italic">
                                  {detail.audit2DifferenceReason || detail.audit1DifferenceReason || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {isAuditEditing ? (
                                <div className="flex flex-col items-center gap-2">
                                  <button
                                    onClick={() => handleHistologyChange(index, 'flagged', !detail.flagged)}
                                    className={`p-1 rounded-full ${detail.flagged ? 'bg-red-100 text-red-600' : 'bg-stone-100 text-stone-400'}`}
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>
                                  {detail.flagged && (
                                    <input
                                      type="text"
                                      value={detail.flagReason || ''}
                                      onChange={(e) => handleHistologyChange(index, 'flagReason', e.target.value)}
                                      className="w-24 p-1 text-xs border border-red-300 rounded focus:ring-red-500 focus:border-red-500"
                                      placeholder="Flag Reason"
                                    />
                                  )}
                                </div>
                              ) : (
                                detail.flagged && (
                                  <div className="flex flex-col items-center">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    {detail.flagReason && <span className="text-xs text-red-600 mt-1">{detail.flagReason}</span>}
                                  </div>
                                )
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isEmergency && request.paymentDetails && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-8 border-b border-stone-100">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-stone-900 uppercase tracking-wider">Payment Advice</h2>
                  <p className="text-stone-500 mt-1">Zankli Medical Centre</p>
                </div>
                
                <div className="flex justify-between items-center mb-8">
                  <div className="text-sm">
                    <span className="font-semibold text-stone-700">Date:</span> {format(new Date(request.paymentDetails.date), 'MMMM d, yyyy')}
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-stone-700">Ref:</span> {request.id}
                  </div>
                </div>

                <div className="space-y-6 text-stone-800">
                  <div className="flex items-start">
                    <span className="font-semibold w-32 shrink-0">Please Pay:</span>
                    <span className="font-medium border-b border-stone-300 flex-grow pb-1">{request.paymentDetails.payee}</span>
                  </div>
                  
                  <div className="flex items-start">
                    <span className="font-semibold w-32 shrink-0">The Sum Of:</span>
                    <div className="flex-grow">
                      <span className="font-medium border-b border-stone-300 block pb-1">
                        {numberToWords(request.paymentDetails.amount)}
                      </span>
                      <span className="font-bold text-lg mt-2 block">
                        (₦{(request.paymentDetails.amount || 0).toLocaleString()})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <span className="font-semibold w-32 shrink-0">Being:</span>
                    <span className="font-medium border-b border-stone-300 flex-grow pb-1">{request.paymentDetails.purpose}</span>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-2 gap-8">
                  <div>
                    <div className="h-16 border-b border-stone-300 flex items-end justify-center pb-2">
                      {request.creatorSignature && (
                        <img src={request.creatorSignature} alt="Creator Signature" className="h-12 object-contain" />
                      )}
                    </div>
                    <p className="text-center text-xs font-semibold mt-2 uppercase">Prepared By</p>
                    <p className="text-center text-xs text-stone-500">{request.createdBy}</p>
                  </div>
                  
                  {request.approvals && request.approvals.length > 0 && (
                    <div>
                      <div className="h-16 border-b border-stone-300 flex items-end justify-center pb-2">
                        {request.approvals[request.approvals.length - 1].signature && (
                          <img src={request.approvals[request.approvals.length - 1].signature} alt="Final Approver Signature" className="h-12 object-contain" />
                        )}
                      </div>
                      <p className="text-center text-xs font-semibold mt-2 uppercase">Authorized By</p>
                      <p className="text-center text-xs text-stone-500">
                        {MOCK_USERS.find(u => u.id === request.approvals![request.approvals!.length - 1].approverId)?.department || 'Approver'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {request.requestType === 'Emergency Drug Purchase (1 week)' && (
                <div className="p-8 bg-stone-50 border-t-2 border-dashed border-stone-300">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-stone-900 uppercase tracking-wider">Payment Voucher</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm font-semibold text-stone-700">Payee:</p>
                      <p className="text-stone-900">{request.paymentDetails.payee}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-700">Amount:</p>
                      <p className="text-lg font-bold text-stone-900">₦{(request.paymentDetails.amount || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <p className="text-sm font-semibold text-stone-700 mb-1">Particulars:</p>
                    <p className="text-stone-900 p-3 bg-white border border-stone-200 rounded-lg">{request.paymentDetails.purpose}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="h-12 border-b border-stone-300 flex items-end justify-center pb-1">
                        {request.creatorSignature && <img src={request.creatorSignature} alt="Sig" className="h-8 object-contain" />}
                      </div>
                      <p className="text-xs font-semibold mt-1">Prepared</p>
                    </div>
                    <div className="text-center">
                      <div className="h-12 border-b border-stone-300 flex items-end justify-center pb-1">
                        {request.approvals && request.approvals.length > 0 && <img src={request.approvals[0].signature} alt="Sig" className="h-8 object-contain" />}
                      </div>
                      <p className="text-xs font-semibold mt-1">Checked</p>
                    </div>
                    <div className="text-center">
                      <div className="h-12 border-b border-stone-300 flex items-end justify-center pb-1">
                        {request.approvals && request.approvals.length > 1 && <img src={request.approvals[request.approvals.length - 1].signature} alt="Sig" className="h-8 object-contain" />}
                      </div>
                      <p className="text-xs font-semibold mt-1">Authorized</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isDiesel && request.dieselDetails && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Diesel Requisition Details</h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                  <div><dt className="text-sm font-medium text-stone-500">Date of Requisition</dt><dd className="mt-1 text-sm text-stone-900">{request.dieselDetails.dateOfRequisition}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Issuer Name</dt><dd className="mt-1 text-sm text-stone-900">{request.dieselDetails.issuerName}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Volume (Liters)</dt><dd className="mt-1 text-sm text-stone-900">{(request.dieselDetails.volumeLiters || 0).toLocaleString()}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Diesel Remaining (Liters)</dt><dd className="mt-1 text-sm text-stone-900">{(request.dieselDetails.dieselRemainingLiters || 0).toLocaleString()}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Cost per Liter</dt><dd className="mt-1 text-sm font-medium text-stone-900">₦{(request.dieselDetails.costPerLiter || 0).toLocaleString()}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Vendor</dt><dd className="mt-1 text-sm text-stone-900">{getVendorName(request.dieselDetails.vendorId, request.dieselDetails.manualVendorName)}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {isProductProc && request.productProcurementDetails && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Procurement Details</h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-6">
                  <div><dt className="text-sm font-medium text-stone-500">Date of Requisition</dt><dd className="mt-1 text-sm text-stone-900">{request.productProcurementDetails.dateOfRequisition}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Issuer Name</dt><dd className="mt-1 text-sm text-stone-900">{request.productProcurementDetails.issuerName}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Department</dt><dd className="mt-1 text-sm text-stone-900">{request.productProcurementDetails.department}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {isLeave && request.leaveDetails && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Leave Details</h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                  <div><dt className="text-sm font-medium text-stone-500">Date of Requisition</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.dateOfRequisition}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Issuer Name</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.issuerName}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Applicant Name</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.applicantName}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Start Date</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.startDate}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">End Date</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.endDate}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Number of Leave Days</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.numberOfLeaveDays || request.leaveDetails.daysRemaining}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Remaining Leave Days</dt><dd className="mt-1 text-sm text-stone-900">{request.leaveDetails.daysRemaining}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Purpose</dt><dd className="mt-1 text-sm text-stone-900 capitalize">{request.leaveDetails.purpose}</dd></div>
                  {request.leaveDetails.headOfDepartmentId && (
                    <div><dt className="text-sm font-medium text-stone-500">Head of Department</dt><dd className="mt-1 text-sm text-stone-900">{MOCK_USERS.find(u => u.id === request.leaveDetails?.headOfDepartmentId)?.department || 'Approver'}</dd></div>
                  )}
                  {request.leaveDetails.headOfDepartmentComment && (
                    <div className="sm:col-span-2 md:col-span-3"><dt className="text-sm font-medium text-stone-500">HOD Comment</dt><dd className="mt-1 text-sm text-stone-900 p-3 bg-stone-50 rounded-lg border border-stone-200">{request.leaveDetails.headOfDepartmentComment}</dd></div>
                  )}
                </dl>
              </div>
            </div>
          )}

          {isStoreReq && request.storeRequisitionDetails && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Store Requisition Details</h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                  <div><dt className="text-sm font-medium text-stone-500">Date of Requisition</dt><dd className="mt-1 text-sm text-stone-900">{request.storeRequisitionDetails.dateOfRequisition}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Issuer Name</dt><dd className="mt-1 text-sm text-stone-900">{request.storeRequisitionDetails.issuerName}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {isIssueStore && request.issueFromStoreDetails && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Issue Details</h2>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-6">
                  <div><dt className="text-sm font-medium text-stone-500">Date of Requisition</dt><dd className="mt-1 text-sm text-stone-900">{request.issueFromStoreDetails.dateOfRequisition}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Issuer Name</dt><dd className="mt-1 text-sm text-stone-900">{request.issueFromStoreDetails.issuerName}</dd></div>
                  <div><dt className="text-sm font-medium text-stone-500">Department to Issue To</dt><dd className="mt-1 text-sm text-stone-900">{request.issueFromStoreDetails.departmentToIssueTo}</dd></div>
                </dl>
              </div>
            </div>
          )}

          {!isHistology && !isEmergency && !isDiesel && !isLeave && request.items && request.items.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-stone-900">Requested Items</h2>
                {isAuditEditing && (
                  <button
                    onClick={handleRunMarketComparer}
                    disabled={isMarketComparerLoading}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isMarketComparerLoading ? 'Running AI Comparer...' : 'Run AI Market Comparer'}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Item</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Quantity</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Est. Unit Cost</th>
                      {(isStoreEditing || isAuditEditing || request.items.some(i => i.recommendedPrice)) && (
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Store Rec.</th>
                      )}
                      {(isAuditEditing || request.items.some(i => i.audit1RecommendedPrice)) && (
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Audit 1 Rec.</th>
                      )}
                      {(isAuditEditing || request.items.some(i => i.audit2RecommendedPrice)) && (
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Audit 2 Rec.</th>
                      )}
                      {(isStoreEditing || isAuditEditing || request.items.some(i => i.supplier)) && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Vendor / Supplier</th>
                      )}
                      {(isStoreEditing || isAuditEditing || request.items.some(i => i.availability)) && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Availability</th>
                      )}
                      {(isAuditEditing || request.items.some(i => i.flagged || i.aiMarketPrice)) && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Audit Info</th>
                      )}
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-stone-200">
                    {(isStoreEditing || isAuditEditing ? editableItems : request.items).map((item, index) => (
                      <tr key={item.id} className={item.flagged ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-stone-900">{item.name}</div>
                          {item.description && <div className="text-xs text-stone-500 mt-1">{item.description}</div>}
                          <div className="text-xs text-stone-400 mt-1 flex gap-2">
                            {item.unit && <span>Unit: {item.unit}</span>}
                            {item.stockLevel && <span>Stock: {item.stockLevel}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">{item.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">₦{(item.estimatedCost || 0).toLocaleString()}</td>
                        
                        {(isStoreEditing || isAuditEditing || request.items.some(i => i.recommendedPrice)) && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">
                            {isStoreEditing ? (
                              <NumericFormat
                                value={item.recommendedPrice || ''}
                                onValueChange={(values) => handleItemChange(index, 'recommendedPrice', values.floatValue || 0)}
                                thousandSeparator=","
                                decimalScale={2}
                                allowNegative={false}
                                className="w-24 text-right rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                placeholder="Price"
                              />
                            ) : (
                              item.recommendedPrice ? `₦${(item.recommendedPrice || 0).toLocaleString()}` : '-'
                            )}
                          </td>
                        )}

                        {(isAuditEditing || request.items.some(i => i.audit1RecommendedPrice)) && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">
                            {(isAudit1 || isGenericAudit) ? (
                              <div className="flex flex-col gap-2 items-end">
                                <NumericFormat
                                  value={item.audit1RecommendedPrice || ''}
                                  onValueChange={(values) => handleItemChange(index, 'audit1RecommendedPrice', values.floatValue || 0)}
                                  thousandSeparator=","
                                  decimalScale={2}
                                  allowNegative={false}
                                  className="w-24 text-right rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                  placeholder="Price"
                                />
                                <input
                                  type="text"
                                  value={item.audit1DifferenceReason || ''}
                                  onChange={(e) => handleItemChange(index, 'audit1DifferenceReason', e.target.value)}
                                  className="w-24 text-xs rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                                  placeholder="Reason"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span>{item.audit1RecommendedPrice ? `₦${item.audit1RecommendedPrice.toLocaleString()}` : '-'}</span>
                                {item.audit1DifferenceReason && <span className="text-xs text-stone-400 italic max-w-[100px] truncate" title={item.audit1DifferenceReason}>{item.audit1DifferenceReason}</span>}
                              </div>
                            )}
                          </td>
                        )}

                        {(isAuditEditing || request.items.some(i => i.audit2RecommendedPrice)) && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">
                            {(isAudit2) ? (
                              <div className="flex flex-col gap-2 items-end">
                                <NumericFormat
                                  value={item.audit2RecommendedPrice || ''}
                                  onValueChange={(values) => handleItemChange(index, 'audit2RecommendedPrice', values.floatValue || 0)}
                                  thousandSeparator=","
                                  decimalScale={2}
                                  allowNegative={false}
                                  className="w-24 text-right rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                  placeholder="Price"
                                />
                                <input
                                  type="text"
                                  value={item.audit2DifferenceReason || ''}
                                  onChange={(e) => handleItemChange(index, 'audit2DifferenceReason', e.target.value)}
                                  className="w-24 text-xs rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                                  placeholder="Reason"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span>{item.audit2RecommendedPrice ? `₦${item.audit2RecommendedPrice.toLocaleString()}` : '-'}</span>
                                {item.audit2DifferenceReason && <span className="text-xs text-stone-400 italic max-w-[100px] truncate" title={item.audit2DifferenceReason}>{item.audit2DifferenceReason}</span>}
                              </div>
                            )}
                          </td>
                        )}

                        {(isStoreEditing || isAuditEditing || request.items.some(i => i.supplier)) && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                            {isStoreEditing ? (
                              <>
                                <input
                                  type="text"
                                  list={`vendors-list-${index}`}
                                  value={item.supplier || ''}
                                  onChange={(e) => handleItemChange(index, 'supplier', e.target.value)}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val && !vendors.some(v => v.name.toLowerCase() === val.toLowerCase())) {
                                      addVendor({ name: val, category: 'Facility' });
                                    }
                                  }}
                                  className="w-32 rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                                  placeholder="Vendor / Supplier"
                                />
                                <datalist id={`vendors-list-${index}`}>
                                  {vendors.map(v => <option key={v.id} value={v.name} />)}
                                </datalist>
                              </>
                            ) : (
                              item.supplier || '-'
                            )}
                          </td>
                        )}

                        {(isStoreEditing || isAuditEditing || request.items.some(i => i.availability)) && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                            {isStoreEditing ? (
                              <select
                                value={item.availability || ''}
                                onChange={(e) => handleItemChange(index, 'availability', e.target.value)}
                                className="w-32 rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                              >
                                <option value="">Select...</option>
                                <option value="In Stock">In Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                                <option value="Partial">Partial</option>
                              </select>
                            ) : (
                              item.availability || '-'
                            )}
                          </td>
                        )}

                        {(isAuditEditing || request.items.some(i => i.flagged || i.aiMarketPrice)) && (
                          <td className="px-6 py-4 text-sm text-stone-500">
                            {isAuditEditing ? (
                              <div className="space-y-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.flagged || false}
                                    onChange={(e) => handleItemChange(index, 'flagged', e.target.checked)}
                                    className="rounded text-red-600 focus:ring-red-500"
                                  />
                                  <span className="text-xs text-red-600 font-medium">Flag</span>
                                </label>
                                {item.flagged && (
                                  <input
                                    type="text"
                                    value={item.flagReason || ''}
                                    onChange={(e) => handleItemChange(index, 'flagReason', e.target.value)}
                                    className="w-full text-xs rounded-md border-stone-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                                    placeholder="Reason for flag..."
                                  />
                                )}
                                {item.aiMarketPrice && (
                                  <div className="text-xs text-blue-600 bg-blue-50 p-1 rounded">
                                    AI: {item.aiMarketPrice}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {item.flagged && (
                                  <div className="text-xs text-red-600 font-medium bg-red-50 p-1 rounded border border-red-100">
                                    Flagged: {item.flagReason || 'No reason provided'}
                                  </div>
                                )}
                                {item.aiMarketPrice && (
                                  <div className="text-xs text-blue-600">
                                    AI: {item.aiMarketPrice}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )}

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900 text-right">
                          ₦{((item.quantity || 0) * (item.recommendedPrice || item.estimatedCost || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-stone-50">
                    <tr>
                      <th scope="row" colSpan={
                        3 + 
                        ((isStoreEditing || isAuditEditing || request.items.some(i => i.recommendedPrice)) ? 1 : 0) +
                        ((isAuditEditing || request.items.some(i => i.audit1RecommendedPrice)) ? 1 : 0) +
                        ((isAuditEditing || request.items.some(i => i.audit2RecommendedPrice)) ? 1 : 0) +
                        ((isStoreEditing || isAuditEditing || request.items.some(i => i.supplier)) ? 1 : 0) +
                        ((isStoreEditing || isAuditEditing || request.items.some(i => i.availability)) ? 1 : 0) +
                        ((isAuditEditing || request.items.some(i => i.flagged || i.aiMarketPrice)) ? 1 : 0)
                      } className="px-6 py-4 text-right text-sm font-bold text-stone-900 uppercase">Total Amount</th>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-lg font-bold text-orange-600">
                        ₦{(isStoreEditing || isAuditEditing ? editableItems : request.items).reduce((sum, item) => sum + ((item.quantity || 0) * (item.recommendedPrice || item.estimatedCost || 0)), 0).toLocaleString()}
                      </td>
                    </tr>
                    {(isAuditEditing || request.recommendedAmount !== undefined) && (
                      <tr className="bg-orange-50/50">
                        <th scope="row" colSpan={
                          3 + 
                          ((isStoreEditing || isAuditEditing || request.items.some(i => i.recommendedPrice)) ? 1 : 0) +
                          ((isAuditEditing || request.items.some(i => i.audit1RecommendedPrice)) ? 1 : 0) +
                          ((isAuditEditing || request.items.some(i => i.audit2RecommendedPrice)) ? 1 : 0) +
                          ((isStoreEditing || isAuditEditing || request.items.some(i => i.supplier)) ? 1 : 0) +
                          ((isStoreEditing || isAuditEditing || request.items.some(i => i.availability)) ? 1 : 0) +
                          ((isAuditEditing || request.items.some(i => i.flagged || i.aiMarketPrice)) ? 1 : 0)
                        } className="px-6 py-4 text-right text-sm font-bold text-orange-900 uppercase">
                          Auditor Recommended Total
                        </th>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {isAuditEditing ? (
                            <div className="flex items-center justify-end">
                              <span className="text-stone-500 mr-1">₦</span>
                              <NumericFormat
                                value={recommendedAmount}
                                onValueChange={(values) => setRecommendedAmount(values.floatValue || '')}
                                thousandSeparator=","
                                decimalScale={2}
                                allowNegative={false}
                                className="w-32 rounded-md border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm text-right font-bold text-orange-700"
                                placeholder="Amount"
                              />
                            </div>
                          ) : (
                            <span className="text-xl font-black text-orange-700">
                              ₦{(request.recommendedAmount || 0).toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          
          {(isHistology || isEmergency || isDiesel) && (
            <div className="space-y-4">
              <div className="bg-stone-50 rounded-2xl p-6 flex justify-between items-center border border-stone-200">
                <span className="text-sm font-bold text-stone-900 uppercase">Total Amount</span>
                <span className="text-2xl font-bold text-orange-600">₦{(request.totalAmount || 0).toLocaleString()}</span>
              </div>
              
              {(isAuditEditing || request.recommendedAmount !== undefined) && (
                <div className="bg-orange-50 rounded-2xl p-6 flex justify-between items-center border border-orange-200 shadow-sm">
                  <span className="text-sm font-bold text-orange-900 uppercase">Auditor Recommended Total</span>
                  {isAuditEditing ? (
                    <div className="flex items-center">
                      <span className="text-stone-500 mr-2 font-bold text-xl">₦</span>
                      <NumericFormat
                        value={recommendedAmount}
                        onValueChange={(values) => setRecommendedAmount(values.floatValue || '')}
                        thousandSeparator=","
                        decimalScale={2}
                        allowNegative={false}
                        className="w-48 rounded-xl border-orange-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-xl font-bold text-orange-700 px-4 py-2"
                        placeholder="Enter Amount"
                      />
                    </div>
                  ) : (
                    <span className="text-3xl font-black text-orange-700">
                      ₦{(request.recommendedAmount || 0).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!hasItems && !(isHistology || isEmergency || isDiesel) && (isAuditEditing || request.recommendedAmount !== undefined) && (
            <div className="bg-orange-50 rounded-2xl p-6 flex justify-between items-center border border-orange-200 shadow-sm">
              <span className="text-sm font-bold text-orange-900 uppercase">Auditor Recommended Total</span>
              {isAuditEditing ? (
                <div className="flex items-center">
                  <span className="text-stone-500 mr-2 font-bold text-xl">₦</span>
                  <NumericFormat
                    value={recommendedAmount}
                    onValueChange={(values) => setRecommendedAmount(values.floatValue || '')}
                    thousandSeparator=","
                    decimalScale={2}
                    allowNegative={false}
                    className="w-48 rounded-xl border-orange-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-xl font-bold text-orange-700 px-4 py-2"
                    placeholder="Enter Amount"
                  />
                </div>
              ) : (
                <span className="text-3xl font-black text-orange-700">
                  ₦{(request.recommendedAmount || 0).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {request.creatorSignature && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900">Creator Signature</h2>
              </div>
              <div className="p-6">
                <img src={request.creatorSignature} alt="Creator Signature" className="h-24 object-contain border border-stone-200 rounded-lg p-2 bg-stone-50" />
                <p className="text-xs text-stone-500 mt-2">Signed by {request.createdBy}</p>
              </div>
            </div>
          )}

          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900 flex items-center">
                  <Paperclip className="w-5 h-5 mr-2 text-stone-400" />
                  Attachments
                </h2>
              </div>
              <div className="p-6">
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {request.attachments.map((att) => (
                    <li key={att.id} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl shadow-sm hover:border-orange-300 transition-colors">
                      <div className="flex items-center space-x-3 truncate">
                        <div className="flex-shrink-0">
                          {att.type.toLowerCase().includes('pdf') || att.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText className="w-6 h-6 text-red-500" />
                          ) : (
                            <img src={att.data} alt="preview" className="w-8 h-8 object-cover rounded" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-stone-700 truncate" title={att.name}>{att.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setPreviewAttachment(att)}
                          className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Preview"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <a
                          href={att.data}
                          download={att.name}
                          className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {request.paymentInvoice && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-stone-400" />
                  Payment Invoice
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl shadow-sm hover:border-orange-300 transition-colors max-w-md">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="flex-shrink-0">
                      {request.paymentInvoice.type.toLowerCase().includes('pdf') || request.paymentInvoice.name.toLowerCase().endsWith('.pdf') ? (
                        <FileText className="w-6 h-6 text-red-500" />
                      ) : (
                        <img src={request.paymentInvoice.data} alt="preview" className="w-8 h-8 object-cover rounded" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-stone-700 truncate" title={request.paymentInvoice.name}>{request.paymentInvoice.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPreviewAttachment(request.paymentInvoice!)}
                      className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <a
                      href={request.paymentInvoice.data}
                      download={request.paymentInvoice.name}
                      className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-stone-900">Approval Workflow</h2>
              {canVoid && (
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  Void Current Approver
                </button>
              )}
            </div>
            <div className="p-6 space-y-6">
              <div className="relative">
                <div className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-stone-200" aria-hidden="true"></div>
                <ul className="space-y-6">
                  <li className="relative flex gap-4">
                    <div className="relative flex h-8 w-8 flex-none items-center justify-center bg-white">
                      <CheckCircle className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-stone-900">Request Created</p>
                      <p className="text-xs text-stone-500">{format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  </li>
                  
                  {isDynamicWorkflow ? (
                    request.workflow!.map((approverId, index) => {
                      const approver = MOCK_USERS.find(u => u.id === approverId);
                      const approvalRecord = request.approvals?.find((a, i) => i === index);
                      const isCurrent = request.currentApproverIndex === index && request.status === 'Pending Approval';
                      const isPast = request.currentApproverIndex !== undefined && index < request.currentApproverIndex;
                      const voidRecord = request.voidedApprovers?.find(v => v.approverId === approverId);
                      
                      return (
                        <li key={index} className="relative flex gap-4">
                          <div className="relative flex h-8 w-8 flex-none items-center justify-center bg-white">
                            {voidRecord ? (
                              <XCircle className="h-6 w-6 text-stone-400" />
                            ) : approvalRecord?.status === 'Approved' ? (
                              <CheckCircle className="h-6 w-6 text-emerald-500" />
                            ) : approvalRecord?.status === 'Rejected' ? (
                              <XCircle className="h-6 w-6 text-red-500" />
                            ) : approvalRecord?.status === 'Sent Back' ? (
                              <RotateCcw className="h-6 w-6 text-purple-500" />
                            ) : isCurrent ? (
                              <div className="h-4 w-4 rounded-full bg-amber-500 ring-4 ring-white" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-stone-300 bg-white ring-4 ring-white" />
                            )}
                          </div>
                          <div className="flex flex-col w-full">
                            <p className={`text-sm font-medium ${voidRecord ? 'text-stone-400 line-through' : 'text-stone-900'}`}>Step {index + 1}: {approver?.department}</p>
                            <p className="text-xs text-stone-500">{approver?.email}</p>
                            {voidRecord && (
                              <div className="mt-2 text-sm text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-stone-500">Voided</span>
                                  <span className="text-xs text-stone-400">{format(new Date(voidRecord.date), 'MMM d, h:mm a')}</span>
                                </div>
                                <p className="text-sm mb-2">"{voidRecord.reason}"</p>
                              </div>
                            )}
                            {approvalRecord && !voidRecord && (
                              <div className="mt-2 text-sm text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <div className="flex justify-between items-center mb-2">
                                  <span className={`text-xs font-bold ${
                                    approvalRecord.status === 'Approved' ? 'text-emerald-600' :
                                    approvalRecord.status === 'Rejected' ? 'text-red-600' : 'text-purple-600'
                                  }`}>{approvalRecord.status}</span>
                                  <span className="text-xs text-stone-400">
                                    {format(new Date(approvalRecord.date), 'MMM d, h:mm a')}
                                    {index === 0 
                                      ? ` (${calculateDuration(request.createdAt, approvalRecord.date)})`
                                      : request.approvals && request.approvals[index - 1]
                                        ? ` (${calculateDuration(request.approvals[index - 1].date, approvalRecord.date)})`
                                        : ''
                                    }
                                  </span>
                                </div>
                                {approvalRecord.notes && (
                                  <p className="text-sm mb-2">"{approvalRecord.notes}"</p>
                                )}
                                {approvalRecord.signature && (
                                  <img src={approvalRecord.signature} alt="Signature" className="h-12 object-contain border border-stone-200 rounded bg-white p-1" />
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <>
                      <li className="relative flex gap-4">
                        <div className="relative flex h-8 w-8 flex-none items-center justify-center bg-white">
                          {request.status === 'Pending Audit' ? (
                            <div className="h-4 w-4 rounded-full bg-amber-500 ring-4 ring-white" />
                          ) : request.status === 'Rejected' && !request.accountsNotes ? (
                            <XCircle className="h-6 w-6 text-red-500" />
                          ) : request.status === 'Sent Back' && !request.accountsNotes ? (
                            <RotateCcw className="h-6 w-6 text-purple-500" />
                          ) : (
                            <CheckCircle className="h-6 w-6 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-stone-900">Audit Review</p>
                          {(request.auditNotes || request.auditSignature) && (
                            <div className="mt-2 text-sm text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                              {request.auditNotes && (
                                <>
                                  <p className="font-medium text-xs text-stone-500 mb-1">Audit Notes:</p>
                                  <p className="mb-2">{request.auditNotes}</p>
                                </>
                              )}
                              {request.auditSignature && (
                                <img src={request.auditSignature} alt="Audit Signature" className="h-12 object-contain border border-stone-200 rounded bg-white p-1" />
                              )}
                            </div>
                          )}
                        </div>
                      </li>

                      <li className="relative flex gap-4">
                        <div className="relative flex h-8 w-8 flex-none items-center justify-center bg-white">
                          {request.status === 'Pending Accounts' ? (
                            <div className="h-4 w-4 rounded-full bg-amber-500 ring-4 ring-white" />
                          ) : request.status === 'Approved' ? (
                            <CheckCircle className="h-6 w-6 text-emerald-500" />
                          ) : request.status === 'Rejected' && request.accountsNotes ? (
                            <XCircle className="h-6 w-6 text-red-500" />
                          ) : request.status === 'Sent Back' && request.accountsNotes ? (
                            <RotateCcw className="h-6 w-6 text-purple-500" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-stone-300 bg-white ring-4 ring-white" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-stone-900">Accounts Approval</p>
                          {(request.accountsNotes || request.accountsSignature) && (
                            <div className="mt-2 text-sm text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                              {request.accountsNotes && (
                                <>
                                  <p className="font-medium text-xs text-stone-500 mb-1">Accounts Notes:</p>
                                  <p className="mb-2">{request.accountsNotes}</p>
                                </>
                              )}
                              {request.accountsSignature && (
                                <img src={request.accountsSignature} alt="Accounts Signature" className="h-12 object-contain border border-stone-200 rounded bg-white p-1" />
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {(canApproveAudit || canApproveAccounts || canApproveDynamic) && (
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100 bg-orange-50/50">
                <h2 className="text-lg font-semibold text-stone-900">Your Action Required</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Your Signature</label>
                  <SignaturePad onSave={setApproverSignature} onClear={() => setApproverSignature('')} />
                  {approverSignature && (
                    <div className="mt-2 text-sm text-green-600 font-medium">✓ Signature captured</div>
                  )}
                </div>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-stone-700">Review Notes (Optional)</label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                    placeholder="Add any comments or justification..."
                  />
                </div>
                {isLeave && request.leaveDetails?.headOfDepartmentId === (mockUserId || user?.id) && (
                  <div>
                    <label htmlFor="hodComment" className="block text-sm font-medium text-stone-700">Head of Department Comment</label>
                    <textarea
                      id="hodComment"
                      rows={3}
                      value={hodComment}
                      onChange={(e) => setHodComment(e.target.value)}
                      className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                      placeholder="Special comment from the Head of Department..."
                    />
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleAction('Approve')}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction('Sent Back')}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-purple-200 text-sm font-medium rounded-xl shadow-sm text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Send Back
                    </button>
                    <button
                      onClick={() => handleAction('Reject')}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-xl shadow-sm text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {request.status === 'Approved' && 
           !['Leave Request', 'Issue From Store', 'Emergency Drug Purchase (1 week)', 'Emergency Drug Purchase (1 month)', 'Daily Purchase'].includes(request.requestType || '') && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mt-6">
              <div className="p-6 border-b border-stone-100 bg-stone-50">
                <h2 className="text-lg font-semibold text-stone-900">Physical Audit Verification</h2>
                <p className="text-sm text-stone-500 mt-1">Please confirm that you have physically seen the requested items.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <p className="font-medium text-stone-900">Audit 1 Verification</p>
                    {request.audit1PhysicallySeen ? (
                      <p className="text-sm text-emerald-600 flex items-center mt-1">
                        <CheckCircle className="w-4 h-4 mr-1" /> Verified on {new Date(request.audit1PhysicallySeenAt!).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-sm text-stone-500 mt-1">Pending verification</p>
                    )}
                  </div>
                  {(isAudit1 || isGenericAudit) && !request.audit1PhysicallySeen && (
                    <button
                      onClick={() => handlePhysicalAudit('audit1')}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Confirm Seen
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <p className="font-medium text-stone-900">Audit 2 Verification</p>
                    {request.audit2PhysicallySeen ? (
                      <p className="text-sm text-emerald-600 flex items-center mt-1">
                        <CheckCircle className="w-4 h-4 mr-1" /> Verified on {new Date(request.audit2PhysicallySeenAt!).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-sm text-stone-500 mt-1">Pending verification</p>
                    )}
                  </div>
                  {(isAudit2 || isGenericAudit) && !request.audit2PhysicallySeen && (
                    <button
                      onClick={() => handlePhysicalAudit('audit2')}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Confirm Seen
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <PdfAnnotator
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          readOnly={!(canApproveAudit || canApproveAccounts || canApproveDynamic)}
          onSave={(annotatedAttachment) => {
            if (request) {
              const newAttachments = request.attachments?.map(a => 
                a.id === annotatedAttachment.id ? annotatedAttachment : a
              );
              updateRequest(request.id, { attachments: newAttachments });
            }
            setPreviewAttachment(null);
          }}
        />
      )}
      {/* Void Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Void Current Approver</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Reason for Voiding</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full rounded-xl border-stone-200 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                  rows={3}
                  placeholder="e.g., Approver is on leave"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  value={voidPassword}
                  onChange={(e) => setVoidPassword(e.target.value)}
                  className="w-full rounded-xl border-stone-200 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowVoidModal(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                >
                  Confirm Void
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
