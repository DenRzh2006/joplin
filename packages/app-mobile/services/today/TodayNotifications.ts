import { AppState, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import Logger from '@joplin/utils/Logger';
import { sourceNotes } from './TodayService';
import { DatedLine, extractDatedLines } from './extractDatedLines';

const logger = Logger.create('TodayNotifications');
const alarmApi = Platform.OS === 'android' ? require('@joplin/react-native-alarm-notification').default : null;
let ready = false;
let timer: ReturnType<typeof setTimeout> = null;
let pending = Promise.resolve();
let requestedPermissions = false;
let requestedExactPermission = false;
let listening = false;

export const notificationText = (line: string) => line
	.replace(/^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s*/, '')
	.replace(/(?:\bв\s*)?\d{2}([./])\d{2}\1(?:\d{4}|ey)(?![a-z0-9])(?:\s*,?\s+(?:в\s*)?\d{1,2}:\d{2}(?!\d))?/gi, '')
	.replace(/\s{2,}/g, ' ').trim() || 'Напоминание';

const nextOccurrence = (item: DatedLine, now: Date) => {
	if (!item.annual || item.date.getTime() > now.getTime()) return item.date;
	const month = item.date.getMonth();
	const day = item.date.getDate();
	for (let year = now.getFullYear() + 1; year <= now.getFullYear() + 8; year++) {
		const date = new Date(year, month, day, item.date.getHours(), item.date.getMinutes());
		if (date.getMonth() === month && date.getDate() === day) return date;
	}
	return item.date;
};

const update = async () => {
	if (!alarmApi) return;
	if (!requestedPermissions && Number(Platform.Version) >= 33) {
		requestedPermissions = true;
		if (!await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
	}
	const notes = await sourceNotes();
	const hasFuture = notes.some(note => extractDatedLines(note.body || '').some(item => item.hasTime && nextOccurrence(item, new Date()).getTime() > Date.now() && (!item.isTask || !item.checked)));
	let exact = false;
	if (hasFuture) {
		exact = await NativeModules.RNAlarmNotification.exactAlarmPermission(!requestedExactPermission);
		requestedExactPermission = true;
	}
	const wanted = new Map<string, { noteId: string; title: string; line: string; date: Date }>();
	for (const note of notes) {
		for (const item of extractDatedLines(note.body || '')) {
			const date = nextOccurrence(item, new Date());
			if (!item.hasTime || date.getTime() <= Date.now() || (item.isTask && item.checked)) continue;
			const key = JSON.stringify([note.id, item.lineIndex, date.getTime(), item.line, note.title, exact, 'clean-v2']);
			wanted.set(key, { noteId: note.id, title: note.title || 'Напоминание', line: item.line, date });
		}
	}
	const alarms = await alarmApi.getScheduledAlarms() as { id: string; data?: { todayKey?: string } }[];
	for (const alarm of alarms) {
		const key = alarm.data?.todayKey;
		if (!key) continue;
		if (wanted.has(key)) wanted.delete(key);
		else await alarmApi.deleteAlarm(alarm.id);
	}
	for (const [key, item] of wanted) {
		if (item.date.getTime() <= Date.now()) continue;
		await alarmApi.scheduleAlarm({ title: item.title, message: notificationText(item.line), channel: 'net.cozic.joplin.notification', small_icon: 'ic_launcher_foreground', color: 'blue', has_button: true, fire_date: alarmApi.parseDate(item.date), data: { todayKey: key, noteId: item.noteId } });
	}
};

export const startTodayNotifications = () => {
	ready = true;
	if (!listening && alarmApi) {
		listening = true;
		AppState.addEventListener('change', state => { if (state === 'active') scheduleTodayNotifications(); });
	}
	scheduleTodayNotifications();
};
export const scheduleTodayNotifications = () => {
	if (!ready || !alarmApi) return;
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		pending = pending.then(update).catch(error => logger.error('Could not update dated-line notifications', error));
	}, 1500);
};
