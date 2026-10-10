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
    private static PendingIntent completionIntent(Context c,long target) {
        return PendingIntent.getBroadcast(c,2,new Intent(c,ReminderReceiver.class).putExtra("id",2).putExtra("target",target),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void schedule(Context c, Store.Reminder r) {
        cancel(c,r.id);
        if(!r.enabled || !new Store(c).prefs.getBoolean("notifications",true)) return;
        Store store=new Store(c);
        long next;
        PendingIntent operation;
        if(r.id==2) {
            org.json.JSONObject active=store.active();
            if(active==null) return;
            next=store.target(active);
            if(store.silent(java.time.Instant.ofEpochMilli(next).atZone(ZoneId.systemDefault()).toLocalDate())) return;
            if(store.prefs.getLong("completionDelivered",0)==next) return;
            if(next<=System.currentTimeMillis()) { complete(c,next); return; }
            operation=completionIntent(c,next);
        } else {
            if(r.id==1 && store.workMinutes()>WorkMath.windowMinutes(store.dayStart(),store.dayEnd())) return;
            int minute=r.id==1?WorkMath.latestMinute(store.dayEnd(),store.workMinutes()):r.time;
            next=DayMath.nextReminder(System.currentTimeMillis(),ZoneId.systemDefault(),minute,r.days,store.silentDates());
            operation=intent(c,r.id);
        }
        AlarmManager manager=c.getSystemService(AlarmManager.class);
        try {
            if(precise(c)) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,operation);
            else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,operation);
        } catch(SecurityException denied) { manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,operation); }
    }
    static void complete(Context c,long expected) {
        Store store=new Store(c); org.json.JSONObject active=store.active();
        if(store.silent(java.time.LocalDate.now()) || store.silent(java.time.Instant.ofEpochMilli(expected).atZone(ZoneId.systemDefault()).toLocalDate())) return;
        if(active==null || store.target(active)!=expected || expected>System.currentTimeMillis() || store.prefs.getLong("completionDelivered",0)==expected) return;
        if(!store.prefs.getBoolean("notifications",true) || !c.getSystemService(NotificationManager.class).areNotificationsEnabled()) return;
        for(Store.Reminder r:store.reminders()) if(r.id==2 && r.enabled) {
            notify(c,2,r.title,r.message+" Your work goal is complete. Expected swipe out: "+java.time.Instant.ofEpochMilli(expected).atZone(ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))+".");
            store.prefs.edit().putLong("completionDelivered",expected).apply(); break;
        }
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
        if(!new Store(c).prefs.getBoolean("notifications",true) || new Store(c).silent(java.time.LocalDate.now())) return;
        NotificationManager manager=c.getSystemService(NotificationManager.class);
        if(!manager.areNotificationsEnabled()) return;
        PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,channel(c)).setSmallIcon(com.fouremp.app.R.drawable.ic_notification)
            .setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message))
            .setColor(0xFFBEF264).setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build();
        try { manager.notify(id,n); } catch(SecurityException denied) { /* Permission can be revoked while an alarm fires. */ }
    }
}
