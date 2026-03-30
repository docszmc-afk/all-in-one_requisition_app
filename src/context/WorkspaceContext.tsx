import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChatMessage, Task, TaskStatus } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface WorkspaceContextType {
  messages: ChatMessage[];
  sendMessage: (text: string, imageUrl?: string) => void;
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStatus: TaskStatus) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: chatData } = await supabase.from('workspace_chat').select('*');
      if (chatData) setMessages(chatData);
      const { data: taskData } = await supabase.from('workspace_tasks').select('*');
      if (taskData) setTasks(taskData);
    };
    fetchData();

    const chatChannel = supabase.channel('public:workspace_chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_chat' }, payload => {
        fetchData();
      })
      .subscribe();
      
    const taskChannel = supabase.channel('public:workspace_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_tasks' }, payload => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(taskChannel);
    };
  }, []);

  const sendMessage = async (text: string, imageUrl?: string) => {
    if (!user) return;
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: user.id,
      text,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);
    await supabase.from('workspace_chat').insert(newMessage);
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
    const { error } = await supabase.from('workspace_tasks').insert(newTask);
    if (error) console.error('Error adding task:', error);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
    const { error } = await supabase.from('workspace_tasks').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) console.error('Error updating task:', error);
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('workspace_tasks').delete().eq('id', id);
    if (error) console.error('Error deleting task:', error);
  };

  const moveTask = async (id: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t));
    const { error } = await supabase.from('workspace_tasks').update({ status: newStatus, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) console.error('Error moving task:', error);
  };

  return (
    <WorkspaceContext.Provider value={{ messages, sendMessage, tasks, addTask, updateTask, deleteTask, moveTask }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
