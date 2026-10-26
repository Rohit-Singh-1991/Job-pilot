package ai.jobpilot.core;
/** A draft only; sending must require explicit user approval in the eventual UI. */
public record OutreachDraft(String recipientName, String role, String company, String strength,
 String appliedStatus, String question) {
 public String render() {
  String greeting = recipientName == null || recipientName.isBlank() ? "Hello" : "Hi " + recipientName.trim();
  String strengthText = strength == null || strength.isBlank() ? "my relevant experience" : strength.trim();
  String appliedText = "true".equalsIgnoreCase(appliedStatus) ? "I recently applied for the " + role + " role at " + company + ". " : "I’m reaching out about the " + role + " opportunity at " + company + ". ";
  String ask = question == null || question.isBlank() ? "Would you be the right person to speak with about the role?" : question.trim();
  String body = greeting + ",\\n\\n" + appliedText + "My background in " + strengthText + " looks relevant to the position. " + ask + "\\n\\nThank you";
  if (body.length() > 700) return body.substring(0, 697) + "...";
  return body;
 }
}
