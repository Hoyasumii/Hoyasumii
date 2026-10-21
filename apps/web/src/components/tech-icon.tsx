import { resolveIconName } from "@hoyasumii/skill-icons";
import { type Appearance, iconLook } from "@portfolio/shared";
import { iconUrl } from "@/lib/icons";

type Props = {
	name: string;
	/** The site's appearance: accent colors and the icon style of each theme. */
	appearance: Appearance;
	size?: number;
};

/**
 * A Skill Icon that follows the site's theme. One layer per site theme is rendered, each with the
 * variant and tint chosen for that theme, and CSS shows the one matching `data-theme`; hovering a
 * tinted icon reveals its original colors.
 */
export function TechIcon({ name, appearance, size = 40 }: Props) {
	const canonical = resolveIconName(name);
	if (!canonical) return null;

	return (
		<span
			className="tech-icon"
			style={{ width: size, height: size }}
			role="img"
			aria-label={canonical}
			title={canonical}
		>
			{(["dark", "light"] as const).map((theme) => {
				const { variant, tint } = iconLook(appearance, theme);
				return (
					<span
						key={theme}
						className={`tech-icon__theme tech-icon__theme--${theme}${tint ? " tech-icon__theme--tinted" : ""}`}
					>
						{tint ? (
							<img
								className="tech-icon__img tech-icon__img--tinted"
								src={iconUrl(canonical, variant, tint)}
								alt=""
								width={size}
								height={size}
								loading="lazy"
								decoding="async"
							/>
						) : null}
						<img
							className="tech-icon__img tech-icon__img--original"
							src={iconUrl(canonical, variant)}
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
