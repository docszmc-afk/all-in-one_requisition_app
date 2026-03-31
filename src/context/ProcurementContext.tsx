import React, { createContext, useContext, useState, useEffect } from 'react';
import { ProcurementRequest, RequestStatus, SavedWorkflow, ApprovalRecord, Attachment, ProcurementItem } from '../types';
import { useInventory } from './InventoryContext';
import { useNotifications } from './NotificationContext';
import { MOCK_USERS } from './AuthContext';
import { supabase } from '../lib/supabase';

interface ProcurementContextType {
  requests: ProcurementRequest[];
  savedWorkflows: SavedWorkflow[];
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

export const ProcurementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);

  const fetchRequests = async () => {
    const { data } = await supabase.from('procurement_requests').select('*');
    if (data) setRequests(data);
  };
  const fetchWorkflows = async () => {
    const { data } = await supabase.from('saved_workflows').select('*');
    if (data) {
      setSavedWorkflows(data.map((wf: any) => {
        const rawApprovers = wf.approver_id || wf.approver_ids || wf.approverIds;
        return {
          id: wf.id,
          name: wf.name,
          approverIds: typeof rawApprovers === 'string' ? JSON.parse(rawApprovers) : (rawApprovers || []),
          creatorId: wf.creator_id || wf.creatorId || '',
        };
      }));
    }
  };

  const refreshRequests = async () => {
    await Promise.all([fetchRequests(), fetchWorkflows()]);
  };

  useEffect(() => {
    fetchRequests();
    fetchWorkflows();

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
    
    setRequests(prev => [newRequest, ...prev]);
    
    const { error } = await supabase.from('procurement_requests').insert(newRequest);
    if (error) {
      console.error('Supabase insert error:', error.message, error.details, error.hint);
      throw error;
    }
    return newRequest.id;
  };

  const saveDraft = async (requestData: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'>, existingId?: string) => {
    try {
      if (existingId) {
        const updates = { ...requestData, status: 'Draft' as const, isDraft: true };
        setRequests(prev => prev.map(req => req.id === existingId ? { ...req, ...updates } : req));
        const { error } = await supabase.from('procurement_requests').update(updates).eq('id', existingId);
        if (error) {
            console.error('Supabase update error:', error.message, error.details, error.hint);
            throw error;
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
        setRequests(prev => [newRequest, ...prev]);
        const { error } = await supabase.from('procurement_requests').insert(newRequest);
        if (error) {
            console.error('Supabase insert error:', error.message, error.details, error.hint);
            throw error;
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  };

  const updateRequest = async (id: string, updates: Partial<ProcurementRequest>) => {
    try {
      setRequests(prev => prev.map(req => req.id === id ? { ...req, ...updates } : req));
      const { error } = await supabase.from('procurement_requests').update(updates).eq('id', id);
      if (error) {
          console.error('Supabase update error:', error.message, error.details, error.hint);
          throw error;
      }
    } catch (error) {
      console.error('Error updating request:', error);
      throw error;
    }
  };

  const voidApprover = async (id: string, approverId: string, reason: string) => {
    try {
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => prev.map(req => {
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
      }));

      if (updatedReq) {
        const { error } = await supabase.from('procurement_requests').update({
          voidedApprovers: updatedReq.voidedApprovers,
          currentApproverIndex: updatedReq.currentApproverIndex,
          status: updatedReq.status
        }).eq('id', id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Supabase voidApprover error:', error.message, error.details, error.hint);
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
      console.log('Request found:', req);
      
      const approver = MOCK_USERS.find(u => u.id === approverId);
      const approverName = approver?.email || approver?.department || 'Approver';
      console.log('Approver:', approverName);

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

      let requestsToInsert: ProcurementRequest[] = [];
      let requestToUpdate: ProcurementRequest | undefined;
      let requestToDeleteId: string | undefined;

      setRequests(prev => {
        let newRequests = [...prev];
        const reqIndex = newRequests.findIndex(r => r.id === id);
        if (reqIndex === -1) return prev;
        
        const req = newRequests[reqIndex];
        const approvalRecord: ApprovalRecord = {
          approverId,
          status,
          signature,
          notes,
          date: new Date().toISOString()
        };
        
        const updatedApprovals = [...(req.approvals || []), approvalRecord];
        let newStatus = req.status;
        let newIndex = req.currentApproverIndex;

        if (status === 'Rejected') {
          newStatus = 'Rejected';
        } else if (status === 'Sent Back') {
          newStatus = 'Sent Back';
        } else if (status === 'Approved') {
          if (req.workflow && req.currentApproverIndex !== undefined) {
            if (req.currentApproverIndex < req.workflow.length - 1) {
              newIndex = req.currentApproverIndex + 1;
              newStatus = 'Pending Approval';
            } else {
              newStatus = 'Approved';
            }
          } else {
            newStatus = 'Approved';
          }
        }

        const isLabPurchaseSplit = req.requestType === 'Lab Purchase Order' && approverId === '2'; // storezankli
        const isEquipmentSplit = req.requestType === 'Equipment Request' && approverId === '1'; // labzankli
        const isPharmacySplit = req.requestType === 'Pharmacy Purchase Order' && approverId === '2'; // storezankli

        // Use updatedItems if provided, otherwise use existing items
        const currentItems = updatedItems || req.items || [];

        // Handle Store splitting logic
        if (status === 'Approved' && (isLabPurchaseSplit || isEquipmentSplit || isPharmacySplit) && currentItems.length > 0) {
          // Filter out 'Out of Stock' items
          const availableItems = currentItems.filter(item => item.availability !== 'Out of Stock');
          
          const suppliers = Array.from(new Set(availableItems.map(item => item.supplier || 'Unspecified')));
          
          if (suppliers.length > 1) {
            // We need to split the request
            const splitRequests: ProcurementRequest[] = suppliers.map((supplier, idx) => {
              const supplierItems = availableItems.filter(item => (item.supplier || 'Unspecified') === supplier);
              const supplierTotal = supplierItems.reduce((sum, item) => sum + (item.quantity * (item.recommendedPrice || item.estimatedCost)), 0);
              
              return {
                ...req,
                id: `${req.id}-${idx + 1}`,
                parentRequestId: req.id,
                splitSupplier: supplier,
                items: supplierItems,
                totalAmount: supplierTotal,
                approvals: updatedApprovals,
                status: newStatus,
                currentApproverIndex: newIndex
              };
            });
            
            requestsToInsert = splitRequests;
            requestToDeleteId = req.id;

            // Remove the original request and add the split ones
            newRequests.splice(reqIndex, 1, ...splitRequests);
            return newRequests;
          } else {
            // If not splitting (single supplier), but we filtered items, we must update the items
            // Or if we just have updatedItems passed in, we should save them
            // We should update the request with availableItems only
            
             const updatedReq = { 
              ...req, 
              items: availableItems,
              totalAmount: availableItems.reduce((sum, item) => sum + (item.quantity * (item.recommendedPrice || item.estimatedCost)), 0),
              approvals: updatedApprovals,
              status: newStatus,
              currentApproverIndex: newIndex
            };
            requestToUpdate = updatedReq;
            newRequests[reqIndex] = updatedReq;
            return newRequests;
          }
        }

        const updatedReq = { 
          ...req, 
          items: currentItems, // Ensure updatedItems are persisted if passed
          approvals: updatedApprovals,
          status: newStatus,
          currentApproverIndex: newIndex
        };

        requestToUpdate = updatedReq;
        newRequests[reqIndex] = updatedReq;
        return newRequests;
      });

      console.log('requestToUpdate:', requestToUpdate);
      console.log('requestToDeleteId:', requestToDeleteId);
      console.log('requestsToInsert:', requestsToInsert);

      // Handle inventory updates upon full approval (outside setRequests to avoid double execution in StrictMode)
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
        console.log('Deleting request:', requestToDeleteId);
        const { error: deleteError } = await supabase.from('procurement_requests').delete().eq('id', id);
        if (deleteError) {
            console.error('Supabase delete error:', deleteError);
            throw deleteError;
        }
        console.log('Inserting requests:', requestsToInsert);
        const { error: insertError } = await supabase.from('procurement_requests').insert(requestsToInsert);
        if (insertError) {
            console.error('Supabase insert error:', insertError);
            throw insertError;
        }
      } else if (requestToUpdate) {
        console.log('Updating request:', id, 'with data:', {
          items: requestToUpdate.items,
          totalAmount: requestToUpdate.totalAmount,
          approvals: requestToUpdate.approvals,
          status: requestToUpdate.status,
          currentApproverIndex: requestToUpdate.currentApproverIndex
        });
        const { error } = await supabase.from('procurement_requests').update({
          items: requestToUpdate.items,
          totalAmount: requestToUpdate.totalAmount,
          approvals: requestToUpdate.approvals,
          status: requestToUpdate.status,
          currentApproverIndex: requestToUpdate.currentApproverIndex
        }).eq('id', id);
        if (error) {
            console.error('Supabase update error:', error);
            throw error;
        }
        console.log('Update successful');
      }
    } catch (error: any) {
      console.error('Supabase approval error:', error.message, error.details, error.hint);
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

      setRequests(prev => prev.map(req => {
        if (req.id === id) {
          updatedReq = { ...req, status };
          if (role === 'Audit') {
            if (notes) updatedReq.auditNotes = notes;
            if (signature) updatedReq.auditSignature = signature;
          } else if (role === 'Accounts') {
            if (notes) updatedReq.accountsNotes = notes;
            if (signature) updatedReq.accountsSignature = signature;
          }

          return updatedReq;
        }
        return req;
      }));

      if (updatedReq) {
        // Handle inventory updates upon full approval (outside setRequests to avoid double execution in StrictMode)
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

        const { error } = await supabase.from('procurement_requests').update({
          status: updatedReq.status,
          auditNotes: updatedReq.auditNotes,
          auditSignature: updatedReq.auditSignature,
          accountsNotes: updatedReq.accountsNotes,
          accountsSignature: updatedReq.accountsSignature
        }).eq('id', id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Supabase updateRequestStatus error:', error.message, error.details, error.hint);
      throw error;
    }
  };

  const saveWorkflow = async (workflow: Omit<SavedWorkflow, 'id'>) => {
    const newWorkflow: SavedWorkflow = {
      ...workflow,
      id: `WF-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    };
    setSavedWorkflows(prev => [...prev, newWorkflow]);
    console.log('Saving workflow:', newWorkflow);
    try {
      const { error } = await supabase.from('saved_workflows').insert({
        id: newWorkflow.id,
        name: newWorkflow.name,
        approver_ids: newWorkflow.approverIds,
        creator_id: newWorkflow.creatorId
      });
      if (error) {
        console.error('Error saving workflow to Supabase:', error);
        addNotification({
          userId: workflow.creatorId,
          title: 'Workflow Error',
          message: 'Failed to save workflow to database.',
          type: 'error'
        });
      } else {
        addNotification({
          userId: workflow.creatorId,
          title: 'Workflow Saved',
          message: `Workflow "${workflow.name}" saved successfully.`,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error in saveWorkflow:', error);
    }
  };

  const deleteWorkflow = async (id: string) => {
    setSavedWorkflows(prev => prev.filter(wf => wf.id !== id));
    await supabase.from('saved_workflows').delete().eq('id', id);
  };

  const markAsPaid = async (id: string, invoice?: Attachment) => {
    try {
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => prev.map(req => {
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
      }));

      if (updatedReq) {
        const { error } = await supabase.from('procurement_requests').update({
          paymentStatus: updatedReq.paymentStatus,
          paymentDate: updatedReq.paymentDate,
          paymentInvoice: updatedReq.paymentInvoice
        }).eq('id', id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Supabase markAsPaid error:', error.message, error.details, error.hint);
      throw error;
    }
  };

  const requestAccountNumber = async (id: string) => {
    try {
      let updatedReq: ProcurementRequest | undefined;
      setRequests(prev => prev.map(req => {
        if (req.id === id) {
          updatedReq = {
            ...req,
            accountNumberRequested: true
          };
          return updatedReq;
        }
        return req;
      }));

      if (updatedReq) {
        const { error } = await supabase.from('procurement_requests').update({
          accountNumberRequested: updatedReq.accountNumberRequested
        }).eq('id', id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Supabase requestAccountNumber error:', error.message, error.details, error.hint);
      throw error;
    }
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
