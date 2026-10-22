import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { teamsAppId, teamsAppPackage, teamsManifest } from './manifest';

describe('Teams app package', () => {
  it('has a stable id per address and points the tab at our app', () => {
    expect(teamsAppId('app.seatline.ch')).toBe(teamsAppId('app.seatline.ch'));
    expect(teamsAppId('app.seatline.ch')).not.toBe(teamsAppId('app.other.ch'));
    expect(teamsAppId('app.seatline.ch')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const m = teamsManifest('https://app.seatline.ch/', 'client-1', 'https://seatline.ch');
    expect(m.staticTabs[0]).toMatchObject({
      contentUrl: 'https://app.seatline.ch/teams',
      scopes: ['personal'],
    });
    expect(m.validDomains).toEqual(['app.seatline.ch']);
    expect(m.webApplicationInfo).toEqual({
      id: 'client-1',
      resource: 'api://app.seatline.ch/client-1',
    });
  });

  it('zips the manifest and both icons', () => {
    const files = unzipSync(teamsAppPackage('https://app.seatline.ch', 'c', 'https://seatline.ch'));
    expect(Object.keys(files).sort()).toEqual(['color.png', 'manifest.json', 'outline.png']);
    expect(JSON.parse(strFromU8(files['manifest.json']!)).name.short).toBe('Seatline');
    // PNG signature
    expect([...files['color.png']!.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
