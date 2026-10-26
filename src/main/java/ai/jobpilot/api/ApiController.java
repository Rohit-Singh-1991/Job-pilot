package ai.jobpilot.api;
import ai.jobpilot.core.JobScorer; import ai.jobpilot.core.JobScorer.JobInput; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api") public class ApiController {
 private final JobScorer scorer=new JobScorer();
 @GetMapping("/health") public Map<String,Object> health(){return Map.of("status","UP","application","JobPilot AI","mode","DRY_RUN","liveSubmissionEnabled",false);}
 @GetMapping("/connectors") public List<Map<String,Object>> connectors(){return List.of(c("linkedin","LinkedIn","MANUAL_HANDOFF","Use authorized integrations/user-provided links; no website scraping or automated activity."),c("naukri","Naukri","NOT_CONFIGURED","Verify current terms and authorized integration before automation."),c("indeed","Indeed","NOT_CONFIGURED","Use approved data access and permitted workflows."),c("foundit","Foundit","NOT_CONFIGURED","Use approved data access and permitted workflows."),c("instahyre","Instahyre","NOT_CONFIGURED","Use approved data access and permitted workflows."));}
 private Map<String,Object> c(String id,String name,String status,String note){return Map.of("id",id,"name",name,"status",status,"submissionEnabled",false,"note",note);}
 @PostMapping("/jobs/score") public JobScorer.Score score(@RequestBody JobInput input){return scorer.score(input);}
}
