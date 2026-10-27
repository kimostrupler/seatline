import { describe, expect, it } from 'vitest';
import { headerValue, isAutomatic, isAutoSubmitted, messageIds } from './inbox.service';

describe('reading reply headers', () => {
  it('finds Message-IDs in In-Reply-To and References', () => {
    expect(messageIds('<a@seatline.ch>')).toEqual(['<a@seatline.ch>']);
    expect(messageIds(' <a@x.ch>\r\n <b@y.ch>')).toEqual(['<a@x.ch>', '<b@y.ch>']);
    expect(messageIds(undefined)).toEqual([]);
    expect(messageIds('no id here')).toEqual([]);
  });

  it('reads one header from a raw block, folded lines included', () => {
    const raw =
      'Subject: Re: hi\r\nReferences: <a@x.ch>\r\n <b@y.ch>\r\nAuto-Submitted: auto-replied\r\n\r\n';
    expect(headerValue(raw, 'References')).toBe('<a@x.ch> <b@y.ch>');
    expect(headerValue(raw, 'auto-submitted')).toBe('auto-replied');
    expect(headerValue(raw, 'In-Reply-To')).toBeUndefined();
  });

  it('knows a machine from a person', () => {
    expect(isAutoSubmitted(undefined)).toBe(false);
    expect(isAutoSubmitted('no')).toBe(false);
    expect(isAutoSubmitted('No (by hand)')).toBe(false);
    expect(isAutoSubmitted('auto-replied')).toBe(true);
    expect(isAutoSubmitted('auto-generated; owner-email')).toBe(true);
  });

  it('spots out-of-office answers by header or by subject, in three languages', () => {
    expect(isAutomatic('Auto-Submitted: auto-replied\r\n')).toBe(true);
    expect(isAutomatic('Precedence: auto_reply\r\n')).toBe(true);
    expect(isAutomatic('X-Autoreply: yes\r\n')).toBe(true);
    expect(isAutomatic('', 'Automatic reply: Who sits where?')).toBe(true);
    expect(isAutomatic('', 'Automatische Antwort: Wer sitzt wo?')).toBe(true);
    expect(isAutomatic('', 'Abwesenheitsnotiz: Wer sitzt wo?')).toBe(true);
    expect(isAutomatic('', 'Réponse automatique : Qui est assis où ?')).toBe(true);
    expect(isAutomatic('', 'Out of Office')).toBe(true);
    // a person
    expect(isAutomatic('Auto-Submitted: no\r\n', 'Re: Wer sitzt wo?')).toBe(false);
    expect(isAutomatic('', 'AW: Wer sitzt wo bei uns? Abwesenheit wäre kein Problem')).toBe(false);
  });
});
