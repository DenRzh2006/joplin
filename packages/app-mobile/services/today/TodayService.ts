import Note from '@joplin/lib/models/Note';
import Folder from '@joplin/lib/models/Folder';
import { NoteEntity } from '@joplin/lib/services/database/types';
import { extractDatedLines } from './extractDatedLines';

const marker = '<!-- joplin-today-generated -->';
const statsMarker = '<!-- joplin-weekly-statistics -->';
const helpMarker = '<!-- joplin-today-help -->';
export const isStatisticsNote = (body: string) => !!body?.startsWith(statsMarker);
const reference = /\s*<!-- today-source:([a-f0-9]{32}):(\d+) -->$/;
const checkbox = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\])/;
const withoutCheck = (line: string) => line.replace(checkbox, '$1 $3');

export const isTodayNote = (body: string) => !!body?.startsWith(marker);

const eligible = (note: NoteEntity) => !note.deleted_time && !note.is_conflict && !note.is_locked && !note.encryption_applied && (note.markup_language === 1 || !note.markup_language) && !isTodayNote(note.body) && !isStatisticsNote(note.body) && !note.body?.startsWith(helpMarker);

export const sourceNotes = async (): Promise<NoteEntity[]> => (await Note.all()).filter(eligible);

const refresh = async (now: Date) => {
	const notes = await Note.all() as NoteEntity[];
	const current = notes.find(n => !n.deleted_time && !n.is_locked && isTodayNote(n.body));
	const folder = current?.parent_id ? await Folder.load(current.parent_id) : await Folder.defaultFolder();
	if (!folder) return;
	const todayLines = [marker, ''];
	const overdueLines = ['## Не сделано в прошлые дни', ''];
	const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const nextDay = new Date(dayStart); nextDay.setDate(nextDay.getDate() + 1);
	for (const note of notes.filter(eligible)) {
		const items = extractDatedLines(note.body || '', now);
		const today = new Map<number, typeof items[number]>();
		const overdue = new Map<number, typeof items[number]>();
		for (const item of items) {
			if (item.date >= dayStart && item.date < nextDay) today.set(item.lineIndex, item);
			else if (item.isTask && !item.checked && item.date < dayStart) overdue.set(item.lineIndex, item);
		}
		// A task explicitly scheduled for today belongs only to today's section.
		for (const index of today.keys()) overdue.delete(index);
		for (const [section, matches] of [[todayLines, today], [overdueLines, overdue]] as [string[], Map<number, typeof items[number]>][]) {
			if (!matches.size) continue;
			section.push(`### [${(note.title || 'Без названия').replace(/[\[\]]/g, '')}](:/${note.id})`, '');
			for (const item of matches.values()) section.push(`${item.line}${item.isTask ? ` <!-- today-source:${note.id}:${item.lineIndex} -->` : ''}`);
			section.push('');
		}
	}
	const lines = [...todayLines, ...overdueLines];
	const body = lines.join('\n');
	if (!current || current.body !== body) await Note.save({ id: current?.id, title: current?.title || 'Сегодня', parent_id: folder.id, body });
};

let refreshQueue = Promise.resolve();
export const refreshTodayNote = (now = new Date()) => {
	const result = refreshQueue.then(() => refresh(now));
	refreshQueue = result.catch(() => {});
	return result;
};

const helpBody = `${helpMarker}

## Русский

**Заметка «Сегодня».** Задачи и строки с сегодняшней датой собираются здесь автоматически. Невыполненные задачи прошлых дней находятся в разделе «Не сделано в прошлые дни». Дата в исходной заметке не меняется. Галочка в «Сегодня» меняет исходную задачу. Заметку «Сегодня» можно переименовать.

**Даты и напоминания.** Напишите дату в формате 30/10/2026 или 30.10.2026. Чтобы получить напоминание, добавьте время, например:

\`\`\`text
- [ ] Позвонить 30/10/2026 14:30
\`\`\`

Для ежегодной даты используйте 30/10/ey. На Android нажмите на уведомление и введите целое количество минут, чтобы отложить напоминание. Разрешите уведомления и точные напоминания в настройках Android, если приложение запросит их.

**Общая дата.** Строка \`all_30/10/2026\` назначает указанную дату всем пунктам с галочками выше неё, начиная после предыдущей строки \`all_\`. Пример:

\`\`\`text
- [ ] Первое дело
- [ ] Второе дело
all_30/10/2026
\`\`\`

**Статистика за неделю.** Отдельная заметка обновляется при открытии и показывает выполненные и невыполненные задачи, назначенные на текущую неделю с понедельника по воскресенье. В понедельник при следующем открытии начинается подсчёт новой недели.

## English

**Today note.** Lines and tasks dated today are collected automatically. Unfinished tasks from earlier days appear under «Не сделано в прошлые дни» (unfinished from previous days). Original dates are preserved. Checking a task in Today updates the original task. You can rename the Today note.

**Dates and reminders.** Enter a date as 30/10/2026 or 30.10.2026. Add a time for a reminder, for example:

\`\`\`text
- [ ] Call someone 30/10/2026 14:30
\`\`\`

Use 30/10/ey for an annual date. On Android, tap the notification and enter a whole number of minutes to snooze it. Allow notifications and exact alarms in Android settings if prompted.

**Common date.** A line such as \`all_30/10/2026\` assigns that date to all checkboxes above it, starting after the previous \`all_\` line. For example:

\`\`\`text
- [ ] First task
- [ ] Second task
all_30/10/2026
\`\`\`

**Weekly statistics.** The separate statistics note refreshes when opened. It counts completed and incomplete tasks scheduled for the current Monday–Sunday week. The next time it is opened on Monday, it counts the new week.
`;

