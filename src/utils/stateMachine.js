// Defines every allowed "from → to" transition.
// CONVERTED and LOST are terminal — their arrays are empty.
const VALID_TRANSITIONS = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['CONVERTED', 'LOST'],
  CONVERTED: [],
  LOST: [],
};

const ALL_STATUSES = Object.keys(VALID_TRANSITIONS);

/**
 * Returns { valid: true } or { valid: false, message: string }
 */
function validateTransition(from, to) {
  if (!ALL_STATUSES.includes(from)) {
    return { valid: false, message: `Unknown current status: ${from}` };
  }
  if (!ALL_STATUSES.includes(to)) {
    return { valid: false, message: `Unknown target status: ${to}` };
  }
  if (!VALID_TRANSITIONS[from].includes(to)) {
    return {
      valid: false,
      message: `Invalid status transition from ${from} to ${to}`,
    };
  }
  return { valid: true };
}

module.exports = { validateTransition, ALL_STATUSES };
