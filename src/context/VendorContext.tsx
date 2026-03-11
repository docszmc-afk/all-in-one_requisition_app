import React, { createContext, useContext } from 'react';
import { Vendor } from '../types';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

interface VendorContextType {
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id'>) => void;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vendors, setVendors, , forceSaveVendors] = useSupabaseSync<Vendor[]>('zankli_vendors', []);

  const addVendor = (vendorData: Omit<Vendor, 'id'>) => {
    const newVendor: Vendor = {
      ...vendorData,
      id: `VEND-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    };
    setVendors(prev => {
      const newVendors = [...prev, newVendor];
      if (forceSaveVendors) forceSaveVendors(newVendors);
      return newVendors;
    });
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
