import { describe, expect, it } from 'vitest';
import { formatDateTime } from './dates';

describe('formatDateTime', () => {
  it('mostra dd/mm/aaaa e hh:mm, sem vírgula (o fuso é o do navegador)', () => {
    expect(formatDateTime('2026-10-21T15:30:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
});
