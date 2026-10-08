package com.fouremp.app;
import android.content.*;
import java.time.*;
public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent) {
        int id=intent.getIntExtra("id",-1);
        if(id==2) {
            ReminderScheduler.complete(c,intent.getLongExtra("target",-1));
            ReminderScheduler.all(c); return;
        }
        for(Store.Reminder r:new Store(c).reminders()) if(r.id==id) {
            // Re-check enabled days: an old alarm may race with an edit or a clock change.
            int today=LocalDate.now().getDayOfWeek().getValue()-1;
            if(r.enabled && !new Store(c).silent(LocalDate.now()) && (r.days & (1<<today))!=0) {
                Store store=new Store(c);
                String message=r.message;
                if(r.id==1) message+=" Swipe in by "+String.format(java.util.Locale.getDefault(),"%02d:%02d",WorkMath.latestMinute(store.dayEnd(),store.workMinutes())/60,WorkMath.latestMinute(store.dayEnd(),store.workMinutes())%60)+" to finish by "+String.format(java.util.Locale.getDefault(),"%02d:%02d",store.dayEnd()/60,store.dayEnd()%60)+".";
                ReminderScheduler.notify(c,r.id,r.title,message);
            }
            ReminderScheduler.schedule(c,r); break;
        }
    }
}
