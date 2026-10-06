package com.fouremp.app;
import android.content.*;
import java.time.*;
public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent) {
        int id=intent.getIntExtra("id",-1);
        for(Store.Reminder r:new Store(c).reminders()) if(r.id==id) {
            // Re-check enabled days: an old alarm may race with an edit or a clock change.
            int today=LocalDate.now().getDayOfWeek().getValue()-1;
            if(r.enabled && (r.days & (1<<today))!=0) ReminderScheduler.notify(c,r.id,r.title,r.message);
            ReminderScheduler.schedule(c,r); break;
        }
    }
}
