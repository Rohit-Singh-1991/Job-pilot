package ai.jobpilot.core;
import java.time.LocalDate;
import java.time.Instant;

/** Domain record for tracker workflows. Persistence is not wired in this starter yet. */
public record ApplicationRecord(String company, String role, String jobUrl, LocalDate applicationDate,
 String contactName, String contactEmail, String contactSourceUrl, String contactStatus,
 LocalDate followUpDate, String status, String resumeVersion, String confirmationEvidence,
 Instant updatedAt) {
 public ApplicationRecord {
  if (company == null || company.isBlank()) throw new IllegalArgumentException("Company is required");
  if (role == null || role.isBlank()) throw new IllegalArgumentException("Role is required");
  if (jobUrl == null || !jobUrl.startsWith("https://")) throw new IllegalArgumentException("HTTPS job URL required");
  if (status == null || status.isBlank()) status = "DISCOVERED";
  if ("SUBMITTED".equalsIgnoreCase(status) && (confirmationEvidence == null || confirmationEvidence.isBlank()))
   throw new IllegalArgumentException("Submission status requires confirmation evidence");
 }
 public boolean needsFollowUp(LocalDate today) {
  return followUpDate != null && !followUpDate.isAfter(today) && !"REJECTED".equalsIgnoreCase(status)
   && !"WITHDRAWN".equalsIgnoreCase(status) && !"OFFER".equalsIgnoreCase(status);
 }
}
