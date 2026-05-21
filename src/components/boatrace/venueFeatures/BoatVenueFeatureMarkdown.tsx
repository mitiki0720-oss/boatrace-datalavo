import type { ReactNode } from "react";

type BoatVenueFeatureMarkdownProps = {
	markdown: string;
};

const inlineStrong = (text: string): ReactNode[] => {
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return parts.map((part, index) => {
		const strong = /^\*\*([^*]+)\*\*$/.exec(part);
		return strong ? <strong key={`${part}-${index}`}>{strong[1]}</strong> : part;
	});
};

const blockStyle = {
	display: "grid",
	gap: "14px",
	color: "#17374f",
	lineHeight: 1.8,
};

const headingStyle = {
	margin: "8px 0 0",
	color: "#12324a",
	lineHeight: 1.35,
};

const paragraphStyle = {
	margin: 0,
	color: "#35576d",
};

const listStyle = {
	margin: 0,
	paddingLeft: "1.2rem",
	color: "#35576d",
};

const tableWrapStyle = {
	overflowX: "auto" as const,
	borderRadius: "16px",
	border: "1px solid rgba(80, 150, 180, 0.16)",
};

const tableStyle = {
	width: "100%",
	borderCollapse: "collapse" as const,
	minWidth: "560px",
	background: "rgba(255,255,255,0.74)",
};

const thStyle = {
	padding: "10px 12px",
	background: "rgba(231, 247, 255, 0.9)",
	color: "#12324a",
	fontSize: "0.82rem",
	textAlign: "left" as const,
	borderBottom: "1px solid rgba(80, 150, 180, 0.16)",
};

const tdStyle = {
	padding: "10px 12px",
	borderBottom: "1px solid rgba(80, 150, 180, 0.12)",
	color: "#35576d",
	fontSize: "0.86rem",
	verticalAlign: "top" as const,
};

function isTableSeparator(line: string): boolean {
	return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTable(lines: string[], startIndex: number): { node: ReactNode; nextIndex: number } {
	const tableLines: string[] = [];
	let index = startIndex;

	while (index < lines.length && lines[index].includes("|")) {
		tableLines.push(lines[index]);
		index += 1;
	}

	const rows = tableLines
		.filter((line) => !isTableSeparator(line))
		.map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
	const [header, ...body] = rows;

	return {
		nextIndex: index,
		node: (
			<div style={tableWrapStyle} key={`table-${startIndex}`}>
				<table style={tableStyle}>
					{header ? (
						<thead>
							<tr>
								{header.map((cell, cellIndex) => <th key={`h-${cellIndex}`} style={thStyle}>{inlineStrong(cell)}</th>)}
							</tr>
						</thead>
					) : null}
					<tbody>
						{body.map((row, rowIndex) => (
							<tr key={`r-${rowIndex}`}>
								{row.map((cell, cellIndex) => <td key={`c-${cellIndex}`} style={tdStyle}>{inlineStrong(cell)}</td>)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		),
	};
}

export function BoatVenueFeatureMarkdown({ markdown }: BoatVenueFeatureMarkdownProps) {
	const lines = markdown.replace(/^---[\s\S]*?---\s*/, "").split(/\r?\n/);
	const nodes: ReactNode[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index].trimEnd();

		if (!line.trim()) {
			index += 1;
			continue;
		}

		if (/^-{3,}$/.test(line.trim())) {
			nodes.push(<hr key={`hr-${index}`} style={{ width: "100%", border: 0, borderTop: "1px solid rgba(80, 150, 180, 0.18)" }} />);
			index += 1;
			continue;
		}

		if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
			const table = parseTable(lines, index);
			nodes.push(table.node);
			index = table.nextIndex;
			continue;
		}

		const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
		if (heading) {
			const level = heading[1].length;
			const Tag = (`h${Math.min(level + 1, 4)}`) as "h2" | "h3" | "h4";
			nodes.push(<Tag key={`heading-${index}`} style={{ ...headingStyle, fontSize: level === 1 ? "1.5rem" : level === 2 ? "1.18rem" : "1rem" }}>{inlineStrong(heading[2])}</Tag>);
			index += 1;
			continue;
		}

		if (/^\s*[-*]\s+/.test(line)) {
			const items: string[] = [];
			while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
				items.push(lines[index].replace(/^\s*[-*]\s+/, "").trim());
				index += 1;
			}
			nodes.push(<ul key={`ul-${index}`} style={listStyle}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineStrong(item)}</li>)}</ul>);
			continue;
		}

		if (/^\s*\d+\.\s+/.test(line)) {
			const items: string[] = [];
			while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
				items.push(lines[index].replace(/^\s*\d+\.\s+/, "").trim());
				index += 1;
			}
			nodes.push(<ol key={`ol-${index}`} style={listStyle}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineStrong(item)}</li>)}</ol>);
			continue;
		}

		const paragraph: string[] = [];
		while (
			index < lines.length &&
			lines[index].trim() &&
			!lines[index].trim().startsWith("#") &&
			!/^\s*[-*]\s+/.test(lines[index]) &&
			!/^\s*\d+\.\s+/.test(lines[index]) &&
			!/^-{3,}$/.test(lines[index].trim()) &&
			!(lines[index].includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
		) {
			paragraph.push(lines[index].trim());
			index += 1;
		}
		nodes.push(<p key={`p-${index}`} style={paragraphStyle}>{inlineStrong(paragraph.join(" "))}</p>);
	}

	return <div style={blockStyle}>{nodes}</div>;
}
