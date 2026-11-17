import { toIcs } from './ceremonies.service.js';

describe('toIcs', () => {
  const ceremony = {
    id: 'c1',
    title: 'Sangeet, Mehendi',
    description: 'Music; dance',
    startsAt: new Date('2026-11-14T13:00:00Z'),
    endsAt: null,
    venueName: 'Grand Lotus',
    venueAddress: 'Whitefield',
    venueMapsUrl: 'https://maps.google.com/?q=x',
    streamUrl: null,
    dressCode: 'Festive',
  };
  const wedding = { brideName: 'Sanvi', groomName: 'Santosh' };

  it('produces a valid VEVENT with escaped text and a 2-hour alarm', () => {
    const ics = toIcs(ceremony, wedding);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261114T130000Z');
    expect(ics).toContain('DTEND:20261114T160000Z');
    expect(ics).toContain('SUMMARY:Sangeet\\, Mehendi • Sanvi & Santosh');
    expect(ics).toContain('DESCRIPTION:Music\\; dance\\nDress code: Festive');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });
});
