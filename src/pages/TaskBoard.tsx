import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import { KanbanTask } from '../types';
import { Plus, Archive, XCircle, MoreVertical, Paperclip, MessageSquare, Clock, Calendar, Trash2 } from 'lucide-react';

export default function TaskBoard() {
  const { user } = useAuth();
  const { boards, tasks, comments, attachments, loading, taskSuggestions, fetchTasks, createBoard, archiveBoard, createTask, updateTaskStatus, updateTask, updateBoard, deleteTask, addComment, addAttachment } = useTasks();
  
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardTitle, setEditingBoardTitle] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState<string>('');
  
  // Board form
  const [newBoard, setNewBoard] = useState({ title: '', start_date: '', end_date: '' });
  const [rolloverUnfinished, setRolloverUnfinished] = useState(false);
  // Task form
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [newComment, setNewComment] = useState('');
  
  const isAuthorized = user?.department === 'Facility' || user?.email === 'zanklihr@gmail.com' || user?.email === 'docs.zmc@gmail.com';

  useEffect(() => {
    if (boards.length > 0 && !selectedBoardId) {
      const activeBoards = boards.filter(b => !b.is_archived);
      if (activeBoards.length > 0) {
        setSelectedBoardId(activeBoards[0].id);
      }
    }
  }, [boards]);

  useEffect(() => {
    if (selectedBoardId) {
      fetchTasks(selectedBoardId);
    }
  }, [selectedBoardId]);

  if (!isAuthorized) {
    return <div className="p-8 text-center text-stone-500">You do not have access to Task Management.</div>;
  }

  const activeBoards = boards.filter(b => b.is_archived === showArchived);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const prevBoardId = boards.find(b => !b.is_archived)?.id;
    const createdBoard = await createBoard(
      newBoard.title, 
      newBoard.start_date, 
      newBoard.end_date, 
      rolloverUnfinished ? prevBoardId : undefined
    );
    if (createdBoard) {
      setSelectedBoardId(createdBoard.id);
    }
    setIsCreateBoardOpen(false);
    setNewBoard({ title: '', start_date: '', end_date: '' });
    setRolloverUnfinished(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoardId) return;
    await createTask({ board_id: selectedBoardId, title: newTask.title, description: newTask.description });
    setNewTask({ title: '', description: '' });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    await addComment(selectedTask.id, newComment);
    setNewComment('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.[0]) return;
    await addAttachment(selectedTask.id, e.target.files[0]);
    e.target.value = ''; // reset
  };

  const currentBoard = boards.find(b => b.id === selectedBoardId);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, status: KanbanTask['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      await updateTaskStatus(taskId, status);
    }
  };

  const columns: { id: KanbanTask['status'], title: string }[] = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'done', title: 'Done' }
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100dvh-64px)] flex flex-col">
      <datalist id="task-suggestions">
        {taskSuggestions.map((suggestion, idx) => (
          <option key={idx} value={suggestion} />
        ))}
      </datalist>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-stone-100 gap-3 md:gap-4 mb-4 md:mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center">
            <Calendar className="w-6 h-6 mr-3 text-orange-500" />
            Weekly Task Board
          </h1>
          <p className="text-stone-500 mt-1">Manage tasks for facility and projects</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
          <select 
            value={selectedBoardId} 
            onChange={(e) => setSelectedBoardId(e.target.value)}
            className="px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 text-sm flex-1 md:w-48"
          >
            <option value="" disabled>Select a Week...</option>
            {activeBoards.map(b => (
              <option key={b.id} value={b.id}>{b.title} {b.is_archived ? '(Archived)' : ''}</option>
            ))}
          </select>
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className="p-2.5 bg-white border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition-colors"
            title={showArchived ? "Show Active Boards" : "Show Archived Boards"}
          >
            <Archive className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsCreateBoardOpen(true)}
            className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" /> New Week
          </button>
        </div>
      </div>

      {/* Kanban Board Area */}
      {selectedBoardId && currentBoard ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4 shrink-0 px-2">
            {editingBoardId === currentBoard.id ? (
              <input 
                autoFocus
                className="text-lg font-bold text-stone-700 bg-white border border-stone-300 rounded px-2 py-1 -ml-2 w-full max-w-sm"
                value={editingBoardTitle}
                onChange={e => setEditingBoardTitle(e.target.value)}
                onBlur={async () => {
                  if (editingBoardTitle.trim() && editingBoardTitle !== currentBoard.title) {
                    await updateBoard(currentBoard.id, editingBoardTitle.trim());
                  }
                  setEditingBoardId(null);
                }}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    if (editingBoardTitle.trim() && editingBoardTitle !== currentBoard.title) {
                      await updateBoard(currentBoard.id, editingBoardTitle.trim());
                    }
                    setEditingBoardId(null);
                  } else if (e.key === 'Escape') {
                    setEditingBoardId(null);
                  }
                }}
              />
            ) : (
              <h2 
                className="text-lg font-bold text-stone-700 cursor-pointer hover:bg-stone-100 px-2 py-1 -ml-2 rounded transition-colors"
                onClick={() => {
                  setEditingBoardTitle(currentBoard.title);
                  setEditingBoardId(currentBoard.id);
                }}
                title="Click to edit board title"
              >
                {currentBoard.title}
              </h2>
            )}
            {!currentBoard.is_archived && (
              <button 
                onClick={() => archiveBoard(currentBoard.id, true)}
                className="text-sm text-stone-500 hover:text-stone-800 flex items-center"
              >
                <Archive className="w-4 h-4 mr-1" /> Archive Week
              </button>
            )}
            {currentBoard.is_archived && (
              <button 
                onClick={() => archiveBoard(currentBoard.id, false)}
                className="text-sm text-stone-500 hover:text-stone-800 flex items-center"
              >
                <Archive className="w-4 h-4 mr-1" /> Unarchive Week
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-x-auto pb-4 snap-x snap-mandatory">
            <div className="flex gap-4 md:gap-6 h-full min-w-max px-4 md:px-2">
              {columns.map(col => {
                const colTasks = tasks.filter(t => t.status === col.id);
                return (
                  <div 
                    key={col.id} 
                    className={`w-[85vw] max-w-[320px] md:w-80 flex flex-col rounded-2xl border shrink-0 h-full snap-center md:snap-align-none transition-colors ${draggedTaskId ? 'bg-orange-50/50 border-orange-200 border-dashed' : 'bg-stone-100/50 border-stone-200/60'}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    <div className="p-4 flex justify-between items-center border-b border-stone-200/60 bg-stone-50/50 rounded-t-2xl">
                      <h3 className="font-bold text-stone-700">{col.title}</h3>
                      <span className="bg-white text-stone-500 px-2.5 py-0.5 rounded-full text-xs font-bold border border-stone-200 shadow-sm">{colTasks.length}</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {colTasks.map(task => {
                        const taskComments = comments.filter(c => c.task_id === task.id);
                        const taskAtts = attachments.filter(a => a.task_id === task.id);
                        const imageThumbnail = taskAtts.find(a => /\.(jpg|jpeg|png|gif|webp)$/i.test(a.file_name));
                        
                        return (
                          <div 
                            key={task.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={() => setDraggedTaskId(null)}
                            onClick={() => { setSelectedTask(task); setIsTaskModalOpen(true); }}
                            className={`bg-white p-4 rounded-xl shadow-sm border border-stone-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-orange-300 transition-all group ${draggedTaskId === task.id ? 'opacity-40 scale-95' : 'opacity-100'}`}
                          >
                            {imageThumbnail && (
                              <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-stone-100 border border-stone-100">
                                <img src={imageThumbnail.file_url} alt="Attachment thumbnail" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <h4 className="font-semibold text-stone-800 mb-2">{task.title}</h4>
                            {task.description && (
                              <p className="text-xs text-stone-500 line-clamp-2 mb-3">{task.description}</p>
                            )}
                            <div className="flex justify-between items-center text-xs text-stone-400 font-medium">
                              <span className="truncate max-w-[120px] text-orange-600">{task.created_by_email.split('@')[0]}</span>
                              <div className="flex items-center gap-3">
                                {taskAtts.length > 0 && <span className="flex items-center"><Paperclip className="w-3.5 h-3.5 mr-1" />{taskAtts.length}</span>}
                                {taskComments.length > 0 && <span className="flex items-center"><MessageSquare className="w-3.5 h-3.5 mr-1" />{taskComments.length}</span>}
                              </div>
                            </div>
                            
                            {/* Quick Action Buttons for moving tasks */}
                            <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              {col.id !== 'todo' && <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'todo'); }} className="flex-1 py-2 md:py-1.5 bg-stone-50 text-stone-600 rounded-lg text-xs hover:bg-stone-200 font-medium">To Do</button>}
                              {col.id !== 'in_progress' && <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'in_progress'); }} className="flex-1 py-2 md:py-1.5 bg-stone-50 text-stone-600 rounded-lg text-xs hover:bg-stone-200 font-medium">Progress</button>}
                              {col.id !== 'done' && <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'done'); }} className="flex-1 py-2 md:py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs hover:bg-emerald-100 font-medium">Done</button>}
                            </div>
                          </div>
                        );
                      })}
                      
                      {col.id === 'todo' && !currentBoard.is_archived && (
                        <div className="bg-white/50 border border-dashed border-stone-300 rounded-xl p-3 flex flex-col">
                          <input 
                            type="text" 
                            list="task-suggestions"
                            placeholder="Add a new task..."
                            className="w-full bg-transparent text-sm font-medium focus:outline-none mb-2"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter' && newTask.title) handleCreateTask(e); }}
                          />
                          <button onClick={handleCreateTask} disabled={!newTask.title} className="text-xs text-orange-600 font-bold self-end disabled:opacity-50">Add</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-stone-400">
          <p>Select or create a week to view tasks.</p>
        </div>
      )}

      {/* Create Board Modal */}
      {isCreateBoardOpen && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-end md:items-center justify-center z-50 md:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Create New Week</h2>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Title</label>
                <input required type="text" value={newBoard.title} onChange={e => setNewBoard({...newBoard, title: e.target.value})} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl" placeholder="Week of Aug 15" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-1">Start Date</label>
                  <input type="date" value={newBoard.start_date} onChange={e => setNewBoard({...newBoard, start_date: e.target.value})} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-1">End Date</label>
                  <input type="date" value={newBoard.end_date} onChange={e => setNewBoard({...newBoard, end_date: e.target.value})} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl" />
                </div>
              </div>
              
              {boards.some(b => !b.is_archived) && (
                <div className="pt-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={rolloverUnfinished}
                      onChange={(e) => setRolloverUnfinished(e.target.checked)}
                      className="w-5 h-5 rounded border-stone-300 text-orange-500 focus:ring-orange-500" 
                    />
                    <span className="text-sm font-medium text-stone-700">Roll over unfinished tasks from the previous week</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreateBoardOpen(false)} className="px-4 py-2 bg-stone-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-stone-900 text-white rounded-xl">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {isTaskModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90dvh]">
            <div className="p-5 md:p-6 border-b border-stone-100 flex justify-between items-start">
              <div className="flex-1 mr-4">
                {editingTaskId === selectedTask.id ? (
                  <input
                    autoFocus
                    className="text-2xl font-bold text-stone-800 bg-white border border-stone-300 rounded px-2 py-1 -ml-2 w-full"
                    value={editingTaskTitle}
                    onChange={e => setEditingTaskTitle(e.target.value)}
                    onBlur={async () => {
                      if (editingTaskTitle.trim() && editingTaskTitle !== selectedTask.title) {
                        await updateTask(selectedTask.id, { title: editingTaskTitle.trim() });
                        setSelectedTask({ ...selectedTask, title: editingTaskTitle.trim() });
                      }
                      setEditingTaskId(null);
                    }}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        if (editingTaskTitle.trim() && editingTaskTitle !== selectedTask.title) {
                          await updateTask(selectedTask.id, { title: editingTaskTitle.trim() });
                          setSelectedTask({ ...selectedTask, title: editingTaskTitle.trim() });
                        }
                        setEditingTaskId(null);
                      } else if (e.key === 'Escape') {
                        setEditingTaskId(null);
                      }
                    }}
                  />
                ) : (
                  <h2 
                    className="text-2xl font-bold text-stone-800 cursor-pointer hover:bg-stone-50 px-2 py-1 -ml-2 rounded transition-colors"
                    onClick={() => {
                      setEditingTaskTitle(selectedTask.title);
                      setEditingTaskId(selectedTask.id);
                    }}
                    title="Click to edit task title"
                  >
                    {selectedTask.title}
                  </h2>
                )}
                <div className="text-sm text-stone-500 mt-1 flex items-center">
                  <span className="bg-stone-100 px-2 py-1 rounded text-xs font-semibold mr-2">{selectedTask.status.replace('_', ' ').toUpperCase()}</span>
                  Created by {selectedTask.created_by_email}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to completely remove this task? This cannot be undone.')) {
                      await deleteTask(selectedTask.id);
                      setIsTaskModalOpen(false);
                      setSelectedTask(null);
                    }
                  }} 
                  className="text-stone-400 hover:text-red-600 p-2"
                  title="Delete Task"
                >
                  <Trash2 className="w-5 h-5"/>
                </button>
                <button onClick={() => { setIsTaskModalOpen(false); setSelectedTask(null); }} className="text-stone-400 hover:text-stone-600 p-2">
                  <XCircle className="w-6 h-6"/>
                </button>
              </div>
            </div>
            
            <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-6 md:space-y-8">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">Description</h3>
                <p className="text-stone-700 text-sm whitespace-pre-wrap bg-stone-50 p-4 rounded-xl border border-stone-100">{selectedTask.description || 'No description provided.'}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">Attachments</h3>
                  <label className="cursor-pointer text-sm font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1 rounded-lg">
                    <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
                    + Add File
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {attachments.filter(a => a.task_id === selectedTask.id).map(a => (
                    <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" className="block border border-stone-200 rounded-xl p-3 hover:border-orange-300 transition-colors">
                      <div className="flex items-center mb-2 text-stone-500">
                        <Paperclip className="w-4 h-4 mr-2" />
                        <span className="text-xs truncate font-medium">{a.file_name}</span>
                      </div>
                      {a.file_name.match(/\.(jpeg|jpg|gif|png)$/i) && (
                        <div className="h-20 bg-stone-100 rounded bg-cover bg-center" style={{ backgroundImage: `url(${a.file_url})` }} />
                      )}
                    </a>
                  ))}
                  {attachments.filter(a => a.task_id === selectedTask.id).length === 0 && (
                    <div className="col-span-full text-sm text-stone-400 py-2">No attachments yet.</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-3">Comments</h3>
                <div className="space-y-4 mb-4">
                  {comments.filter(c => c.task_id === selectedTask.id).map(c => (
                    <div key={c.id} className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-stone-800 text-sm">{c.user_email.split('@')[0]}</span>
                        <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-stone-700 text-sm">{c.content}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Write a comment..." className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 text-sm" />
                  <button type="submit" disabled={!newComment.trim()} className="px-5 py-2.5 bg-stone-900 text-white rounded-xl font-medium disabled:opacity-50">Send</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
