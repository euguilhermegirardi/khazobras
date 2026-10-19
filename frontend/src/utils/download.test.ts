import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_BLOB_REVOKE_MS, openBlobInNewTab } from './download';

describe('openBlobInNewTab', () => {
  const createObjectURL = vi.fn(() => 'blob:http://localhost/abc');
  const revokeObjectURL = vi.fn();
  let anchorClicks: { download: string; href: string }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    anchorClicks = [];
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      anchorClicks.push({ download: this.download, href: this.href });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('abre o blob em nova aba com noopener e revoga o object URL só depois de 60 s', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openBlobInNewTab(new Blob(['x'], { type: 'application/pdf' }));

    expect(open).toHaveBeenCalledWith('blob:http://localhost/abc', '_blank', 'noopener');
    expect(OPEN_BLOB_REVOKE_MS).toBe(60_000);
    expect(anchorClicks).toHaveLength(0);

    vi.advanceTimersByTime(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/abc');
  });

  it.each(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'IMAGE/PNG'])(
    'abre %s em nova aba',
    (type) => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      openBlobInNewTab(new Blob(['x'], { type }), 'arq');

      expect(open).toHaveBeenCalledTimes(1);
      expect(anchorClicks).toHaveLength(0);
    },
  );

  it.each([
    ['vazio', ''],
    ['text/html', 'text/html'],
    ['image/svg+xml', 'image/svg+xml'],
    ['application/octet-stream', 'application/octet-stream'],
    ['application/pdf com parâmetro extra', 'application/pdf-x'],
  ])('tipo %s não abre aba: baixa com o nome informado', (_rotulo, type) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openBlobInNewTab(new Blob(['<script>1</script>'], { type }), 'doc.bin');

    expect(open).not.toHaveBeenCalled();
    expect(anchorClicks).toEqual([{ download: 'doc.bin', href: 'blob:http://localhost/abc' }]);
    vi.advanceTimersByTime(0);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/abc');
  });

  it('sem nome informado, baixa como "arquivo"', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    openBlobInNewTab(new Blob(['x'], { type: 'text/html' }));

    expect(anchorClicks[0]?.download).toBe('arquivo');
  });
});
