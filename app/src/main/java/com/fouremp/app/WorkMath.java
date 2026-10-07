package com.fouremp.app;

import java.time.*;

/** Elapsed work duration is absolute; day boundaries follow the device timezone. */
public final class WorkMath {
    private WorkMath() {}
    public static long target(long swipeIn, int minutes) {
        if(minutes<=0 || minutes>1440) throw new IllegalArgumentException("Work duration must be between 1 minute and 24 hours");
        return swipeIn + minutes * 60000L;
    }
    public static double progress(long elapsed, int minutes) {
        return Math.max(0, Math.min(1, (double)elapsed / (minutes * 60000L)));
    }
    public static int windowMinutes(int start,int end) {
        int result=(end-start+1440)%1440;
        return result==0?1440:result;
    }
    public static int latestMinute(int end,int minutes) { return (end-minutes+1440)%1440; }
    // The window containing now, or the next window if today's window has ended.
    public static long[] window(long now, ZoneId zone, int start, int end) {
        ZonedDateTime local=Instant.ofEpochMilli(now).atZone(zone);
        LocalDate date=local.toLocalDate();
        if(end<=start && local.toLocalTime().isBefore(LocalTime.of(end/60,end%60))) date=date.minusDays(1);
        long from=at(date,start,zone), to=at(end<=start?date.plusDays(1):date,end,zone);
        if(now>=to) {
            date=date.plusDays(1); from=at(date,start,zone); to=at(end<=start?date.plusDays(1):date,end,zone);
        }
        return new long[]{from,to};
    }
    private static long at(LocalDate date,int minute,ZoneId zone) {
        return date.atTime(minute/60,minute%60).atZone(zone).toInstant().toEpochMilli();
    }
}
