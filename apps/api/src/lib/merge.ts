const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Merges `patch` into `base` key by key; nested objects merge too, arrays and scalars replace. */
export function deepMerge<T>(base: T, patch: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
	const result: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(patch)) result[key] = deepMerge(result[key], value);
	return result as T;
}
