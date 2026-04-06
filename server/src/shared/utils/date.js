const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function getNearestWeekday(targetDay) {
  const today = new Date();
  const todayDay = today.getDay();
  let diff = targetDay - todayDay;

  if (diff <= 0) diff += 7;

  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return result;
}

function normalizeDateFromText(text) {
  if (!text) return null;

  const lower = text.toLowerCase();
  const today = new Date();

  if (lower.includes("tomorrow")) {
    const date = new Date(today);
    date.setDate(today.getDate() + 1);
    return date;
  }

  if (lower.includes("today")) {
    return today;
  }

  for (const [day, value] of Object.entries(WEEKDAYS)) {
    if (lower.includes(`next ${day}`)) {
      const date = getNearestWeekday(value);
      date.setDate(date.getDate() + 7);
      return date;
    }
  }

  for (const [day, value] of Object.entries(WEEKDAYS)) {
    if (lower.includes(day)) {
      return getNearestWeekday(value);
    }
  }

  return null;
}

module.exports = {
  normalizeDateFromText,
};
