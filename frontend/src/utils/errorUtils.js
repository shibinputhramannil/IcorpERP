/**
 * Standardized Error Extractor for Django / DRF responses and network errors.
 * Formats API errors into clean, human-readable strings for Snackbars and alerts.
 */
export function extractErrorMessage(err, defaultMsg = 'An unexpected error occurred.') {
  if (!err) return defaultMsg;
  if (typeof err === 'string') return err;

  const data = err.response?.data;
  if (!data) {
    if (err.message) return err.message;
    return defaultMsg;
  }

  // If response is plain text or HTML
  if (typeof data === 'string') {
    if (data.trim().startsWith('<')) {
      return err.response?.statusText || defaultMsg;
    }
    return data;
  }

  // Handle standard DRF detail field
  if (data.detail) {
    return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
  }

  // Handle error / message properties
  if (data.error) {
    return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  }
  if (data.message) {
    return typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
  }

  // Handle non-field errors
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
    return data.non_field_errors.join(' ');
  }

  // Handle field-level validation errors object: { fieldName: ['Error msg 1', ...] }
  if (typeof data === 'object') {
    const fieldErrors = [];
    for (const [key, value] of Object.entries(data)) {
      // Beautify key: e.g. "first_name" -> "First Name"
      const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (Array.isArray(value)) {
        fieldErrors.push(`${fieldName}: ${value.join(', ')}`);
      } else if (typeof value === 'string') {
        fieldErrors.push(`${fieldName}: ${value}`);
      } else if (typeof value === 'object' && value !== null) {
        fieldErrors.push(`${fieldName}: ${JSON.stringify(value)}`);
      }
    }
    if (fieldErrors.length > 0) {
      return fieldErrors.join(' | ');
    }
  }

  return defaultMsg;
}
