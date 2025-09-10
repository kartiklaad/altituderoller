export function rankSlots(slots, norm) {
  if (!Array.isArray(slots)) return [];
  const window = norm.time_window || { start: '10:00', end: '18:00' };
  return [...slots].sort((a, b) => {
    const aIn = within(a, window);
    const bIn = within(b, window);
    if (aIn !== bIn) return aIn ? -1 : 1;
    return Number(a.price) - Number(b.price);
  });
}
function within(slot, window) {
  const s = slot.start?.slice(11,16) || '00:00';
  const e = slot.end?.slice(11,16) || '23:59';
  return (s >= window.start) && (e <= window.end);
}
