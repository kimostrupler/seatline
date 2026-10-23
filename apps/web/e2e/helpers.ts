import { DEMO_TENANTS } from '@seatline/shared';
import { expect, type Locator, type Page } from '@playwright/test';
import zlib from 'node:zlib';

const [alpenblick] = DEMO_TENANTS;
export const admin = { tenantId: alpenblick!.id, userId: alpenblick!.users[0].id };
export const adminHeaders = { 'x-tenant-id': admin.tenantId, 'x-user-id': admin.userId };
const headers = adminHeaders;

export interface MapSeat {
  id: string;
  label: string;
  x: number;
  y: number;
  roomId: string | null;
  rotation: number;
  currentAssignment?: unknown;
}
export interface MapData {
  floor: {
    id: string;
    scale: number | null;
    planFileKey: string | null;
    planWidth: number | null;
    deskWidth: number | null;
    seatNumbering: string;
  };
  rooms: Array<{
    id: string;
    name: string;
    polygon: Array<{ x: number; y: number }>;
    capacity?: number | null;
    equipment?: string[];
  }>;
  markers?: Array<{ id: string; kind: string; x: number; y: number; label?: string | null }>;
  seats: MapSeat[];
}

export const currentFloorId = (page: Page) => new URL(page.url()).searchParams.get('floor')!;

export async function floorMap(page: Page): Promise<MapData> {
  const res = await page.request.get(`/api/floors/${currentFloorId(page)}/map`, { headers });
  expect(res.ok()).toBe(true);
  return (await res.json()) as MapData;
}

/** Plan coordinates → screen position, using the canvas' current zoom/pan. */
export async function toScreen(canvas: Locator, p: { x: number; y: number }) {
  const view = JSON.parse((await canvas.getAttribute('data-view'))!) as {
    scale: number;
    x: number;
    y: number;
  };
  const box = (await canvas.boundingBox())!;
  return { x: box.x + view.x + p.x * view.scale, y: box.y + view.y + p.y * view.scale };
}

export async function switchUser(page: Page, name: string) {
  await page.getByTestId('dev-login').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(name) })
    .click();
}

/** A real (decodable) solid-white PNG. */
export function makePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xff)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Settings sections fold away; open one by its title. */
export const openFold = (page: Page, title: string) =>
  page.locator('summary', { hasText: title }).click();
