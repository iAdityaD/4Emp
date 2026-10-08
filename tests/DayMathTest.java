import com.fouremp.app.DayMath;
import java.time.*;
import java.util.*;
public class DayMathTest {
    static int count;
    static void check(boolean value) { count++; if(!value) throw new AssertionError("Check "+count+" failed"); }
    static long at(String value,ZoneId zone) { return LocalDateTime.parse(value).atZone(zone).toInstant().toEpochMilli(); }
    public static void main(String[] args) {
        ZoneId zone=ZoneId.of("Asia/Kolkata");
        check(DayMath.weekend(LocalDate.parse("2026-10-10"),96));
        check(!DayMath.weekend(LocalDate.parse("2026-10-09"),96));
        check(DayMath.weekend(LocalDate.parse("2026-10-09"),48));
        check(!DayMath.weekend(LocalDate.parse("2026-10-10"),0));
        long in=at("2026-10-08T22:00",zone),out=at("2026-10-09T06:00",zone);
        check(DayMath.worked(LocalDate.parse("2026-10-08"),in,out,out,zone));
        check(DayMath.worked(LocalDate.parse("2026-10-09"),in,out,out,zone));
        check(!DayMath.worked(LocalDate.parse("2026-10-10"),in,out,out,zone));
        check(!DayMath.worked(LocalDate.parse("2026-10-09"),in,at("2026-10-09T00:00",zone),out,zone));
        check(DayMath.worked(LocalDate.parse("2026-10-09"),in,0,out,zone));
        Set<LocalDate> silent=new HashSet<>(); silent.add(LocalDate.parse("2026-10-08")); silent.add(LocalDate.parse("2026-10-09"));
        check(DayMath.nextReminder(at("2026-10-08T08:00",zone),zone,540,31,silent)==at("2026-10-12T09:00",zone));
        check(DayMath.nextReminder(at("2026-10-08T08:00",zone),zone,780,127,silent)==at("2026-10-10T13:00",zone));
        check(DayMath.nextReminder(at("2026-10-09T21:00",zone),zone,1320,127,silent)==at("2026-10-10T22:00",zone));
        check(DayMath.nextReminder(at("2026-10-08T08:00",zone),zone,540,31,Collections.emptySet())==at("2026-10-08T09:00",zone));
        System.out.println("Passed "+count+" calendar and silent-day checks.");
    }
}
