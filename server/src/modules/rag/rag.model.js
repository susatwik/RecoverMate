const mongoose = require("mongoose");

const ragDocumentSchema = new mongoose.Schema(
  {
    sourceName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
    },
    chunks: [
      {
        chunkId: {
          type: String,
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        tokens: {
          type: [String],
          default: [],
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.RagDocument || mongoose.model("RagDocument", ragDocumentSchema);
