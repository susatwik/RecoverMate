const multer = require("multer");

const { sendError, sendSuccess } = require("../../shared/http/response");
const ragService = require("./rag.service");

const upload = multer({ storage: multer.memoryStorage() });

async function uploadPolicy(req, res) {
  try {
    const policy = await ragService.storePolicyFromFile(req.file);
    return sendSuccess(
      res,
      {
        _id: policy._id,
        sourceName: policy.sourceName,
        chunkCount: policy.chunks.length,
      },
      201
    );
  } catch (error) {
    return sendError(res, error.message, 400);
  }
}

async function getPolicies(_req, res) {
  try {
    const policies = await ragService.listPolicies();
    return sendSuccess(res, policies);
  } catch (error) {
    return sendError(res, error.message);
  }
}

module.exports = {
  uploadMiddleware: upload.single("file"),
  uploadPolicy,
  getPolicies,
};
