package com.fouremp.app;
import android.content.*;
public class RestoreReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent) { ReminderScheduler.all(c); }
}
