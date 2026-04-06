const { sendError, sendSuccess } = require("../../shared/http/response");
const customerService = require("./customer.service");

async function getCustomers(_req, res) {
  try {
    const customers = await customerService.listCustomers();
    return sendSuccess(res, customers);
  } catch (error) {
    return sendError(res, error.message);
  }
}

async function createCustomer(req, res) {
  try {
    const { name, phone, email, companyName } = req.body;

    if (!name) {
      return sendError(res, "Name is required", 400);
    }

    const customer = await customerService.createCustomer({
      name,
      phone,
      email,
      companyName,
    });

    return sendSuccess(res, customer, 201);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
}

module.exports = {
  getCustomers,
  createCustomer,
};
