const Customer = require("./customer.model");

async function listCustomers() {
  return Customer.find().sort({ name: 1 });
}

async function createCustomer(payload) {
  return Customer.create({
    name: payload.name,
    phone: payload.phone || "",
    email: payload.email || "",
    companyName: payload.companyName || "",
  });
}

module.exports = {
  listCustomers,
  createCustomer,
};
