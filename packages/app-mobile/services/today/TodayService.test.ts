import Note from '@joplin/lib/models/Note';
import Folder from '@joplin/lib/models/Folder';
import { refreshTodayNote, propagateTodayCheckbox } from './TodayService';

jest.mock('@joplin/lib/models/Note', () => ({ __esModule: true, default: { all: jest.fn(), load: jest.fn(), save: jest.fn() } }));
jest.mock('@joplin/lib/models/Folder', () => ({ __esModule: true, default: { defaultFolder: jest.fn(), load: jest.fn() } }));

const id = '1234567890abcdef1234567890abcdef';
const source = { id, title: 'Работа', body: '- [ ] Задача 26.11.2026', markup_language: 1 };

describe('Today note', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(Note.all as jest.Mock).mockResolvedValue([source]);
		(Note.load as jest.Mock).mockResolvedValue(source);
		(Folder.defaultFolder as jest.Mock).mockResolvedValue({ id: 'folder' });
		(Note.save as jest.Mock).mockResolvedValue({});
	});
	it('generates source links and copies only current-date lines', async () => {
		await refreshTodayNote(new Date(2026, 10, 26));
		const saved = (Note.save as jest.Mock).mock.calls[0][0];
		expect(saved.title).toBe('Сегодня');
		expect(saved.body).toContain(`[Работа](:/${id})`);
		expect(saved.body).toContain(`- [ ] Задача 26.11.2026 <!-- today-source:${id}:0 -->`);
	});
	it('updates the source checkbox', async () => {
		const oldBody = `<!-- joplin-today-generated -->\n- [ ] Задача 26.11.2026 <!-- today-source:${id}:0 -->`;
		await propagateTodayCheckbox(oldBody, oldBody.replace('[ ]', '[x]'));
		expect(Note.save).toHaveBeenCalledWith({ id, body: '- [x] Задача 26.11.2026' });
	});
	it('rejects ambiguous or changed source lines', async () => {
		const oldBody = `<!-- joplin-today-generated -->\n- [ ] Задача 26.11.2026 <!-- today-source:${id}:0 -->`;
		(Note.load as jest.Mock).mockResolvedValue({ ...source, body: `${source.body}\n${source.body}` });
		await expect(propagateTodayCheckbox(oldBody, oldBody.replace('[ ]', '[x]'))).rejects.toThrow();
		expect(Note.save).not.toHaveBeenCalled();
	});
});

it('includes annual tasks on the matching day and does not add another Today heading', async () => {
 (Note.all as jest.Mock).mockResolvedValue([{ ...source, body: '- [ ] Anniversary 26/11/ey' }]);
 (Folder.defaultFolder as jest.Mock).mockResolvedValue({ id: 'folder' });
 (Note.save as jest.Mock).mockClear();
 await refreshTodayNote(new Date(2029, 10, 26));
 const saved = (Note.save as jest.Mock).mock.calls[0][0];
 expect(saved.body).toContain('Anniversary 26/11/ey');
 expect(saved.body).not.toContain('# Сегодня');
});

it('carries over unfinished tasks and preserves a renamed Today note', async () => {
 const today = { id: 'today', title: 'Мои дела', parent_id: 'folder', body: '<!-- joplin-today-generated -->' };
 (Note.all as jest.Mock).mockResolvedValue([today, { ...source, body: '- [ ] Старое 25.11.2026\n- [x] Готово 25.11.2026' }]);
 (Folder.load as jest.Mock).mockResolvedValue({ id: 'folder' });
 (Note.save as jest.Mock).mockClear();
 await refreshTodayNote(new Date(2026, 10, 26));
 const saved = (Note.save as jest.Mock).mock.calls[0][0];
 expect(saved.title).toBe('Мои дела');
 expect(saved.body).toContain('Старое 25.11.2026');
 expect(saved.body).not.toContain('Готово');
});

it('counts the current Monday-to-Sunday week and resets at Monday midnight', async () => {
 const service = require('./TodayService');
 (Note.all as jest.Mock).mockResolvedValue([{ ...source, body: '- [x] A 26.10.2026\n- [ ] B 01.11.2026\n- [ ] C 02.11.2026' }]);
 (Folder.defaultFolder as jest.Mock).mockResolvedValue({ id: 'folder' });
 (Note.save as jest.Mock).mockClear();
 await service.refreshStatisticsNote(new Date(2026, 10, 1, 23, 59));
 expect((Note.save as jest.Mock).mock.calls[0][0].body).toContain('Выполнено: **1**');
 expect((Note.save as jest.Mock).mock.calls[0][0].body).toContain('Не выполнено: **1**');
 (Note.save as jest.Mock).mockClear();
 await service.refreshStatisticsNote(new Date(2026, 10, 2, 0, 0));
 expect((Note.save as jest.Mock).mock.calls[0][0].body).toContain('Выполнено: **0**');
 expect((Note.save as jest.Mock).mock.calls[0][0].body).toContain('Не выполнено: **1**');
});


it('separates overdue tasks from today and does not repeat the statistics title', async () => {
 (Note.all as jest.Mock).mockResolvedValue([{ ...source, body: '- [ ] Сегодня 26.11.2026\n- [ ] Вчера 25.11.2026\n- [x] Готово 25.11.2026' }]);
 (Folder.defaultFolder as jest.Mock).mockResolvedValue({ id: 'folder' });
 (Note.save as jest.Mock).mockClear();
 await refreshTodayNote(new Date(2026, 10, 26));
 const body = (Note.save as jest.Mock).mock.calls[0][0].body;
 expect(body.indexOf('Сегодня 26.11.2026')).toBeLessThan(body.indexOf('## Не сделано в прошлые дни'));
 expect(body.indexOf('Вчера 25.11.2026')).toBeGreaterThan(body.indexOf('## Не сделано в прошлые дни'));
 expect(body).not.toContain('Готово 25.11.2026');
 (Note.save as jest.Mock).mockClear();
 await require('./TodayService').refreshStatisticsNote(new Date(2026, 10, 26));
 expect((Note.save as jest.Mock).mock.calls[0][0].body).not.toContain('# Статистика за неделю');
});

it('creates bilingual help only when missing and excludes it from task aggregation', async () => {
 const service = require('./TodayService');
 (Folder.defaultFolder as jest.Mock).mockResolvedValue({ id: 'folder' });
 (Note.all as jest.Mock).mockResolvedValue([]);
 (Note.save as jest.Mock).mockClear();
 await service.ensureHelpNote();
 const help = (Note.save as jest.Mock).mock.calls[0][0];
 expect(help.body).toContain('## Русский');
 expect(help.body).toContain('## English');
 expect(help.body).toContain('all_30/10/2026');
 (Note.all as jest.Mock).mockResolvedValue([help]);
 (Note.save as jest.Mock).mockClear();
 await service.ensureHelpNote();
 expect(Note.save).not.toHaveBeenCalled();
 expect(await service.sourceNotes()).toHaveLength(0);
 (Note.all as jest.Mock).mockResolvedValue([{ ...help, deleted_time: 1 }]);
 await service.ensureHelpNote();
 expect(Note.save).toHaveBeenCalledTimes(1);
});
