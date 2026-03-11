import React, { createContext, useContext } from 'react';
import { InventoryItem } from '../types';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

interface InventoryContextType {
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateStock: (id: string, quantityChange: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inventory, setInventory, , forceSaveInventory] = useSupabaseSync<InventoryItem[]>('zankli_inventory', []);

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    };
    setInventory(prev => {
      const newInv = [...prev, newItem];
      if (forceSaveInventory) forceSaveInventory(newInv);
      return newInv;
    });
  };

  const updateStock = (id: string, quantityChange: number) => {
    setInventory(prev => {
      const newInv = prev.map(item => {
        if (item.id === id) {
          return { ...item, inStock: item.inStock + quantityChange };
        }
        return item;
      });
      if (forceSaveInventory) forceSaveInventory(newInv);
      return newInv;
    });
  };

  return (
    <InventoryContext.Provider value={{ inventory, addInventoryItem, updateStock }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
