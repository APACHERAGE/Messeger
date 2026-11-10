package com.nightfall.messenger.auth;

import jakarta.mail.MessagingException;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.HtmlUtils;

@Service
public class RegistrationMailService {
  private static final Logger log = LoggerFactory.getLogger(RegistrationMailService.class);

  private final ObjectProvider<JavaMailSender> mailSenders;

  @Value("${app.mail.mode:disabled}")
  private String mode;

  @Value("${app.mail.from:no-reply@nightfall.local}")
  private String from;

  @Value("${app.auth.public-url:http://127.0.0.1:5173}")
  private String publicUrl;

  @Value("${app.auth.public-url-file:}")
  private String publicUrlFile;

  public RegistrationMailService(ObjectProvider<JavaMailSender> mailSenders) {
    this.mailSenders = mailSenders;
  }

  public void sendVerification(AuthUserEntity user, String token) {
    String link = publicBaseUrl() + "/?verify=" + token;
    if ("console".equalsIgnoreCase(mode)) {
      log.warn("Development-only verification link for {}: {}", user.email, link);
      return;
    }
    if (!"smtp".equalsIgnoreCase(mode)) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email delivery is not configured");
    }

    JavaMailSender mailSender = mailSenders.getIfAvailable();
    if (mailSender == null) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SMTP mail sender is unavailable");
    }

    try {
      var message = mailSender.createMimeMessage();
      var helper = new MimeMessageHelper(message, true, "UTF-8");
      String firstName = HtmlUtils.htmlEscape(user.firstName);
      helper.setFrom(from);
      helper.setTo(user.email);
      helper.setSubject("Welcome to Nightfall — verify your email");
      helper.setText(
        "Hello, " + user.firstName + "!\n\n"
          + "Welcome to Nightfall. To finish creating your account, verify your email address using this link:\n"
          + link + "\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this message.\n\nThe Nightfall team",
        "<!doctype html><html lang=\"en\"><body style=\"margin:0;padding:32px;background:#0b1016;color:#efe7d5;font-family:Arial,sans-serif\">"
          + "<div style=\"max-width:560px;margin:0 auto;padding:32px;background:#121923;border:1px solid #34424c;border-radius:12px\">"
          + "<p style=\"color:#71d4e5;letter-spacing:2px;font-size:12px\">NIGHTFALL / WELCOME</p>"
          + "<h1 style=\"font-size:26px\">Welcome, " + firstName + "!</h1>"
          + "<p style=\"line-height:1.7;color:#c5cbd0\">Welcome to Nightfall. Verify your email address to finish creating your account.</p>"
          + "<p style=\"margin:28px 0\"><a href=\"" + HtmlUtils.htmlEscape(link) + "\" style=\"padding:13px 20px;background:#71d4e5;color:#091216;text-decoration:none;border-radius:6px;font-weight:bold\">Verify email</a></p>"
          + "<p style=\"font-size:13px;line-height:1.7;color:#929da5\">This link expires in 24 hours. If you did not create an account, you can ignore this message.</p>"
          + "<p style=\"margin-top:30px;color:#929da5\">The Nightfall team</p></div></body></html>"
      );
      mailSender.send(message);
    } catch (MessagingException | org.springframework.mail.MailException exception) {
      log.error("Could not send verification email to {}", user.email, exception);
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send verification email");
    }
  }

  public void sendInvitation(String recipient, String inviterName, String inviteCode) {
    if (!"smtp".equalsIgnoreCase(mode)) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email invitations need SMTP delivery");
    }
    JavaMailSender mailSender = mailSenders.getIfAvailable();
    if (mailSender == null) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SMTP mail sender is unavailable");
    }
    String link = publicBaseUrl() + "/#invite=" + URLEncoder.encode(inviteCode, StandardCharsets.UTF_8);
    String cleanName = inviterName == null || inviterName.isBlank() ? "A Nightfall member" : inviterName.trim();
    try {
      var message = mailSender.createMimeMessage();
      var helper = new MimeMessageHelper(message, true, "UTF-8");
      helper.setFrom(from);
      helper.setTo(recipient);
      helper.setSubject("You're invited to Nightfall");
      helper.setText(
        "Hello!\n\n" + cleanName + " invited you to Nightfall. Open this link to create your account:\n"
          + link + "\n\nEnter your email address on the registration page. We will send a separate verification link to it.\n\nThe Nightfall team",
        "<!doctype html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;background:#0b1016;color:#efe7d5;padding:32px\">"
          + "<div style=\"max-width:560px;margin:auto;padding:32px;background:#121923\">"
          + "<h1>You're invited to Nightfall</h1><p>" + HtmlUtils.htmlEscape(cleanName) + " invited you to join.</p>"
          + "<p><a href=\"" + HtmlUtils.htmlEscape(link) + "\" style=\"color:#71d4e5\">Create your account</a></p>"
          + "<p>We'll send a separate verification link to the email address you enter on the registration page.</p>"
          + "</div></body></html>"
      );
      mailSender.send(message);
    } catch (MessagingException | org.springframework.mail.MailException exception) {
      log.error("Could not send invitation email to {}", recipient, exception);
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send invitation email");
    }
  }

  public void sendPasswordReset(AuthUserEntity user, String token) {
      String link = publicBaseUrl() + "/reset-password?token=" + token;
      if ("console".equalsIgnoreCase(mode)) {
        log.warn("Development-only password reset link for {}: {}", user.email, link);
        return;
      }
      if (!"smtp".equalsIgnoreCase(mode)) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email delivery is not configured");
      }
      JavaMailSender mailSender = mailSenders.getIfAvailable();
      if (mailSender == null) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SMTP mail sender is unavailable");
      }
      try {
        var message = mailSender.createMimeMessage();
        var helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(from);
        helper.setTo(user.email);
        helper.setSubject("Reset your Nightfall password");
        helper.setText(
          "A password reset was requested for your Nightfall account.\n\n"
            + "Use this link within 30 minutes:\n" + link
            + "\n\nIf you did not request this, you can ignore this message.",
          "<!doctype html><html lang=\"en\"><body><p>A password reset was requested for your Nightfall account.</p>"
            + "<p><a href=\"" + HtmlUtils.htmlEscape(link) + "\">Reset password</a></p>"
            + "<p>This link expires in 30 minutes. If you did not request this, ignore this email.</p></body></html>"
        );
        mailSender.send(message);
      } catch (MessagingException | org.springframework.mail.MailException exception) {
        log.error("Could not send password reset email to {}", user.email, exception);
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send password reset email");
    }
  }

  private String publicBaseUrl() {
    String url = publicUrl;
    if (publicUrlFile != null && !publicUrlFile.isBlank()) {
      try {
        url = Files.readString(Path.of(publicUrlFile), StandardCharsets.UTF_8).trim();
      } catch (IOException | IllegalArgumentException exception) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Public invitation URL is unavailable");
      }
    }
    try {
      URI parsed = URI.create(url);
      if (!("https".equalsIgnoreCase(parsed.getScheme()) || "http".equalsIgnoreCase(parsed.getScheme()))
          || parsed.getHost() == null || parsed.getRawUserInfo() != null
          || parsed.getRawQuery() != null || parsed.getRawFragment() != null) {
        throw new IllegalArgumentException("Invalid public URL");
      }
      return url.replaceAll("/+$", "");
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Public invitation URL is not configured");
    }
  }
}
