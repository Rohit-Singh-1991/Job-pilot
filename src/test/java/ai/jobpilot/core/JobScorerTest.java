package ai.jobpilot.core;
import org.junit.jupiter.api.Test; import java.util.List; import static org.junit.jupiter.api.Assertions.*;
class JobScorerTest {
 @Test void scoresRelevantRole(){var r=new JobScorer().score(new JobScorer.JobInput("Senior Java Angular Developer","Spring Boot Angular REST",List.of("Java","Spring Boot","Angular"),"Delhi NCR","Hybrid",8.0));assertTrue(r.score()>=50);assertEquals(3,r.matchedSkills().size());assertTrue(r.missingSkills().isEmpty());}
 @Test void rejectsPoorMatchForReview(){var r=new JobScorer().score(new JobScorer.JobInput("Designer","Portfolio design",List.of("Java","Angular"),"Delhi NCR","Remote",8.0));assertFalse(r.eligibleForReview());assertEquals(2,r.missingSkills().size());}
}
