import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Voucher, VoucherApproval, PaymentVoucherReport } from '../types';
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
  fetchVoucherReport: () => Promise<PaymentVoucherReport[]>;
}

const VoucherContext = createContext<VoucherContextType | undefined>(undefined);

const VOUCHERS_CACHE_KEY = 'zmc_cached_vouchers';
const APPROVALS_CACHE_KEY = 'zmc_cached_voucher_approvals';

export const VoucherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    try {
      const saved = localStorage.getItem(VOUCHERS_CACHE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [approvals, setApprovals] = useState<VoucherApproval[]>(() => {
    try {
      const saved = localStorage.getItem(APPROVALS_CACHE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);

  // Helper to query Supabase with fallback for statement timeout (57014)
  const safeFetchVouchers = async (): Promise<Voucher[]> => {
    try {
      // Primary: ordered query
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // If statement timeout (57014) or slow query, try fallback without server-side ordering
        if (error.code === '57014' || error.message?.includes('timeout') || error.message?.includes('canceling statement')) {
          console.warn('Vouchers ordered query timed out. Retrying with unordered scan and client-side sorting...');
          const fallbackRes = await supabase.from('vouchers').select('*');
          if (fallbackRes.error) throw fallbackRes.error;
          const sorted = (fallbackRes.data as Voucher[] || []).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          return sorted;
        }
        throw error;
      }
      return (data as Voucher[]) || [];
    } catch (err: any) {
      if (err?.code === '57014' || err?.message?.includes('timeout')) {
        // Try unordered fallback if not already tried
        const fallbackRes = await supabase.from('vouchers').select('*');
        if (fallbackRes.data) {
          return (fallbackRes.data as Voucher[]).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      }
      throw err;
    }
  };

  const safeFetchApprovals = async (): Promise<VoucherApproval[]> => {
    try {
      // Primary: ordered query
      const { data, error } = await supabase
        .from('voucher_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '57014' || error.message?.includes('timeout') || error.message?.includes('canceling statement')) {
          console.warn('Voucher approvals ordered query timed out. Retrying with unordered scan...');
          const fallbackRes = await supabase.from('voucher_approvals').select('*');
          if (fallbackRes.error) throw fallbackRes.error;
          const sorted = (fallbackRes.data as VoucherApproval[] || []).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          return sorted;
        }
        throw error;
      }
      return (data as VoucherApproval[]) || [];
    } catch (err: any) {
      if (err?.code === '57014' || err?.message?.includes('timeout')) {
        const fallbackRes = await supabase.from('voucher_approvals').select('*');
        if (fallbackRes.data) {
          return (fallbackRes.data as VoucherApproval[]).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      }
      throw err;
    }
  };

  const fetchApprovals = async () => {
    try {
      const data = await safeFetchApprovals();
      setApprovals(data);
      try {
        localStorage.setItem(APPROVALS_CACHE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Could not cache approvals in localStorage', e);
      }
    } catch (error) {
      console.error('Error fetching voucher approvals:', error);
    }
  };

  const fetchVouchers = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoading(true);
      
      // Execute sequentially rather than concurrently to prevent Postgres resource contention/timeouts
      const vouchersData = await safeFetchVouchers();
      setVouchers(vouchersData);
      try {
        localStorage.setItem(VOUCHERS_CACHE_KEY, JSON.stringify(vouchersData));
      } catch (e) {
        console.warn('Could not cache vouchers in localStorage', e);
      }

      const approvalsData = await safeFetchApprovals();
      setApprovals(approvalsData);
      try {
        localStorage.setItem(APPROVALS_CACHE_KEY, JSON.stringify(approvalsData));
      } catch (e) {
        console.warn('Could not cache approvals in localStorage', e);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      // Check if we have cached data to serve gracefully
      const hasCachedVouchers = vouchers.length > 0 || localStorage.getItem(VOUCHERS_CACHE_KEY);
      if (error?.message === 'Failed to fetch' || error?.message?.includes('Failed to fetch')) {
        if (!hasCachedVouchers) {
          toast.error('Network Error: Could not connect to the database.');
        }
      } else if (error?.code === '57014' || error?.message?.includes('timeout')) {
        console.warn('Database statement timeout handled gracefully with cache/client fallbacks.');
      } else {
        if (!hasCachedVouchers) {
          toast.error('Failed to load vouchers data');
        }
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchVouchers();

    let timeoutId: NodeJS.Timeout | null = null;
    const debouncedFetch = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchVouchers();
      }, 500);
    };

    const channel = supabase.channel('public:vouchers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => {
        debouncedFetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voucher_approvals' }, () => {
        debouncedFetch();
      })
      .subscribe();

    return () => { 
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel); 
    };
  }, []);

  const createVoucher = async (voucher: Partial<Voucher>) => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .insert([voucher])
        .select()
        .single();

      if (error) throw error;
      const updated = [data as Voucher, ...vouchers];
      setVouchers(updated);
      try { localStorage.setItem(VOUCHERS_CACHE_KEY, JSON.stringify(updated)); } catch {}
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
      const updated = [data as VoucherApproval, ...approvals];
      setApprovals(updated);
      try { localStorage.setItem(APPROVALS_CACHE_KEY, JSON.stringify(updated)); } catch {}
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
      const updated = vouchers.map(v => v.id === id ? (data as Voucher) : v);
      setVouchers(updated);
      try { localStorage.setItem(VOUCHERS_CACHE_KEY, JSON.stringify(updated)); } catch {}
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
      const updated = vouchers.map(v => v.id === id ? (data as Voucher) : v);
      setVouchers(updated);
      try { localStorage.setItem(VOUCHERS_CACHE_KEY, JSON.stringify(updated)); } catch {}
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
      const updated = vouchers.map(v => v.id === id ? (data as Voucher) : v);
      setVouchers(updated);
      try { localStorage.setItem(VOUCHERS_CACHE_KEY, JSON.stringify(updated)); } catch {}
    } catch (error) {
      console.error('Error updating voucher content:', error);
      throw error;
    }
  };

  const fetchVoucherReport = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_voucher_report')
        .select('*');
      if (error) throw error;
      return data as PaymentVoucherReport[];
    } catch (error) {
      console.error('Error fetching voucher report:', error);
      return [];
    }
  };

  return (
    <VoucherContext.Provider value={{ vouchers, approvals, loading, createVoucher, updateVoucherStatus, queryVoucher, fetchVouchers, updateVoucherContent, fetchApprovals, addApproval, fetchVoucherReport }}>
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
