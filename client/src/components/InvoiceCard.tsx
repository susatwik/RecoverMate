import React from 'react';
import type { Invoice } from '../types';
import { format } from 'date-fns';
import { MessageCircle, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/currency';

interface InvoiceCardProps {
    invoice: Invoice;
    onReminder: (id: string) => void;
    onMarkPaid: (id: string) => void;
    onClick: (invoice: Invoice) => void;
}

const statusStyles = {
    // Left border colors
    TO_CONTACT: 'border-l-amber-500',
    PROMISED: 'border-l-blue-500',
    DISPUTED: 'border-l-red-500',
    PAID: 'border-l-emerald-500',
    CALL_REQUIRED: 'border-l-amber-600',
};

const badgeStyles = {
    // Badge colors
    TO_CONTACT: 'bg-amber-50 text-amber-700 border-amber-200',
    PROMISED: 'bg-blue-50 text-blue-700 border-blue-200',
    DISPUTED: 'bg-red-50 text-red-700 border-red-200',
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CALL_REQUIRED: 'bg-amber-100 text-amber-800 border-amber-300',
};

export const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onReminder, onMarkPaid, onClick }) => {
    const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID';
    const daysOverdue = isOverdue ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24)) : 0;

    return (
        <motion.div
            layoutId={invoice._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className={`group relative bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.05)] transition-all cursor-pointer border-l-4 ${statusStyles[invoice.status]}`}
            onClick={() => onClick(invoice)}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-400 mb-0.5">{invoice.invoiceNumber}</span>
                    <h3 className="font-semibold text-slate-800 truncate max-w-[150px]" title={invoice.customer.name}>{invoice.customer.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                        {/* Display Mobile Number explicitly */}
                        {invoice.customer.phone ? (
                            <>
                                <span className="mr-1">📱</span>
                                {invoice.customer.phone}
                            </>
                        ) : (
                            <span className="text-slate-400 italic">No Mobile</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeStyles[invoice.status]} uppercase tracking-wide`}>
                        {invoice.status.replace('_', ' ')}
                    </div>
                    {invoice.riskLevel && invoice.riskLevel !== 'LOW' && invoice.status !== 'PAID' && (
                        <div className={`text-[10px] font-bold px-1.5 rounded ${invoice.riskLevel === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                            {invoice.riskLevel} RISK
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-baseline mb-4">
                <span className="text-xl font-bold text-slate-900">
                    {formatCurrency(invoice.amount)}
                </span>
                {isOverdue && (
                    <div className="flex items-center text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
                        <AlertCircle size={12} className="mr-1.5" />
                        {daysOverdue}d Overdue
                    </div>
                )}
            </div>

            {invoice.status === 'PROMISED' && invoice.promisedDate && (
                <div className="flex items-center text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-md mb-3 border border-blue-100">
                    <CheckCircle size={12} className="mr-1.5" />
                    Promised: {format(new Date(invoice.promisedDate), 'MMM dd')}
                </div>
            )}

            <div className="flex items-center text-sm text-slate-500 mb-4 pb-4 border-b border-slate-100">
                <Clock size={14} className="mr-2 text-slate-400" />
                <span className="font-medium">Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
            </div>

            <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {invoice.status !== 'PAID' && (
                    <>
                        <button
                            onClick={() => onReminder(invoice._id)}
                            disabled={!invoice.customer.phone}
                            className="flex-1 flex items-center justify-center py-2 px-3 rounded-lg border border-slate-200 hover:enabled:bg-slate-50 text-slate-600 transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!invoice.customer.phone ? "No Phone Number" : "Send Reminder"}
                        >
                            <MessageCircle size={14} className="mr-2" />
                            Remind
                        </button>
                        <button
                            onClick={() => onMarkPaid(invoice._id)}
                            className="flex-1 flex items-center justify-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-xs font-semibold shadow-sm"
                            title="Mark as Paid"
                        >
                            <CheckCircle size={14} className="mr-2" />
                            Mark Paid
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
};
