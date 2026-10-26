package ai.jobpilot.core;
import org.junit.jupiter.api.Test; import java.time.*; import static org.junit.jupiter.api.Assertions.*;
class ApplicationRecordTest {
 @Test void submittedRequiresEvidence(){assertThrows(IllegalArgumentException.class,()->new ApplicationRecord("Acme","Java Developer","https://example.com/job",LocalDate.now(),null,null,null,null,null,"SUBMITTED",null,null,Instant.now()));}
 @Test void followUpCanBeDetected(){var a=new ApplicationRecord("Acme","Java Developer","https://example.com/job",LocalDate.now(),null,null,null,null,LocalDate.now(),"APPLIED",null,null,Instant.now());assertTrue(a.needsFollowUp(LocalDate.now()));}
}
