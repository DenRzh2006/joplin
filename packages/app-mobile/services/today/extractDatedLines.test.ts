import { extractDatedLines } from './extractDatedLines';

describe('extractDatedLines', () => {
	it('finds valid dates, times, and Markdown checkboxes', () => {
		const items = extractDatedLines('- [ ] Задача 26.11.2026 в 14:30\n- [x] Готово 26/11/2026\nВстреча 26.11.2026');
		expect(items).toHaveLength(3);
		expect([items[0].isTask, items[0].checked, items[0].hasTime, items[0].date.getHours()]).toEqual([true, false, true, 14]);
		expect([items[1].isTask, items[1].checked, items[1].hasTime]).toEqual([true, true, false]);
		expect(items[2].isTask).toBe(false);
	});
	it('ignores invalid dates and fenced code', () => {
		const items = extractDatedLines('31.02.2026\n```\n- [ ] 26.11.2026\n```\n29.02.2024');
		expect(items).toHaveLength(1);
		expect(items[0].lineIndex).toBe(4);
	});
});

it('recognizes yearly dates in both formats and handles leap days', () => {
 const entries = extractDatedLines('26/11/ey\n26.11.ey 18:30\n29.02.ey', new Date(2027, 0, 1));
 expect(entries).toHaveLength(3);
 expect(entries.every(item => item.annual)).toBe(true);
 expect(entries[1].date.getHours()).toBe(18);
 expect(entries[2].date.getFullYear()).toBe(2028);
});

it('assigns all preceding checkboxes to a directive date without including the directive', () => {
 const items = extractDatedLines('- [ ] first\n- [x] second\nall_30/10/2026\n- [ ] later\nall_31/10/2026', new Date(2026, 9, 30));
 expect(items.map(item => [item.line, item.date.getDate(), item.checked])).toEqual([['- [ ] first', 30, false], ['- [x] second', 30, true], ['- [ ] later', 31, false]]);
});
