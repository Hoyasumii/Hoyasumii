const REVEAL = { duration: 620, easing: "cubic-bezier(0.7, 0, 0.2, 1)" };

/**
 * Runs `apply` as a view transition where the new page grows as a circle from the center of
 * `origin` to the farthest corner. Without view transitions, or with reduced motion, it just applies.
 */
export function circleReveal(origin: Element, apply: () => void) {
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!document.startViewTransition || reduceMotion) {
		apply();
		return;
	}

	const { left, top, width, height } = origin.getBoundingClientRect();
	const x = left + width / 2;
	const y = top + height / 2;
	const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

	document
		.startViewTransition(apply)
		.ready.then(() => {
			document.documentElement.animate(
				{ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
				{ ...REVEAL, fill: "both", pseudoElement: "::view-transition-new(root)" },
			);
		})
		.catch(() => {});
}
