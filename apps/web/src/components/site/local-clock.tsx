"use client";

import { useEffect, useState } from "react";

function format(timeZone: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(new Date());
}

export function LocalClock({ timeZone }: { timeZone: string }) {
	const [time, setTime] = useState<string | null>(null);

	useEffect(() => {
		setTime(format(timeZone));
		const timer = setInterval(() => setTime(format(timeZone)), 1000);
		return () => clearInterval(timer);
	}, [timeZone]);

	return (
		<time className="clock" suppressHydrationWarning>
			{time ?? "--:--:--"}
		</time>
	);
}
