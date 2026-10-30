package com.emekalites.react.alarm.notification;

final class SnoozeMinutes {
    private SnoozeMinutes() {}

    static int parse(String value) {
        if (value == null || !value.matches("[0-9]{1,6}")) return -1;
        try {
            int minutes = Integer.parseInt(value);
            return minutes >= 1 && minutes <= 525600 ? minutes : -1;
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
