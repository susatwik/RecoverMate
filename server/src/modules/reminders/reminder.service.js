const Invoice = require("../invoices/invoice.model");
const invoiceService = require("../invoices/invoice.service");
const messageService = require("../messages/message.service");
const ReminderLog = require("./reminder.model");
const aiService = require("../ai/ai.service");

async function sendReminderForInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId).populate("customer");

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const reminderText = await aiService.generateReminderMessage(invoice);
  await messageService.createAiMessage({
    invoiceId: invoice._id,
    customerId: invoice.customer._id,
    text: reminderText,
    messageType: "reminder",
  });

  await ReminderLog.create({
    invoice: invoice._id,
    customer: invoice.customer._id,
    message: reminderText,
  });

  const updatedInvoice = await invoiceService.incrementReminder(invoice._id);

  return {
    invoice: updatedInvoice,
    reminderText,
  };
}

async function runOverdueReminders() {
  const today = new Date();
  const overdueInvoices = await Invoice.find({
    status: { $in: ["TO_CONTACT", "PROMISED", "CALL_REQUIRED"] },
    dueDate: { $lt: today },
  }).populate("customer");

  const results = [];

  for (const invoice of overdueInvoices) {
    const hasReminderToday =
      invoice.lastReminderDate &&
      new Date(invoice.lastReminderDate).toDateString() === today.toDateString();

    if (hasReminderToday) {
      continue;
    }

    results.push(await sendReminderForInvoice(invoice._id));
  }

  return results;
}

module.exports = {
  sendReminderForInvoice,
  runOverdueReminders,
};
