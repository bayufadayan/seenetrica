export function createSeededRandom(seed) {
  let value = 2166136261;
  for (const character of String(seed || "seenetrica")) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let number = value;
    number = Math.imul(number ^ (number >>> 15), number | 1);
    number ^= number + Math.imul(number ^ (number >>> 7), number | 61);
    return ((number ^ (number >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(random, minimum, maximum) {
  return minimum + random() * (maximum - minimum);
}
