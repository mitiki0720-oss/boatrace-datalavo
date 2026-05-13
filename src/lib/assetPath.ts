export function withBasePath(path: string): string {
	if (!path) {
		return import.meta.env.BASE_URL || "/";
	}

	if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) {
		return path;
	}

	const baseUrl = import.meta.env.BASE_URL || "/";
	const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

	return `${normalizedBaseUrl}${normalizedPath}`;
}