import React, { createContext, useContext, useEffect } from 'react';
import { ChatMessage, Task, TaskStatus } from '../types';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

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
  
  const [messages, setMessages, , forceSaveMessages] = useSupabaseSync<ChatMessage[]>('zmc_chat', []);
  const [tasks, setTasks, , forceSaveTasks] = useSupabaseSync<Task[]>('zmc_tasks', []);

  const sendMessage = (text: string, imageUrl?: string) => {
    if (!user) return;
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: user.id,
      text,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => {
      const newMsgs = [...prev, newMessage];
      if (forceSaveMessages) forceSaveMessages(newMsgs);
      return newMsgs;
    });
  };

  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(prev => {
      const newTasks = [newTask, ...prev];
      if (forceSaveTasks) forceSaveTasks(newTasks);
      return newTasks;
    });
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const newTasks = prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t);
      if (forceSaveTasks) forceSaveTasks(newTasks);
      return newTasks;
    });
  };

  const deleteTask = (id: string) => {
    setTasks(prev => {
      const newTasks = prev.filter(t => t.id !== id);
      if (forceSaveTasks) forceSaveTasks(newTasks);
      return newTasks;
    });
  };

  const moveTask = (id: string, newStatus: TaskStatus) => {
    setTasks(prev => {
      const newTasks = prev.map(t => t.id === id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t);
      if (forceSaveTasks) forceSaveTasks(newTasks);
      return newTasks;
    });
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
