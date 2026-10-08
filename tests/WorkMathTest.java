import com.fouremp.app.WorkMath;
import java.time.*;
public class WorkMathTest {
    static int count;
    static void eq(long expected,long actual) { count++; if(expected!=actual) throw new AssertionError(expected+" != "+actual); }
    static long at(String value,ZoneId zone) { return LocalDateTime.parse(value).atZone(zone).toInstant().toEpochMilli(); }
    public static void main(String[] args) {
        ZoneId zone=ZoneId.of("Asia/Kolkata");
        long in=at("2026-10-07T09:04",zone);
        eq(at("2026-10-07T18:04",zone),WorkMath.target(in,540));
        eq(at("2026-10-07T15:04",zone),WorkMath.target(in,360));
        eq(at("2026-10-07T16:04",zone),WorkMath.target(in,420));
        eq(at("2026-10-07T15:34",zone),WorkMath.target(in,390));
        eq(at("2026-10-08T09:04",zone),WorkMath.target(in,1440));
        eq(at("2026-10-08T07:45",zone),WorkMath.target(at("2026-10-07T22:45",zone),540));
        eq(540,WorkMath.latestMinute(1080,540));
        eq(720,WorkMath.latestMinute(1080,360));
        eq(1320,WorkMath.latestMinute(420,540));
        eq(540,WorkMath.windowMinutes(1320,420));
        eq(1440,WorkMath.windowMinutes(540,540));
        long[] window=WorkMath.window(at("2026-10-08T02:00",zone),zone,1320,420);
        eq(at("2026-10-07T22:00",zone),window[0]); eq(at("2026-10-08T07:00",zone),window[1]);
        window=WorkMath.window(at("2026-10-07T19:00",zone),zone,540,1080);
        eq(at("2026-10-08T09:00",zone),window[0]); eq(at("2026-10-08T18:00",zone),window[1]);
        eq(0,(long)(WorkMath.progress(-1,540)*100));
        eq(50,(long)(WorkMath.progress(270*60000L,540)*100));
        eq(100,(long)(WorkMath.progress(600*60000L,540)*100));
        ZoneId ny=ZoneId.of("America/New_York");
        long dst=at("2026-03-08T00:00",ny);
        eq(9*3600000L,WorkMath.target(dst,540)-dst);
        try { WorkMath.target(in,0); throw new AssertionError(); } catch(IllegalArgumentException expected) { count++; }
        System.out.println("Passed "+count+" work-goal and progress checks.");
    }
}
