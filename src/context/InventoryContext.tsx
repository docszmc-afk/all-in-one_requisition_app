import React, { createContext, useContext, useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { supabase } from '../lib/supabase';
import { useNotifications } from './NotificationContext';

interface InventoryContextType {
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateStock: (id: string, quantityChange: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const { addNotification } = useNotifications();

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) throw error;
        if (data) {
          setInventory(data.map((item: any) => ({
            id: item.id,
            name: item.name,
            inStock: item.in_stock !== undefined ? item.in_stock : (item.inStock || 0),
            unitCost: item.unit_cost !== undefined ? item.unit_cost : (item.unitCost || 0),
          })));
        }
      } catch (error) {
        console.error('Error fetching inventory:', error);
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
