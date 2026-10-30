const mockNotes = jest.fn();
const mockSchedule = jest.fn();
const mockDelete = jest.fn();
const mockGetAlarms = jest.fn();

jest.mock('react-native', () => ({
	Platform: { OS: 'android', Version: 32 },
	AppState: { addEventListener: jest.fn() },
	NativeModules: { RNAlarmNotification: { exactAlarmPermission: jest.fn().mockResolvedValue(true) } },
	PermissionsAndroid: { request: jest.fn(), PERMISSIONS: { POST_NOTIFICATIONS: 'notifications' } },
}));
jest.mock('@joplin/utils/Logger', () => ({ __esModule: true, default: { create: () => ({ error: jest.fn() }) } }));
jest.mock('@joplin/react-native-alarm-notification', () => ({ __esModule: true, default: {
	getScheduledAlarms: mockGetAlarms, scheduleAlarm: mockSchedule, deleteAlarm: mockDelete, parseDate: (date: Date) => date.toString(),
} }));
jest.mock('./TodayService', () => ({ sourceNotes: mockNotes }));

import { startTodayNotifications, notificationText } from './TodayNotifications';

test('schedules each future timed line and links to its source note', async () => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date(2026, 10, 26, 9));
	mockNotes.mockResolvedValue([{ id: 'note1', title: 'Source', body: '- [ ] 26.11.2026 10:00\n- [ ] 26.11.2026 10:00\n- [x] 26.11.2026 11:00' }]);
	mockGetAlarms.mockResolvedValue([]);
	mockSchedule.mockResolvedValue({});
	startTodayNotifications();
	await jest.advanceTimersByTimeAsync(1500);
	expect(mockSchedule).toHaveBeenCalledTimes(2);
	expect(mockSchedule.mock.calls[0][0].data.noteId).toBe('note1');
	jest.useRealTimers();
});


test('removes Markdown checkbox and scheduled date and time from notification text', () => {
 expect(notificationText('- [ ] Лалалал 30/10/2026 13:48')).toBe('Лалалал');
 expect(notificationText('- [x] 30.10.2026 в 9:05 Сделать')).toBe('Сделать');
 expect(notificationText('- [ ] 30/10/2026 13:48')).toBe('Напоминание');
 expect(notificationText('Встреча 30.10.ey, 10:30')).toBe('Встреча');
});
