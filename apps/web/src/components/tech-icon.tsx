import { type Appearance, iconLook } from "@portfolio/shared";
import { loadIconCatalog, resolveIcon } from "@/lib/icon-catalog";
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
 *
 * Names are resolved against the Worker's catalog at build time; a name the catalog can't vouch
 * for (it couldn't be reached, or it has no aliases) goes to the Worker as is, which resolves
 * aliases itself.
 */
export async function TechIcon({ name, appearance, size = 40 }: Props) {
	const catalog = await loadIconCatalog();
	const icon = catalog ? resolveIcon(catalog, name) : undefined;
	if (!icon && catalog?.complete) return null;
	const canonical = icon?.id ?? name.trim().toLowerCase();
	const label = icon?.name ?? name;

	return (
		<span className="tech-icon" style={{ width: size, height: size }} role="img" aria-label={label} title={label}>
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
