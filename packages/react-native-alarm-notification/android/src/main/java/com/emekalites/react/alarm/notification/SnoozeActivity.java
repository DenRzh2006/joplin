package com.emekalites.react.alarm.notification;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.text.InputType;
import android.view.WindowManager;
import android.widget.EditText;

/** Opens from a reminder and schedules a new alarm only after validating minutes. */
public class SnoozeActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        int alarmId = getIntent().getIntExtra("SnoozeAlarmId", -1);
        AlarmDatabase database = new AlarmDatabase(this);
        AlarmModel alarm = database.getAlarm(alarmId);
        if (alarm == null) {
            finish();
            return;
        }

        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setSingleLine(true);
        input.setHint("Минуты, от 1 до 525600");
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Напомнить позже")
                .setMessage(alarm.getMessage())
                .setView(input)
                .setPositiveButton("Напомнить", null)
                .setNegativeButton("Отмена", (d, which) -> finish())
                .setOnCancelListener(d -> finish())
                .create();
        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
                int minutes = SnoozeMinutes.parse(input.getText().toString());
                if (minutes < 0) {
                    input.setError("Введите целое число от 1 до 525600");
                    return;
                }
                AlarmUtil util = new AlarmUtil(getApplication());
                util.removeFiredNotification(alarm.getId());
                alarm.setSnoozeInterval(minutes);
                util.snoozeAlarm(alarm);
                dialog.dismiss();
                finish();
            });
            input.requestFocus();
            dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        });
        dialog.show();
    }
}
