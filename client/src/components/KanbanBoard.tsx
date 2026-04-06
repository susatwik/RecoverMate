import { memo, useEffect, useMemo, useState } from 'react';
import type { Invoice, InvoiceStatus } from '../types';
import { InvoiceCard } from './InvoiceCard';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { LayoutGroup, motion } from 'framer-motion';
import api from '../services/api';

interface KanbanBoardProps {
    invoices: Invoice[];
    onReminder: (id: string) => void;
    onMarkPaid: (id: string) => void;
    onInvoiceClick: (invoice: Invoice) => void;
    onInvoiceUpdate: () => void;
}

const COLUMNS: { id: InvoiceStatus; label: string }[] = [
    { id: 'TO_CONTACT', label: 'To Contact' },
    { id: 'PROMISED', label: 'Promised' },
    { id: 'DISPUTED', label: 'Disputed' },
    { id: 'PAID', label: 'Paid' },
];

function mapDropColumnToStatus(columnId: InvoiceStatus): InvoiceStatus {
    return columnId;
}

function KanbanBoardComponent({
    invoices,
    onReminder,
    onMarkPaid,
    onInvoiceClick,
    onInvoiceUpdate
}: KanbanBoardProps) {
    const [boardInvoices, setBoardInvoices] = useState<Invoice[]>(invoices);

    useEffect(() => {
        setBoardInvoices(invoices);
    }, [invoices]);

    const groupedInvoices = useMemo(() => {
        return COLUMNS.reduce<Record<InvoiceStatus, Invoice[]>>((acc, column) => {
            acc[column.id] = boardInvoices.filter((invoice) => {
                if (column.id === 'TO_CONTACT') {
                    return invoice.status === 'TO_CONTACT' || invoice.status === 'CALL_REQUIRED';
                }

                return invoice.status === column.id;
            });

            return acc;
        }, {
            TO_CONTACT: [],
            PROMISED: [],
            DISPUTED: [],
            PAID: [],
            CALL_REQUIRED: []
        } as Record<InvoiceStatus, Invoice[]>);
    }, [boardInvoices]);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const newStatus = mapDropColumnToStatus(destination.droppableId as InvoiceStatus);
        const previousInvoices = boardInvoices;

        setBoardInvoices((current) =>
            current.map((invoice) =>
                invoice._id === draggableId ? { ...invoice, status: newStatus } : invoice
            )
        );

        try {
            await api.patch(`/invoices/${draggableId}/status`, { status: newStatus });
        } catch (error) {
            console.error('Failed to update status', error);
            setBoardInvoices(previousInvoices);
            onInvoiceUpdate();
        }
    };

    return (
        <LayoutGroup>
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full overflow-x-auto pb-4">
                    {COLUMNS.map((column) => {
                        const columnInvoices = groupedInvoices[column.id] || [];

                        return (
                            <motion.div
                                key={column.id}
                                layout
                                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                                className="flex flex-col min-w-[280px]"
                            >
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        {column.label}
                                    </h3>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {columnInvoices.length}
                                    </span>
                                </div>

                                <Droppable droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <motion.div
                                            layout
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                                            className={`flex-1 rounded-2xl p-2 transition-colors min-h-[150px] ${snapshot.isDraggingOver ? 'bg-slate-50/80 ring-2 ring-blue-500/20' : ''}`}
                                        >
                                            <div className="space-y-3">
                                                {columnInvoices.map((invoice, index) => (
                                                    <Draggable key={invoice._id} draggableId={invoice._id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{
                                                                    ...provided.draggableProps.style,
                                                                    opacity: snapshot.isDragging ? 0.92 : 1,
                                                                }}
                                                            >
                                                                <motion.div
                                                                    layout
                                                                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                                                >
                                                                    <InvoiceCard
                                                                        invoice={invoice}
                                                                        onReminder={onReminder}
                                                                        onMarkPaid={onMarkPaid}
                                                                        onClick={onInvoiceClick}
                                                                    />
                                                                </motion.div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                {columnInvoices.length === 0 && !snapshot.isDraggingOver && (
                                                    <motion.div
                                                        layout
                                                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                                                        className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"
                                                    >
                                                        <span className="text-slate-400 text-sm font-medium">No invoices</span>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </Droppable>
                            </motion.div>
                        );
                    })}
                </div>
            </DragDropContext>
        </LayoutGroup>
    );
}

export const KanbanBoard = memo(KanbanBoardComponent);
