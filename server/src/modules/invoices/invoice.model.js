const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["TO_CONTACT", "PROMISED", "DISPUTED", "PAID", "CALL_REQUIRED"],
      default: "TO_CONTACT",
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "LOW",
    },
    promiseCount: {
      type: Number,
      default: 0,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    lastReminderDate: Date,
    lastContactedAt: Date,
    promisedDate: Date,
    paidAt: Date,
    invoiceDate: Date,
    pdfUrl: String,
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
