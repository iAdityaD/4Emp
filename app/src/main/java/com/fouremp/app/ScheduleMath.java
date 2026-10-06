package com.fouremp.app;

import java.time.*;

public final class ScheduleMath {
    private ScheduleMath() {}
    // ISO weekdays: bit 0 = Monday, bit 6 = Sunday. Resolve DST in the device zone.
    public static long next(long now, ZoneId zone, int minutes, int days) {
        if (minutes < 0 || minutes >= 1440 || (days & 127) == 0) throw new IllegalArgumentException("Invalid schedule");
        LocalDate date = Instant.ofEpochMilli(now).atZone(zone).toLocalDate();
        for (int i = 0; i <= 7; i++) {
            LocalDate candidate = date.plusDays(i);
            if ((days & (1 << (candidate.getDayOfWeek().getValue() - 1))) == 0) continue;
            long time = candidate.atTime(minutes / 60, minutes % 60).atZone(zone).toInstant().toEpochMilli();
            if (time > now) return time;
        }
        throw new IllegalStateException("No next occurrence");
    }
    public static long duration(long in, long out, long now) {
        return in <= 0 ? 0 : Math.max(0, (out > 0 ? out : now) - in);
    }
}
