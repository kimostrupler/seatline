import { describe, expect, it } from 'vitest';
import {
  headerValue,
  htmlToText,
  isAutomatic,
  isAutoSubmitted,
  messageIds,
  textPart,
  withoutQuote,
} from './inbox.service';

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

  it('reads a reply: the text part, HTML made plain, the quoted e-mail cut off', () => {
    expect(
      textPart({
        type: 'multipart/mixed',
        childNodes: [
          {
            type: 'multipart/alternative',
            childNodes: [
              { type: 'text/html', part: '1.2' },
              { type: 'text/plain', part: '1.1' },
            ],
          },
          { type: 'text/plain', part: '2', disposition: 'attachment' },
        ],
      }),
    ).toEqual({ part: '1.1', html: false });
    expect(textPart({ type: 'text/html' })).toEqual({ part: '1', html: true });
    expect(textPart({ type: 'image/png', part: '2' })).toBeNull();

    expect(
      htmlToText(
        '<style>p{}</style><p>Guten Tag&nbsp;Herr&nbsp;Strupler</p><p>Gerne &amp; bald</p>',
      ),
    ).toBe('Guten Tag Herr Strupler\nGerne & bald');

    expect(
      withoutQuote(
        'Gerne, rufen Sie mich an.\n\nAm 27.10.2026 um 08:00 schrieb Kimo:\n> Guten Tag',
      ),
    ).toBe('Gerne, rufen Sie mich an.');
    expect(withoutQuote('Merci !\nDe : Kimo <hello@seatline.ch>\nObjet : …')).toBe('Merci !');
    expect(withoutQuote('Thanks!\n-----Original Message-----\nFrom: x')).toBe('Thanks!');
    expect(withoutQuote('> only quoted')).toBe('> only quoted');
  });
});
