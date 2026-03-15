import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth, MOCK_USERS } from '../context/AuthContext';
import { useProcurement } from '../context/ProcurementContext';
import { useVendors } from '../context/VendorContext';
import { useInventory } from '../context/InventoryContext';
import { useNotifications } from '../context/NotificationContext';
import { useFacilityRequests } from '../context/FacilityRequestContext';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, ArrowLeft, Paperclip, Maximize2, X, Download, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

import { 
  RequestType, UrgencyLevel, HistologyDetails, PaymentDetails,
  DieselDetails, ProductProcurementDetails, LeaveDetails, StoreRequisitionDetails, IssueFromStoreDetails, Department, SavedWorkflow, ProcurementItem, Attachment
} from '../types';
import SignaturePad from '../components/SignaturePad';
import { NumericFormat } from 'react-number-format';

export default function CreateRequest() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { requests, addRequest, updateRequest, savedWorkflows, saveWorkflow, saveDraft } = useProcurement();
  const { vendors, addVendor } = useVendors();
  const { inventory } = useInventory();
  const { addNotification } = useNotifications();
  const { updateFacilityRequestStatus } = useFacilityRequests();
  const navigate = useNavigate();

  const existingRequest = useMemo(() => requests.find(r => r.id === id), [requests, id]);
  const isEditMode = !!existingRequest;

  const [creatorSignature, setCreatorSignature] = useState<string>('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [workflowApprovers, setWorkflowApprovers] = useState<string[]>([]);
  const [newWorkflowName, setNewWorkflowName] = useState<string>('');
  const [isSavingWorkflow, setIsSavingWorkflow] = useState<boolean>(false);

  const mockUserId = user ? MOCK_USERS.find(m => m.email === user.email)?.id : undefined;

  const allowedRequestTypes = useMemo((): RequestType[] => {
    if (user?.email === 'labzankli@gmail.com') {
      return ['General', 'Lab Purchase Order', 'Histology Payment', 'Equipment Request'];
    }
    if (user?.email === 'storezankli@gmail.com') {
      return ['General', 'Pharmacy Purchase Order', 'Emergency Drug Purchase (1 month)', 'Emergency Drug Purchase (1 week)', 'Daily Purchase'];
    }
    if (user?.department === 'Facility') {
      return ['General', 'Diesel Request', 'Product Procurement', 'Leave Request', 'Store Requisition', 'Issue From Store'];
    }
    // Everyone can access IT Procurement and General
    return ['General', 'IT Procurement'];
  }, [user]);

  const prefill = location.state?.prefill;

  const [requestType, setRequestType] = useState<RequestType>(prefill?.requestType || allowedRequestTypes[0]);
  const [title, setTitle] = useState(prefill?.title || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('Normal');
  
  const [items, setItems] = useState<ProcurementItem[]>([{ id: '1', name: '', description: '', quantity: 1, unit: '', estimatedCost: 0, stockLevel: '', supplier: '', inventoryItemId: '', isManual: false }]);
  
  const [histologyDetailsList, setHistologyDetailsList] = useState<HistologyDetails[]>([{
    date: '', patientName: '', hospNo: '', labNo: '', outsourceService: '', outsourceBill: 0, zmcCharges: 0, receiptHmo: '', retainership: ''
  }]);

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    date: '', payee: '', amount: 0, purpose: ''
  });

  const [dieselDetails, setDieselDetails] = useState<DieselDetails>({
    dateOfRequisition: '', issuerName: user?.email || '', volumeLiters: 0, dieselRemainingLiters: 0, costPerLiter: 0, vendorId: ''
  });

  const [productProcurementDetails, setProductProcurementDetails] = useState<ProductProcurementDetails>({
    dateOfRequisition: '', issuerName: user?.email || '', department: user?.department || 'Facility'
  });

  const [leaveDetails, setLeaveDetails] = useState<LeaveDetails>({
    dateOfRequisition: '', issuerName: user?.email || '', applicantName: '', startDate: '', endDate: '', daysRemaining: 0
  });

  const [storeRequisitionDetails, setStoreRequisitionDetails] = useState<StoreRequisitionDetails>({
    dateOfRequisition: '', issuerName: user?.email || ''
  });

  const [issueFromStoreDetails, setIssueFromStoreDetails] = useState<IssueFromStoreDetails>({
    dateOfRequisition: '', issuerName: user?.email || '', departmentToIssueTo: 'Facility'
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF Viewer State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfError(false);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  }

  function zoomOut() {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  }

  const isPdf = previewAttachment && (
    previewAttachment.type.toLowerCase().includes('pdf') || 
    previewAttachment.name.toLowerCase().endsWith('.pdf')
  );

  useEffect(() => {
    if (isPdf && previewAttachment?.data) {
      setPdfError(false);
      try {
        const base64Data = previewAttachment.data.includes(',') 
          ? previewAttachment.data.split(',')[1] 
          : previewAttachment.data;
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

  // Auto-update title for specific requests
  useEffect(() => {
    if (isEditMode) return;
    if (requestType === 'Diesel Request') setTitle('Diesel Request');
    if (requestType === 'Product Procurement') setTitle('Product Procurement');
    if (requestType === 'Leave Request') setTitle('Leave Request');
    if (requestType === 'Store Requisition') setTitle('Store Requisition');
    if (requestType === 'Issue From Store') setTitle('Issue From Store');
    if (requestType === 'IT Procurement') setTitle('IT Procurement Request');
  }, [requestType, isEditMode]);

  useEffect(() => {
    if (isEditMode && existingRequest) {
      setRequestType(existingRequest.requestType || 'General');
      setTitle(existingRequest.title);
      setDescription(existingRequest.description);
      setUrgencyLevel(existingRequest.urgencyLevel);
      setItems(existingRequest.items.length > 0 ? existingRequest.items : [{ id: '1', name: '', description: '', quantity: 1, unit: '', estimatedCost: 0, stockLevel: '', supplier: '', inventoryItemId: '', isManual: false }]);
      if (existingRequest.histologyDetailsList && existingRequest.histologyDetailsList.length > 0) {
        setHistologyDetailsList(existingRequest.histologyDetailsList);
      } else if (existingRequest.histologyDetails) {
        setHistologyDetailsList([existingRequest.histologyDetails]);
      } else {
        setHistologyDetailsList([{ date: '', patientName: '', hospNo: '', labNo: '', outsourceService: '', outsourceBill: 0, zmcCharges: 0, receiptHmo: '', retainership: '' }]);
      }
      if (existingRequest.paymentDetails) setPaymentDetails(existingRequest.paymentDetails);
      if (existingRequest.dieselDetails) setDieselDetails(existingRequest.dieselDetails);
      if (existingRequest.productProcurementDetails) setProductProcurementDetails(existingRequest.productProcurementDetails);
      if (existingRequest.leaveDetails) setLeaveDetails(existingRequest.leaveDetails);
      if (existingRequest.storeRequisitionDetails) setStoreRequisitionDetails(existingRequest.storeRequisitionDetails);
      if (existingRequest.issueFromStoreDetails) setIssueFromStoreDetails(existingRequest.issueFromStoreDetails);
      if (existingRequest.workflow) setWorkflowApprovers(existingRequest.workflow);
      if (existingRequest.creatorSignature) setCreatorSignature(existingRequest.creatorSignature);
      if (existingRequest.attachments) setAttachments(existingRequest.attachments);
    }
  }, [isEditMode, existingRequest]);

  if (user?.role !== 'Creator' && user?.role !== 'Both') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-stone-900">Access Denied</h2>
        <p className="mt-2 text-stone-500">You do not have permission to create requests.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-orange-600 hover:text-orange-700 font-medium">
          Go back to Dashboard
        </button>
      </div>
    );
  }

  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(), name: '', description: '', quantity: 1, unit: '', estimatedCost: 0, stockLevel: '', supplier: '', inventoryItemId: '', isManual: false }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'inventoryItemId' && value && value !== 'manual') {
          const invItem = inventory.find(i => i.id === value);
          if (invItem) {
            updatedItem.name = invItem.name;
            updatedItem.estimatedCost = invItem.unitCost;
            updatedItem.stockLevel = invItem.inStock.toString();
            updatedItem.isManual = false;
          }
        } else if (field === 'inventoryItemId' && value === 'manual') {
          updatedItem.name = '';
          updatedItem.estimatedCost = 0;
          updatedItem.stockLevel = '';
          updatedItem.isManual = true;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateLeaveDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateTotal = () => {
    if (requestType === 'Histology Payment') return histologyDetailsList.reduce((sum, item) => sum + item.outsourceBill, 0);
    if (requestType === 'Emergency Drug Purchase (1 month)' || requestType === 'Emergency Drug Purchase (1 week)') return paymentDetails.amount;
    if (requestType === 'Diesel Request') return dieselDetails.volumeLiters * dieselDetails.costPerLiter;
    if (requestType === 'Leave Request') return 0;
    return items.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
  };

  const totalAmount = calculateTotal();

  const [isAILoading, setIsAILoading] = useState(false);

  const handleAIAutofill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addNotification({
        userId: user!.id,
        title: 'File Too Large',
        message: `File ${file.name} exceeds the 5MB limit.`,
        type: 'error',
      });
      e.target.value = ''; // Reset input
      return;
    }

    setIsAILoading(true);
    try {
      const { GoogleGenAI, Type } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      let textContent = '';
      let inlineData: any = null;

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        const xlsx = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        textContent = xlsx.utils.sheet_to_csv(worksheet);
      } else {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        inlineData = {
          data: base64,
          mimeType: file.type
        };
      }

      let prompt = '';
      let schema: any = {};

      if (requestType === 'Histology Payment') {
        prompt = `Extract histology payment details from the provided document. Return a JSON object with the following fields: date (YYYY-MM-DD), patientName, hospNo, labNo, outsourceService, outsourceBill (number), zmcCharges (number), receiptHmo, retainership. If a field is not found, leave it empty.`;
        schema = {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            patientName: { type: Type.STRING },
            hospNo: { type: Type.STRING },
            labNo: { type: Type.STRING },
            outsourceService: { type: Type.STRING },
            outsourceBill: { type: Type.NUMBER },
            zmcCharges: { type: Type.NUMBER },
            receiptHmo: { type: Type.STRING },
            retainership: { type: Type.STRING },
          }
        };
      } else if (requestType === 'Pharmacy Purchase Order' || requestType === 'Lab Purchase Order') {
        prompt = `Extract the list of items to purchase from the provided document. Return a JSON object with an 'items' array. Each item should have: name, description, quantity (number), unit, estimatedCost (number), supplier. If a field is not found, leave it empty.`;
        schema = {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  estimatedCost: { type: Type.NUMBER },
                  supplier: { type: Type.STRING },
                }
              }
            }
          }
        };
      }

      const parts: any[] = [{ text: prompt }];
      if (textContent) parts.push({ text: textContent });
      if (inlineData) parts.push({ inlineData });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        }
      });

      const result = JSON.parse(response.text);

      if (requestType === 'Histology Payment') {
        setHistologyDetailsList(prev => {
          const newList = [...prev];
          newList[0] = {
            ...newList[0],
            ...result
          };
          return newList;
        });
      } else if (requestType === 'Pharmacy Purchase Order' || requestType === 'Lab Purchase Order') {
        if (result.items && result.items.length > 0) {
          const newItems = result.items.map((item: any, index: number) => ({
            id: Math.random().toString(),
            name: item.name || '',
            description: item.description || '',
            quantity: item.quantity || 1,
            unit: item.unit || '',
            estimatedCost: item.estimatedCost || 0,
            stockLevel: '',
            supplier: item.supplier || '',
            inventoryItemId: '',
            isManual: true
          }));
          setItems(newItems);
        }
      }

      addNotification({
        userId: user!.id,
        title: 'AI Auto-fill Complete',
        message: 'The form has been populated with data from your document.',
        type: 'success',
      });

    } catch (error) {
      console.error('AI Auto-fill error:', error);
      alert('Failed to auto-fill form. Please check the document and try again.');
    } finally {
      setIsAILoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        addNotification({
          userId: user!.id,
          title: 'File Too Large',
          message: `File ${file.name} exceeds the 5MB limit.`,
          type: 'error',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachments(prev => [...prev, {
            id: Math.random().toString(),
            name: file.name,
            type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            data: event.target!.result as string
          }]);
        }
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        addNotification({
          userId: user!.id,
          title: 'Upload Error',
          message: `Failed to read file ${file.name}.`,
          type: 'error',
        });
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleSaveDraft = () => {
    if (!title) { alert('Please provide a request title to save as draft.'); return; }

    const noItemsTypes = ['Histology Payment', 'Emergency Drug Purchase (1 month)', 'Emergency Drug Purchase (1 week)', 'Diesel Request', 'Leave Request'];

    const requestData = {
      title,
      description: description || requestType,
      department: user!.department,
      createdBy: user!.email,
      items: noItemsTypes.includes(requestType) ? [] : items,
      totalAmount,
      requestType,
      urgencyLevel,
      creatorSignature,
      workflow: workflowApprovers,
      attachments,
      ...(requestType === 'Histology Payment' && { 
        histologyDetailsList,
        histologyDetails: histologyDetailsList[0] 
      }),
      ...(requestType.startsWith('Emergency Drug Purchase') && { paymentDetails }),
      ...(requestType === 'Diesel Request' && { dieselDetails }),
      ...(requestType === 'Product Procurement' && { productProcurementDetails }),
      ...(requestType === 'Leave Request' && { leaveDetails: { ...leaveDetails, daysRemaining: calculateLeaveDays(leaveDetails.startDate, leaveDetails.endDate) } }),
      ...(requestType === 'Store Requisition' && { storeRequisitionDetails }),
      ...(requestType === 'Issue From Store' && { issueFromStoreDetails }),
    };

    saveDraft(requestData, existingRequest?.id);
    navigate('/requests');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) { alert('Please provide a request title.'); return; }
    if (!creatorSignature) { alert('Please sign the request before submitting.'); return; }
    if (workflowApprovers.length === 0) { alert('Please select at least one approver for the workflow.'); return; }

    if (!selectedWorkflowId && workflowApprovers.length > 0) {
      saveWorkflow({
        name: newWorkflowName || `Custom Workflow - ${new Date().toLocaleDateString()}`,
        approverIds: workflowApprovers,
        creatorId: user?.id || mockUserId || ''
      });
    }

    const noItemsTypes = ['Histology Payment', 'Emergency Drug Purchase (1 month)', 'Emergency Drug Purchase (1 week)', 'Diesel Request', 'Leave Request'];

    const requestData = {
      title,
      description: description || requestType,
      department: user!.department,
      createdBy: user!.email,
      items: noItemsTypes.includes(requestType) ? [] : items,
      totalAmount,
      requestType,
      urgencyLevel,
      creatorSignature,
      workflow: workflowApprovers,
      attachments,
      ...(requestType === 'Histology Payment' && { 
        histologyDetailsList,
        histologyDetails: histologyDetailsList[0] 
      }),
      ...(requestType.startsWith('Emergency Drug Purchase') && { paymentDetails }),
      ...(requestType === 'Diesel Request' && { dieselDetails }),
      ...(requestType === 'Product Procurement' && { productProcurementDetails }),
      ...(requestType === 'Leave Request' && { leaveDetails: { ...leaveDetails, daysRemaining: calculateLeaveDays(leaveDetails.startDate, leaveDetails.endDate) } }),
      ...(requestType === 'Store Requisition' && { storeRequisitionDetails }),
      ...(requestType === 'Issue From Store' && { issueFromStoreDetails }),
    };

    const shouldSplit = (requestType === 'Equipment Request' || requestType === 'Pharmacy Purchase Order') && items.length > 0;
    
    if (shouldSplit) {
      const suppliers = Array.from(new Set(items.map(item => item.supplier || 'Unspecified')));
      if (suppliers.length > 1) {
        suppliers.forEach((supplier, idx) => {
          const supplierItems = items.filter(item => (item.supplier || 'Unspecified') === supplier);
          const supplierTotal = supplierItems.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
          
          const splitData = {
            ...requestData,
            items: supplierItems,
            totalAmount: supplierTotal,
            splitSupplier: supplier,
          };
          
          if (isEditMode && existingRequest && idx === 0) {
            updateRequest(existingRequest.id, {
              ...splitData,
              status: splitData.workflow && splitData.workflow.length > 0 ? 'Pending Approval' : 'Pending Audit',
              currentApproverIndex: splitData.workflow && splitData.workflow.length > 0 ? 0 : undefined,
              approvals: []
            });
            if (splitData.workflow && splitData.workflow.length > 0) {
              addNotification({
                userId: splitData.workflow[0],
                title: 'Request Updated',
                message: `${user?.email} updated request: ${title} (Split: ${supplier})`,
                type: 'info',
                link: `/requests/${existingRequest.id}`
              });
            } else {
              addNotification({
                userId: 'Audit',
                title: 'Request Updated',
                message: `${user?.email} updated request: ${title} (Split: ${supplier})`,
                type: 'info',
                link: `/requests/${existingRequest.id}`
              });
            }
          } else {
            const newId = addRequest(splitData);
            if (splitData.workflow && splitData.workflow.length > 0) {
              addNotification({
                userId: splitData.workflow[0],
                title: 'New Request',
                message: `${user?.email} submitted a new request: ${title} (Split: ${supplier})`,
                type: 'info',
                link: `/requests/${newId}`
              });
            } else {
              addNotification({
                userId: 'Audit',
                title: 'New Request',
                message: `${user?.email} submitted a new request: ${title} (Split: ${supplier})`,
                type: 'info',
                link: `/requests/${newId}`
              });
            }
          }
        });

        if (prefill?.facilityRequestId) {
          updateFacilityRequestStatus(prefill.facilityRequestId, 'Completed');
          addNotification({
            userId: 'Facility',
            title: 'Facility Request Completed',
            message: `The facility request "${prefill.title}" has been marked as completed because a procurement request was created.`,
            type: 'success',
            link: '/facility-requests'
          });
        }

        navigate('/requests');
        return;
      }
    }

    if (isEditMode && existingRequest) {
      updateRequest(existingRequest.id, {
        ...requestData,
        status: requestData.workflow && requestData.workflow.length > 0 ? 'Pending Approval' : 'Pending Audit',
        currentApproverIndex: requestData.workflow && requestData.workflow.length > 0 ? 0 : undefined,
        approvals: [] // Clear previous approvals
      });
      
      if (requestData.workflow && requestData.workflow.length > 0) {
        addNotification({
          userId: requestData.workflow[0],
          title: 'Request Updated',
          message: `${user?.email} updated request: ${title}`,
          type: 'info',
          link: `/requests/${existingRequest.id}`
        });
      } else {
        addNotification({
          userId: 'Audit',
          title: 'Request Updated',
          message: `${user?.email} updated request: ${title}`,
          type: 'info',
          link: `/requests/${existingRequest.id}`
        });
      }
    } else {
      const newId = addRequest(requestData);
      if (requestData.workflow && requestData.workflow.length > 0) {
        addNotification({
          userId: requestData.workflow[0],
          title: 'New Request',
          message: `${user?.email} submitted a new request: ${title}`,
          type: 'info',
          link: `/requests/${newId}`
        });
      } else {
        addNotification({
          userId: 'Audit',
          title: 'New Request',
          message: `${user?.email} submitted a new request: ${title}`,
          type: 'info',
          link: `/requests/${newId}`
        });
      }
    }

    if (prefill?.facilityRequestId) {
      updateFacilityRequestStatus(prefill.facilityRequestId, 'Completed');
      addNotification({
        userId: 'Facility',
        title: 'Facility Request Completed',
        message: `The facility request "${prefill.title}" has been marked as completed because a procurement request was created.`,
        type: 'success',
        link: '/facility-requests'
      });
    }

    navigate('/requests');
  };

  const handleWorkflowChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wfId = e.target.value;
    setSelectedWorkflowId(wfId);
    if (wfId) {
      const wf = savedWorkflows.find(w => w.id === wfId);
      if (wf) {
        setWorkflowApprovers(wf.approverIds);
      }
    } else {
      setWorkflowApprovers([]);
    }
  };

  const addApprover = () => {
    setWorkflowApprovers([...workflowApprovers, '']);
  };

  const updateApprover = (index: number, val: string) => {
    const updated = [...workflowApprovers];
    updated[index] = val;
    setWorkflowApprovers(updated);
  };

  const removeApprover = (index: number) => {
    const updated = [...workflowApprovers];
    updated.splice(index, 1);
    setWorkflowApprovers(updated);
  };

  const renderItemFields = (item: any) => {
    const isLabPO = requestType === 'Lab Purchase Order';
    const isEquipReq = requestType === 'Equipment Request';
    const isPharmPO = requestType === 'Pharmacy Purchase Order';
    const isDailyPurch = requestType === 'Daily Purchase';
    const isGeneral = requestType === 'General';
    const isProductProc = requestType === 'Product Procurement';
    const isStoreReq = requestType === 'Store Requisition';
    const isIssueStore = requestType === 'Issue From Store';
    const isITProc = requestType === 'IT Procurement';

    return (
      <div key={item.id} className="flex flex-col gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {(isStoreReq || isIssueStore) && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Select Item</label>
              <select
                value={item.inventoryItemId || ''}
                onChange={(e) => handleItemChange(item.id, 'inventoryItemId', e.target.value)}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                required
              >
                <option value="">-- Select an item --</option>
                {inventory.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.name} ({inv.inStock} in stock)</option>
                ))}
                {isStoreReq && <option value="manual">-- Manual Input --</option>}
              </select>
            </div>
          )}

          {(!isStoreReq && !isIssueStore) || item.isManual ? (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Item Name</label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                required
              />
            </div>
          ) : null}

          {(isLabPO || isEquipReq || isPharmPO || isDailyPurch || isProductProc || isITProc) && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Item Description</label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
              className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
              required
            />
          </div>

          {(isLabPO || isEquipReq || isPharmPO) && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Unit</label>
              <input
                type="text"
                value={item.unit}
                onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                placeholder="e.g. Packs, Vials"
              />
            </div>
          )}

          {(isLabPO || isDailyPurch || isStoreReq || isIssueStore) && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Stock Level</label>
              <input
                type="text"
                value={item.stockLevel}
                onChange={(e) => handleItemChange(item.id, 'stockLevel', e.target.value)}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                disabled={!item.isManual && (isStoreReq || isIssueStore)}
              />
            </div>
          )}

          {(isEquipReq || isPharmPO || isGeneral || isProductProc || isStoreReq || isITProc) && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Unit Price (₦)</label>
              <NumericFormat
                value={item.estimatedCost}
                onValueChange={(values) => {
                  handleItemChange(item.id, 'estimatedCost', values.floatValue || 0);
                }}
                thousandSeparator=","
                decimalScale={2}
                allowNegative={false}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                required={isGeneral || isProductProc || isStoreReq || isITProc}
                disabled={!item.isManual && isStoreReq}
              />
            </div>
          )}

          {(isEquipReq || isPharmPO || (user?.department === 'Facility' && (isProductProc || isStoreReq))) && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Vendor / Supplier</label>
              <input
                type="text"
                list={`create-vendors-list-${item.id}`}
                value={item.supplier}
                onChange={(e) => handleItemChange(item.id, 'supplier', e.target.value)}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && !vendors.some(v => v.name.toLowerCase() === val.toLowerCase())) {
                    addVendor({ name: val, category: 'Facility' });
                  }
                }}
                className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                placeholder="Select or type vendor name"
              />
              <datalist id={`create-vendors-list-${item.id}`}>
                {vendors.map(v => <option key={v.id} value={v.name} />)}
              </datalist>
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => handleRemoveItem(item.id)}
            disabled={items.length === 1}
            className="p-2 text-stone-400 hover:text-red-500 disabled:opacity-50 transition-colors flex items-center text-sm"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Remove Item
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-4 p-2 rounded-full hover:bg-stone-200 text-stone-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              {isEditMode ? 'Edit & Resubmit Request' : 'New Procurement Request'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {isEditMode ? `Editing request ${existingRequest?.id}` : `Create a new request for ${user.department}`}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allowedRequestTypes.length > 1 && (
              <div className="md:col-span-2 flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <label className="block text-sm font-medium text-stone-700">Request Type</label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as RequestType)}
                    className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-stone-50"
                  >
                    {allowedRequestTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                {(requestType === 'Histology Payment' || requestType === 'Pharmacy Purchase Order' || requestType === 'Lab Purchase Order') && (
                  <div className="mt-6">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-orange-200 text-sm font-medium rounded-xl shadow-sm text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors">
                      {isAILoading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-orange-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          Auto-fill with AI
                        </span>
                      )}
                      <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" onChange={handleAIAutofill} disabled={isAILoading} />
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700">Request Title / Subject</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                required
              />
            </div>

            {requestType !== 'General' && requestType !== 'Leave Request' && (
              <div>
                <label className="block text-sm font-medium text-stone-700">Urgency Level</label>
                <select
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value as UrgencyLevel)}
                  className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            )}
            
            {(requestType === 'General' || requestType === 'Diesel Request' || requestType === 'Leave Request' || requestType === 'Product Procurement' || requestType === 'Issue From Store') && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-stone-700">
                  {requestType === 'Diesel Request' || requestType === 'Leave Request' ? 'Reason' : 'Description / Justification'}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                  required={requestType === 'Diesel Request' || requestType === 'Leave Request' || requestType === 'Product Procurement' || requestType === 'Issue From Store'}
                />
              </div>
            )}
          </div>

          {/* Diesel Request Fields */}
          {requestType === 'Diesel Request' && (
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <h3 className="text-lg font-medium text-stone-900">Diesel Requisition Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Date of Requisition</label>
                  <input type="date" required value={dieselDetails.dateOfRequisition} onChange={e => setDieselDetails({...dieselDetails, dateOfRequisition: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Issuer Name</label>
                  <input type="text" required value={dieselDetails.issuerName} onChange={e => setDieselDetails({...dieselDetails, issuerName: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Volume (Liters)</label>
                  <input type="number" required min="0" value={dieselDetails.volumeLiters} onChange={e => setDieselDetails({...dieselDetails, volumeLiters: parseFloat(e.target.value) || 0})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Diesel Remaining (Liters)</label>
                  <input type="number" required min="0" value={dieselDetails.dieselRemainingLiters} onChange={e => setDieselDetails({...dieselDetails, dieselRemainingLiters: parseFloat(e.target.value) || 0})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Cost per Liter (₦)</label>
                  <NumericFormat 
                    required 
                    value={dieselDetails.costPerLiter} 
                    onValueChange={(values) => setDieselDetails({...dieselDetails, costPerLiter: values.floatValue || 0})} 
                    thousandSeparator=","
                    decimalScale={2}
                    allowNegative={false}
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" 
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-stone-500 mb-1">Select Vendor</label>
                  <select required value={dieselDetails.vendorId} onChange={e => setDieselDetails({...dieselDetails, vendorId: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border">
                    <option value="">-- Select a Vendor --</option>
                    {vendors.filter(v => v.category === 'Facility' || v.category === 'Both').map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                    <option value="manual">-- Manual Input --</option>
                  </select>
                </div>
                {dieselDetails.vendorId === 'manual' && (
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Vendor Name (Manual)</label>
                    <input type="text" required value={dieselDetails.manualVendorName || ''} onChange={e => setDieselDetails({...dieselDetails, manualVendorName: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product Procurement Fields */}
          {requestType === 'Product Procurement' && (
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <h3 className="text-lg font-medium text-stone-900">Procurement Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Date of Requisition</label>
                  <input type="date" required value={productProcurementDetails.dateOfRequisition} onChange={e => setProductProcurementDetails({...productProcurementDetails, dateOfRequisition: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Issuer Name</label>
                  <input type="text" required value={productProcurementDetails.issuerName} onChange={e => setProductProcurementDetails({...productProcurementDetails, issuerName: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Department</label>
                  <select required value={productProcurementDetails.department} onChange={e => setProductProcurementDetails({...productProcurementDetails, department: e.target.value as Department})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border">
                    <option value="Facility">Facility</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Audit">Audit</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Leave Request Fields */}
          {requestType === 'Leave Request' && (
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <h3 className="text-lg font-medium text-stone-900">Leave Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Date of Requisition</label>
                  <input type="date" required value={leaveDetails.dateOfRequisition} onChange={e => setLeaveDetails({...leaveDetails, dateOfRequisition: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Issuer Name</label>
                  <input type="text" required value={leaveDetails.issuerName} onChange={e => setLeaveDetails({...leaveDetails, issuerName: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Applicant Name</label>
                  <input type="text" required value={leaveDetails.applicantName} onChange={e => setLeaveDetails({...leaveDetails, applicantName: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Start Date</label>
                  <input type="date" required value={leaveDetails.startDate} onChange={e => setLeaveDetails({...leaveDetails, startDate: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">End Date</label>
                  <input type="date" required value={leaveDetails.endDate} onChange={e => setLeaveDetails({...leaveDetails, endDate: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Number of Leave Days</label>
                  <div className="block w-full rounded-lg border-stone-200 bg-stone-100 sm:text-sm py-2 px-3 border text-stone-700">
                    {calculateLeaveDays(leaveDetails.startDate, leaveDetails.endDate)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Store Requisition & Issue From Store Headers */}
          {(requestType === 'Store Requisition' || requestType === 'Issue From Store') && (
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <h3 className="text-lg font-medium text-stone-900">
                {requestType === 'Store Requisition' ? 'Store Requisition Details' : 'Issue Details'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Date of Requisition</label>
                  <input type="date" required 
                    value={requestType === 'Store Requisition' ? storeRequisitionDetails.dateOfRequisition : issueFromStoreDetails.dateOfRequisition} 
                    onChange={e => requestType === 'Store Requisition' 
                      ? setStoreRequisitionDetails({...storeRequisitionDetails, dateOfRequisition: e.target.value})
                      : setIssueFromStoreDetails({...issueFromStoreDetails, dateOfRequisition: e.target.value})
                    } 
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Issuer Name</label>
                  <input type="text" required 
                    value={requestType === 'Store Requisition' ? storeRequisitionDetails.issuerName : issueFromStoreDetails.issuerName} 
                    onChange={e => requestType === 'Store Requisition' 
                      ? setStoreRequisitionDetails({...storeRequisitionDetails, issuerName: e.target.value})
                      : setIssueFromStoreDetails({...issueFromStoreDetails, issuerName: e.target.value})
                    } 
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" 
                  />
                </div>
                {requestType === 'Issue From Store' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Department to Issue To</label>
                    <select required value={issueFromStoreDetails.departmentToIssueTo} onChange={e => setIssueFromStoreDetails({...issueFromStoreDetails, departmentToIssueTo: e.target.value as Department})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border">
                      <option value="Facility">Facility</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Audit">Audit</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Histology Payment Fields */}
          {requestType === 'Histology Payment' && (
            <div className="pt-6 border-t border-stone-100 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-stone-900">Histology Details</h3>
                <button
                  type="button"
                  onClick={() => setHistologyDetailsList([...histologyDetailsList, { date: '', patientName: '', hospNo: '', labNo: '', outsourceService: '', outsourceBill: 0, zmcCharges: 0, receiptHmo: '', retainership: '' }])}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Detail
                </button>
              </div>
              
              {histologyDetailsList.map((detail, index) => (
                <div key={index} className="bg-stone-50 p-4 rounded-xl border border-stone-200 relative">
                  {histologyDetailsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setHistologyDetailsList(histologyDetailsList.filter((_, i) => i !== index))}
                      className="absolute top-2 right-2 p-1 text-stone-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Date</label><input type="date" required value={detail.date} onChange={e => { const newList = [...histologyDetailsList]; newList[index].date = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Patient Name</label><input type="text" required value={detail.patientName} onChange={e => { const newList = [...histologyDetailsList]; newList[index].patientName = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Hosp No.</label><input type="text" required value={detail.hospNo} onChange={e => { const newList = [...histologyDetailsList]; newList[index].hospNo = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Lab No.</label><input type="text" required value={detail.labNo} onChange={e => { const newList = [...histologyDetailsList]; newList[index].labNo = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Outsource Service</label><input type="text" required value={detail.outsourceService} onChange={e => { const newList = [...histologyDetailsList]; newList[index].outsourceService = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Outsource Bill (₦)</label><NumericFormat required value={detail.outsourceBill} onValueChange={(values) => { const newList = [...histologyDetailsList]; newList[index].outsourceBill = values.floatValue || 0; setHistologyDetailsList(newList); }} thousandSeparator="," decimalScale={2} allowNegative={false} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">ZMC Charges (₦)</label><NumericFormat required value={detail.zmcCharges} onValueChange={(values) => { const newList = [...histologyDetailsList]; newList[index].zmcCharges = values.floatValue || 0; setHistologyDetailsList(newList); }} thousandSeparator="," decimalScale={2} allowNegative={false} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Receipt/HMO</label><input type="text" required value={detail.receiptHmo} onChange={e => { const newList = [...histologyDetailsList]; newList[index].receiptHmo = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                    <div><label className="block text-xs font-medium text-stone-500 mb-1">Retainership</label><input type="text" required value={detail.retainership} onChange={e => { const newList = [...histologyDetailsList]; newList[index].retainership = e.target.value; setHistologyDetailsList(newList); }} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Emergency Drug Purchase Fields */}
          {requestType.startsWith('Emergency Drug Purchase') && (
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <h3 className="text-lg font-medium text-stone-900">Payment Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-stone-500 mb-1">Date</label><input type="date" required value={paymentDetails.date} onChange={e => setPaymentDetails({...paymentDetails, date: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                <div><label className="block text-xs font-medium text-stone-500 mb-1">Please Pay (Payee)</label><input type="text" required value={paymentDetails.payee} onChange={e => setPaymentDetails({...paymentDetails, payee: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                <div><label className="block text-xs font-medium text-stone-500 mb-1">The Sum Of (Amount ₦)</label><NumericFormat required value={paymentDetails.amount} onValueChange={(values) => setPaymentDetails({...paymentDetails, amount: values.floatValue || 0})} thousandSeparator="," decimalScale={2} allowNegative={false} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Being (Purpose)</label><input type="text" required value={paymentDetails.purpose} onChange={e => setPaymentDetails({...paymentDetails, purpose: e.target.value})} className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" /></div>
              </div>
            </div>
          )}

          {/* Items List (for all other types) */}
          {requestType !== 'Histology Payment' && !requestType.startsWith('Emergency Drug Purchase') && requestType !== 'Diesel Request' && requestType !== 'Leave Request' && (
            <div className="pt-6 border-t border-stone-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-stone-900">Items List</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {items.map(renderItemFields)}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="pt-6 border-t border-stone-100 space-y-4">
            <h3 className="text-lg font-medium text-stone-900">Attachments</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-stone-300 border-dashed rounded-xl cursor-pointer bg-stone-50 hover:bg-stone-100 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Paperclip className="w-8 h-8 mb-3 text-stone-500" />
                    <p className="mb-2 text-sm text-stone-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-stone-500">PDF, PNG, JPG (Max 5MB)</p>
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept=".pdf,image/*" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>
              
              {attachments.length > 0 && (
                <ul className="space-y-2">
                  {attachments.map(att => (
                    <li key={att.id} className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <div className="flex items-center space-x-3 truncate">
                        <span className="text-sm font-medium text-stone-700 truncate">{att.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="text-stone-400 hover:text-orange-500 p-1"
                          title="Preview"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Approval Workflow */}
          <div className="pt-6 border-t border-stone-100 space-y-4">
            <h3 className="text-lg font-medium text-stone-900">Approval Workflow</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">Load Saved Workflow</label>
              <select
                value={selectedWorkflowId}
                onChange={handleWorkflowChange}
                className="block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-stone-50"
              >
                <option value="">-- Custom Workflow --</option>
                {savedWorkflows.filter(wf => wf.creatorId === user?.id || wf.creatorId === mockUserId).map(wf => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-stone-700">Approvers Sequence</label>
              {workflowApprovers.map((approverId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <select
                    value={approverId}
                    onChange={(e) => updateApprover(index, e.target.value)}
                    className="flex-1 rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                    required
                  >
                    <option value="">-- Select Approver --</option>
                    {MOCK_USERS.filter(u => u.role === 'Approver' || u.role === 'Both').map(u => (
                      <option key={u.id} value={u.id}>{u.department} - {u.email}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeApprover(index)}
                    className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addApprover}
                className="inline-flex items-center px-3 py-1.5 border border-stone-300 text-xs font-medium rounded-lg text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors mt-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Approver
              </button>
            </div>

            {!selectedWorkflowId && workflowApprovers.length > 0 && (
              <div className="mt-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Workflow Name (Optional - will be saved automatically)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Standard Lab Approval"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
                />
              </div>
            )}
          </div>

          {/* Signature Pad */}
          <div className="pt-6 border-t border-stone-100 space-y-4">
            <h3 className="text-lg font-medium text-stone-900">Creator Signature</h3>
            <p className="text-sm text-stone-500">Please sign below to authorize this request.</p>
            <SignaturePad onSave={setCreatorSignature} onClear={() => setCreatorSignature('')} />
            {creatorSignature && (
              <div className="mt-2 text-sm text-green-600 font-medium">✓ Signature captured</div>
            )}
          </div>

          <div className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-lg font-medium text-stone-900">
              {requestType !== 'Leave Request' && (
                <>Total Estimated Cost: <span className="text-2xl font-bold text-orange-600">₦{(totalAmount || 0).toLocaleString()}</span></>
              )}
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 sm:flex-none px-4 py-2 border border-stone-300 shadow-sm text-sm font-medium rounded-xl text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex-1 sm:flex-none px-4 py-2 border border-stone-300 shadow-sm text-sm font-medium rounded-xl text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
              >
                Save Draft
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {isEditMode && existingRequest?.status !== 'Draft' ? 'Resubmit Request' : 'Submit Request'}
              </button>
            </div>
          </div>

        </div>
      </form>
      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-white z-10">
              <h3 className="text-lg font-semibold text-stone-900 truncate pr-4">{previewAttachment.name}</h3>
              <div className="flex items-center space-x-2">
                {isPdf && pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                    title="Open in New Tab"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </a>
                )}
                <a
                  href={previewAttachment.data}
                  download={previewAttachment.name}
                  className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-stone-100 flex flex-col items-center relative p-4">
              {isPdf ? (
                pdfUrl ? (
                  <div className="flex flex-col items-center w-full">
                    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur shadow-sm rounded-full px-4 py-2 mb-4 flex items-center space-x-4 border border-stone-200">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={previousPage} 
                          disabled={pageNumber <= 1}
                          className="p-1 rounded-full hover:bg-stone-100 disabled:opacity-30"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-stone-600">
                          {pageNumber} / {numPages || '--'}
                        </span>
                        <button 
                          onClick={nextPage} 
                          disabled={pageNumber >= numPages}
                          className="p-1 rounded-full hover:bg-stone-100 disabled:opacity-30"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="w-px h-4 bg-stone-300"></div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={zoomOut}
                          className="p-1 rounded-full hover:bg-stone-100"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-stone-600 w-12 text-center">
                          {Math.round(scale * 100)}%
                        </span>
                        <button 
                          onClick={zoomIn}
                          className="p-1 rounded-full hover:bg-stone-100"
                          title="Zoom In"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="shadow-lg rounded-lg overflow-hidden bg-white">
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={(error) => {
                          console.error('Error loading PDF:', error);
                          setPdfError(true);
                        }}
                        loading={
                          <div className="flex items-center justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                          </div>
                        }
                        error={
                          <div className="flex flex-col items-center justify-center p-8 text-red-500">
                            <FileText className="w-12 h-12 mb-2" />
                            <p>Failed to load PDF.</p>
                          </div>
                        }
                      >
                        <Page 
                          pageNumber={pageNumber} 
                          scale={scale} 
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="max-w-full"
                        />
                      </Document>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full w-full bg-stone-50 p-6">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                      <FileText className="w-8 h-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-medium text-stone-900 mb-2">
                      {pdfError ? 'Preview Unavailable' : 'Loading Preview...'}
                    </h3>
                    <p className="text-stone-500 text-center mb-6 max-w-sm">
                      {pdfError 
                        ? 'This PDF cannot be displayed directly. You can download it to view it.' 
                        : 'Preparing document for display...'}
                    </p>
                    <a
                      href={previewAttachment.data}
                      download={previewAttachment.name}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </a>
                  </div>
                )
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={previewAttachment.data}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
