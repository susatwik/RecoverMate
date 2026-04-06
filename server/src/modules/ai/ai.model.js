const mongoose = require("mongoose");

const aiInteractionSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    purpose: {
      type: String,
      enum: ["CLASSIFY_REPLY", "GENERATE_REMINDER", "GENERATE_RESPONSE"],
      required: true,
    },
    inputText: String,
    outputText: String,
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AIInteraction ||
  mongoose.model("AIInteraction", aiInteractionSchema);
