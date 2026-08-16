import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Voucher, VoucherApproval } from '../types';
import { toast } from 'sonner';

interface VoucherContextType {
  vouchers: Voucher[];
  approvals: VoucherApproval[];
  loading: boolean;
  createVoucher: (voucher: Partial<Voucher>) => Promise<void>;
  updateVoucherStatus: (id: string, status: Voucher['status'], approverEmail?: string, comments?: string, finalAmount?: number) => Promise<void>;
  queryVoucher: (id: string, queryNotes: string) => Promise<void>;
  fetchVouchers: () => Promise<void>;
  updateVoucherContent: (id: string, updates: Partial<Voucher>) => Promise<void>;
  addApproval: (approval: Partial<VoucherApproval>) => Promise<void>;
  fetchApprovals: () => Promise<void>;
}

const VoucherContext = createContext<VoucherContextType | undefined>(undefined);

export const VoucherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [approvals, setApprovals] = useState<VoucherApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('voucher_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApprovals(data as VoucherApproval[]);
    } catch (error) {
      console.error('Error fetching voucher approvals:', error);
    }
  };

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const [vouchersRes, approvalsRes] = await Promise.all([
        supabase.from('vouchers').select('*').order('created_at', { ascending: false }),
        supabase.from('voucher_approvals').select('*').order('created_at', { ascending: false })
      ]);

      if (vouchersRes.error) throw vouchersRes.error;
      if (approvalsRes.error) throw approvalsRes.error;

      setVouchers(vouchersRes.data as Voucher[]);
      setApprovals(approvalsRes.data as VoucherApproval[]);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error?.message === 'Failed to fetch' || error?.message?.includes('Failed to fetch')) {
         toast.error('Network Error: Could not connect to the database.');
      } else {
         toast.error('Failed to load vouchers data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();

    const channel = supabase.channel('public:vouchers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, payload => {
        fetchVouchers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voucher_approvals' }, payload => {
        fetchApprovals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const createVoucher = async (voucher: Partial<Voucher>) => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .insert([voucher])
        .select()
        .single();

      if (error) throw error;
      setVouchers([data as Voucher, ...vouchers]);
    } catch (error) {
      console.error('Error creating voucher:', error);
      throw error;
    }
  };

  const addApproval = async (approval: Partial<VoucherApproval>) => {
    try {
      const { data, error } = await supabase
        .from('voucher_approvals')
        .insert([approval])
        .select()
        .single();

      if (error) throw error;
      setApprovals([data as VoucherApproval, ...approvals]);
    } catch (error) {
      console.error('Error creating approval:', error);
      throw error;
    }
  };

  const updateVoucherStatus = async (
    id: string, 
    status: Voucher['status'], 
    approverEmail?: string, 
    comments?: string,
    finalAmount?: number
  ) => {
    try {
      const updates: any = { status };
      if (approverEmail) updates.approver_email = approverEmail;
      if (comments) updates.approver_comments = comments;
      if (finalAmount !== undefined) updates.final_amount = finalAmount;
      if (status === 'final_payable' || status === 'negotiated') {
        if (comments) updates.account_comments = comments;
      }

      const { data, error } = await supabase
        .from('vouchers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setVouchers(vouchers.map(v => v.id === id ? (data as Voucher) : v));
    } catch (error) {
      console.error('Error updating voucher:', error);
      throw error;
    }
  };

  const queryVoucher = async (id: string, queryNotes: string) => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .update({ is_queried: true, query_notes: queryNotes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setVouchers(vouchers.map(v => v.id === id ? (data as Voucher) : v));
    } catch (error) {
      console.error('Error querying voucher:', error);
      throw error;
    }
  };

  const updateVoucherContent = async (id: string, updates: Partial<Voucher>) => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setVouchers(vouchers.map(v => v.id === id ? (data as Voucher) : v));
    } catch (error) {
      console.error('Error updating voucher content:', error);
      throw error;
    }
  };

  return (
    <VoucherContext.Provider value={{ vouchers, approvals, loading, createVoucher, updateVoucherStatus, queryVoucher, fetchVouchers, updateVoucherContent, fetchApprovals, addApproval }}>
      {children}
    </VoucherContext.Provider>
  );
};

export const useVouchers = () => {
  const context = useContext(VoucherContext);
  if (context === undefined) {
    throw new Error('useVouchers must be used within a VoucherProvider');
  }
  return context;
};
