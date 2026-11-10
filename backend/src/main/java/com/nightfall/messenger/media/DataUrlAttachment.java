package com.nightfall.messenger.media;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Validates browser data URLs before they are stored or served again.
 *
 * <p>Declared MIME types are not trusted: the decoded bytes must match a
 * small allowlist and, where possible, the file signature. SVG and HTML are
 * deliberately excluded.</p>
 */
public final class DataUrlAttachment {
  private static final Pattern DATA_URL = Pattern.compile("^data:([a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+);base64,(.+)$", Pattern.DOTALL);
  public static final Set<String> AVATAR_TYPES = Set.of("image/png", "image/jpeg", "image/gif", "image/webp");
  private static final Set<String> IMAGE_TYPES = AVATAR_TYPES;

  public static final Set<String> CHAT_TYPES = Set.of(
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain",
    "video/mp4", "video/webm",
    "audio/mpeg", "audio/ogg", "audio/wav"
  );
  public static final Set<String> CHANNEL_TYPES = Set.of(
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain"
  );

  private DataUrlAttachment() {}

  public record Validated(String name, String mimeType, String dataUrl, int byteLength) {}

  public static Validated parse(String name, String declaredType, String dataUrl, long maxBytes, Set<String> allowedTypes) {
    String cleanName = name == null ? "" : name.trim();
    if (cleanName.isEmpty() || cleanName.length() > 255) {
      throw bad("Attachment name must contain 1–255 characters.");
    }
    if (cleanName.chars().anyMatch(character -> character < 32 || character == '/' || character == '\\')) {
      throw bad("Attachment name contains unsupported characters.");
    }
    if (dataUrl == null || dataUrl.isBlank()) {
      throw bad("Attachment data is missing.");
    }
    if (dataUrl.length() > maxBytes * 2 + 2048) {
      throw bad("Attachment is too large.");
    }
    Matcher matcher = DATA_URL.matcher(dataUrl);
    if (!matcher.matches()) {
      throw bad("Attachment must be a base64 data URL.");
    }
    String mimeType = matcher.group(1).toLowerCase(Locale.ROOT);
    if (!allowedTypes.contains(mimeType)) {
      throw bad("This file type is not supported. Allowed: " + String.join(", ", allowedTypes.stream().sorted().toList()) + ".");
    }
    if (declaredType != null && !declaredType.isBlank()) {
      String declared = declaredType.toLowerCase(Locale.ROOT).split(";", 2)[0].trim();
      if (!declared.equals(mimeType)) {
        throw bad("Attachment type does not match its contents.");
      }
    }
    byte[] bytes;
    try {
      bytes = Base64.getDecoder().decode(matcher.group(2).replaceAll("\\s+", ""));
    } catch (IllegalArgumentException exception) {
      throw bad("Attachment contains invalid base64 data.");
    }
    if (bytes.length == 0) {
      throw bad("Attachment is empty.");
    }
    if (bytes.length > maxBytes) {
      throw bad("Attachment must be smaller than " + (maxBytes / 1_000_000) + " MB.");
    }
    if (!matchesSignature(mimeType, bytes)) {
      throw bad("Attachment contents do not match the declared file type.");
    }
    String canonical = "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(bytes);
    return new Validated(cleanName, mimeType, canonical, bytes.length);
  }

  public static boolean isImage(String mimeType) {
    return IMAGE_TYPES.contains(mimeType);
  }

  private static boolean matchesSignature(String mimeType, byte[] bytes) {
    return switch (mimeType) {
      case "image/png" -> startsWith(bytes, new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
      case "image/jpeg" -> startsWith(bytes, new int[]{0xFF, 0xD8, 0xFF});
      case "image/gif" -> asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a");
      case "image/webp" -> asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP");
      case "application/pdf" -> asciiAt(bytes, 0, "%PDF-");
      case "text/plain" -> validUtf8WithoutNul(bytes);
      case "video/mp4" -> asciiAt(bytes, 4, "ftyp");
      case "video/webm" -> startsWith(bytes, new int[]{0x1A, 0x45, 0xDF, 0xA3});
      case "audio/mpeg" -> asciiAt(bytes, 0, "ID3")
        || (bytes.length > 1 && (bytes[0] & 0xFF) == 0xFF && ((bytes[1] & 0xFF) == 0xFB || (bytes[1] & 0xFF) == 0xF3 || (bytes[1] & 0xFF) == 0xF2));
      case "audio/ogg" -> asciiAt(bytes, 0, "OggS");
      case "audio/wav" -> asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE");
      default -> false;
    };
  }

  private static boolean startsWith(byte[] bytes, int[] signature) {
    if (bytes.length < signature.length) return false;
    for (int index = 0; index < signature.length; index++) {
      if ((bytes[index] & 0xFF) != signature[index]) return false;
    }
    return true;
  }

  private static boolean asciiAt(byte[] bytes, int offset, String value) {
    if (bytes.length < offset + value.length()) return false;
    for (int index = 0; index < value.length(); index++) {
      if ((bytes[offset + index] & 0xFF) != value.charAt(index)) return false;
    }
    return true;
  }

  private static boolean validUtf8WithoutNul(byte[] bytes) {
    for (byte value : bytes) {
      if (value == 0) return false;
    }
    try {
      StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes));
      return true;
    } catch (CharacterCodingException exception) {
      return false;
    }
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
