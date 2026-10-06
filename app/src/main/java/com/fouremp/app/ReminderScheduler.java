package com.fouremp.app;

import android.app.*;
import android.content.*;
import android.os.Build;
import java.time.ZoneId;

final class ReminderScheduler {
    static PendingIntent intent(Context c, int id) {
        return PendingIntent.getBroadcast(c,id,new Intent(c,ReminderReceiver.class).putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void cancel(Context c,int id) { c.getSystemService(AlarmManager.class).cancel(intent(c,id)); }
    static boolean precise(Context c) { return Build.VERSION.SDK_INT<31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms(); }
    static void schedule(Context c, Store.Reminder r) {
        cancel(c,r.id);
        if(!r.enabled || !new Store(c).prefs.getBoolean("notifications",true)) return;
        long next=ScheduleMath.next(System.currentTimeMillis(),ZoneId.systemDefault(),r.time,r.days);
        AlarmManager manager=c.getSystemService(AlarmManager.class);
        try {
            if(precise(c)) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent(c,r.id));
            else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent(c,r.id));
        } catch(SecurityException denied) { manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent(c,r.id)); }
    }
    static void all(Context c) { for(Store.Reminder r:new Store(c).reminders()) schedule(c,r); }
    static String channel(Context c) {
        Store s=new Store(c);
        boolean sound=s.prefs.getBoolean("sound",true), vibration=s.prefs.getBoolean("vibration",true);
        String id="reminders_"+(sound?"sound":"silent")+"_"+(vibration?"vibrate":"still");
        NotificationChannel channel=new NotificationChannel(id,"Work reminders · "+(sound?"sound":"silent")+" · "+(vibration?"vibrate":"no vibration"),NotificationManager.IMPORTANCE_HIGH);
        if(!sound) channel.setSound(null,null);
        channel.enableVibration(vibration);
        channel.setDescription("Swipe, break and timesheet reminders");
        c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        return id;
    }
    static void notify(Context c,int id,String title,String message) {
        if(!new Store(c).prefs.getBoolean("notifications",true)) return;
        NotificationManager manager=c.getSystemService(NotificationManager.class);
        if(!manager.areNotificationsEnabled()) return;
        PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,channel(c)).setSmallIcon(com.fouremp.app.R.drawable.ic_notification)
            .setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message))
            .setColor(0xFFBEF264).setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build();
        try { manager.notify(id,n); } catch(SecurityException denied) { /* Permission can be revoked while an alarm fires. */ }
    }
}
