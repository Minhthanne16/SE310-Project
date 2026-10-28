import { afterEach, expect, it, vi } from 'vitest';
import { buildCsv, downloadCsv, escapeCsvCell } from './csv';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('builds CRLF-terminated CSV and escapes every cell', () => {
  expect(buildCsv(['a', 'b'], [['=1+1', 'x,"y"']])).toBe(
    `a,b\r\n'=1+1,"x,""y"""\r\n`,
  );
  expect(buildCsv(['a'], [])).toBe('a\r\n');
  expect(escapeCsvCell(null)).toBe('');
});

it('downloads with a UTF-8 BOM, the file name and revokes the URL', () => {
  vi.useFakeTimers();
  const blobs: { parts: unknown[]; options: unknown }[] = [];
  vi.stubGlobal(
    'Blob',
    class {
      constructor(parts: unknown[], options: unknown) {
        blobs.push({ parts, options });
      }
    },
  );
  const create = vi.fn(() => 'blob:test');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  let downloaded = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloaded = this.download;
  });

  downloadCsv('ds.csv', 'a\r\n');

  expect(blobs).toHaveLength(1);
  expect(blobs[0].parts).toEqual(['﻿', 'a\r\n']);
  expect(blobs[0].options).toEqual({ type: 'text/csv;charset=utf-8' });
  expect(downloaded).toBe('ds.csv');
  expect(document.querySelector('a[download]')).toBeNull();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:test');
});
