import React, { useEffect, useState } from 'react';
import type { ApiResponse, Invoice, Message } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';

interface InvoiceModalProps {
    invoice: Invoice | null;
    onClose: () => void;
    onInvoiceRefresh: () => Promise<void>;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, onClose, onInvoiceRefresh }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    // const [loading, setLoading] = useState(false); // Removed unused
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchMessages = async () => {
        if (!invoice) return;
        try {
            const response = await api.get<ApiResponse<Message[]>>(`/messages?invoiceId=${invoice._id}`);
            const sortedMessages = response.data.data.sort((a: Message, b: Message) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            setMessages(sortedMessages);
        } catch (error) {
            console.error('Failed to fetch messages', error);
        }
    };

    useEffect(() => {
        if (invoice) {
            setMessages([]); // Clear previous messages
            fetchMessages(); // Initial fetch

            const intervalId = setInterval(fetchMessages, 3000);

            return () => clearInterval(intervalId);
        }
    }, [invoice]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !invoice) return;

        const messageText = newMessage;
        setNewMessage(''); // Clear input immediately

        const tempId = Date.now().toString();
        const optimisticMsg: Message = {
            _id: tempId,
            invoice: invoice._id,
            sender: 'user',
            text: messageText,
            messageType: 'reply',
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            await api.post('/messages/reply', {
                invoiceId: invoice._id,
                text: messageText
            });
            await onInvoiceRefresh();
            fetchMessages();
        } catch (error) {
            console.error("Failed to send message", error);
            setMessages(prev => prev.filter(m => m._id !== tempId));
            alert("Failed to send message. Please try again.");
            setNewMessage(messageText);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!invoice) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-xl flex overflow-hidden ring-1 ring-slate-900/5"
                >
                    {/* Left Panel: Details */}
                    <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
                        <h2 className="text-xl font-bold text-slate-900 mb-1">{invoice.invoiceNumber}</h2>
                        <p className="text-slate-500 mb-8 font-medium">{invoice.customer.name}</p>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</label>
                                <div className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(invoice.amount)}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</label>
                                <div className="text-sm font-medium text-slate-700 mt-1">{format(new Date(invoice.dueDate), 'MMMM dd, yyyy')}</div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                                <div className="mt-2 text-sm font-medium text-slate-700">
                                    <span className="inline-block px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                                        {invoice.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors text-sm font-medium">
                                Close Details
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Conversation */}
                    <div className="flex-1 flex flex-col bg-white">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <MessageCircleIcon size={18} className="text-slate-400" /> Activity Timeline
                            </h3>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.map((msg) => {
                                const isUser = msg.sender === 'user';
                                return (
                                    <div key={msg._id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>
                                                {isUser ? <User size={14} /> : <Bot size={14} />}
                                            </div>
                                            <div>
                                                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${isUser
                                                    ? 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'
                                                    : 'bg-blue-600 text-white rounded-tr-none'
                                                    }`}>
                                                    {msg.text}
                                                </div>
                                                <div className={`text-[10px] text-slate-400 mt-1.5 ${isUser ? 'text-left' : 'text-right'}`}>
                                                    {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Simulate a customer reply..."
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow placeholder:text-slate-400"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

function MessageCircleIcon({ size, className }: { size?: number; className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
    )
}
