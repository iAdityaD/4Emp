package com.fouremp.app;

import java.time.*;
import java.util.Set;

public final class DayMath {
    private DayMath() {}
    public static boolean weekend(LocalDate date,int mask) { return (mask & (1 << (date.getDayOfWeek().getValue()-1)))!=0; }
    public static boolean worked(LocalDate date,long in,long out,long now,ZoneId zone) {
        LocalDate first=Instant.ofEpochMilli(in).atZone(zone).toLocalDate();
        long last=out>0?Math.max(in,out-1):Math.max(in,now);
        LocalDate end=Instant.ofEpochMilli(last).atZone(zone).toLocalDate();
        return !date.isBefore(first) && !date.isAfter(end);
    }
    public static long nextReminder(long now,ZoneId zone,int minute,int days,Set<LocalDate> silent) {
        long candidate=ScheduleMath.next(now,zone,minute,days);
        for(int i=0;i<=silent.size();i++) {
            if(!silent.contains(Instant.ofEpochMilli(candidate).atZone(zone).toLocalDate())) return candidate;
            candidate=ScheduleMath.next(candidate,zone,minute,days);
        }
        throw new IllegalStateException("No eligible reminder date");
    }
}
