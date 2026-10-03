/**
 * Centralized Currency Formatter
 * Phase 15.1 - India-First Localization
 */

export const formatCurrency = (amount, currencyCode = 'INR') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    amount = 0;
  }

  // Handle parsing string to float if needed
  if (typeof amount === 'string') {
    amount = amount.replace(/,/g, '');
  }
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Use Indian Number formatting by default
  // Style currency with INR code will automatically use the ₹ symbol.
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(numericAmount);
};
