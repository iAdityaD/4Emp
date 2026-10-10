package com.fouremp.app;

import android.content.*;
import org.json.*;
import java.util.*;
import java.time.*;

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
    int workMinutes() { return prefs.getInt("workMinutes",540); }
    int dayStart() { return prefs.getInt("dayStart",540); }
    int dayEnd() { return prefs.getInt("dayEnd",1080); }
    int shiftMinutes(JSONObject shift) { return shift.optInt("workMinutes",540); }
    long target(JSONObject shift) { return WorkMath.target(shift.optLong("in"),shiftMinutes(shift)); }
    void swipe() {
        JSONArray a=shifts(); long now=System.currentTimeMillis();
        try {
            if(active()!=null) a.getJSONObject(a.length()-1).put("out",now);
            else a.put(new JSONObject().put("in",now).put("out",0).put("workMinutes",workMinutes()));
        } catch(JSONException e) { throw new IllegalStateException(e); }
        prefs.edit().putString("shifts",a.toString()).apply();
    }
    void editShift(int index, long in, long out) {
        if(in<=0 || (out!=0 && out<in) || in>System.currentTimeMillis() || out>System.currentTimeMillis()) throw new IllegalArgumentException("Choose valid times in the past; swipe out must follow swipe in.");
        JSONArray a=shifts();
        try { a.getJSONObject(index).put("in",in).put("out",out); } catch(JSONException e) { throw new IllegalStateException(e); }
        prefs.edit().putString("shifts",a.toString()).apply();
    }
    JSONObject calendarDays() {
        try { return new JSONObject(prefs.getString("calendarDays","{}")); }
        catch(JSONException e) { throw new IllegalStateException(e); }
    }
    String dayMark(LocalDate date) { return calendarDays().optString(date.toString(),""); }
    void markDay(LocalDate date,String mark) {
        JSONObject days=calendarDays();
        try { if(mark.isEmpty()) days.remove(date.toString()); else days.put(date.toString(),mark); }
        catch(JSONException e) { throw new IllegalStateException(e); }
        prefs.edit().putString("calendarDays",days.toString()).apply();
    }
    Set<LocalDate> silentDates() {
        Set<LocalDate> result=new HashSet<>(); JSONObject days=calendarDays(); Iterator<String> keys=days.keys();
        while(keys.hasNext()) { String key=keys.next(); String mark=days.optString(key); if(mark.equals("leave") || mark.equals("holiday")) result.add(LocalDate.parse(key)); }
        return result;
    }
    boolean silent(LocalDate date) { String mark=dayMark(date); return mark.equals("leave") || mark.equals("holiday"); }
    boolean weekend(LocalDate date) { return DayMath.weekend(date,prefs.getInt("weekends",96)); }
    Set<LocalDate> workedDates(YearMonth month) {
        Set<LocalDate> result=new HashSet<>(); JSONArray shifts=shifts(); JSONObject marks=calendarDays();
        for(int day=1;day<=month.lengthOfMonth();day++) {
            LocalDate date=month.atDay(day);
            if(marks.optString(date.toString()).equals("worked")) result.add(date);
            for(int i=0;i<shifts.length();i++) { JSONObject shift=shifts.optJSONObject(i); if(DayMath.worked(date,shift.optLong("in"),shift.optLong("out"),System.currentTimeMillis(),ZoneId.systemDefault())) { result.add(date); break; } }
        }
        return result;
    }
    void changeWorkMinutes(int minutes,boolean updateActive) {
        WorkMath.target(0,minutes); prefs.edit().putInt("workMinutes",minutes).apply();
        JSONArray shifts=shifts();
        if(updateActive && active()!=null) {
            try { shifts.getJSONObject(shifts.length()-1).put("workMinutes",minutes); } catch(JSONException e) { throw new IllegalStateException(e); }
            prefs.edit().putString("shifts",shifts.toString()).apply();
        }
    }
    int newId() { int id=prefs.getInt("nextId",100); prefs.edit().putInt("nextId",id+1).apply(); return id; }
}
