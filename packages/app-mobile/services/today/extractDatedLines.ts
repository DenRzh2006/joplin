/** Extract dated Markdown lines without treating fenced code as note content. */
export interface DatedLine {
	line: string;
	lineIndex: number;
	date: Date;
	hasTime: boolean;
	annual: boolean;
	isTask: boolean;
	checked: boolean;
}

export const extractDatedLines = (body: string, now = new Date()): DatedLine[] => {
	const result: DatedLine[] = [];
	let fence: { char: string; length: number } = null;
	let pendingTasks: { line: string; lineIndex: number; checked: boolean }[] = [];
	for (const [lineIndex, line] of body.split(/\r?\n/).entries()) {
		const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
		if (fenceMatch) {
			const marker = fenceMatch[1];
			if (!fence) fence = { char: marker[0], length: marker.length };
			else if (marker[0] === fence.char && marker.length >= fence.length) fence = null;
			continue;
		}
		if (fence) continue;
		const task = line.match(/^\s*(?:[-+*]|\d+[.)])\s+\[([ xX])\](?:\s|$)/);
		const directive = line.match(/^\s*all_(\d{2}\/\d{2}\/\d{4})\s*$/i);
		if (directive) {
			const dateEntry = extractDatedLines(directive[1], now)[0];
			if (dateEntry) for (const item of pendingTasks) result.push({ ...item, date: dateEntry.date, annual: false, hasTime: false, isTask: true });
			pendingTasks = [];
			continue;
		}
		if (task) pendingTasks.push({ line, lineIndex, checked: task[1].toLowerCase() === 'x' });
		const dates = /(\d{2})([./])(\d{2})\2(\d{4}|ey)(?![a-z0-9])(?:\s*,?\s+(?:в\s*)?(\d{1,2}):(\d{2})(?!\d))?/gi;
		let match: RegExpExecArray;
		while ((match = dates.exec(line)) !== null) {
			if (match.index > 0 && /\d/.test(line[match.index - 1])) continue;
			const day = Number(match[1]);
			const month = Number(match[3]);
			const annual = match[4].toLowerCase() === 'ey';
			let year = annual ? now.getFullYear() : Number(match[4]);
			if (annual && month === 2 && day === 29) {
				while (new Date(year, 1, 29).getMonth() !== 1) year++;
			}
			const hour = match[5] === undefined ? 0 : Number(match[5]);
			const minute = match[6] === undefined ? 0 : Number(match[6]);
			if (year < 100 || hour > 23 || minute > 59) continue;
			const date = new Date(year, month - 1, day, hour, minute);
			if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) continue;
			result.push({ line, lineIndex, date, annual, hasTime: match[5] !== undefined, isTask: !!task, checked: !!task && task[1].toLowerCase() === 'x' });
		}
	}
	return result;
};
