import { InlineScript } from "@/components/inline-script";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** GitHub Pages has no server to read Accept-Language, so the browser picks the language. */
const script = `(function(){var l=(navigator.languages&&navigator.languages[0])||navigator.language||"";location.replace(${JSON.stringify(base)}+(/^pt/i.test(l)?"/pt/":"/en/")+location.hash)})()`;

export default function Root() {
	return (
		<>
			<InlineScript code={script} />
			<noscript>
				<meta httpEquiv="refresh" content={`0; url=${base}/pt/`} />
				<a href={`${base}/pt/`}>Português</a> · <a href={`${base}/en/`}>English</a>
			</noscript>
		</>
	);
}
