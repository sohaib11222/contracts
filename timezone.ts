// Calendar wall times are resolved explicitly so DST gaps/folds cannot silently shift appointments.
export function wallTime(instant: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return (
    get("year") +
    "-" +
    get("month") +
    "-" +
    get("day") +
    "T" +
    get("hour") +
    ":" +
    get("minute")
  );
}
export function timeOptions(
  local: string,
  zone: string,
): { instant: string; label: string }[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return [];
  const nominal = Date.parse(local + ":00Z");
  if (!Number.isFinite(nominal)) return [];
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = nominal + hours * 3600000;
    const parts = wallTime(new Date(probe).toISOString(), zone);
    offsets.add(Date.parse(parts + ":00Z") - probe);
  }
  return [...offsets]
    .map((offset) => ({
      instant: new Date(nominal - offset).toISOString(),
      label:
        "UTC" +
        (offset < 0 ? "-" : "+") +
        String(Math.floor(Math.abs(offset) / 3600000)).padStart(2, "0") +
        ":" +
        String((Math.abs(offset) / 60000) % 60).padStart(2, "0"),
    }))
    .filter((value) => wallTime(value.instant, zone) === local)
    .sort((a, b) => a.instant.localeCompare(b.instant));
}
