/**
 * Big media files live in Azure Blob Storage in Zurich, not in the app's image
 * (docs/azure-setup.md › Media storage). The host is allowed in the CSP's media-src.
 */
export const MEDIA_HOST = 'https://seatlinemedia3148.blob.core.windows.net';
export const VIDEO_TOUR_URL = `${MEDIA_HOST}/media/seatline-tutorial.mp4`;
