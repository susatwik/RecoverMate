import React, { useEffect, useState } from 'react';
import { KanbanBoard } from '../components/KanbanBoard';
import type { ApiResponse, Invoice } from '../types';
import { InvoiceModal } from '../components/InvoiceModal';
import { NewInvoiceModal } from '../components/NewInvoiceModal';
import api from '../services/api';
import { Plus, Search, RefreshCw } from 'lucide-react';
import logo from '../assets/logo.png';
import { formatCurrency } from '../utils/currency';

const Dashboard: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const response = await api.get<ApiResponse<Invoice[]>>('/invoices');
            setInvoices(response.data.data);
        } catch (error) {
            console.error('Failed to fetch invoices', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = invoices.filter(invoice => {
        const query = debouncedQuery.toLowerCase();
        if (!query) return true;
        return (
            invoice.invoiceNumber.toLowerCase().includes(query) ||
            invoice.customer?.name.toLowerCase().includes(query) ||
            (invoice.customer?.phone && invoice.customer.phone.toLowerCase().includes(query)) ||
            invoice.status.toLowerCase().replace('_', ' ').includes(query) ||
            invoice.amount.toString().includes(query)
        );
    });

    const handleReminder = async (id: string) => {
        try {
            await api.post(`/reminders/invoices/${id}/send`);
            alert(`Reminder sent for invoice ${id}`);
            fetchInvoices();
        } catch (error) {
            console.error("Failed to send reminder", error);
            alert("Failed to send reminder");
        }
    };

    const handleMarkPaid = async (id: string) => {
        // Optimistic update
        setInvoices(prev => prev.map(inv =>
            inv._id === id ? { ...inv, status: 'PAID' } : inv
        ));

        try {
            await api.post(`/invoices/${id}/mark-paid`);
        } catch (e) {
            console.error("Failed to mark paid on server", e);
            fetchInvoices();
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-8 font-sans">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <img src={logo} alt="RecoverMate" className="h-12 w-auto object-contain" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">RecoverMate</h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Automated Recovery</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search invoices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-72 placeholder:text-slate-400"
                        />
                    </div>
                    <button
                        onClick={fetchInvoices}
                        className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all text-slate-500 bg-white"
                        title="Refresh"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowNewInvoiceModal(true)}
                        className="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg text-sm font-medium flex items-center transition-all shadow-sm"
                    >
                        <Plus size={18} className="mr-2" /> New Invoice
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                {[ 
                    { label: 'Total Outstanding', value: formatCurrency(invoices.reduce((acc, current) => current.status !== 'PAID' ? acc + current.amount : acc, 0)), color: 'text-slate-900' },
                    { label: 'Overdue', value: formatCurrency(invoices.reduce((acc, curr) => (new Date(curr.dueDate) < new Date() && curr.status !== 'PAID') ? acc + curr.amount : acc, 0)), color: 'text-red-600' },
                    { label: 'Promised', value: formatCurrency(invoices.filter(i => i.status === 'PROMISED').reduce((acc, curr) => acc + curr.amount, 0)), color: 'text-blue-600' },
                    { label: 'Recovery Rate', value: `${invoices.length ? Math.round((invoices.filter(i => i.status === 'PAID').length / invoices.length) * 100) : 0}%`, color: 'text-emerald-600' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-200 p-6 rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.04)] transition-shadow">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{stat.label}</div>
                        <div className={`text-3xl font-bold ${stat.color} tracking-tight`}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="h-[calc(100vh-280px)]">
                <KanbanBoard
                    invoices={filteredInvoices}
                    onReminder={handleReminder}
                    onMarkPaid={handleMarkPaid}
                    onInvoiceClick={setSelectedInvoice}
                    onInvoiceUpdate={fetchInvoices}
                />
            </div>

            <InvoiceModal
                invoice={selectedInvoice}
                onClose={() => setSelectedInvoice(null)}
                onInvoiceRefresh={fetchInvoices}
            />

            <NewInvoiceModal
                isOpen={showNewInvoiceModal}
                onClose={() => setShowNewInvoiceModal(false)}
                onSuccess={fetchInvoices}
            />
        </div>
    );
};

export default Dashboard;
