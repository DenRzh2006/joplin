"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        getScheduledAlarms: mockGetAlarms, scheduleAlarm: mockSchedule, deleteAlarm: mockDelete, parseDate: (date) => date.toString(),
    } }));
jest.mock('./TodayService', () => ({ sourceNotes: mockNotes }));
const TodayNotifications_1 = require("./TodayNotifications");
test('schedules each future timed line and links to its source note', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 26, 9));
    mockNotes.mockResolvedValue([{ id: 'note1', title: 'Source', body: '- [ ] 26.11.2026 10:00\n- [ ] 26.11.2026 10:00\n- [x] 26.11.2026 11:00' }]);
    mockGetAlarms.mockResolvedValue([]);
    mockSchedule.mockResolvedValue({});
    (0, TodayNotifications_1.startTodayNotifications)();
    await jest.advanceTimersByTimeAsync(1500);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockSchedule.mock.calls[0][0].data.noteId).toBe('note1');
    jest.useRealTimers();
});
//# sourceMappingURL=TodayNotifications.test.js.map