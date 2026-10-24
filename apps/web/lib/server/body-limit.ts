/**
 * Public routes must not read a body of any size into memory (a few big posts would take the
 * web app down). Browsers always send Content-Length for small JSON posts and beacons; a
 * missing or oversized one is refused before the body is read.
 */
export const tooLarge = (req: Pick<Request, 'headers'>, maxBytes: number): boolean => {
  const length = Number(req.headers.get('content-length'));
  return !Number.isFinite(length) || length <= 0 || length > maxBytes;
};
