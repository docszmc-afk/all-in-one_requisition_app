import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TaskBoard, KanbanTask, TaskComment, TaskAttachment } from '../types';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface TaskContextType {
  boards: TaskBoard[];
  tasks: KanbanTask[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  loading: boolean;
  taskSuggestions: string[];
  createBoard: (title: string, startDate?: string, endDate?: string, rolloverBoardId?: string) => Promise<TaskBoard | undefined>;
  archiveBoard: (id: string, isArchived: boolean) => Promise<void>;
  createTask: (task: Partial<KanbanTask>) => Promise<void>;
  updateTaskStatus: (id: string, status: KanbanTask['status']) => Promise<void>;
  updateTask: (id: string, updates: Partial<KanbanTask>) => Promise<void>;
  updateBoard: (id: string, title: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addComment: (taskId: string, content: string) => Promise<void>;
  addAttachment: (taskId: string, file: File) => Promise<void>;
  fetchBoards: () => Promise<void>;
  fetchTasks: (boardId: string) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskSuggestions, setTaskSuggestions] = useState<string[]>([]);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_boards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBoards(data || []);
      
      // Also fetch task suggestions
      const { data: suggestionsData } = await supabase
        .from('tasks')
        .select('title')
        .order('created_at', { ascending: false })
        .limit(300);
      if (suggestionsData) {
        setTaskSuggestions(Array.from(new Set(suggestionsData.map(t => t.title))));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (boardId: string) => {
    try {
      const { data: tasksData, error: tErr } = await supabase.from('tasks').select('*').eq('board_id', boardId);
      if (tErr) throw tErr;
      setTasks(tasksData || []);

      const { data: commentsData, error: cErr } = await supabase.from('task_comments').select('*, tasks!inner(board_id)').eq('tasks.board_id', boardId);
      if (cErr) throw cErr;
      setComments(commentsData || []);

      const { data: attData, error: aErr } = await supabase.from('task_attachments').select('*, tasks!inner(board_id)').eq('tasks.board_id', boardId);
      if (aErr) throw aErr;
      setAttachments(attData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tasks data');
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const createBoard = async (title: string, start_date?: string, end_date?: string, rolloverBoardId?: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('task_boards')
        .insert([{ title, start_date, end_date, created_by: user.id }])
        .select()
        .single();
      if (error) throw error;
      
      if (rolloverBoardId) {
        const { data: oldTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('board_id', rolloverBoardId)
          .neq('status', 'done');
          
        if (oldTasks && oldTasks.length > 0) {
          const tasksToInsert = oldTasks.map(t => ({
            board_id: data.id,
            title: t.title,
            description: t.description,
            status: t.status,
            created_by: user.id,
            created_by_email: user.email
          }));
          await supabase.from('tasks').insert(tasksToInsert);
        }
      }
      
      setBoards([data, ...boards]);
      toast.success('Board created');
      return data;
    } catch (err) {
      console.error(err);
      toast.error('Failed to create board');
    }
  };

  const archiveBoard = async (id: string, isArchived: boolean) => {
    try {
      const { data, error } = await supabase.from('task_boards').update({ is_archived: isArchived }).eq('id', id).select().single();
      if (error) throw error;
      setBoards(boards.map(b => b.id === id ? data : b));
    } catch (err) {
      console.error(err);
      toast.error('Failed to archive board');
    }
  };

  const createTask = async (task: Partial<KanbanTask>) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...task, created_by: user.id, created_by_email: user.email }])
        .select()
        .single();
      if (error) throw error;
      setTasks([...tasks, data]);
      toast.success('Task added');
      if (data.title && !taskSuggestions.includes(data.title)) {
        setTaskSuggestions(prev => [data.title, ...prev]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create task');
    }
  };

  const updateTaskStatus = async (id: string, status: KanbanTask['status']) => {
    try {
      const { data, error } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      setTasks(tasks.map(t => t.id === id ? data : t));
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    }
  };

  const updateTask = async (id: string, updates: Partial<KanbanTask>) => {
    try {
      const { data, error } = await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      setTasks(tasks.map(t => t.id === id ? data : t));
      toast.success('Task updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    }
  };

  const updateBoard = async (id: string, title: string) => {
    try {
      const { data, error } = await supabase.from('task_boards').update({ title }).eq('id', id).select().single();
      if (error) throw error;
      setBoards(boards.map(b => b.id === id ? data : b));
      toast.success('Board title updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update board');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      // Delete associated attachments and comments first to prevent foreign key constraint issues
      await supabase.from('task_attachments').delete().eq('task_id', id);
      await supabase.from('task_comments').delete().eq('task_id', id);
      
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      
      setTasks(tasks.filter(t => t.id !== id));
      toast.success('Task removed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove task');
    }
  };

  const addComment = async (taskId: string, content: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('task_comments').insert([{
        task_id: taskId,
        content,
        user_id: user.id,
        user_email: user.email
      }]).select().single();
      if (error) throw error;
      setComments([...comments, data]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add comment');
    }
  };

  const addAttachment = async (taskId: string, file: File) => {
    if (!user) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task_attachments')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('task_attachments')
        .getPublicUrl(filePath);

      const { data, error } = await supabase.from('task_attachments').insert([{
        task_id: taskId,
        file_name: file.name,
        file_url: publicUrl,
        uploaded_by: user.id,
        uploaded_by_email: user.email
      }]).select().single();
      
      if (error) throw error;
      setAttachments([...attachments, data]);
      toast.success('File attached');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload file');
    }
  };

  return (
    <TaskContext.Provider value={{
      boards, tasks, comments, attachments, loading, taskSuggestions,
      createBoard, archiveBoard, createTask, updateTaskStatus, updateTask, updateBoard, deleteTask, addComment, addAttachment,
      fetchBoards, fetchTasks
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
};
