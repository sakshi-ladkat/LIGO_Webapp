//registrationutils.js
export const FIELD_MAP = {
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


export function getFieldId(key) {
  return FIELD_MAP[key] || key;
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateField(fieldId, errorMessage) {
  const field = document.getElementById(fieldId);
  if (!field) return true;

  const value = field.value.trim();
  if (!value) {
    showFieldError(fieldId, errorMessage);
    return false;
  }
  hideFieldError(fieldId);
  return true;
}

export function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorElement = field?.nextElementSibling;

  field?.classList.add('error');
  if (errorElement && errorElement.classList.contains('error-message')) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
  } else if (window.toastr) {
    toastr.error(message);
  }
}

export function hideFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorElement = field?.nextElementSibling;

  field?.classList.remove('error');
  if (errorElement && errorElement.classList.contains('error-message')) {
    errorElement.classList.remove('show');
  }
}

export function showError(message) {
  if (window.toastr) toastr.error(message);
}

