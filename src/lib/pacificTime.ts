const pacificClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Pacific civil time, including DST. Ranges are start-inclusive, end-exclusive. */
export function pacificTime(date = new Date()): { time: string; mood: "green" | "yellow" | "red" } {
  const parts = pacificClock.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")!.value);
  const minute = parts.find((part) => part.type === "minute")!.value;
  return { time: `${String(hour).padStart(2, "0")}:${minute}`, mood: hour >= 1 && hour < 6 ? "red" : hour < 8 || hour >= 19 ? "yellow" : "green" };
}
