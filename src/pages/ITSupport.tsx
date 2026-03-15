import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useITSupport } from '../context/ITSupportContext';
import { useProcurement } from '../context/ProcurementContext';
import { Ticket, UrgencyLevel, TicketMessage } from '../types';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, CheckCircle, XCircle, Clock, Monitor, Send, Search, Filter, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import ImageGeneration from '../components/ImageGeneration';

export default function ITSupport() {
  const { user } = useAuth();
  const { tickets, createTicket, addMessage, updateTicketStatus } = useITSupport();
  const { requests } = useProcurement();

  const [activeTab, setActiveTab] = useState<'tickets' | 'procurement' | 'image-gen'>('tickets');
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // Create Ticket Form State
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<UrgencyLevel>('Normal');

  // Resolve Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<'Resolved' | 'Unfixable' | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const isITAdmin = user?.department === 'IT Support';

  const filteredTickets = isITAdmin 
    ? tickets 
    : tickets.filter(t => t.createdBy === user?.email);

  const itProcurementRequests = requests.filter(r => r.requestType === 'IT Procurement');

  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) : null;

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    createTicket(newTicketTitle, newTicketDesc, newTicketPriority);
    setShowCreateTicket(false);
    setNewTicketTitle('');
    setNewTicketDesc('');
    setNewTicketPriority('Normal');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newMessage.trim()) return;
    addMessage(selectedTicket.id, newMessage);
    setNewMessage('');
  };

  const handleResolve = (status: 'Resolved' | 'Unfixable') => {
    if (!selectedTicket) return;
    setResolveStatus(status);
    setResolutionText('');
    setShowResolveModal(true);
  };

  const submitResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !resolveStatus || !resolutionText.trim()) return;
    
    updateTicketStatus(selectedTicket.id, resolveStatus, resolutionText);
    setShowResolveModal(false);
    setResolveStatus(null);
    setResolutionText('');
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">IT Support</h1>
          <p className="text-sm text-stone-500 mt-1">
            {isITAdmin ? 'Manage IT tickets and procurement.' : 'Request IT support and equipment.'}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('refresh_data'))}
            className="inline-flex items-center px-4 py-2 border border-stone-200 text-sm font-medium rounded-xl shadow-sm text-stone-700 bg-white hover:bg-stone-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          {isITAdmin && (
            <div className="flex bg-stone-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('tickets')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'tickets' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-900'}`}
              >
                Support Tickets
              </button>
              <button
                onClick={() => setActiveTab('procurement')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'procurement' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-900'}`}
              >
                IT Procurement
              </button>
              <button
                onClick={() => setActiveTab('image-gen')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'image-gen' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-900'}`}
              >
                Image Generation
              </button>
            </div>
          )}
          {!isITAdmin && (
            <Link
              to="/requests/new"
              state={{ prefill: { requestType: 'IT Procurement' } }}
              className="inline-flex items-center px-4 py-2 border border-stone-200 text-sm font-medium rounded-xl shadow-sm text-stone-700 bg-white hover:bg-stone-50"
            >
              <Monitor className="w-4 h-4 mr-2" />
              Request Hardware/Software
            </Link>
          )}
          <button
            onClick={() => setShowCreateTicket(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Support Ticket
          </button>
        </div>
      </div>

      {activeTab === 'tickets' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Ticket List */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-900">Tickets</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-stone-500 text-sm">No tickets found.</div>
              ) : (
                filteredTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-colors border ${selectedTicket?.id === ticket.id ? 'bg-orange-50 border-orange-200' : 'bg-white border-stone-100 hover:border-orange-200'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ticket.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                        ticket.status === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                        ticket.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {ticket.status}
                      </span>
                      <span className="text-xs text-stone-400">{format(new Date(ticket.createdAt), 'MMM d')}</span>
                    </div>
                    <h3 className="text-sm font-medium text-stone-900 truncate">{ticket.title}</h3>
                    <p className="text-xs text-stone-500 truncate">{ticket.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ticket Details / Chat */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col overflow-hidden">
            {selectedTicket ? (
              <>
                <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                  <div>
                    <h2 className="font-bold text-stone-900">{selectedTicket.title}</h2>
                    <p className="text-xs text-stone-500">Created by {selectedTicket.createdBy} • {format(new Date(selectedTicket.createdAt), 'PP p')}</p>
                  </div>
                  {isITAdmin && selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Unfixable' && (
                    <div className="flex space-x-2">
                      <button onClick={() => handleResolve('Resolved')} className="flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-medium transition-colors">
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Mark Fixed
                      </button>
                      <button onClick={() => handleResolve('Unfixable')} className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors">
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Unfixable
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-b border-stone-100 bg-stone-50/50">
                  <p className="text-sm text-stone-800">{selectedTicket.description}</p>
                  {selectedTicket.resolution && (
                    <div className={`mt-3 p-3 border rounded-lg ${selectedTicket.status === 'Resolved' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <p className={`text-xs font-bold uppercase mb-1 ${selectedTicket.status === 'Resolved' ? 'text-emerald-800' : 'text-red-800'}`}>
                        {selectedTicket.status === 'Resolved' ? 'Resolution' : 'Reason for Unfixable'}
                      </p>
                      <p className={`text-sm ${selectedTicket.status === 'Resolved' ? 'text-emerald-900' : 'text-red-900'}`}>{selectedTicket.resolution}</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedTicket.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        msg.senderId === user?.id 
                          ? 'bg-orange-600 text-white rounded-br-none' 
                          : 'bg-stone-100 text-stone-800 rounded-bl-none'
                      }`}>
                        <p>{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${msg.senderId === user?.id ? 'text-orange-200' : 'text-stone-400'}`}>
                          {format(new Date(msg.createdAt), 'p')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-stone-100">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border-stone-200 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      disabled={selectedTicket.status === 'Resolved' || selectedTicket.status === 'Unfixable'}
                    />
                    <button 
                      type="submit"
                      disabled={!newMessage.trim() || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Unfixable'}
                      className="p-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
                <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                <p>Select a ticket to view details</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'procurement' ? (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100">
             <h2 className="font-semibold text-stone-900">IT Procurement Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Requester</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-200">
                {itProcurementRequests.map(req => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">{req.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{req.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">{req.createdBy}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link to={`/requests/${req.id}`} className="text-orange-600 hover:text-orange-900">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ImageGeneration />
      )}

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">New Support Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700">Subject</label>
                <input
                  type="text"
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Description</label>
                <textarea
                  value={newTicketDesc}
                  onChange={(e) => setNewTicketDesc(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Priority</label>
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value as UrgencyLevel)}
                  className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateTicket(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve/Unfixable Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${resolveStatus === 'Resolved' ? 'text-emerald-700' : 'text-red-700'}`}>
                {resolveStatus === 'Resolved' ? 'Mark as Fixed' : 'Mark as Unfixable'}
              </h2>
              <button onClick={() => setShowResolveModal(false)} className="text-stone-400 hover:text-stone-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={submitResolution} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700">
                  {resolveStatus === 'Resolved' ? 'Resolution Details' : 'Reason for Unfixable'}
                </label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-xl border-stone-200 shadow-sm focus:ring-orange-500 focus:border-orange-500"
                  placeholder={resolveStatus === 'Resolved' ? 'Explain how the issue was resolved...' : 'Explain why the issue cannot be fixed...'}
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium text-white rounded-xl ${
                    resolveStatus === 'Resolved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
