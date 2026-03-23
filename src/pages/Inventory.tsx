import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { motion } from 'framer-motion';
import { Plus, Package, DollarSign, Layers } from 'lucide-react';
import { MoneyInput } from '../components/MoneyInput';

export default function Inventory() {
  const { inventory, addInventoryItem } = useInventory();
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    inStock: 0,
    unitCost: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addInventoryItem(newItem);
    setIsAdding(false);
    setNewItem({ name: '', inStock: 0, unitCost: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Store Management</h1>
          <p className="text-sm text-stone-500 mt-1">Manage facility inventory and stock levels.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </button>
      </div>

      {isAdding && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200"
          onSubmit={handleSubmit}
        >
          <h2 className="text-lg font-medium text-stone-900 mb-4">Add New Store Item</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700">Item Name *</label>
              <input type="text" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Initial Stock *</label>
              <input type="number" required min="0" value={newItem.inStock} onChange={e => setNewItem({...newItem, inStock: parseInt(e.target.value) || 0})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Unit Cost (₦) *</label>
              <MoneyInput required min="0" value={newItem.unitCost} onChange={val => setNewItem({...newItem, unitCost: val})} className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border border-stone-300 text-sm font-medium rounded-xl text-stone-700 bg-white hover:bg-stone-50">Cancel</button>
            <button type="submit" className="px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-orange-600 hover:bg-orange-700">Save Item</button>
          </div>
        </motion.form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Item Name</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Stock Level</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Unit Cost</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Total Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="w-5 h-5 text-stone-400 mr-3" />
                      <div className="text-sm font-medium text-stone-900">{item.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.inStock < 10 ? 'bg-red-100 text-red-800' : 
                      item.inStock < 50 ? 'bg-amber-100 text-amber-800' : 
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.inStock} units
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500 text-right">
                    ₦{(item.unitCost || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900 text-right">
                    ₦{((item.inStock || 0) * (item.unitCost || 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                    No items in inventory. Add your first item above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
