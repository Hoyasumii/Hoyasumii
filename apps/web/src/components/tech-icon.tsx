import { resolveIconName } from "@hoyasumii/skill-icons";
import { iconUrl } from "@/lib/icons";
import { tintFor } from "@/lib/theme";

type Props = {
	name: string;
	/** The appearance setting: "accent", a hex color, or "" for the original colors. */
	tint: string;
	size?: number;
};

/**
 * A Skill Icon that follows the site's theme. Both theme variants are rendered, each tinted for
 * its own theme, and CSS shows the one matching `data-theme`; hovering reveals the original colors.
 */
export function TechIcon({ name, tint, size = 40 }: Props) {
	const canonical = resolveIconName(name);
	if (!canonical) return null;
	const tinted = Boolean(tint);

	return (
		<span
			className={`tech-icon${tinted ? " tech-icon--tinted" : ""}`}
			style={{ width: size, height: size }}
			role="img"
			aria-label={canonical}
			title={canonical}
		>
			{(["dark", "light"] as const).map((theme) => {
				const themeTint = tintFor(tint, theme);
				return (
					<span key={theme} className={`tech-icon__theme tech-icon__theme--${theme}`}>
						{themeTint ? (
							<img
								className="tech-icon__img tech-icon__img--tinted"
								src={iconUrl(canonical, theme, themeTint)}
								alt=""
								width={size}
								height={size}
								loading="lazy"
								decoding="async"
							/>
						) : null}
						<img
							className="tech-icon__img tech-icon__img--original"
							src={iconUrl(canonical, theme)}
							alt=""
							width={size}
							height={size}
							loading="lazy"
							decoding="async"
						/>
					</span>
				);
			})}
		</span>
	);
}
