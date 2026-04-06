import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Plus, Check, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import type { ApiResponse, Customer, InvoiceExtractionResult } from '../types';

interface NewInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false); // Upload/Extraction loading
    const [submitting, setSubmitting] = useState(false); // Form submit loading

    // Extraction State
    const [extractionStatus, setExtractionStatus] = useState<'idle' | 'success' | 'partial' | 'failed'>('idle');
    const [statusMessage, setStatusMessage] = useState('');

    // Form State
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [customerId, setCustomerId] = useState('');

    // New Customer Fields
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchCustomers();
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setCustomerId('');
        setIsNewCustomer(false);
        setClientName('');
        setClientPhone('');
        setAmount('');
        setDueDate('');
        setInvoiceNumber('');
        setExtractionStatus('idle');
        setStatusMessage('');
    }

    const fetchCustomers = async () => {
        try {
            const res = await api.get<ApiResponse<Customer[]>>('/customers');
            setCustomers(res.data.data);
        } catch (error) {
            console.error("Failed to fetch customers", error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setExtractionStatus('idle');
        setStatusMessage('');

        try {
            const formData = new FormData();
            formData.append("file", file);
            console.log("UPLOADING FILE:", file.name, file.type, file.size);

            const res = await api.post("/invoices/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const { success, data, error } = res.data as ApiResponse<InvoiceExtractionResult | null>;

            if (!success || !data) {
                setExtractionStatus('failed');
                setStatusMessage(error || 'We couldn’t read this invoice. Please enter details manually.');
                return;
            }

            if (data.amount) setAmount(data.amount.toString());
            if (data.dueDate) setDueDate(data.dueDate);
            if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);

            if (data.customerName) {
                const existing = customers.find(c =>
                    c.name.toLowerCase() === data.customerName.toLowerCase()
                );

                if (existing) {
                    setCustomerId(existing._id);
                    setIsNewCustomer(false);
                } else {
                    setIsNewCustomer(true);
                    setCustomerId('');
                    setClientName(data.customerName);
                }
            }

            const missingFields = [];
            if (!data.amount) missingFields.push('Amount');
            if (!data.dueDate) missingFields.push('Due Date');
            if (!data.customerName) missingFields.push('Customer Name');
            if (!data.invoiceNumber) missingFields.push('Invoice Number');

            if (missingFields.length > 0) {
                setExtractionStatus('partial');
                setStatusMessage(`Some fields missing: ${missingFields.join(', ')}. Please review.`);
            } else {
                setExtractionStatus('success');
            }

        } catch (error: any) {
            console.error("Upload failed", error);
            setExtractionStatus('failed');
            setStatusMessage(error.response?.data?.error || "We couldn’t read this invoice. Please enter details manually.");
        } finally {
            setLoading(false);
            e.target.value = ""; // Reset input
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            let finalCustomerId = customerId;

            // Create New Customer if needed
            if (isNewCustomer) {
                if (!clientName.trim()) {
                    alert("Client Name is required.");
                    setSubmitting(false);
                    return;
                }
                const newCustRes = await api.post("/customers", {
                    name: clientName,
                    phone: clientPhone || null
                });
                finalCustomerId = newCustRes.data.data._id;
            }

            if (!finalCustomerId) {
                alert("Please select or create a customer.");
                setSubmitting(false);
                return;
            }

            await api.post('/invoices', {
                customerId: finalCustomerId,
                amount: Number(amount),
                dueDate,
                invoiceNumber: invoiceNumber || undefined
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to create invoice", error);
            alert("Failed to create invoice. Please check fields.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

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
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-900/5 flex flex-col max-h-[90vh]"
                >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                        <h2 className="text-lg font-bold text-slate-900">New Invoice</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="overflow-y-auto p-6 space-y-5">

                        {/* Status Banners */}
                        {extractionStatus === 'partial' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-3 text-sm text-yellow-800">
                                <AlertTriangle size={18} className="shrink-0 text-yellow-600" />
                                <p>{statusMessage}</p>
                            </div>
                        )}
                        {extractionStatus === 'failed' && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3 text-sm text-red-800">
                                <AlertTriangle size={18} className="shrink-0 text-red-600" />
                                <p>{statusMessage}</p>
                            </div>
                        )}

                        <form id="invoice-form" onSubmit={handleSubmit} className="space-y-5">

                            {/* Customer Section */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-semibold text-slate-700">Customer</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsNewCustomer(!isNewCustomer);
                                            setCustomerId('');
                                        }}
                                        className="text-xs text-blue-600 font-bold hover:underline"
                                    >
                                        {isNewCustomer ? "Select Existing" : "+ Create New"}
                                    </button>
                                </div>

                                {isNewCustomer ? (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 uppercase">Client Name *</label>
                                            <input
                                                type="text"
                                                required
                                                value={clientName}
                                                onChange={(e) => setClientName(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                                placeholder="e.g. Acme Corp"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between">
                                                Mobile Number
                                                <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={clientPhone}
                                                onChange={(e) => setClientPhone(e.target.value)}
                                                className={`w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${!clientPhone && extractionStatus !== 'idle' ? 'border-amber-300 ring-1 ring-amber-100' : ''}`}
                                                placeholder="+91..."
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={customerId}
                                        onChange={(e) => setCustomerId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                    >
                                        <option value="">Select a Customer</option>
                                        {customers.map(c => (
                                            <option key={c._id} value={c._id}>{c.name} {c.companyName ? `(${c.companyName})` : ''}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium ${!amount && extractionStatus !== 'idle' ? 'border-yellow-400' : ''}`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Due Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium ${!dueDate && extractionStatus !== 'idle' ? 'border-yellow-400' : ''}`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Invoice Number <span className="text-slate-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                    placeholder="Auto-generated if empty"
                                />
                            </div>
                        </form>

                        {/* File Upload Area */}
                        <div className="pt-2">
                            <input
                                type="file"
                                id="invoice-upload"
                                className="hidden"
                                accept=".pdf, .png, .jpg, .jpeg"
                                disabled={loading}
                                onChange={handleFileUpload}
                            />
                            <label
                                htmlFor="invoice-upload"
                                className={`border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${loading ? 'bg-slate-50 opacity-50 cursor-wait' : 'hover:bg-slate-50'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Upload size={20} className={loading ? 'animate-bounce' : ''} />
                                </div>
                                <p className="text-sm font-medium text-slate-900">{loading ? 'Analyzing Invoice...' : 'Upload Invoice PDF/Image'}</p>
                                <p className="text-xs text-slate-400 mt-1">{loading ? 'AI is reading details...' : 'Drag and drop or click to browse'}</p>
                            </label>
                        </div>

                    </div>

                    <div className="p-6 border-t border-slate-100 flex gap-3 bg-white shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="invoice-form"
                            disabled={submitting}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {submitting ? <Check size={18} className="animate-spin" /> : <Plus size={18} />}
                            Create Invoice
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
