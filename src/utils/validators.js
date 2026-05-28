const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email).trim());
}

/**
 * Validate fields required on creation.
 * Returns an array of error strings (empty = valid).
 */
function validateLeadCreate(data) {
  const errors = [];

  if (!data.name || String(data.name).trim() === '') {
    errors.push('name is required');
  }
  if (!data.email || String(data.email).trim() === '') {
    errors.push('email is required');
  } else if (!isValidEmail(data.email)) {
    errors.push('email must be a valid email format');
  }

  return errors;
}

/**
 * Validate fields on a partial update (only fields present are checked).
 * Returns an array of error strings (empty = valid).
 */
function validateLeadUpdate(data) {
  const errors = [];

  if (data.name !== undefined && String(data.name).trim() === '') {
    errors.push('name cannot be empty');
  }
  if (data.email !== undefined) {
    if (String(data.email).trim() === '') {
      errors.push('email cannot be empty');
    } else if (!isValidEmail(data.email)) {
      errors.push('email must be a valid email format');
    }
  }

  return errors;
}

module.exports = { validateLeadCreate, validateLeadUpdate };
