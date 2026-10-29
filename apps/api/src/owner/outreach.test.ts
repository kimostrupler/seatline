import {
  draftMessage,
  isNo,
  isNoAnswer,
  messageProblem,
  nextSendSlot,
  nextStep,
  wordCount,
  zurichTime,
  leadScore,
  ownLinesRemoved,
} from '@seatline/shared/dist/outreach';
import { describe, expect, it } from 'vitest';
import { outreachHtml, replyKey } from './leads.service';

const lead = {
  company: 'Livingdocs',
  greeting: 'Herr van der Ploeg',
  whyNow: 'Ich habe gesehen, dass Livingdocs weiter wächst.',
  address: 'Tellstrasse 31, 8004 Zürich',
  language: 'de' as const,
};

describe('outreach rules', () => {
  it('sends on the next Tuesday to Thursday at 8 am Zurich, summer or winter', () => {
    // Monday → Tuesday 08:00 (CET = 07:00 UTC)
    expect(nextSendSlot(new Date('2026-10-26T10:00:00Z')).toISOString()).toBe(
      '2026-10-27T07:00:00.000Z',
    );
    // Tuesday after 8 → Wednesday; Thursday after 8 → next Tuesday
    expect(nextSendSlot(new Date('2026-10-27T08:00:00Z')).toISOString()).toBe(
      '2026-10-28T07:00:00.000Z',
    );
    expect(nextSendSlot(new Date('2026-10-29T09:00:00Z')).toISOString()).toBe(
      '2026-11-03T07:00:00.000Z',
    );
    // summer time (CEST = 06:00 UTC)
    expect(nextSendSlot(new Date('2026-07-01T05:00:00Z')).toISOString()).toBe(
      '2026-07-01T06:00:00.000Z',
    );
    expect(zurichTime('2026-03-29', 8).toISOString()).toBe('2026-03-29T06:00:00.000Z');
  });

  it('fills the template, and keeps a placeholder for what the lead doesn’t have yet', () => {
    const d = draftMessage('first', lead);
    expect(d.subject).toBe('Wer sitzt wo bei Livingdocs?');
    expect(d.body).toContain('Guten Tag Herr van der Ploeg');
    // personal and short: a question, the free set-up offer; no price, no link
    expect(d.body).toContain('Wie behalten Sie heute den Überblick, wer bei Livingdocs wo sitzt?');
    expect(d.body).toContain('ich richte Ihr Büro kostenlos ein');
    expect(d.body).not.toMatch(/CHF|https?:\/\//);
    expect(wordCount(d.body)).toBeLessThanOrEqual(100);
    // the follow-up brings the offer again and the 90-second video
    const f = draftMessage('follow_up', lead, d.subject);
    expect(f.body).toContain('https://seatline.ch/de/video?utm_source=email');
    for (const language of ['fr', 'en'] as const)
      expect(draftMessage('first', { ...lead, language }).body).not.toMatch(/CHF|https?:\/\//);
    const blank = draftMessage('first', { ...lead, greeting: null, whyNow: null, address: null });
    expect(blank.body).toContain('[Name]');
    expect(draftMessage('follow_up', lead, d.subject).subject).toBe(`Re: ${d.subject}`);
    for (const language of ['fr', 'en'] as const)
      for (const kind of ['first', 'follow_up'] as const)
        expect(wordCount(draftMessage(kind, { ...lead, language }).body)).toBeLessThanOrEqual(100);
  });

  it('only lets a personal, short e-mail with an address be scheduled', () => {
    const ok = { whyNow: 'x', contactEmail: 'contact@x.ch', channel: 'email' as const };
    const body = draftMessage('first', lead).body;
    expect(messageProblem(ok, body)).toBeNull();
    expect(messageProblem({ ...ok, whyNow: null }, body)).toBe('no_reason');
    expect(messageProblem({ ...ok, contactEmail: null }, body)).toBe('no_email');
    expect(messageProblem({ ...ok, channel: 'form' }, body)).toBe('no_email');
    expect(messageProblem(ok, `${body} [Name]`)).toBe('placeholder');
    // no word limit: a long personal e-mail is fine
    expect(messageProblem(ok, 'word '.repeat(300))).toBeNull();
  });

  it('knows the next step and when nobody answered', () => {
    const now = new Date('2026-11-10T08:00:00Z');
    const base = { followUpSentAt: null, scheduled: false, researched: false };
    expect(nextStep({ ...base, status: 'research', firstSentAt: null }, now)).toBe('research');
    expect(
      nextStep({ ...base, status: 'research', firstSentAt: null, researched: true }, now),
    ).toBe('write_first');
    expect(nextStep({ ...base, status: 'ready', firstSentAt: null }, now)).toBe('write_first');
    expect(nextStep({ ...base, status: 'ready', firstSentAt: null, scheduled: true }, now)).toBe(
      'scheduled',
    );
    expect(
      nextStep({ ...base, status: 'sent', firstSentAt: new Date('2026-11-05T07:00:00Z') }, now),
    ).toBe('waiting');
    expect(
      nextStep({ ...base, status: 'sent', firstSentAt: new Date('2026-11-03T07:00:00Z') }, now),
    ).toBe('follow_up_due');
    expect(nextStep({ ...base, status: 'replied', firstSentAt: now }, now)).toBe('talk');
    expect(
      isNoAnswer({ status: 'followed_up', followUpSentAt: new Date('2026-10-27T07:00:00Z') }, now),
    ).toBe(true);
    expect(
      isNoAnswer({ status: 'followed_up', followUpSentAt: new Date('2026-11-03T07:00:00Z') }, now),
    ).toBe(false);
  });

  it('makes the HTML version: same words, the video as its picture, no tracking', () => {
    const html = outreachHtml(draftMessage('follow_up', lead).body, 'de');
    expect(html).toContain('<img src="https://seatline.ch/site-video/email/seatline-video.gif"');
    expect(html).toContain('href="https://seatline.ch/de/video?utm_source=email"');
    expect(html).toContain('Guten Tag Herr van der Ploeg');
    expect(outreachHtml('<script>x</script>', 'de')).not.toContain('<script>');
  });

  it('counts replies from the company’s domain, or the exact address at a mail provider', () => {
    expect(replyKey('contact@livingdocs.io')).toEqual({ domain: 'livingdocs.io', exact: null });
    expect(replyKey('Anna.Muster@gmail.com')).toEqual({
      domain: 'gmail.com',
      exact: 'anna.muster@gmail.com',
    });
  });
});

describe('which leads are worth it, and reading a "no"', () => {
  const base = { employees: null, tags: [], contactName: null, contactEmail: null, whyNow: null };

  it('scores size, tags, a named person and a reason', () => {
    expect(leadScore(base)).toEqual({ score: 0, fit: 'weak' });
    // 120 people moving, a named IT manager, a real reason: the best kind
    expect(
      leadScore({
        employees: 120,
        tags: ['moving', 'hybrid'],
        contactName: 'Anna Muster',
        contactEmail: 'anna.muster@muster.ch',
        whyNow: 'Sie ziehen im März nach Oerlikon.',
      }),
    ).toEqual({ score: 11, fit: 'good' });
    // a shared inbox gets no point for the person, a tiny office loses points
    expect(
      leadScore({ ...base, employees: 8, contactName: 'Team', contactEmail: 'info@x.ch' }).fit,
    ).toBe('weak');
    // a press inbox or a team name isn't a person either
    for (const [contactName, contactEmail] of [
      ['Mammut-Team (Medienstelle)', 'pr@mammut.example'],
      ['Anna Muster', 'media.relations@x.example'],
      ['Équipe Gruner', 'geneve@gruner.example'],
    ] as const)
      expect(leadScore({ ...base, contactName, contactEmail }).score).toBe(0);
    expect(leadScore({ ...base, employees: 60, tags: ['growing'] })).toEqual({
      score: 5,
      fit: 'ok',
    });
  });

  it('spots a clear no in three languages, but not in our own quoted e-mail', () => {
    for (const no of [
      'Nein danke.',
      'Wir haben kein Interesse.',
      'Brauchen wir nicht, danke.',
      'Non merci, bonne journée',
      'Nous ne sommes pas intéressés.',
      'No thanks!',
      'We are not interested at the moment.',
      'stop',
    ])
      expect(isNo(no)).toBe(true);
    for (const yes of ['Gerne, rufen Sie mich an.', 'Merci, envoyez-moi une offre.', 'Sounds good'])
      expect(isNo(yes)).toBe(false);

    const ours = 'Guten Tag\n\nPS: Kein Thema? Ein kurzes "Nein danke" genügt.';
    const reply = 'Gerne mehr dazu!\n> PS: Kein Thema? Ein kurzes "Nein danke" genügt.';
    expect(isNo(reply)).toBe(true); // quoted naively it would look like a no
    expect(isNo(ownLinesRemoved(reply, [ours]))).toBe(false);
  });

  it('after a no: a short thank-you that asks why, as a reply', () => {
    const lead = {
      company: 'Muster AG',
      greeting: 'Frau Muster',
      whyNow: 'x',
      address: null,
      language: 'de' as const,
    };
    const d = draftMessage('ask_why', lead, 'Wer sitzt wo bei Muster AG?');
    expect(d.subject).toBe('Re: Wer sitzt wo bei Muster AG?');
    expect(d.body).toContain('Guten Tag Frau Muster');
    expect(d.body).toContain('Reicht Excel');
    expect(draftMessage('ask_why', { ...lead, language: 'fr' }).body).toContain('Excel suffit');
  });
});
