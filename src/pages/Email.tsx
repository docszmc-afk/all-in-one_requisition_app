import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, MOCK_USERS } from '../context/AuthContext';
import { useEmail } from '../context/EmailContext';
import { EmailMessage, Attachment } from '../types';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { 
  Inbox, Send, Archive, Trash2, Edit3, Paperclip, 
  Search, ArrowLeft, Reply, Download, Maximize2, X, AlertCircle, RotateCcw
} from 'lucide-react';

type Folder = 'inbox' | 'sent' | 'archive' | 'trash';

export default function Email() {
  const { user } = useAuth();
  const location = useLocation();
  const { emails, sendEmail, markAsRead, archiveEmail, deleteEmail, restoreEmail } = useEmail();
  const [currentFolder, setCurrentFolder] = useState<Folder>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);

  const isPdf = previewAttachment && (
    previewAttachment.type.toLowerCase().includes('pdf') || 
    previewAttachment.name.toLowerCase().endsWith('.pdf')
  );

  useEffect(() => {
    if (isPdf && previewAttachment?.data) {
      setPdfError(false);
      try {
        const base64Data = previewAttachment.data.includes(',') 
          ? previewAttachment.data.split(',')[1] 
          : previewAttachment.data;
        const cleanBase64 = base64Data.replace(/\s/g, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Error creating PDF blob:', e);
        setPdfUrl(null);
        setPdfError(true);
      }
    } else {
      setPdfUrl(null);
      setPdfError(false);
    }
  }, [previewAttachment, isPdf]);

  // Compose State
  const [toIds, setToIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  useEffect(() => {
    if (location.state?.composeTo || location.state?.composeSubject) {
      setIsComposing(true);
      if (location.state.composeTo) {
        const targetUser = MOCK_USERS.find(u => u.email === location.state.composeTo);
        if (targetUser) {
          setToIds([targetUser.id]);
        }
      }
      if (location.state.composeSubject) {
        setSubject(location.state.composeSubject);
      }
    }
  }, [location.state]);

  const filteredEmails = useMemo(() => {
    if (!user) return [];
    
    let folderEmails = emails.filter(email => {
      const isSender = email.senderId === user.id;
      const isRecipient = email.toIds.includes(user.id) || email.ccIds.includes(user.id) || email.bccIds.includes(user.id);
      const isDeleted = email.deletedBy.includes(user.id);
      const isArchived = email.archivedBy.includes(user.id);

      if (currentFolder === 'trash') return isDeleted;
      if (currentFolder === 'archive') return isArchived && !isDeleted;
      if (currentFolder === 'sent') return isSender && !isDeleted && !isArchived;
      if (currentFolder === 'inbox') return isRecipient && !isDeleted && !isArchived;
      
      return false;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      folderEmails = folderEmails.filter(e => 
        e.subject.toLowerCase().includes(q) || 
        e.body.toLowerCase().includes(q) ||
        MOCK_USERS.find(u => u.id === e.senderId)?.email.toLowerCase().includes(q)
      );
    }

    return folderEmails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [emails, user, currentFolder, searchQuery]);

  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmail(email);
    if (user && !email.readBy.includes(user.id)) {
      markAsRead(email.id);
    }
  };

  const handleReply = () => {
    if (!selectedEmail || !user) return;
    setToIds([selectedEmail.senderId]);
    setSubject(selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`);
    setBody(`\n\n--- Original Message ---\nFrom: ${getUserEmail(selectedEmail.senderId)}\nDate: ${format(new Date(selectedEmail.createdAt), 'PPpp')}\n\n${selectedEmail.body}`);
    setIsComposing(true);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (toIds.length === 0) {
      alert('Please select at least one recipient.');
      return;
    }
    if (!subject) {
      alert('Please enter a subject.');
      return;
    }

    sendEmail({
      senderId: user.id,
      toIds,
      ccIds,
      bccIds,
      subject,
      body,
      attachments,
      replyToId: selectedEmail?.id
    });

    setIsComposing(false);
    setToIds([]);
    setCcIds([]);
    setBccIds([]);
    setSubject('');
    setBody('');
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachments(prev => [...prev, {
            id: Math.random().toString(),
            name: file.name,
            type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            data: event.target!.result as string
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const getUserEmail = (id: string) => {
    return MOCK_USERS.find(u => u.id === id)?.email || 'Unknown User';
  };

  const getUnreadCount = (folder: Folder) => {
    if (!user) return 0;
    return emails.filter(e => {
      const isRecipient = e.toIds.includes(user.id) || e.ccIds.includes(user.id) || e.bccIds.includes(user.id);
      const isDeleted = e.deletedBy.includes(user.id);
      const isArchived = e.archivedBy.includes(user.id);
      const isUnread = !e.readBy.includes(user.id);
      
      if (folder === 'inbox') return isRecipient && !isDeleted && !isArchived && isUnread;
      return false;
    }).length;
  };

  const renderUserSelect = (label: string, value: string[], onChange: (val: string[]) => void) => {
    const availableUsers = MOCK_USERS.filter(u => u.id !== user?.id && !value.includes(u.id));
    
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</label>
        <div className="flex flex-wrap gap-2">
          {value.map(id => {
            const u = MOCK_USERS.find(user => user.id === id);
            return (
              <span key={id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                {u?.email}
                <button
                  type="button"
                  onClick={() => onChange(value.filter(v => v !== id))}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-orange-600 hover:bg-orange-200 focus:outline-none"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
        <select
          onChange={(e) => {
            if (e.target.value) {
              onChange([...value, e.target.value]);
              e.target.value = '';
            }
          }}
          className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 border bg-white"
          defaultValue=""
        >
          <option value="" disabled>Select user to add...</option>
          {availableUsers.map(u => (
            <option key={u.id} value={u.id}>{u.department} - {u.email}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-stone-200 bg-stone-50 flex flex-col">
        <div className="p-4">
          <button
            onClick={() => {
              setIsComposing(true);
              setSelectedEmail(null);
              setToIds([]);
              setCcIds([]);
              setBccIds([]);
              setSubject('');
              setBody('');
              setAttachments([]);
            }}
            className="w-full flex items-center justify-center px-4 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Compose
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {[
            { id: 'inbox', label: 'Inbox', icon: Inbox },
            { id: 'sent', label: 'Sent', icon: Send },
            { id: 'archive', label: 'Archive', icon: Archive },
            { id: 'trash', label: 'Trash', icon: Trash2 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentFolder(item.id as Folder);
                setSelectedEmail(null);
                setIsComposing(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentFolder === item.id
                  ? 'bg-orange-100 text-orange-900'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center">
                <item.icon className={`w-4 h-4 mr-3 ${currentFolder === item.id ? 'text-orange-600' : 'text-stone-400'}`} />
                {item.label}
              </div>
              {item.id === 'inbox' && getUnreadCount('inbox') > 0 && (
                <span className="bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {getUnreadCount('inbox')}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isComposing ? (
          <div className="flex-1 flex flex-col bg-white h-full">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
              <div className="flex items-center">
                <button onClick={() => setIsComposing(false)} className="mr-3 p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold text-stone-900">New Message</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setShowCc(!showCc)} className={`text-sm font-medium px-2 py-1 rounded transition-colors ${showCc ? 'bg-orange-100 text-orange-700' : 'text-stone-500 hover:bg-stone-200'}`}>CC</button>
                <button onClick={() => setShowBcc(!showBcc)} className={`text-sm font-medium px-2 py-1 rounded transition-colors ${showBcc ? 'bg-orange-100 text-orange-700' : 'text-stone-500 hover:bg-stone-200'}`}>BCC</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {renderUserSelect('To', toIds, setToIds)}
                {showCc && renderUserSelect('CC', ccIds, setCcIds)}
                {showBcc && renderUserSelect('BCC', bccIds, setBccIds)}
                
                <div>
                  <input
                    type="text"
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2.5 px-3 border"
                  />
                </div>
                
                <div>
                  <textarea
                    placeholder="Write your message here..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="block w-full rounded-lg border-stone-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-3 px-3 border resize-y min-h-[200px]"
                  />
                </div>

                {/* Attachments Upload */}
                <div>
                  <label className="flex items-center justify-center w-full h-24 border-2 border-stone-300 border-dashed rounded-xl cursor-pointer bg-stone-50 hover:bg-stone-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Paperclip className="w-6 h-6 mb-2 text-stone-400" />
                      <p className="text-sm text-stone-500"><span className="font-semibold">Click to attach files</span></p>
                    </div>
                    <input type="file" className="hidden" multiple accept=".pdf,image/*" onChange={handleFileUpload} />
                  </label>
                  
                  {attachments.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {attachments.map(att => (
                        <li key={att.id} className="flex items-center justify-between p-2 bg-stone-50 border border-stone-200 rounded-lg shadow-sm">
                          <span className="text-sm text-stone-700 truncate">{att.name}</span>
                          <button onClick={() => removeAttachment(att.id)} className="text-red-500 hover:text-red-700 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end shrink-0">
              <button
                onClick={handleSend}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </button>
            </div>
          </div>
        ) : selectedEmail ? (
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center">
                <button onClick={() => setSelectedEmail(null)} className="mr-3 p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex space-x-2">
                  <button onClick={handleReply} className="p-1.5 text-stone-500 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors" title="Reply">
                    <Reply className="w-5 h-5" />
                  </button>
                  {currentFolder !== 'archive' && currentFolder !== 'trash' && (
                    <button onClick={() => { archiveEmail(selectedEmail.id); setSelectedEmail(null); }} className="p-1.5 text-stone-500 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors" title="Archive">
                      <Archive className="w-5 h-5" />
                    </button>
                  )}
                  {currentFolder !== 'trash' && (
                    <button onClick={() => { deleteEmail(selectedEmail.id); setSelectedEmail(null); }} className="p-1.5 text-stone-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  {(currentFolder === 'trash' || currentFolder === 'archive') && (
                    <button onClick={() => { restoreEmail(selectedEmail.id); setSelectedEmail(null); }} className="p-1.5 text-stone-500 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors" title="Restore to Inbox">
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <h1 className="text-2xl font-bold text-stone-900 mb-6">{selectedEmail.subject}</h1>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-stone-100">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-lg mr-4">
                    {getUserEmail(selectedEmail.senderId).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-900">{getUserEmail(selectedEmail.senderId)}</p>
                    <p className="text-xs text-stone-500">
                      To: {selectedEmail.toIds.map(getUserEmail).join(', ')}
                      {selectedEmail.ccIds.length > 0 && ` | CC: ${selectedEmail.ccIds.map(getUserEmail).join(', ')}`}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-stone-500">
                  {format(new Date(selectedEmail.createdAt), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
              <div className="prose max-w-none text-stone-800 whitespace-pre-wrap mb-8">
                {selectedEmail.body}
              </div>

              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="mt-8 pt-6 border-t border-stone-100">
                  <h3 className="text-sm font-medium text-stone-900 flex items-center mb-4">
                    <Paperclip className="w-4 h-4 mr-2 text-stone-400" />
                    Attachments ({selectedEmail.attachments.length})
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedEmail.attachments.map((att) => (
                      <li key={att.id} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl shadow-sm hover:border-orange-300 transition-colors">
                        <div className="flex items-center space-x-3 truncate">
                          <span className="text-sm font-medium text-stone-700 truncate" title={att.name}>{att.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => setPreviewAttachment(att)} className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                            <Maximize2 className="w-4 h-4" />
                          </button>
                          <a href={att.data} download={att.name} className="p-1.5 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900 capitalize">{currentFolder}</h2>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-stone-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-stone-200 rounded-xl leading-5 bg-stone-50 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-stone-50">
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-stone-500">
                  <Inbox className="w-12 h-12 mb-4 text-stone-300" />
                  <p>No messages found in {currentFolder}.</p>
                </div>
              ) : (
                <ul className="divide-y divide-stone-200">
                  {filteredEmails.map((email) => {
                    const isUnread = user && !email.readBy.includes(user.id) && currentFolder === 'inbox';
                    return (
                      <li 
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        className={`hover:bg-orange-50 cursor-pointer transition-colors ${isUnread ? 'bg-white' : 'bg-stone-50/50'}`}
                      >
                        <div className="px-4 py-4 sm:px-6 flex items-center">
                          <div className="min-w-0 flex-1 flex items-center">
                            <div className="flex-shrink-0 mr-4">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${isUnread ? 'bg-orange-100 text-orange-700' : 'bg-stone-200 text-stone-600'}`}>
                                {getUserEmail(email.senderId).charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                              <div>
                                <p className={`text-sm truncate ${isUnread ? 'font-bold text-stone-900' : 'font-medium text-stone-600'}`}>
                                  {getUserEmail(email.senderId)}
                                </p>
                                <p className={`mt-1 flex items-center text-sm truncate ${isUnread ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>
                                  {email.subject}
                                </p>
                              </div>
                              <div className="hidden md:block">
                                <div>
                                  <p className="text-sm text-stone-500 truncate mt-1">
                                    {email.body.substring(0, 100)}...
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {email.attachments && email.attachments.length > 0 && (
                              <Paperclip className="w-4 h-4 text-stone-400" />
                            )}
                            <div className="text-sm text-stone-500 whitespace-nowrap">
                              {format(new Date(email.createdAt), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-white z-10">
              <h3 className="text-lg font-semibold text-stone-900 truncate pr-4">{previewAttachment.name}</h3>
              <div className="flex items-center space-x-2">
                {isPdf && pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                    title="Open in New Tab"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </a>
                )}
                <a
                  href={previewAttachment.data}
                  download={previewAttachment.name}
                  className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-stone-100 flex items-center justify-center relative">
              {isPdf ? (
                pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0 bg-white"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full w-full bg-stone-50 p-6">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                      <Paperclip className="w-8 h-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-medium text-stone-900 mb-2">
                      {pdfError ? 'Preview Unavailable' : 'Loading Preview...'}
                    </h3>
                    <p className="text-stone-500 text-center mb-6 max-w-sm">
                      {pdfError 
                        ? 'This PDF cannot be displayed directly. You can download it to view it.' 
                        : 'Preparing document for display...'}
                    </p>
                    <a
                      href={previewAttachment.data}
                      download={previewAttachment.name}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </a>
                  </div>
                )
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={previewAttachment.data}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
