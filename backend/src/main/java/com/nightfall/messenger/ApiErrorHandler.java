package com.nightfall.messenger;

import com.nightfall.messenger.auth.RateLimitException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
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

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> validation(MethodArgumentNotValidException exception) {
    String message = exception.getBindingResult().getFieldErrors().stream()
      .findFirst()
      .map(error -> switch (error.getField()) {
        case "email" -> "Enter a valid email address.";
        case "username" -> "Username must contain 3–24 letters, numbers, or underscores.";
        case "password" -> "Password must contain 10–72 characters.";
        case "confirmPassword" -> "Passwords do not match.";
        case "firstName" -> "Enter your first name.";
        case "lastName" -> "Enter your last name.";
        case "title" -> "Title cannot be empty.";
        case "body" -> "Text cannot be empty or exceed the allowed length.";
        case "recipient" -> "Enter a registered Nightfall mailbox in the form username@nf.com.";
        case "subject" -> "Subject cannot be empty or longer than 160 characters.";
        default -> "Check the submitted fields.";
      })
      .orElse("Check the submitted fields.");
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
  }
}
