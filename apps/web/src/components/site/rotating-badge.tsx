/** Text set on a circle that slowly turns — a nod to the "SOFTWARE * DEVELOPER *" ring of the old site. */
export function RotatingBadge({ text }: { text: string }) {
	// SVG drops trailing whitespace, which would glue the last separator to the start of the ring;
	// non-breaking spaces survive, so the seam is spaced like every other gap.
	const unit = text.toUpperCase().replace(/ /g, " ");
	const repeated = unit.repeat(Math.max(1, Math.ceil(44 / unit.length)));

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
