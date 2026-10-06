import com.fouremp.app.ScheduleMath;
import java.time.*;

public class ScheduleMathTest {
    static int count;
    static void eq(long expected,long actual) {
        count++; if(expected!=actual) throw new AssertionError("Expected "+expected+" got "+actual);
    }
    static long at(String value,ZoneId zone) { return LocalDateTime.parse(value).atZone(zone).toInstant().toEpochMilli(); }
    public static void main(String[] args) {
        ZoneId india=ZoneId.of("Asia/Kolkata");
        eq(at("2026-10-06T09:00",india),ScheduleMath.next(at("2026-10-06T08:59",india),india,540,31));
        eq(at("2026-10-07T09:00",india),ScheduleMath.next(at("2026-10-06T09:00",india),india,540,31));
        eq(at("2026-10-12T09:00",india),ScheduleMath.next(at("2026-10-09T18:00",india),india,540,31));
        eq(at("2026-10-11T13:00",india),ScheduleMath.next(at("2026-10-06T22:00",india),india,780,64));
        eq(at("2026-10-07T00:00",india),ScheduleMath.next(at("2026-10-06T23:59",india),india,0,127));
        ZoneId ny=ZoneId.of("America/New_York");
        // Spring DST gap resolves forward; fall overlap resolves to the earlier offset.
        eq(at("2026-03-08T03:30",ny),ScheduleMath.next(at("2026-03-07T23:00",ny),ny,150,127));
        eq(at("2026-11-01T01:30",ny),ScheduleMath.next(at("2026-10-31T23:00",ny),ny,90,127));
        eq(at("2026-10-07T09:00",ZoneId.of("UTC")),ScheduleMath.next(at("2026-10-06T22:00",ZoneId.of("UTC")),ZoneId.of("UTC"),540,31));
        long start=at("2026-10-06T22:00",india),end=at("2026-10-07T06:00",india);
        eq(8*3600000L,ScheduleMath.duration(start,end,end));
        eq(8*3600000L,ScheduleMath.duration(start,0,end));
        eq(0,ScheduleMath.duration(0,0,end));
        eq(0,ScheduleMath.duration(end,start,end));
        for(int[] invalid:new int[][]{{540,0},{-1,31},{1440,31}}) {
            try { ScheduleMath.next(start,india,invalid[0],invalid[1]); throw new AssertionError("Invalid schedule accepted"); }
            catch(IllegalArgumentException expected) { count++; }
        }
        System.out.println("Passed "+count+" schedule and shift checks.");
    }
}
