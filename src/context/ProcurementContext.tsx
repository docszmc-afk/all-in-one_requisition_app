import React, { createContext, useContext, useState, useEffect } from 'react';
import { ProcurementRequest, RequestStatus, SavedWorkflow, ApprovalRecord, Attachment, ProcurementItem } from '../types';
import { useInventory } from './InventoryContext';
import { useNotifications } from './NotificationContext';
import { MOCK_USERS } from './AuthContext';
import { supabase } from '../lib/supabase';

interface ProcurementContextType {
  requests: ProcurementRequest[];
  savedWorkflows: SavedWorkflow[];
  loading: boolean;
  addRequest: (request: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>) => Promise<string>;
  saveDraft: (request: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>, existingId?: string) => Promise<void>;
  updateRequest: (id: string, updates: Partial<ProcurementRequest>) => Promise<void>;
  updateRequestStatus: (id: string, status: RequestStatus | 'Draft', notes?: string, role?: 'Audit' | 'Accounts', signature?: string) => Promise<void>;
  processApproval: (id: string, approverId: string, status: 'Approved' | 'Rejected' | 'Sent Back', signature: string, notes?: string, updatedItems?: ProcurementItem[]) => Promise<void>;
  voidApprover: (id: string, approverId: string, reason: string) => Promise<void>;
  saveWorkflow: (workflow: Omit<SavedWorkflow, 'id'>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  markAsPaid: (id: string, invoice?: Attachment) => Promise<void>;
  requestAccountNumber: (id: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
}

const ProcurementContext = createContext<ProcurementContextType | undefined>(undefined);

const REQ_CACHE_KEY = 'zmc_cached_procurement_requests';
const WF_CACHE_KEY = 'zmc_cached_saved_workflows';

const cleanPayload = (obj: any) => {
  const clean: any = {};
  Object.keys(obj || {}).forEach(key => {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  });
  return clean;
};

const persistToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to persist ${key} to localStorage:`, e);
  }
};

const safeJsonParse = (val: any, fallback: any = undefined) => {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback !== undefined ? fallback : val;
    }
  }
  return val;
};

export const parseProcurementRequest = (raw: any): ProcurementRequest => {
  if (!raw) return raw;
  
  const parsedItems = safeJsonParse(raw.items, []);
  const parsedWorkflow = safeJsonParse(raw.workflow, []);
  const parsedApprovals = safeJsonParse(raw.approvals, []);
  const parsedAttachments = safeJsonParse(raw.attachments, []);
  const parsedVoided = safeJsonParse(raw.voidedApprovers || raw.voided_approvers, []);

  return {
    id: String(raw.id || raw.request_id || `REQ-${Math.floor(Math.random() * 10000)}`),
    title: String(raw.title || 'Untitled Request'),
    description: String(raw.description || ''),
    department: (raw.department || 'General') as any,
    createdBy: String(raw.createdBy || raw.created_by || ''),
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
    items: Array.isArray(parsedItems) ? parsedItems : [],
    totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
    recommendedAmount: raw.recommendedAmount !== undefined ? Number(raw.recommendedAmount) : (raw.recommended_amount !== undefined ? Number(raw.recommended_amount) : undefined),
    status: (raw.status || 'Pending Approval') as any,
    auditNotes: raw.auditNotes || raw.audit_notes,
    auditSignature: raw.auditSignature || raw.audit_signature,
    accountsNotes: raw.accountsNotes || raw.accounts_notes,
    accountsSignature: raw.accountsSignature || raw.accounts_signature,
    requestType: raw.requestType || raw.request_type || 'General',
    urgencyLevel: raw.urgencyLevel || raw.urgency_level || 'Normal',
    histologyDetails: safeJsonParse(raw.histologyDetails || raw.histology_details),
    histologyDetailsList: safeJsonParse(raw.histologyDetailsList || raw.histology_details_list),
    paymentDetails: safeJsonParse(raw.paymentDetails || raw.payment_details),
    dieselDetails: safeJsonParse(raw.dieselDetails || raw.diesel_details),
    productProcurementDetails: safeJsonParse(raw.productProcurementDetails || raw.product_procurement_details),
    leaveDetails: safeJsonParse(raw.leaveDetails || raw.leave_details),
    storeRequisitionDetails: safeJsonParse(raw.storeRequisitionDetails || raw.store_requisition_details),
    issueFromStoreDetails: safeJsonParse(raw.issueFromStoreDetails || raw.issue_from_store_details),
    creatorSignature: raw.creatorSignature || raw.creator_signature,
    workflow: Array.isArray(parsedWorkflow) ? parsedWorkflow : [],
    currentApproverIndex: raw.currentApproverIndex !== undefined ? Number(raw.currentApproverIndex) : (raw.current_approver_index !== undefined ? Number(raw.current_approver_index) : undefined),
    approvals: Array.isArray(parsedApprovals) ? parsedApprovals : [],
    attachments: Array.isArray(parsedAttachments) ? parsedAttachments : [],
    isDraft: Boolean(raw.isDraft ?? raw.is_draft ?? false),
    parentRequestId: raw.parentRequestId || raw.parent_request_id,
    splitSupplier: raw.splitSupplier || raw.split_supplier,
    voidedApprovers: Array.isArray(parsedVoided) ? parsedVoided : [],
    paymentStatus: raw.paymentStatus || raw.payment_status || 'Pending',
    paymentInvoice: safeJsonParse(raw.paymentInvoice || raw.payment_invoice),
    paymentDate: raw.paymentDate || raw.payment_date,
    accountNumberRequested: Boolean(raw.accountNumberRequested ?? raw.account_number_requested ?? false),
    isBought: Boolean(raw.isBought ?? raw.is_bought ?? false),
    isInspected: Boolean(raw.isInspected ?? raw.is_inspected ?? false),
    inspectedBy: raw.inspectedBy || raw.inspected_by,
    inspectedAt: raw.inspectedAt || raw.inspected_at,
  };
};

export const ProcurementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<ProcurementRequest[]>(() => {
    try {
      const saved = localStorage.getItem(REQ_CACHE_KEY);
      if (saved) {
        const rawList = JSON.parse(saved);
        return Array.isArray(rawList) ? rawList.map(parseProcurementRequest) : [];
      }
      return [];
    } catch {
      return [];
    }
  });
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>(() => {
    try {
      const saved = localStorage.getItem(WF_CACHE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  // Sync state to local storage whenever requests change
  useEffect(() => {
    if (requests && requests.length > 0) {
      persistToStorage(REQ_CACHE_KEY, requests);
    }
  }, [requests]);

  useEffect(() => {
    if (savedWorkflows && savedWorkflows.length > 0) {
      persistToStorage(WF_CACHE_KEY, savedWorkflows);
    }
  }, [savedWorkflows]);

  const fetchRequests = async () => {
    try {
      const PAGE_SIZE = 1000;
      let allRemoteRows: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('procurement_requests')
          .select('*')
          .order('createdAt', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          // If sorting by createdAt failed (e.g. column naming difference), try without order
          if (from === 0) {
            const fallback = await supabase
              .from('procurement_requests')
              .select('*')
              .range(from, from + PAGE_SIZE - 1);
            if (!fallback.error && fallback.data) {
              allRemoteRows = allRemoteRows.concat(fallback.data);
              if (fallback.data.length < PAGE_SIZE) break;
              from += PAGE_SIZE;
              continue;
            }
          }
          console.warn('Procurement requests fetch warning:', error.message);
          break;
        }

        if (!data || data.length === 0) break;
        allRemoteRows = allRemoteRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (allRemoteRows.length > 0) {
        const parsedData = allRemoteRows.map(parseProcurementRequest);
        setRequests(prev => {
          const remoteMap = new Map(parsedData.map((r: ProcurementRequest) => [r.id, r]));
          const merged = [...parsedData];
          
          // Preserve any local drafts or recently created items not yet in remote response
          prev.forEach(localReq => {
            if (!remoteMap.has(localReq.id)) {
              merged.push(localReq);
            }
          });

          persistToStorage(REQ_CACHE_KEY, merged);
          return merged;
        });
      }
    } catch (err: any) {
      console.warn('Error fetching procurement requests:', err?.message || err);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const { data, error } = await supabase.from('saved_workflows').select('*').limit(100);
      if (error) {
        if (error.code === '57014' || error.message?.includes('timeout')) {
          console.warn('Saved workflows query timed out; using cache.');
          return;
        }
        console.warn('Error fetching workflows:', error.message);
        return;
      }
      if (data) {
        const parsed = data.map((wf: any) => {
          const rawApprovers = wf.approver_id || wf.approver_ids || wf.approverIds;
          return {
            id: wf.id,
            name: wf.name,
            approverIds: typeof rawApprovers === 'string' ? JSON.parse(rawApprovers) : (rawApprovers || []),
            creatorId: wf.creator_id || wf.creatorId || '',
          };
        });
        setSavedWorkflows(parsed);
        persistToStorage(WF_CACHE_KEY, parsed);
      }
    } catch (err: any) {
      console.warn('Error fetching workflows:', err?.message || err);
    }
  };

  const refreshRequests = async () => {
    setLoading(true);
    await Promise.all([fetchRequests(), fetchWorkflows()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshRequests();

    const reqChannel = supabase.channel('public:procurement_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procurement_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    const wfChannel = supabase.channel('public:saved_workflows')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_workflows' }, () => {
        fetchWorkflows();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reqChannel);
      supabase.removeChannel(wfChannel);
    };
  }, []);

  const { updateStock } = useInventory();
  const { addNotification } = useNotifications();

  const addRequest = async (requestData: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>) => {
    const newRequest: ProcurementRequest = {
      ...requestData,
      id: `REQ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
      status: requestData.workflow && requestData.workflow.length > 0 ? 'Pending Approval' : 'Pending Audit',
      currentApproverIndex: requestData.workflow && requestData.workflow.length > 0 ? 0 : undefined,
      approvals: []
    };
    
