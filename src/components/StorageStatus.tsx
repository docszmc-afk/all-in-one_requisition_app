import React, { useState, useEffect } from 'react';
import { Database, Lock, Unlock, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function StorageStatus() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const MAX_BYTES = 500 * 1024 * 1024; // 500MB

  const fetchStorage = async () => {
    setIsLoading(true);
    try {
      let total = 0;
      
      // Fetch app_state size
      const { data: appState } = await supabase.from('app_state').select('data');
      if (appState) {
        appState.forEach(row => {
          total += JSON.stringify(row.data).length;
        });
      }

      // Fetch profiles size
      const { data: profiles } = await supabase.from('profiles').select('*');
      if (profiles) {
        profiles.forEach(row => {
          total += JSON.stringify(row).length;
        });
      }

      setUsedBytes(total);
    } catch (err) {
      console.error('Error fetching storage:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchStorage();
      
      // Subscribe to changes
      const channel = supabase.channel('storage_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, fetchStorage)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStorage)
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '198713september') {
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isUnlocked) {
    return (
      <div className="mt-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="flex items-center text-stone-400 mb-3 text-sm font-medium">
          <Database className="w-4 h-4 mr-2" />
          Storage Status
        </div>
        <form onSubmit={handleUnlock} className="space-y-2">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-8 py-2 text-sm text-stone-300 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-orange-500"
            >
              <Unlock className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      </div>
    );
  }

  const usedPercentage = usedBytes !== null ? (usedBytes / MAX_BYTES) * 100 : 0;

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between text-stone-300 mb-4 text-sm font-medium">
        <div className="flex items-center">
          <Database className="w-4 h-4 mr-2 text-orange-500" />
          Storage Status
        </div>
        <button 
          onClick={fetchStorage}
          disabled={isLoading}
          className="text-stone-500 hover:text-orange-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {usedBytes === null ? (
        <div className="text-xs text-stone-500 text-center py-2">Loading...</div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-stone-400">Used</span>
              <span className="text-stone-200 font-medium">{formatBytes(usedBytes)}</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${usedPercentage > 90 ? 'bg-red-500' : usedPercentage > 75 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(usedPercentage, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-stone-400">Remaining</span>
            <span className="text-stone-200 font-medium">{formatBytes(MAX_BYTES - usedBytes)}</span>
          </div>
          
          <div className="flex justify-between text-xs pt-3 border-t border-zinc-800">
            <span className="text-stone-500">Total Capacity</span>
            <span className="text-stone-500">500 MB</span>
          </div>
        </div>
      )}
    </div>
  );
}