let helpQueue = Promise.resolve();
export const ensureHelpNote = () => {
	const result = helpQueue.then(async () => {
		const notes = await Note.all() as NoteEntity[];
		if (notes.some(note => !note.deleted_time && note.body?.startsWith(helpMarker))) return;
		const folder = await Folder.defaultFolder();
		if (folder) await Note.save({ title: 'Справка / Help', parent_id: folder.id, body: helpBody });
	});
	helpQueue = result.catch(() => {});
	return result;
};

// Statistics use the task's scheduled date, not the time at which it was checked.
export const refreshStatisticsNote = async (now = new Date()) => {
	const notes = await Note.all() as NoteEntity[];
	const current = notes.find(n => !n.deleted_time && !n.is_locked && isStatisticsNote(n.body));
	const folder = current?.parent_id ? await Folder.load(current.parent_id) : await Folder.defaultFolder();
	if (!folder) return;
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	start.setDate(start.getDate() - (start.getDay() + 6) % 7);
	const end = new Date(start);
	end.setDate(end.getDate() + 7);
	let completed = 0;
	let incomplete = 0;
	for (const note of notes.filter(eligible)) {
		const seen = new Set<number>();
		for (const item of extractDatedLines(note.body || '', now)) {
			if (!item.isTask || item.date < start || item.date >= end || seen.has(item.lineIndex)) continue;
			seen.add(item.lineIndex);
			if (item.checked) completed++; else incomplete++;
		}
	}
	const format = (date: Date) => `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
	const last = new Date(end); last.setDate(last.getDate() - 1);
	const body = `${statsMarker}\n\n${format(start)} – ${format(last)}\n\nВыполнено: **${completed}**\n\nНе выполнено: **${incomplete}**\n`;
	if (!current || current.body !== body) await Note.save({ id: current?.id, title: current?.title || 'Статистика за неделю', parent_id: folder.id, body });
};

// Apply only a single checkbox change and only if the original line still matches.
// Never use a stale line number to change a different task.
export const propagateTodayCheckbox = async (oldBody: string, newBody: string) => {
	if (!isTodayNote(oldBody)) return;
	const oldLines = oldBody.split('\n');
	const newLines = newBody.split('\n');
	if (oldLines.length !== newLines.length) throw new Error('Список задач изменился. Откройте заметку заново.');
	const changes = oldLines.map((line, index) => line === newLines[index] ? -1 : index).filter(index => index >= 0);
	if (changes.length !== 1) throw new Error('Не удалось определить изменённую задачу.');
	const index = changes[0];
	const oldRef = oldLines[index].match(reference);
	const newRef = newLines[index].match(reference);
	const oldCheck = oldLines[index].match(checkbox);
	const newCheck = newLines[index].match(checkbox);
	if (!oldRef || !newRef || oldRef[0] !== newRef[0] || !oldCheck || !newCheck || withoutCheck(oldLines[index]) !== withoutCheck(newLines[index])) throw new Error('Не удалось определить исходную задачу.');
	const note = await Note.load(oldRef[1]);
	if (!note || !eligible(note)) throw new Error('Исходная заметка недоступна.');
	const lineEnding = (note.body || '').includes('\r\n') ? '\r\n' : '\n';
	const originalLines = (note.body || '').split(/\r?\n/);
	const sourceLine = oldLines[index].replace(reference, '');
	const matching = originalLines.map((line, i) => withoutCheck(line) === withoutCheck(sourceLine) ? i : -1).filter(i => i >= 0);
	if (matching.length !== 1) throw new Error('Исходная задача изменилась или встречается несколько раз. Перезапустите приложение для обновления списка.');
	const sourceIndex = matching[0];
	const sourceCheck = originalLines[sourceIndex].match(checkbox);
	if (!sourceCheck || sourceCheck[2].toLowerCase() !== oldCheck[2].toLowerCase()) throw new Error('Состояние исходной задачи изменилось. Перезапустите приложение для обновления списка.');
	if (!checkbox.test(originalLines[sourceIndex])) throw new Error('Исходная задача больше не содержит галочку.');
	originalLines[sourceIndex] = originalLines[sourceIndex].replace(checkbox, `$1${newCheck[2]}$3`);
	await Note.save({ id: note.id, body: originalLines.join(lineEnding) });
};

// Rich-text and Markdown editors save a whole body instead of sending viewer checkbox events.
export const propagateTodayEditorChanges = async (noteId: string, newBody: string) => {
	if (!isTodayNote(newBody)) return;
	const stored = await Note.load(noteId);
	if (!stored || !isTodayNote(stored.body)) return;
	const original = new Map<string, string>();
	for (const line of stored.body.split('\n')) {
		const ref = line.match(reference);
		if (ref && checkbox.test(line)) original.set(`${ref[1]}:${ref[2]}`, line);
	}
	for (const line of newBody.split('\n')) {
		const ref = line.match(reference);
		if (!ref) continue;
		const before = original.get(`${ref[1]}:${ref[2]}`);
		const a = before?.match(checkbox);
		const b = line.match(checkbox);
		if (a && b && a[2].toLowerCase() !== b[2].toLowerCase() && withoutCheck(before) === withoutCheck(line)) {
			await propagateTodayCheckbox(`${marker}\n${before}`, `${marker}\n${line}`);
		}
	}
};
