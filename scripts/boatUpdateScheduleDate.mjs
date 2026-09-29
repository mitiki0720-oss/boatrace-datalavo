const FINAL_SCHEDULE = "30 14 * * *";

function dateStringUtc(date) {
	return date.toISOString().slice(0, 10);
}

export function resolveScheduledBoatTargetDate(schedule, now = new Date()) {
	if (schedule !== FINAL_SCHEDULE) return null;
	if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("now must be a valid Date");

	const intended = new Date(now);
	const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
	if (minutes < 14 * 60 + 30) intended.setUTCDate(intended.getUTCDate() - 1);
	return dateStringUtc(intended);
}

function valueAfter(flag, argv) {
	const index = argv.indexOf(flag);
	return index >= 0 ? argv[index + 1] : undefined;
}

if (process.argv[1]?.endsWith("boatUpdateScheduleDate.mjs")) {
	const schedule = valueAfter("--schedule", process.argv.slice(2)) ?? "";
	const nowText = valueAfter("--now", process.argv.slice(2));
	const now = nowText ? new Date(nowText) : new Date();
	const resolved = resolveScheduledBoatTargetDate(schedule, now);
	if (!resolved) throw new Error(`Unsupported scheduled update: ${schedule || "<empty>"}`);
	process.stdout.write(`${resolved}\n`);
}
