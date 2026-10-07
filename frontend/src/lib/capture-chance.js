export function captureChanceTone(value) {
  const chance = Number(value) || 0;
  if (chance < 25) return 'low';
  if (chance < 50) return 'medium';
  if (chance < 99) return 'high';
  if (chance < 100) return 'near';
  return 'guaranteed';
}
