"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
	src: string;
	alt: string;
	/** Shown under the image, e.g. "fig. 01 — Roastery CMS". */
	caption?: string;
	variant: "feature" | "thumb";
	/** The first cover on the page loads eagerly; the rest wait until they are close. */
	eager?: boolean;
};

/**
 * A project cover shown exactly as uploaded. If the image cannot load (an old address that went
 * offline), the figure removes itself instead of showing a broken image.
 */
export function ProjectCover({ src, alt, caption, variant, eager = false }: Props) {
	const image = useRef<HTMLImageElement>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		// The error may have fired before hydration attached onError.
		const element = image.current;
		if (element?.complete && element.naturalWidth === 0) setFailed(true);
	}, []);

	if (failed) return null;

	return (
		<figure className={`cover cover--${variant}`}>
			<div className="cover__frame">
				<img
					ref={image}
					src={src}
					alt={alt}
					loading={eager ? "eager" : "lazy"}
					decoding="async"
					onError={() => setFailed(true)}
				/>
			</div>
			{caption ? <figcaption className="cover__caption">{caption}</figcaption> : null}
		</figure>
	);
}
