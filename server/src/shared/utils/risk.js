function calculateRiskLevel(dueDate) {
  const today = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));

  if (diffDays <= 5) return "LOW";
  if (diffDays <= 30) return "MEDIUM";
  return "HIGH";
}

module.exports = {
  calculateRiskLevel,
};
