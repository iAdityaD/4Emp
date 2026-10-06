package com.fouremp.app;

import android.content.*;
import org.json.*;
import java.util.*;

final class Store {
    final SharedPreferences prefs;
    Store(Context context) { prefs = context.getSharedPreferences("4emp", Context.MODE_PRIVATE); }
    static final class Reminder {
        int id, time, days; String title, message; boolean enabled;
        Reminder(int id, String title, String message, int time, int days, boolean enabled) {
            this.id=id; this.title=title; this.message=message; this.time=time; this.days=days; this.enabled=enabled;
        }
        JSONObject json() throws JSONException {
            return new JSONObject().put("id",id).put("title",title).put("message",message).put("time",time).put("days",days).put("enabled",enabled);
        }
    }
    List<Reminder> reminders() {
        List<Reminder> list = new ArrayList<>();
        String saved = prefs.getString("reminders",null);
        if (saved == null) {
            list.add(new Reminder(1,"Swipe in","Time to start your workday. Record your swipe in.",540,31,true));
            list.add(new Reminder(2,"Swipe out","Your workday is ending. Record your swipe out.",1080,31,true));
            list.add(new Reminder(3,"Timesheet","Take a moment to fill your timesheet.",1050,31,true));
            list.add(new Reminder(4,"Lunch break","Step away and enjoy your lunch.",780,31,true));
            list.add(new Reminder(5,"Tea break","A little pause. Time for tea.",960,31,true));
            saveReminders(list); return list;
        }
        try {
            JSONArray a = new JSONArray(saved);
            for(int i=0;i<a.length();i++) {
                JSONObject o=a.getJSONObject(i);
                list.add(new Reminder(o.getInt("id"),o.getString("title"),o.getString("message"),o.getInt("time"),o.getInt("days"),o.getBoolean("enabled")));
            }
        } catch (JSONException e) { throw new IllegalStateException("Unable to read saved reminders",e); }
        return list;
    }
    void saveReminders(List<Reminder> list) {
        JSONArray a=new JSONArray();
        try { for(Reminder r:list) a.put(r.json()); } catch(JSONException e) { throw new IllegalStateException(e); }
        prefs.edit().putString("reminders",a.toString()).apply();
    }
    JSONArray shifts() {
        try { return new JSONArray(prefs.getString("shifts","[]")); }
        catch(JSONException e) { throw new IllegalStateException(e); }
    }
    JSONObject active() {
        JSONArray a=shifts();
        if(a.length()==0) return null;
        JSONObject last=a.optJSONObject(a.length()-1);
        return last.optLong("out")==0 ? last : null;
    }
    void swipe() {
        JSONArray a=shifts(); long now=System.currentTimeMillis();
        try {
            if(active()!=null) a.getJSONObject(a.length()-1).put("out",now);
            else a.put(new JSONObject().put("in",now).put("out",0));
        } catch(JSONException e) { throw new IllegalStateException(e); }
        prefs.edit().putString("shifts",a.toString()).apply();
    }
    void editShift(int index, long in, long out) {
        if(in<=0 || (out!=0 && out<in) || in>System.currentTimeMillis() || out>System.currentTimeMillis()) throw new IllegalArgumentException("Choose valid times in the past; swipe out must follow swipe in.");
        JSONArray a=shifts();
        try { a.getJSONObject(index).put("in",in).put("out",out); } catch(JSONException e) { throw new IllegalStateException(e); }
        prefs.edit().putString("shifts",a.toString()).apply();
    }
    int newId() { int id=prefs.getInt("nextId",100); prefs.edit().putInt("nextId",id+1).apply(); return id; }
}
