export function hexToHSV(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
    ),
    max = Math.max(r!, g!, b!),
    min = Math.min(r!, g!, b!),
    delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g! - b!) / delta) % 6;
    else if (max === g) h = (b! - r!) / delta + 2;
    else h = (r! - g!) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}
export function hsvToHex(h: number, s: number, v: number) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const values =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    values
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}
export function durationText(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function parseClockValue(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw Error("Choose a valid time");
  const [h, m] = value.split(":").map(Number);
  return h! * 60 + m!;
}
export function parseDuration(hours: string, minutes: string) {
  if (
    !/^\d{1,2}$/.test(hours) ||
    !/^\d{1,2}$/.test(minutes) ||
    Number(minutes) > 59 ||
    Number(hours) > 24 ||
    (Number(hours) === 24 && Number(minutes) > 0)
  )
    throw Error("Use hours 0–24 and minutes 0–59");
  return Number(hours) * 60 + Number(minutes);
}
