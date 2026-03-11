import React, { createContext, useContext } from 'react';
import { ProcurementRequest, RequestStatus, SavedWorkflow, ApprovalRecord, Attachment, ProcurementItem } from '../types';
import { useInventory } from './InventoryContext';
import { useNotifications } from './NotificationContext';
import { MOCK_USERS, useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

interface ProcurementContextType {
  requests: ProcurementRequest[];
  savedWorkflows: SavedWorkflow[];
  addRequest: (request: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>) => string;
  saveDraft: (request: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>, existingId?: string) => void;
  updateRequest: (id: string, updates: Partial<ProcurementRequest>) => void;
  updateRequestStatus: (id: string, status: RequestStatus | 'Draft', notes?: string, role?: 'Audit' | 'Accounts', signature?: string) => void;
  processApproval: (id: string, approverId: string, status: 'Approved' | 'Rejected' | 'Sent Back', signature: string, notes?: string, updatedItems?: ProcurementItem[]) => void;
  voidApprover: (id: string, approverId: string, reason: string) => void;
  saveWorkflow: (workflow: Omit<SavedWorkflow, 'id'>) => void;
  deleteWorkflow: (id: string) => void;
  markAsPaid: (id: string, invoice?: Attachment) => void;
  requestAccountNumber: (id: string) => void;
}

const ProcurementContext = createContext<ProcurementContextType | undefined>(undefined);

export const ProcurementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests, , forceSaveRequests] = useSupabaseSync<ProcurementRequest[]>('zankli_requests', []);
  const [savedWorkflows, setSavedWorkflows, , forceSaveWorkflows] = useSupabaseSync<SavedWorkflow[]>('zankli_workflows', []);

  const { updateStock } = useInventory();
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  // Physical Audit Reminder Logic
  React.useEffect(() => {
    if (!user || !requests.length) return;

    const isAudit1 = user.email === 'auditorzankli@gmail.com';
    const isAudit2 = user.email === 'auditor2zankli@gmail.com';
    const isGenericAudit = user.department === 'Audit' && !isAudit1 && !isAudit2;

    if (!isAudit1 && !isAudit2 && !isGenericAudit) return;

    const excludedTypes = ['Leave Request', 'Issue From Store', 'Emergency Drug Purchase (1 week)', 'Emergency Drug Purchase (1 month)', 'Daily Purchase'];
    const now = new Date();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    let hasUpdates = false;
    const updatedRequests = requests.map(req => {
      if (req.status !== 'Approved' || (req.requestType && excludedTypes.includes(req.requestType))) {
        return req;
      }

      let reqUpdated = false;
      const newReq = { ...req };

      // Find when it was approved
      const approvalDateStr = req.approvals && req.approvals.length > 0 
        ? req.approvals[req.approvals.length - 1].date 
        : req.createdAt;
      const approvalDate = new Date(approvalDateStr);

      // Check Audit 1
      if ((isAudit1 || isGenericAudit) && !req.audit1PhysicallySeen) {
        const lastReminderStr = req.audit1ReminderSentAt || approvalDateStr;
        const lastReminderDate = new Date(lastReminderStr);
        
        if (now.getTime() - lastReminderDate.getTime() >= SEVEN_DAYS_MS) {
          addNotification({
            userId: user.email,
            title: 'Physical Audit Reminder',
            message: `Reminder: You have not yet physically verified the items for approved request "${req.title}". Please confirm if the items have been bought and audited.`,
            type: 'warning',
            link: `/requests/${req.id}`
          });
          newReq.audit1ReminderSentAt = now.toISOString();
          reqUpdated = true;
        }
      }

      // Check Audit 2
      if ((isAudit2 || isGenericAudit) && !req.audit2PhysicallySeen) {
        const lastReminderStr = req.audit2ReminderSentAt || approvalDateStr;
        const lastReminderDate = new Date(lastReminderStr);
        
        if (now.getTime() - lastReminderDate.getTime() >= SEVEN_DAYS_MS) {
          addNotification({
            userId: user.email,
            title: 'Physical Audit Reminder',
            message: `Reminder: You have not yet physically verified the items for approved request "${req.title}". Please confirm if the items have been bought and audited.`,
            type: 'warning',
            link: `/requests/${req.id}`
          });
          newReq.audit2ReminderSentAt = now.toISOString();
          reqUpdated = true;
        }
      }

      if (reqUpdated) {
        hasUpdates = true;
        return newReq;
      }
      return req;
    });

    if (hasUpdates) {
      setRequests(updatedRequests);
      if (forceSaveRequests) forceSaveRequests(updatedRequests);
    }
  }, [requests, user, addNotification, setRequests, forceSaveRequests]);

  const addRequest = (requestData: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>) => {
    const newRequest: ProcurementRequest = {
      ...requestData,
      id: `REQ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
      status: requestData.workflow && requestData.workflow.length > 0 ? 'Pending Approval' : 'Pending Audit',
      currentApproverIndex: requestData.workflow && requestData.workflow.length > 0 ? 0 : undefined,
      approvals: []
    };
    const newRequests = [newRequest, ...requests];
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
    return newRequest.id;
  };

  const saveDraft = (requestData: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>, existingId?: string) => {
    if (existingId) {
      const newRequests = requests.map(req => req.id === existingId ? { ...req, ...requestData, status: 'Draft', isDraft: true } : req);
      setRequests(newRequests);
      if (forceSaveRequests) forceSaveRequests(newRequests);
    } else {
      const newRequest: ProcurementRequest = {
        ...requestData,
        id: `REQ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        createdAt: new Date().toISOString(),
        status: 'Draft',
        isDraft: true,
        approvals: []
      };
      const newRequests = [newRequest, ...requests];
      setRequests(newRequests);
      if (forceSaveRequests) forceSaveRequests(newRequests);
    }
  };

  const updateRequest = (id: string, updates: Partial<ProcurementRequest>) => {
    const newRequests = requests.map(req => req.id === id ? { ...req, ...updates } : req);
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
  };

  const voidApprover = (id: string, approverId: string, reason: string) => {
    const newRequests = requests.map(req => {
      if (req.id === id && req.workflow && req.currentApproverIndex !== undefined) {
        const voided = { approverId, reason, date: new Date().toISOString() };
        let newIndex = req.currentApproverIndex + 1;
        let newStatus = req.status;
        
        if (newIndex >= req.workflow.length) {
          newStatus = 'Approved';
        }

        return {
          ...req,
          voidedApprovers: [...(req.voidedApprovers || []), voided],
          currentApproverIndex: newIndex,
          status: newStatus
        };
      }
      return req;
    });
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
  };

  const processApproval = (id: string, approverId: string, status: 'Approved' | 'Rejected' | 'Sent Back', signature: string, notes?: string, updatedItems?: ProcurementItem[]) => {
    // Notification Logic
    const req = requests.find(r => r.id === id);
    if (req) {
      const approver = MOCK_USERS.find(u => u.id === approverId);
      const approverName = approver?.email || approver?.department || 'Approver';

      if (status === 'Approved') {
        if (req.workflow && req.currentApproverIndex !== undefined && req.currentApproverIndex < req.workflow.length - 1) {
          // Moving to next approver
          const nextApproverId = req.workflow[req.currentApproverIndex + 1];
          
          // Notify next approver
          addNotification({
            userId: nextApproverId,
            title: 'Action Required',
            message: `You have a new request pending your approval: ${req.title}`,
            type: 'info',
            link: `/requests/${req.id}`
          });

          // Notify creator
          addNotification({
            userId: req.createdBy,
            title: 'Request Moved',
            message: `Your request "${req.title}" has been approved by ${approverName} and moved to the next approver.`,
            type: 'info',
            link: `/requests/${req.id}`
          });
        } else {
          // Final approval
          addNotification({
            userId: req.createdBy,
            title: 'Request Approved',
            message: `Your request "${req.title}" has been finally approved.`,
            type: 'success',
            link: `/requests/${req.id}`
          });
        }
      } else if (status === 'Rejected') {
        addNotification({
          userId: req.createdBy,
          title: 'Request Rejected',
          message: `Your request "${req.title}" has been rejected by ${approverName}.`,
          type: 'error',
          link: `/requests/${req.id}`
        });
      } else if (status === 'Sent Back') {
        addNotification({
          userId: req.createdBy,
          title: 'Request Sent Back',
          message: `Your request "${req.title}" has been sent back by ${approverName}.`,
          type: 'warning',
          link: `/requests/${req.id}`
        });
      }
    }

    let newRequests = [...requests];
    const reqIndex = newRequests.findIndex(r => r.id === id);
    if (reqIndex === -1) return;
    
    const currentReq = newRequests[reqIndex];
    const approvalRecord: ApprovalRecord = {
      approverId,
      status,
      signature,
      notes,
      date: new Date().toISOString()
    };
    
    const updatedApprovals = [...(currentReq.approvals || []), approvalRecord];
    let newStatus = currentReq.status;
    let newIndex = currentReq.currentApproverIndex;

    if (status === 'Rejected') {
      newStatus = 'Rejected';
    } else if (status === 'Sent Back') {
      newStatus = 'Sent Back';
    } else if (status === 'Approved') {
      if (currentReq.workflow && currentReq.currentApproverIndex !== undefined) {
        if (currentReq.currentApproverIndex < currentReq.workflow.length - 1) {
          newIndex = currentReq.currentApproverIndex + 1;
          newStatus = 'Pending Approval';
        } else {
          newStatus = 'Approved';
        }
      } else {
        newStatus = 'Approved';
      }
    }

    const isLabPurchaseSplit = currentReq.requestType === 'Lab Purchase Order' && approverId === '2'; // storezankli
    const isEquipmentSplit = currentReq.requestType === 'Equipment Request' && approverId === '1'; // labzankli
    const isPharmacySplit = currentReq.requestType === 'Pharmacy Purchase Order' && approverId === '2'; // storezankli

    // Use updatedItems if provided, otherwise use existing items
    const currentItemsList = updatedItems || currentReq.items || [];

    // Handle Store splitting logic
    if (status === 'Approved' && (isLabPurchaseSplit || isEquipmentSplit || isPharmacySplit) && currentItemsList.length > 0) {
      // Filter out 'Out of Stock' items
      const availableItems = currentItemsList.filter(item => item.availability !== 'Out of Stock');
      
      const suppliers = Array.from(new Set(availableItems.map(item => item.supplier || 'Unspecified')));
      
      if (suppliers.length > 1) {
        // We need to split the request
        const splitRequests: ProcurementRequest[] = suppliers.map((supplier, idx) => {
          const supplierItems = availableItems.filter(item => (item.supplier || 'Unspecified') === supplier);
          const supplierTotal = supplierItems.reduce((sum, item) => sum + (item.quantity * (item.recommendedPrice || item.estimatedCost)), 0);
          
          return {
            ...currentReq,
            id: `${currentReq.id}-${idx + 1}`,
            parentRequestId: currentReq.id,
            splitSupplier: supplier,
            items: supplierItems,
            totalAmount: supplierTotal,
            approvals: updatedApprovals,
            status: newStatus,
            currentApproverIndex: newIndex
          };
        });
        
        // Remove the original request and add the split ones
        newRequests.splice(reqIndex, 1, ...splitRequests);
        setRequests(newRequests);
        if (forceSaveRequests) forceSaveRequests(newRequests);
        return;
      } else {
        // If not splitting (single supplier), but we filtered items, we must update the items
        // Or if we just have updatedItems passed in, we should save them
        // We should update the request with availableItems only
        
         const updatedReq = { 
          ...currentReq, 
          items: availableItems,
          totalAmount: availableItems.reduce((sum, item) => sum + (item.quantity * (item.recommendedPrice || item.estimatedCost)), 0),
          approvals: updatedApprovals,
          status: newStatus,
          currentApproverIndex: newIndex
        };
        newRequests[reqIndex] = updatedReq;
        setRequests(newRequests);
        if (forceSaveRequests) forceSaveRequests(newRequests);
        return;
      }
    }

    const updatedReq = { 
      ...currentReq, 
      items: currentItemsList, // Ensure updatedItems are persisted if passed
      approvals: updatedApprovals,
      status: newStatus,
      currentApproverIndex: newIndex
    };

    // Handle inventory updates upon full approval
    if (newStatus === 'Approved') {
      if (currentReq.requestType === 'Store Requisition' && currentReq.items) {
        currentReq.items.forEach(item => {
          if (item.inventoryItemId && !item.isManual) {
            updateStock(item.inventoryItemId, item.quantity);
          }
        });
      } else if (currentReq.requestType === 'Issue From Store' && currentReq.items) {
        currentReq.items.forEach(item => {
          if (item.inventoryItemId && !item.isManual) {
            updateStock(item.inventoryItemId, -item.quantity);
          }
        });
      }
    }

    newRequests[reqIndex] = updatedReq;
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
  };

  const updateRequestStatus = (id: string, status: RequestStatus | 'Draft', notes?: string, role?: 'Audit' | 'Accounts', signature?: string) => {
    // Notification Logic
    const req = requests.find(r => r.id === id);
    if (req) {
      if (status === 'Pending Accounts') {
        // Notify Accounts
        addNotification({
          userId: 'Accounts',
          title: 'Action Required',
          message: `A request is pending your approval: ${req.title}`,
          type: 'info',
          link: `/requests/${req.id}`
        });
      }

      // Notify creator of status change
      if (status === 'Approved') {
        addNotification({
          userId: req.createdBy,
          title: 'Request Approved',
          message: `Your request "${req.title}" has been approved by ${role}.`,
          type: 'success',
          link: `/requests/${req.id}`
        });
      } else if (status === 'Rejected') {
        addNotification({
          userId: req.createdBy,
          title: 'Request Rejected',
          message: `Your request "${req.title}" has been rejected by ${role}.`,
          type: 'error',
          link: `/requests/${req.id}`
        });
      } else if (status === 'Sent Back') {
        addNotification({
          userId: req.createdBy,
          title: 'Request Sent Back',
          message: `Your request "${req.title}" has been sent back by ${role}.`,
          type: 'warning',
          link: `/requests/${req.id}`
        });
      }
    }

    const newRequests = requests.map(req => {
      if (req.id === id) {
        const updatedReq = { ...req, status };
        if (role === 'Audit') {
          if (notes) updatedReq.auditNotes = notes;
          if (signature) updatedReq.auditSignature = signature;
        } else if (role === 'Accounts') {
          if (notes) updatedReq.accountsNotes = notes;
          if (signature) updatedReq.accountsSignature = signature;
        }

        // Handle inventory updates upon full approval
        if (status === 'Approved') {
          if (req.requestType === 'Store Requisition' && req.items) {
            req.items.forEach(item => {
              if (item.inventoryItemId && !item.isManual) {
                updateStock(item.inventoryItemId, item.quantity);
              }
            });
          } else if (req.requestType === 'Issue From Store' && req.items) {
            req.items.forEach(item => {
              if (item.inventoryItemId && !item.isManual) {
                updateStock(item.inventoryItemId, -item.quantity);
              }
            });
          }
        }

        return updatedReq;
      }
      return req;
    });
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
  };

  const saveWorkflow = (workflow: Omit<SavedWorkflow, 'id'>) => {
    const newWorkflow: SavedWorkflow = {
      ...workflow,
      id: `WF-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    };
    const newWorkflows = [...savedWorkflows, newWorkflow];
    setSavedWorkflows(newWorkflows);
    if (forceSaveWorkflows) forceSaveWorkflows(newWorkflows);
  };

  const deleteWorkflow = (id: string) => {
    const newWorkflows = savedWorkflows.filter(wf => wf.id !== id);
    setSavedWorkflows(newWorkflows);
    if (forceSaveWorkflows) forceSaveWorkflows(newWorkflows);
  };

  const markAsPaid = (id: string, invoice?: Attachment) => {
    const newRequests = requests.map(req => {
      if (req.id === id) {
        return {
          ...req,
          paymentStatus: 'Paid' as const,
          paymentDate: new Date().toISOString(),
          paymentInvoice: invoice || req.paymentInvoice
        };
      }
      return req;
    });
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
  };

  const requestAccountNumber = (id: string) => {
    const newRequests = requests.map(req => {
      if (req.id === id) {
        return {
          ...req,
          accountNumberRequested: true
        };
      }
      return req;
    });
    setRequests(newRequests);
    if (forceSaveRequests) forceSaveRequests(newRequests);
  };

  return (
    <ProcurementContext.Provider value={{ 
      requests, 
      savedWorkflows, 
      addRequest, 
      saveDraft,
      updateRequest, 
      updateRequestStatus, 
      processApproval, 
      voidApprover,
      saveWorkflow, 
      deleteWorkflow,
      markAsPaid,
      requestAccountNumber
    }}>
      {children}
    </ProcurementContext.Provider>
  );
};

export const useProcurement = () => {
  const context = useContext(ProcurementContext);
  if (context === undefined) {
    throw new Error('useProcurement must be used within a ProcurementProvider');
  }
  return context;
};
