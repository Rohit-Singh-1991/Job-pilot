package ai.jobpilot.core;
import java.net.URI; import java.util.Locale; import java.util.regex.Pattern;
public record RecruiterContact(String name,String email,String sourceUrl,String context){
 private static final Pattern EMAIL=Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",Pattern.CASE_INSENSITIVE);
 public RecruiterContact { if(email==null||!EMAIL.matcher(email.trim()).matches()) throw new IllegalArgumentException("Use only a valid explicitly published email; never guess addresses."); if(sourceUrl==null||sourceUrl.isBlank()) throw new IllegalArgumentException("Contact source URL required."); URI uri=URI.create(sourceUrl); if(!"https".equalsIgnoreCase(uri.getScheme())&& !"http".equalsIgnoreCase(uri.getScheme())) throw new IllegalArgumentException("Source must use HTTP(S)."); email=email.trim().toLowerCase(Locale.ROOT); }
}
