/**
 * Who runs Seatline — used by the imprint, privacy policy and terms.
 * Fill in the [placeholders] before the first paying customer (see docs/legal.md).
 */
export const OPERATOR = {
  name: '[Name or company]',
  street: '[Street and number]',
  place: '[Postcode and town]',
  /** Swiss company number (CHE-…), if the business is registered; '' = not shown */
  uid: '',
  email: 'hello@seatline.ch',
};

/** Date of the current legal texts (YYYY-MM-DD). Change it whenever a text changes. */
export const LEGAL_UPDATED = '2026-10-21';
