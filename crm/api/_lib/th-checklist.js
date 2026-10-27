// The cleaning checklist a cleaner ticks off on each job. Same list as the
// "What we'll clean in each room" section of tidyhausph.com.
export const HOME_CHECKLIST = [
  { room: 'Living areas', items: ['Dust shelves and surfaces', 'Wipe tables', 'Sweep and mop', 'Tidy up', 'Take out the trash'] },
  { room: 'Kitchen', items: ['Wipe the counters', 'Clean the sink', 'Wipe the outside of appliances', 'Sweep and mop', 'Take out the trash'] },
  { room: 'Bedrooms', items: ['Dust', 'Make beds', 'Wipe mirrors', 'Sweep and mop', 'Take out the trash'] },
  { room: 'Bathrooms', items: ['Clean the toilet, sink and shower', 'Wipe mirrors', 'Wipe the counters', 'Sweep and mop', 'Take out the trash'] },
];
export const OFFICE_CHECKLIST = [
  { room: 'Work areas', items: ['Dust desks and shelves', 'Wipe tables and chairs', 'Sweep and mop', 'Empty bins'] },
  { room: 'Pantry', items: ['Wipe the counters', 'Clean the sink', 'Wipe the outside of appliances', 'Sweep and mop', 'Take out the trash'] },
  { room: 'Restrooms', items: ['Clean toilets and sinks', 'Wipe mirrors', 'Refill soap and tissue', 'Sweep and mop', 'Take out the trash'] },
];
const ADDON = /^(Inside fridge|Inside oven|Inside windows|Laundry)/i;

export function checklistFor(serviceName, lineItems) {
  const base = /office/i.test(serviceName || '') ? OFFICE_CHECKLIST : HOME_CHECKLIST;
  const extras = (lineItems || []).map((l) => l.name).filter((n) => ADDON.test(n || ''));
  const rooms = extras.length ? [...base, { room: 'Add-ons', items: extras }] : base;
  return rooms.map((r) => ({ room: r.room, items: r.items.map((t) => ({ key: `${r.room}: ${t}`, text: t })) }));
}
