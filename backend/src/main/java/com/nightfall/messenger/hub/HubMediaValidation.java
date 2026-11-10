package com.nightfall.messenger.hub;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

final class HubMediaValidation {
  static final long IMAGE_LIMIT = 5L * 1024 * 1024;
  static final long VIDEO_LIMIT = 20L * 1024 * 1024;
  static final long TOTAL_LIMIT = 30L * 1024 * 1024;
  private static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm");

  static void validate(List<MultipartFile> files) {
    if (files.size() > 4) bad("You can attach up to 4 files per post.");
    if (files.stream().mapToLong(MultipartFile::getSize).sum() > TOTAL_LIMIT) bad("Attachments must total 30 MB or less.");
    for (MultipartFile file : files) {
      String type = file.getContentType();
      if (!TYPES.contains(type == null ? "" : type)) bad("Choose a JPG, PNG, WebP, GIF, MP4, or WebM file.");
      if (file.isEmpty()) bad("Attachments cannot be empty.");
      if (file.getSize() > (type.startsWith("video/") ? VIDEO_LIMIT : IMAGE_LIMIT)) bad("Photos and GIFs must be up to 5 MB; videos up to 20 MB.");
      try (var stream = file.getInputStream()) {
        byte[] bytes = stream.readNBytes(16);
        boolean valid = switch (type) {
          case "image/jpeg" -> startsWith(bytes, 255, 216, 255);
          case "image/png" -> startsWith(bytes, 137, 80, 78, 71, 13, 10, 26, 10);
          case "image/gif" -> ascii(bytes, 0, 6).equals("GIF87a") || ascii(bytes, 0, 6).equals("GIF89a");
          case "image/webp" -> ascii(bytes, 0, 4).equals("RIFF") && ascii(bytes, 8, 4).equals("WEBP");
          case "video/mp4" -> ascii(bytes, 4, 4).equals("ftyp");
          case "video/webm" -> startsWith(bytes, 26, 69, 223, 163);
          default -> false;
        };
        if (!valid) bad("An attachment does not match its declared file type.");
      } catch (IOException error) { bad("Could not read an attachment. Try uploading it again."); }
    }
  }

  static String filename(MultipartFile file) {
    String raw = file.getOriginalFilename();
    String name = (raw == null ? "attachment" : raw.replace('\\', '/')).replaceAll("[\\p{Cntrl}]", "");
    name = name.substring(name.lastIndexOf('/') + 1);
    return name.isBlank() ? "attachment" : name.substring(0, Math.min(255, name.length()));
  }

  private static boolean startsWith(byte[] data, int... signature) {
    if (data.length < signature.length) return false;
    for (int i = 0; i < signature.length; i++) if ((data[i] & 255) != signature[i]) return false;
    return true;
  }
  private static String ascii(byte[] data, int offset, int length) {
    return data.length < offset + length ? "" : new String(data, offset, length, StandardCharsets.US_ASCII);
  }
  private static void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
