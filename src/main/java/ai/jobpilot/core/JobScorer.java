package ai.jobpilot.core;
import java.util.*;
public class JobScorer {
 public record JobInput(String title,String description,List<String> requiredSkills,String preferredLocation,String workMode,Double yearsRequired){}
 public record Score(int score,List<String> matchedSkills,List<String> missingSkills,String rationale,boolean eligibleForReview){}
 public Score score(JobInput input){ if(input==null) throw new IllegalArgumentException("Job input required"); String text=((input.title()==null?"":input.title())+" "+(input.description()==null?"":input.description())).toLowerCase(Locale.ROOT); List<String> req=Optional.ofNullable(input.requiredSkills()).orElse(List.of()).stream().filter(Objects::nonNull).map(String::trim).filter(s->!s.isBlank()).distinct().toList(); List<String> matched=req.stream().filter(s->text.contains(s.toLowerCase(Locale.ROOT))).toList(); List<String> missing=req.stream().filter(s->!matched.contains(s)).toList(); int skills=req.isEmpty()?0:(int)Math.round(70.0*matched.size()/req.size()); String title=input.title()==null?"":input.title().toLowerCase(Locale.ROOT); int bonus=(title.contains("java")?10:0)+(title.contains("angular")?10:0); int score=Math.min(100,skills+bonus); return new Score(score,matched,missing,"Preliminary keyword score only; verify seniority, experience, location, salary and mandatory requirements.",score>=50); }
}
