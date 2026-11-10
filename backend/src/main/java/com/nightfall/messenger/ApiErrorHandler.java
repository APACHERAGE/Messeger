package com.nightfall.messenger;

import com.nightfall.messenger.auth.RateLimitException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrorHandler {
  @ExceptionHandler(RateLimitException.class)
  public ResponseEntity<Map<String, String>> rateLimit(RateLimitException exception) {
    String message = exception.getReason() == null ? "Too many attempts. Try again later." : exception.getReason();
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
      .header("Retry-After", Long.toString(exception.retryAfterSeconds()))
      .body(Map.of("message", message));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> status(ResponseStatusException exception) {
    String message = exception.getReason() == null ? "Request failed." : exception.getReason();
    return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", message));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<Map<String, String>> uploadTooLarge(MaxUploadSizeExceededException exception) {
    return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
      .body(Map.of("message", "Upload is too large. Attach at most 4 files and keep the whole request under 31 MB."));
  }

  @ExceptionHandler(MultipartException.class)
  public ResponseEntity<Map<String, String>> uploadBroken(MultipartException exception) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
      .body(Map.of("message", "The upload could not be read. Try again with fewer or smaller files."));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> validation(MethodArgumentNotValidException exception) {
    String message = exception.getBindingResult().getFieldErrors().stream()
      .findFirst()
      .map(error -> {
        boolean missing = error.getCode() != null && error.getCode().startsWith("Not");
        return switch (error.getField()) {
          case "email" -> "Enter a valid email address.";
          case "username" -> "Username must contain 3–24 letters, numbers, or underscores.";
          case "password" -> "Password must contain 10–72 characters.";
          case "confirmPassword", "passwordConfirmationValid" -> "Passwords do not match.";
          case "firstName" -> missing ? "Enter your first name." : "First name must be 48 characters or fewer.";
          case "lastName" -> missing ? "Enter your last name." : "Last name must be 48 characters or fewer.";
          case "title" -> missing ? "Title cannot be empty." : "Title is too long.";
          case "body" -> "Text cannot be empty or exceed the allowed length.";
          case "recipient" -> "Enter a registered Nightfall mailbox in the form username@nf.com.";
          case "subject" -> "Subject cannot be empty or longer than 160 characters.";
          case "website" -> "Website must be a valid http:// or https:// address.";
          case "githubUsername" -> "Enter a GitHub username without @ or a URL.";
          case "avatarDataUrl" -> "Avatar must be a PNG, JPEG, GIF, or WebP image under 1 MB.";
          default -> "Check the submitted fields.";
        };
      })
      .orElse("Check the submitted fields.");
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
  }
}
