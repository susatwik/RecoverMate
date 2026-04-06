const pdfParse = require("pdf-parse");
const { GoogleGenAI } = require("@google/genai");

const RagDocument = require("./rag.model");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function chunkText(text, maxLength = 500) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk = `${currentChunk} ${paragraph}`.trim();
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function storePolicyFromFile(file) {
  if (!file) {
    throw new Error("Policy file is required");
  }

  const parsed = await pdfParse(file.buffer);
  const text = parsed.text.trim();

  if (!text || text.length < 50) {
    throw new Error("Invalid or empty policy document");
  }

  const chunks = chunkText(text).map((chunk, index) => ({
    chunkId: `${Date.now()}-${index}`,
    text: chunk,
    tokens: tokenize(chunk),
  }));

  return RagDocument.create({
    sourceName: file.originalname,
    text,
    chunks,
  });
}

async function listPolicies() {
  return RagDocument.find().sort({ createdAt: -1 });
}

function scoreChunk(chunkTokens, queryTokens) {
  if (!chunkTokens.length || !queryTokens.length) {
    return 0;
  }

  const querySet = new Set(queryTokens);
  let hits = 0;

  for (const token of chunkTokens) {
    if (querySet.has(token)) hits += 1;
  }

  return hits / Math.sqrt(chunkTokens.length * queryTokens.length);
}

async function retrieveRelevantPolicy(message, topK = 3) {
  const documents = await RagDocument.find();
  const queryTokens = tokenize(message);
  const allChunks = documents.flatMap((document) =>
    document.chunks.map((chunk) => ({
      sourceName: document.sourceName,
      text: chunk.text,
      score: scoreChunk(chunk.tokens, queryTokens),
    }))
  );

  return allChunks
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function generateDisputeReply(message, invoice) {
  const matches = await retrieveRelevantPolicy(message);
  const context = matches.map((match) => match.text).join("\n\n");

  if (!context) {
    return {
      reply:
        "I reviewed your message. We could not find a matching policy clause yet, so this invoice has been marked for manual review.",
      matches: [],
    };
  }

  if (!genAI) {
    return {
      reply: `I reviewed your dispute for invoice ${invoice.invoiceNumber}. Based on our policy, we will review the billed amount and follow up with the relevant clause shortly.`,
      matches,
    };
  }

  const prompt = `You are a billing assistant.
Use only the policy excerpts below to respond to a dispute.
Invoice: ${invoice.invoiceNumber}
Amount: ${invoice.amount}

Policy excerpts:
${context}

Customer dispute:
${message}

Return one concise response.`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return {
      reply: result.text.trim(),
      matches,
    };
  } catch (_error) {
    return {
      reply: `I reviewed your dispute for invoice ${invoice.invoiceNumber}. Based on our policy, this invoice is now marked for review and we will follow up with the matching clause.`,
      matches,
    };
  }
}

module.exports = {
  storePolicyFromFile,
  listPolicies,
  retrieveRelevantPolicy,
  generateDisputeReply,
};
