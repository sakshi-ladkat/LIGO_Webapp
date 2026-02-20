// -----------------------------------------------------------------------------
// REGISTRATION UTILITIES
// -----------------------------------------------------------------------------
// This file contains shared utility functions and constants used across the
// registration module. It handles field mapping, validation, and error display.
// -----------------------------------------------------------------------------

/**
 * Maps backend database column names (keys) to frontend HTML element IDs.
 * This ensures consistency when saving/restoring data between frontend and backend.
 */
export const FIELD_MAP = {
  // Key: Backend Column Name -> Value: Frontend Element ID
  institute_id: 'institute',
  first_name: 'firstName',
  middle_name: 'middleName',
  last_name: 'lastName',
  suffix: 'suffix',
  email: 'email',
  address_line1: 'addressLine1',
  address_line2: 'addressLine2',
  address_line3: 'addressLine3',
  city: 'city',
  state: 'state',
  postal_code: 'postalCode',
  continent: 'continent',
  country: 'country',
  office_country_code: 'officeCountryCode',
  office_city_code: 'officeCityCode',
  office_number: 'officeNumber',
  fax_number: 'faxNumber',
};


/**
 * Helper function to resolve the frontend element ID from a backend key.
 * If the key exists in FIELD_MAP, returns the mapped ID; otherwise returns the key itself.
 */
export function getFieldId(key) {
  return FIELD_MAP[key] || key;
}

/**
 * Validates an email address using a standard regex pattern.
 * @param {string} email - The email address to validate.
 * @returns {boolean} - True if valid, false otherwise.
 */
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validates a form field to ensure it is not empty.
 * Displays an error message if validation fails.
 * 
 * @param {string} fieldId - The ID of the HTML element to validate.
 * @param {string} errorMessage - The message to display if validation fails.
 * @returns {boolean} - True if valid (not empty), false otherwise.
 */
export function validateField(fieldId, errorMessage) {
  const field = document.getElementById(fieldId);
  // If field doesn't exist, assume valid (or handle gracefully) to prevent crashes
  if (!field) return true;

  const value = field.value.trim();
  if (!value) {
    showFieldError(fieldId, errorMessage);
    return false;
  }
  hideFieldError(fieldId);
  return true;
}

/**
 * Displays an error message associated with a specific form field.
 * Adds 'error' class to input and 'show' class to the error message span.
 * Falls back to global toast notification if inline error element not found.
 */
export function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorElement = field?.nextElementSibling;

  field?.classList.add('error');

  // Check if the next element is indeed an error-message span
  if (errorElement && errorElement.classList.contains('error-message')) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
  } else {
    // Fallback to showToast
    if (window.showToast) window.showToast(message, 'error');
    else if (window.toastr) window.toastr.error(message);
    else console.error('Validation Error:', message);
  }
}

/**
 * Hides the error message for a specific form field.
 * Removes 'error' class from input and 'show' class from the error message span.
 */
export function hideFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorElement = field?.nextElementSibling;

  field?.classList.remove('error');
  if (errorElement && errorElement.classList.contains('error-message')) {
    errorElement.classList.remove('show');
  }
}

/**
 * Generic helper to show a global error toast message.
 */
export function showError(message) {
  if (window.toastr) toastr.error(message);
}
