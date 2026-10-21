/** Text set on a circle that slowly turns — a nod to the "SOFTWARE * DEVELOPER *" ring of the old site. */
export function RotatingBadge({ text }: { text: string }) {
	const repeated = text.toUpperCase().repeat(Math.max(1, Math.ceil(44 / text.length)));

	return (
		<svg className="badge" viewBox="0 0 200 200" aria-hidden="true">
			<defs>
				<path id="badge-circle" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" />
			</defs>
			<text>
				<textPath href="#badge-circle" textLength="515" lengthAdjust="spacing">
					{repeated}
				</textPath>
			</text>
		</svg>
	);
}
