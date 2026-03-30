import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, MOCK_USERS } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { uploadFile } from '../lib/storage';
import { Task, TaskStatus, TaskPriority } from '../types';
import { format } from 'date-fns';
import { 
  Send, Image as ImageIcon, Plus, Clock, AlertCircle, 
  CheckCircle2, Circle, MoreVertical, X, Calendar, Archive
} from 'lucide-react';

const STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Review', 'Done'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export default function Workspace() {
  const { user } = useAuth();
  const { messages, sendMessage, tasks, addTask, updateTask, moveTask, deleteTask } = useWorkspace();
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Task State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('Medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !chatImage) return;
    sendMessage(chatInput, chatImage || undefined);
    setChatInput('');
    setChatImage(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const publicUrl = await uploadFile(file);
      setChatImage(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle) return;
    
    addTask({
      title: newTaskTitle,
      description: newTaskDesc,
      assigneeIds: newTaskAssignees,
      creatorId: user.id,
      priority: newTaskPriority,
      status: 'Todo',
      dueDate: newTaskDueDate || new Date().toISOString(),
    });

    setIsNewTaskModalOpen(false);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskAssignees([]);
    setNewTaskPriority('Medium');
    setNewTaskDueDate('');
  };

  const getUserName = (id: string) => {
    const u = MOCK_USERS.find(u => u.id === id);
    return u ? u.email.split('@')[0] : 'Unknown';
  };

  const workspaceUsers = MOCK_USERS.filter(u => 
    u.department === 'Facility' || u.email === 'zanklihr@gmail.com' || u.email === 'docs.zmc@gmail.com'
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Task Allocator (Kanban) */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-stone-900">Task Allocator</h2>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center ${showArchived ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}
            >
              <Archive className="w-4 h-4 mr-1" />
              {showArchived ? 'View Active' : 'View Archive'}
            </button>
          </div>
          <button
            onClick={() => setIsNewTaskModalOpen(true)}
            className="inline-flex items-center px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Task
          </button>
        </div>
        
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {STATUSES.map(status => (
              <div key={status} className="w-80 flex flex-col bg-stone-50 rounded-xl border border-stone-200">
                <div className="p-3 border-b border-stone-200 font-semibold text-stone-700 flex justify-between items-center">
                  {status}
                  <span className="bg-stone-200 text-stone-600 text-xs px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === status && (showArchived ? t.isArchived : !t.isArchived)).length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {tasks.filter(t => t.status === status && (showArchived ? t.isArchived : !t.isArchived)).map(task => (
                    <motion.div 
                      layoutId={task.id}
                      key={task.id} 
                      className="bg-white p-3 rounded-lg shadow-sm border border-stone-200 cursor-pointer hover:border-orange-300 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-stone-900 text-sm">{task.title}</h4>
                        <div className="relative group">
                          <button className="text-stone-400 hover:text-stone-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-stone-100 hidden group-hover:block z-10">
                            {!task.isArchived && STATUSES.map(s => (
                              <button
                                key={s}
                                onClick={() => moveTask(task.id, s)}
                                className="block w-full text-left px-4 py-2 text-xs text-stone-700 hover:bg-stone-50"
                              >
                                Move to {s}
                              </button>
                            ))}
                            {!task.isArchived && task.status === 'Done' && (
                              <button
                                onClick={() => updateTask(task.id, { isArchived: true })}
                                className="block w-full text-left px-4 py-2 text-xs text-orange-600 hover:bg-orange-50 border-t border-stone-100"
                              >
                                Archive
                              </button>
                            )}
                            {task.isArchived && (
                              <button
                                onClick={() => updateTask(task.id, { isArchived: false })}
                                className="block w-full text-left px-4 py-2 text-xs text-orange-600 hover:bg-orange-50 border-t border-stone-100"
                              >
                                Restore
                              </button>
                            )}
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="block w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-stone-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-stone-500 mb-3 line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex -space-x-2">
                          {task.assigneeIds.map(id => (
                            <div key={id} className="w-6 h-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-orange-700" title={getUserName(id)}>
                              {getUserName(id).charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            task.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                            task.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                            task.priority === 'Medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className="flex items-center text-[10px] text-stone-500">
                              <Calendar className="w-3 h-3 mr-0.5" />
                              {format(new Date(task.dueDate), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Chat */}
      <div className="w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50">
          <h2 className="text-lg font-bold text-stone-900">Live Chat</h2>
          <p className="text-xs text-stone-500">Facility & Admin Workspace</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
          {messages.map((msg, i) => {
            const isMe = msg.senderId === user?.id;
            const showHeader = i === 0 || messages[i - 1].senderId !== msg.senderId;
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                  <span className="text-xs font-medium text-stone-500 mb-1 px-1">
                    {isMe ? 'You' : getUserName(msg.senderId)}
                  </span>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  isMe ? 'bg-orange-600 text-white rounded-tr-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Uploaded" className="max-w-full rounded-lg mb-2" />
                  )}
                  {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                </div>
                <span className="text-[10px] text-stone-400 mt-1 px-1">
                  {format(new Date(msg.createdAt), 'h:mm a')}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-stone-200 bg-white">
          {chatImage && (
            <div className="relative inline-block mb-2">
              <img src={chatImage} alt="Preview" className="h-20 rounded-lg border border-stone-200" />
              <button 
                onClick={() => setChatImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <label className="p-2 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl cursor-pointer transition-colors">
              <ImageIcon className="w-5 h-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 max-h-32 min-h-[40px] rounded-xl border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() && !chatImage}
              className="p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* New Task Modal */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-stone-100">
              <h3 className="text-lg font-semibold text-stone-900">Create New Task</h3>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
                <input
                  required
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Assignees</label>
                <select
                  multiple
                  value={newTaskAssignees}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions, option => option.value);
                    setNewTaskAssignees(options);
                  }}
                  className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border min-h-[100px]"
                >
                  {workspaceUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
                <p className="text-xs text-stone-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-xl hover:bg-orange-700"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
