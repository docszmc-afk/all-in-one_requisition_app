import React, { createContext, useContext, useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { supabase } from '../lib/supabase';
import { useNotifications } from './NotificationContext';
import { toast } from 'sonner';

interface InventoryContextType {
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateStock: (id: string, quantityChange: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const INV_CACHE_KEY = 'zmc_cached_inventory';

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(INV_CACHE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const { addNotification } = useNotifications();

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) throw error;
        if (data) {
          const parsed = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            inStock: item.in_stock !== undefined ? item.in_stock : (item.inStock || 0),
            unitCost: item.unit_cost !== undefined ? item.unit_cost : (item.unitCost || 0),
          }));
          setInventory(parsed);
          try { localStorage.setItem(INV_CACHE_KEY, JSON.stringify(parsed)); } catch {}
        }
      } catch (error: any) {
        console.error('Error fetching inventory:', error);
        const hasCache = inventory.length > 0 || localStorage.getItem(INV_CACHE_KEY);
        if (error?.message === 'Failed to fetch' || error?.message?.includes('Failed to fetch')) {
          if (!hasCache) toast.error('Network Error: Could not connect to the database.');
        } else if (error?.code === '57014' || error?.message?.includes('timeout')) {
          console.warn('Inventory query timed out, served from cache');
        } else {
          if (!hasCache) toast.error('Failed to load inventory data');
        }
      }
    };
    fetchInventory();
  }, []);

  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id'>) => {
    const id = `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const newItem: InventoryItem = {
      ...itemData,
      id,
    };
    
    setInventory(prev => [...prev, newItem]);
    
    console.log('Adding inventory item:', newItem);
    
    try {
      const { error } = await supabase.from('inventory').insert({
        id,
        name: itemData.name,
        in_stock: itemData.inStock,
        unit_cost: itemData.unitCost,
      });

      if (error) {
        console.error('Error adding inventory item to Supabase:', error);
        addNotification({
          userId: 'system',
          title: 'Store Error',
          message: `Failed to save item "${itemData.name}" to database.`,
          type: 'error'
        });
      } else {
        addNotification({
          userId: 'system',
          title: 'Store Updated',
          message: `Item "${itemData.name}" saved successfully.`,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error in addInventoryItem:', error);
    }
  };

  const updateStock = async (id: string, quantityChange: number) => {
    let newStockValue: number | undefined;

    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        newStockValue = item.inStock + quantityChange;
        return { ...item, inStock: newStockValue };
      }
      return item;
    }));

    if (newStockValue !== undefined) {
      const { error } = await supabase.from('inventory').update({ in_stock: newStockValue }).eq('id', id);
      if (error) console.error('Error updating stock:', error);
    }
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
