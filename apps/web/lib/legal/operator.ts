/**
 * Who runs Seatline — used by the imprint, privacy policy and terms.
 * A sole proprietor: the person's name and address (Swiss law requires them on the website).
 */
export const OPERATOR = {
  name: 'Kimo Strupler',
  street: 'Salomon-Landolt-Weg 5',
  place: '8193 Eglisau',
  /** Swiss company number (CHE-…), if the business is registered; '' = not shown */
  uid: '',
  email: 'hello@seatline.ch',
};

/** Date of the current legal texts (YYYY-MM-DD). Change it whenever a text changes. */
export const LEGAL_UPDATED = '2026-10-21';
