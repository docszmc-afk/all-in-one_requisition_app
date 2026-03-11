import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseSync<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSavedData = useRef<string>(JSON.stringify(initialValue));

  const isArray = Array.isArray(initialValue);

  // Load from Supabase on mount and subscribe to changes
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isArray) {
          const { data, error } = await supabase
            .from('app_state')
            .select('data')
            .like('key', `${key}:%`);

          if (error) {
            if (error.code === '42P01') {
              console.error(`CRITICAL ERROR: Table 'app_state' does not exist in Supabase. Please create it to enable saving.`);
            } else {
              console.error(`Error loading ${key} from Supabase:`, error);
            }
          } else if (data && data.length > 0) {
            const loadedArray = data.map(row => row.data);
            // Sort by createdAt if available
            loadedArray.sort((a, b) => {
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              return 0;
            });
            lastSavedData.current = JSON.stringify(loadedArray);
            setState(loadedArray as unknown as T);
          } else {
            // Check if it's stored in the old format (single key)
            const { data: oldData, error: oldError } = await supabase
              .from('app_state')
              .select('data')
              .eq('key', key)
              .single();
            
            if (oldData && !oldError) {
              // Migrate to new format
              const oldArray = oldData.data as any[];
              
              // We must save these to the new format immediately
              const BATCH_SIZE = 10;
              for (let i = 0; i < oldArray.length; i += BATCH_SIZE) {
                const batch = oldArray.slice(i, i + BATCH_SIZE);
                await supabase
                  .from('app_state')
                  .upsert(
                    batch.map(item => ({
                      key: `${key}:${item.id}`,
                      data: item,
                      updated_at: new Date().toISOString()
                    }))
                  );
              }
              // Optionally delete the old single row to clean up
              await supabase.from('app_state').delete().eq('key', key);

              lastSavedData.current = JSON.stringify(oldArray);
              setState(oldArray as unknown as T);
            } else {
              console.log(`No remote data found for ${key}. Resetting to initial state.`);
              lastSavedData.current = JSON.stringify(initialValue);
              setState(initialValue);
            }
          }
        } else {
          // Object logic
          const { data, error } = await supabase
            .from('app_state')
            .select('data')
            .eq('key', key)
            .single();

          if (data && !error) {
            lastSavedData.current = JSON.stringify(data.data);
            setState(data.data as T);
          } else if (error && error.code === 'PGRST116') {
            console.log(`No remote data found for ${key}. Resetting to initial state.`);
            lastSavedData.current = JSON.stringify(initialValue);
            setState(initialValue);
          } else if (error && error.code === '42P01') {
             console.error(`CRITICAL ERROR: Table 'app_state' does not exist in Supabase. Please create it to enable saving.`);
          } else if (error) {
             console.error(`Error loading ${key} from Supabase:`, error);
          }
        }
      } catch (error) {
        console.error(`Failed to load ${key} from Supabase:`, error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`public:app_state:${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_state',
        },
        (payload) => {
          if (isArray) {
            if (payload.new && 'key' in payload.new && typeof payload.new.key === 'string' && payload.new.key.startsWith(`${key}:`)) {
              // Handle array item change
              setState(prev => {
                const prevArray = prev as any[];
                const newData = payload.new.data;
                const existingIndex = prevArray.findIndex(item => item.id === newData.id);
                let newArray;
                if (existingIndex >= 0) {
                  newArray = [...prevArray];
                  newArray[existingIndex] = newData;
                } else {
                  newArray = [newData, ...prevArray];
                }
                // sort
                newArray.sort((a, b) => {
                  if (a.createdAt && b.createdAt) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  }
                  return 0;
                });
                lastSavedData.current = JSON.stringify(newArray);
                return newArray as unknown as T;
              });
            } else if (payload.eventType === 'DELETE' && payload.old && 'key' in payload.old && typeof payload.old.key === 'string' && payload.old.key.startsWith(`${key}:`)) {
              // Handle array item deletion
              const deletedId = payload.old.key.split(':')[1];
              setState(prev => {
                const prevArray = prev as any[];
                const newArray = prevArray.filter(item => item.id !== deletedId);
                lastSavedData.current = JSON.stringify(newArray);
                return newArray as unknown as T;
              });
            }
          } else {
            // Object logic
            if (payload.new && 'key' in payload.new && payload.new.key === key) {
              if (payload.eventType === 'DELETE') {
                lastSavedData.current = JSON.stringify(initialValue);
                setState(initialValue);
              } else if (payload.new && 'data' in payload.new) {
                const newData = payload.new.data as T;
                lastSavedData.current = JSON.stringify(newData);
                setState(newData);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [key]);

  // Save to Supabase when state changes locally
  useEffect(() => {
    if (!isLoaded) return; // Don't overwrite Supabase with initial state before loading

    const currentStateStr = JSON.stringify(state);
    if (currentStateStr === lastSavedData.current) {
      return; // No changes to save, or change came from remote
    }

    const saveData = async () => {
      try {
        if (isArray) {
          const oldArray = JSON.parse(lastSavedData.current) as any[];
          const newArray = state as any[];
          const oldIds = new Set(oldArray.map(item => item.id));
          const newIds = new Set(newArray.map(item => item.id));

          const toDelete = oldArray.filter(item => !newIds.has(item.id));
          const toUpsert = newArray.filter(item => {
            if (!oldIds.has(item.id)) return true;
            const oldItem = oldArray.find(o => o.id === item.id);
            return JSON.stringify(oldItem) !== JSON.stringify(item);
          });

          // Delete removed items
          for (const item of toDelete) {
            await supabase.from('app_state').delete().eq('key', `${key}:${item.id}`);
          }

          // Upsert changed items in batches of 10
          const BATCH_SIZE = 10;
          for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
            const batch = toUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
              .from('app_state')
              .upsert(
                batch.map(item => ({
                  key: `${key}:${item.id}`,
                  data: item,
                  updated_at: new Date().toISOString()
                }))
              );
            if (error) {
              if (error.code === '42P01') {
                console.error(`Cannot save to Supabase: Table 'app_state' does not exist.`);
              } else {
                console.error(`Failed to save batch of ${key} to Supabase:`, error);
              }
            }
          }
          lastSavedData.current = currentStateStr;
        } else {
          const { error } = await supabase
            .from('app_state')
            .upsert({ key, data: state, updated_at: new Date().toISOString() });
          
          if (error) {
             if (error.code === '42P01') {
               console.error(`Cannot save to Supabase: Table 'app_state' does not exist.`);
             } else {
               console.error(`Failed to save ${key} to Supabase:`, error);
             }
          } else {
             lastSavedData.current = currentStateStr;
          }
        }
      } catch (error) {
        console.error(`Failed to save ${key} to Supabase:`, error);
      }
    };

    saveData();
  }, [key, state, isLoaded]);

  const forceSave = async (newState: T) => {
    try {
      if (isArray) {
        const oldArray = JSON.parse(lastSavedData.current) as any[];
        const newArray = newState as any[];
        const oldIds = new Set(oldArray.map(item => item.id));
        const newIds = new Set(newArray.map(item => item.id));

        const toDelete = oldArray.filter(item => !newIds.has(item.id));
        const toUpsert = newArray.filter(item => {
          if (!oldIds.has(item.id)) return true;
          const oldItem = oldArray.find(o => o.id === item.id);
          return JSON.stringify(oldItem) !== JSON.stringify(item);
        });

        // Delete removed items
        for (const item of toDelete) {
          await supabase.from('app_state').delete().eq('key', `${key}:${item.id}`);
        }

        // Upsert changed items in batches of 10
        const BATCH_SIZE = 10;
        let hasError = false;
        for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
          const batch = toUpsert.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from('app_state')
            .upsert(
              batch.map(item => ({
                key: `${key}:${item.id}`,
                data: item,
                updated_at: new Date().toISOString()
              }))
            );
          if (error) {
            console.error(`Failed to force save batch of ${key} to Supabase:`, error);
            hasError = true;
          }
        }
        if (!hasError) {
          lastSavedData.current = JSON.stringify(newState);
        }
      } else {
        const { error } = await supabase
          .from('app_state')
          .upsert({ key, data: newState, updated_at: new Date().toISOString() });
        if (!error) {
          lastSavedData.current = JSON.stringify(newState);
        } else {
          console.error(`Failed to force save ${key} to Supabase:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to force save ${key} to Supabase:`, error);
    }
  };

  return [state, setState, isLoaded, forceSave] as const;
}