    setRequests(prev => {
      const updated = [newRequest, ...prev];
      persistToStorage(REQ_CACHE_KEY, updated);
      return updated;
    });
    
    try {
      const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(newRequest), { onConflict: 'id' });
      if (error) {
        console.warn('Supabase upsert warning on addRequest:', error.message, error.details);
      }
    } catch (err) {
      console.warn('Supabase addRequest network error:', err);
    }
    return newRequest.id;
  };

  const saveDraft = async (requestData: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>, existingId?: string) => {
    try {
      if (existingId) {
        const updates = { ...requestData, status: 'Draft' as const, isDraft: true };
        let updatedReq: ProcurementRequest | undefined;
        setRequests(prev => {
          const updated = prev.map(req => {
            if (req.id === existingId) {
              updatedReq = { ...req, ...updates };
              return updatedReq;
            }
            return req;
          });
          persistToStorage(REQ_CACHE_KEY, updated);
          return updated;
        });
        if (updatedReq) {
          try {
            const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(updatedReq), { onConflict: 'id' });
            if (error) {
              console.warn('Supabase update draft warning:', error.message);
            }
          } catch (e) {
            console.warn('Supabase draft update network error:', e);
          }
        }
      } else {
        const newRequest: ProcurementRequest = {
          ...requestData,
          id: `REQ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          createdAt: new Date().toISOString(),
          status: 'Draft',
          isDraft: true,
          approvals: []
        };
        setRequests(prev => {
          const updated = [newRequest, ...prev];
          persistToStorage(REQ_CACHE_KEY, updated);
          return updated;
        });
        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(newRequest), { onConflict: 'id' });
          if (error) {
            console.warn('Supabase insert draft warning:', error.message);
          }
        } catch (e) {
          console.warn('Supabase draft insert network error:', e);
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  };

  const updateRequest = async (id: string, updates: Partial<ProcurementRequest>) => {
    try {
      const cleaned = cleanPayload(updates);
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => {
        const updated = prev.map(req => {
          if (req.id === id) {
            updatedReq = { ...req, ...cleaned };
            return updatedReq;
          }
          return req;
        });
        persistToStorage(REQ_CACHE_KEY, updated);
        return updated;
      });

      if (updatedReq) {
        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(updatedReq), { onConflict: 'id' });
          if (error) {
            console.warn('Supabase upsert warning on updateRequest:', error.message, error.details);
          }
        } catch (e) {
          console.warn('Supabase update network error:', e);
        }
      }
    } catch (error) {
      console.error('Error updating request:', error);
    }
  };

  const voidApprover = async (id: string, approverId: string, reason: string) => {
    try {
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => {
        const updated = prev.map(req => {
          if (req.id === id && req.workflow && req.currentApproverIndex !== undefined) {
            const voided = { approverId, reason, date: new Date().toISOString() };
            let newIndex = req.currentApproverIndex + 1;
            let newStatus = req.status;
            
            if (newIndex >= req.workflow.length) {
              newStatus = 'Approved';
            }

            updatedReq = {
              ...req,
              voidedApprovers: [...(req.voidedApprovers || []), voided],
              currentApproverIndex: newIndex,
              status: newStatus
            };
            return updatedReq;
          }
          return req;
        });
        persistToStorage(REQ_CACHE_KEY, updated);
        return updated;
      });

      if (updatedReq) {
        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(updatedReq), { onConflict: 'id' });
          if (error) console.warn('Supabase voidApprover error:', error);
        } catch (e) {
          console.warn('Supabase voidApprover error:', e);
        }
      }
    } catch (error: any) {
      console.error('voidApprover error:', error);
      throw error;
    }
  };

  const processApproval = async (id: string, approverId: string, status: 'Approved' | 'Rejected' | 'Sent Back', signature: string, notes?: string, updatedItems?: ProcurementItem[]) => {
    try {
      console.log('processApproval called for request:', id, 'status:', status);
      // Notification Logic
      const req = requests.find(r => r.id === id);
      if (!req) {
        console.error('Request not found for ID:', id);
        throw new Error('Request not found');
      }
      
      const approver = MOCK_USERS.find(u => u.id === approverId);
      const approverName = approver?.email || approver?.department || 'Approver';

      if (status === 'Approved') {
        if (req.workflow && req.currentApproverIndex !== undefined && req.currentApproverIndex < req.workflow.length - 1) {
          // Moving to next approver
          const nextApproverId = req.workflow[req.currentApproverIndex + 1];
          
          addNotification({
            userId: nextApproverId,
            title: 'Action Required',
            message: `You have a new request pending your approval: ${req.title}`,
            type: 'info',
            link: `/requests/${req.id}`
          });

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

      let requestsToInsert: ProcurementRequest[] = [];
      let requestToUpdate: ProcurementRequest | undefined;
      let requestToDeleteId: string | undefined;

      setRequests(prev => {
        let newRequests = [...prev];
        const reqIndex = newRequests.findIndex(r => r.id === id);
        if (reqIndex === -1) return prev;
        
        const targetReq = newRequests[reqIndex];
        const approvalRecord: ApprovalRecord = {
          approverId,
          status,
          signature,
          notes,
          date: new Date().toISOString()
        };
        
        const updatedApprovals = [...(targetReq.approvals || []), approvalRecord];
        let newStatus = targetReq.status;
        let newIndex = targetReq.currentApproverIndex;

        if (status === 'Rejected') {
          newStatus = 'Rejected';
        } else if (status === 'Sent Back') {
          newStatus = 'Sent Back';
        } else if (status === 'Approved') {
          if (targetReq.workflow && targetReq.currentApproverIndex !== undefined) {
            if (targetReq.currentApproverIndex < targetReq.workflow.length - 1) {
              newIndex = targetReq.currentApproverIndex + 1;
              newStatus = 'Pending Approval';
            } else {
              newStatus = 'Approved';
            }
          } else {
            newStatus = 'Approved';
          }
        }

        const isLabPurchaseSplit = targetReq.requestType === 'Lab Purchase Order' && approverId === '2'; // storezankli
        const isEquipmentSplit = targetReq.requestType === 'Equipment Request' && approverId === '1'; // labzankli
        const isPharmacySplit = targetReq.requestType === 'Pharmacy Purchase Order' && approverId === '2'; // storezankli

        // Use updatedItems if provided, otherwise use existing items
        const currentItems = updatedItems || targetReq.items || [];

        // Handle Store splitting logic
        if (status === 'Approved' && (isLabPurchaseSplit || isEquipmentSplit || isPharmacySplit) && currentItems.length > 0) {
          const availableItems = currentItems.filter(item => item.availability !== 'Out of Stock');
          const suppliers = Array.from(new Set(availableItems.map(item => item.supplier || 'Unspecified')));
          
          if (suppliers.length > 1) {
            const splitRequests: ProcurementRequest[] = suppliers.map((supplier, idx) => {
              const supplierItems = availableItems.filter(item => (item.supplier || 'Unspecified') === supplier);
              const supplierTotal = supplierItems.reduce((sum, item) => sum + (item.quantity * (item.recommendedPrice || item.estimatedCost)), 0);
              
              return {
                ...targetReq,
                id: `${targetReq.id}-${idx + 1}`,
                parentRequestId: targetReq.id,
                splitSupplier: supplier,
                items: supplierItems,
                totalAmount: supplierTotal,
                approvals: updatedApprovals,
                status: newStatus,
                currentApproverIndex: newIndex
              };
            });
            
            requestsToInsert = splitRequests;
            requestToDeleteId = targetReq.id;

            newRequests.splice(reqIndex, 1, ...splitRequests);
            persistToStorage(REQ_CACHE_KEY, newRequests);
            return newRequests;
          } else {
            const updatedReq = { 
              ...targetReq, 
              items: availableItems,
              totalAmount: availableItems.reduce((sum, item) => sum + (item.quantity * (item.recommendedPrice || item.estimatedCost)), 0),
              approvals: updatedApprovals,
              status: newStatus,
              currentApproverIndex: newIndex
            };
            requestToUpdate = updatedReq;
            newRequests[reqIndex] = updatedReq;
            persistToStorage(REQ_CACHE_KEY, newRequests);
            return newRequests;
          }
        }

        const updatedReq = { 
          ...targetReq, 
          items: currentItems,
          approvals: updatedApprovals,
          status: newStatus,
          currentApproverIndex: newIndex
        };

        requestToUpdate = updatedReq;
        newRequests[reqIndex] = updatedReq;
        persistToStorage(REQ_CACHE_KEY, newRequests);
        return newRequests;
      });

      // Handle inventory updates upon full approval
      if (requestToUpdate && requestToUpdate.status === 'Approved' && req.status !== 'Approved') {
        if (requestToUpdate.requestType === 'Store Requisition' && requestToUpdate.items) {
          requestToUpdate.items.forEach(item => {
            if (item.inventoryItemId && !item.isManual) {
              updateStock(item.inventoryItemId, item.quantity);
            }
          });
        } else if (requestToUpdate.requestType === 'Issue From Store' && requestToUpdate.items) {
          requestToUpdate.items.forEach(item => {
            if (item.inventoryItemId && !item.isManual) {
              updateStock(item.inventoryItemId, -item.quantity);
            }
          });
        }
      }

      if (requestToDeleteId && requestsToInsert.length > 0) {
        try {
          await supabase.from('procurement_requests').delete().eq('id', id);
          for (const splitReq of requestsToInsert) {
            await supabase.from('procurement_requests').upsert(cleanPayload(splitReq), { onConflict: 'id' });
          }
        } catch (e) {
          console.warn('Supabase split write error:', e);
        }
      } else if (requestToUpdate) {
        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(requestToUpdate), { onConflict: 'id' });
          if (error) {
            console.warn('Supabase update warning in processApproval:', error);
          }
        } catch (e) {
          console.warn('Supabase processApproval network error:', e);
        }
      }
    } catch (error: any) {
      console.error('processApproval error:', error);
      throw error;
    }
  };

  const updateRequestStatus = async (id: string, status: RequestStatus | 'Draft', notes?: string, role?: 'Audit' | 'Accounts', signature?: string) => {
    try {
      let updatedReq: ProcurementRequest | undefined;

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

      setRequests(prev => {
        const updated = prev.map(r => {
          if (r.id === id) {
            updatedReq = { ...r, status };
            if (role === 'Audit') {
              if (notes) updatedReq.auditNotes = notes;
              if (signature) updatedReq.auditSignature = signature;
            } else if (role === 'Accounts') {
              if (notes) updatedReq.accountsNotes = notes;
              if (signature) updatedReq.accountsSignature = signature;
            }
            return updatedReq;
          }
          return r;
        });
        persistToStorage(REQ_CACHE_KEY, updated);
        return updated;
      });

      if (updatedReq) {
        // Handle inventory updates upon full approval
        if (updatedReq.status === 'Approved' && req?.status !== 'Approved') {
          if (updatedReq.requestType === 'Store Requisition' && updatedReq.items) {
            updatedReq.items.forEach(item => {
              if (item.inventoryItemId && !item.isManual) {
                updateStock(item.inventoryItemId, item.quantity);
              }
            });
          } else if (updatedReq.requestType === 'Issue From Store' && updatedReq.items) {
            updatedReq.items.forEach(item => {
              if (item.inventoryItemId && !item.isManual) {
                updateStock(item.inventoryItemId, -item.quantity);
              }
            });
          }
        }

        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(updatedReq), { onConflict: 'id' });
          if (error) {
            console.warn('Supabase updateRequestStatus warning:', error);
          }
        } catch (e) {
          console.warn('Supabase updateRequestStatus network error:', e);
        }
      }
    } catch (error: any) {
      console.error('updateRequestStatus error:', error);
      throw error;
    }
  };

  const saveWorkflow = async (workflow: Omit<SavedWorkflow, 'id'>) => {
    const newWorkflow: SavedWorkflow = {
      ...workflow,
      id: `WF-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    };
    setSavedWorkflows(prev => {
      const updated = [...prev, newWorkflow];
      persistToStorage(WF_CACHE_KEY, updated);
      return updated;
    });
    try {
      const { error } = await supabase.from('saved_workflows').insert(cleanPayload({
        id: newWorkflow.id,
        name: newWorkflow.name,
        approver_ids: newWorkflow.approverIds,
        creator_id: newWorkflow.creatorId
      }));
      if (error) {
        console.warn('Error saving workflow to Supabase:', error);
      } else {
        addNotification({
          userId: workflow.creatorId,
          title: 'Workflow Saved',
          message: `Workflow "${workflow.name}" saved successfully.`,
          type: 'success'
        });
      }
    } catch (error) {
      console.warn('Error in saveWorkflow:', error);
    }
  };

  const deleteWorkflow = async (id: string) => {
    setSavedWorkflows(prev => {
      const updated = prev.filter(wf => wf.id !== id);
      persistToStorage(WF_CACHE_KEY, updated);
      return updated;
    });
    try {
      await supabase.from('saved_workflows').delete().eq('id', id);
    } catch (e) {
      console.warn('Error deleting workflow in Supabase:', e);
    }
  };

  const markAsPaid = async (id: string, invoice?: Attachment) => {
    try {
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => {
        const updated = prev.map(req => {
          if (req.id === id) {
            updatedReq = {
              ...req,
              paymentStatus: 'Paid',
              paymentDate: new Date().toISOString(),
              paymentInvoice: invoice || req.paymentInvoice
            };
            return updatedReq;
          }
          return req;
        });
        persistToStorage(REQ_CACHE_KEY, updated);
        return updated;
      });

      if (updatedReq) {
        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(updatedReq), { onConflict: 'id' });
          if (error) console.warn('Supabase markAsPaid warning:', error);
        } catch (e) {
          console.warn('Supabase markAsPaid network error:', e);
        }
      }
    } catch (error: any) {
      console.error('markAsPaid error:', error);
      throw error;
    }
  };

  const requestAccountNumber = async (id: string) => {
    try {
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => {
        const updated = prev.map(req => {
          if (req.id === id) {
            updatedReq = {
              ...req,
              accountNumberRequested: true
            };
            return updatedReq;
          }
          return req;
        });
        persistToStorage(REQ_CACHE_KEY, updated);
        return updated;
      });

      if (updatedReq) {
        try {
          const { error } = await supabase.from('procurement_requests').upsert(cleanPayload(updatedReq), { onConflict: 'id' });
          if (error) console.warn('Supabase requestAccountNumber warning:', error);
        } catch (e) {
          console.warn('Supabase requestAccountNumber network error:', e);
        }
      }
    } catch (error: any) {
      console.error('requestAccountNumber error:', error);
      throw error;
    }
  };

  return (
    <ProcurementContext.Provider value={{ 
      requests, 
      savedWorkflows, 
      loading,
      addRequest, 
      saveDraft,
      updateRequest, 
      updateRequestStatus, 
      processApproval, 
      voidApprover,
      saveWorkflow, 
      deleteWorkflow,
      markAsPaid,
      requestAccountNumber,
      refreshRequests
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
