import { describe, expect, it } from 'vitest';
import { buildTxt, generateTableName, isIpv4, parseService, pickIpv4, truncateUtf8, MAX_SERVICE_NAME_BYTES } from './lanFormat';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('generateTableName', () => {
  it('is readable and gets a random suffix', () => {
    expect(generateTableName('Ali', () => 0)).toBe("Ali's table-aaa");
  });
  it('falls back when the nickname is empty or only control characters', () => {
    expect(generateTableName('  \n\t ', () => 0)).toMatch(/^Table's table-/);
  });
  it('stays within the NSD byte limit for multi-byte names', () => {
    const name = generateTableName('احمد'.repeat(20));
    expect(bytes(name)).toBeLessThanOrEqual(MAX_SERVICE_NAME_BYTES);
    expect(name).toMatch(/-[a-z2-9]{3}$/);
  });
  it('varies with the random source', () => {
    expect(generateTableName('Ali', () => 0)).not.toBe(generateTableName('Ali', () => 0.99));
  });
});

describe('truncateUtf8', () => {
  it('never splits a character', () => {
    expect(truncateUtf8('ééé', 5)).toBe('éé');
    expect(truncateUtf8('abc', 10)).toBe('abc');
  });
});

describe('buildTxt', () => {
  it('has only version, game, host and open, with open clamped', () => {
    const txt = buildTxt({ game: 'Rummy', hostNickname: 'Ali', open: 99 });
    expect(Object.keys(txt).sort()).toEqual(['game', 'host', 'open', 'v']);
    expect(txt.open).toBe('8');
    expect(buildTxt({ game: 'x', hostNickname: 'y', open: -3 }).open).toBe('0');
    expect(buildTxt({ game: 'x', hostNickname: 'y', open: Number.NaN }).open).toBe('0');
  });
  it('caps the host nickname', () => {
    expect(buildTxt({ game: 'x', hostNickname: 'n'.repeat(100), open: 1 }).host).toHaveLength(24);
  });
});

describe('ip helpers', () => {
  it('validates IPv4', () => {
    expect(isIpv4('192.168.1.20')).toBe(true);
    expect(isIpv4('256.1.1.1')).toBe(false);
    expect(isIpv4('fe80::1')).toBe(false);
    expect(isIpv4('1.2.3')).toBe(false);
  });
  it('skips loopback, link-local, unspecified and IPv6', () => {
    expect(pickIpv4(['fe80::1', '169.254.1.1', '127.0.0.1', '0.0.0.0', '10.0.0.5'])).toBe('10.0.0.5');
    expect(pickIpv4(['fe80::1'])).toBeNull();
    expect(pickIpv4(undefined)).toBeNull();
  });
});

describe('parseService', () => {
  const good = { name: 'a-table', port: 4000, addresses: ['fe80::1', '192.168.0.9'], txt: { v: '1', game: 'Rummy', host: 'Ali', open: '2' } };
  it('parses a valid service', () => {
    expect(parseService(good)).toEqual({ name: 'a-table', host: '192.168.0.9', port: 4000, game: 'Rummy', hostNickname: 'Ali', open: 2 });
  });
  it('rejects other versions, missing txt, bad ports and no IPv4', () => {
    expect(parseService({ ...good, txt: { ...good.txt, v: '2' } })).toBeNull();
    expect(parseService({ ...good, txt: undefined })).toBeNull();
    expect(parseService({ ...good, port: 0 })).toBeNull();
    expect(parseService({ ...good, port: 70000 })).toBeNull();
    expect(parseService({ ...good, addresses: ['fe80::1'] })).toBeNull();
  });
  it('tolerates junk fields', () => {
    const t = parseService({ ...good, txt: { v: '1', game: 5, host: 'x\u0000y', open: 'lots' } });
    expect(t).toMatchObject({ game: '', hostNickname: 'x y', open: 0 });
  });
});
