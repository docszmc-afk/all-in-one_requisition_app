import React, { createContext, useContext, useState, useEffect } from 'react';
import { Vendor } from '../types';
import { supabase } from '../lib/supabase';

interface VendorContextType {
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id'>) => void;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    const fetchVendors = async () => {
      const { data } = await supabase.from('vendors').select('*');
      if (data) setVendors(data);
    };
    fetchVendors();
  }, []);

  const addVendor = async (vendorData: Omit<Vendor, 'id'>) => {
    const newVendor: Vendor = {
      ...vendorData,
      id: `VEND-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    };
    setVendors(prev => [...prev, newVendor]);
    await supabase.from('vendors').insert(newVendor);
  };

  return (
    <VendorContext.Provider value={{ vendors, addVendor }}>
      {children}
    </VendorContext.Provider>
  );
};

export const useVendors = () => {
  const context = useContext(VendorContext);
  if (context === undefined) {
    throw new Error('useVendors must be used within a VendorProvider');
  }
  return context;
};
