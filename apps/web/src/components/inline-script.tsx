/** Renders a script that must run before paint. Only for constants defined in this codebase. */
export function InlineScript({ code }: { code: string }) {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: static code from this repository, no user input
	return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
