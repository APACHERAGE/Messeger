package com.nightfall.messenger.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class RegistrationMailServiceTest {
  @TempDir Path directory;

  @SuppressWarnings("unchecked")
  private MailFixture fixture() {
    ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
    JavaMailSender sender = mock(JavaMailSender.class);
    when(provider.getIfAvailable()).thenReturn(sender);
    when(sender.createMimeMessage()).thenAnswer(ignored -> new MimeMessage(Session.getInstance(new Properties())));
    RegistrationMailService service = new RegistrationMailService(provider);
    ReflectionTestUtils.setField(service, "mode", "smtp");
    ReflectionTestUtils.setField(service, "from", "apache.desktop@gmail.com");
    ReflectionTestUtils.setField(service, "publicUrl", "http://127.0.0.1:5173");
    ReflectionTestUtils.setField(service, "publicUrlFile", "");
    return new MailFixture(service, sender);
  }

  private record MailFixture(RegistrationMailService service, JavaMailSender sender) {
    MimeMessage sentMessage() {
      ArgumentCaptor<MimeMessage> message = ArgumentCaptor.forClass(MimeMessage.class);
      verify(sender).send(message.capture());
      return message.getValue();
    }
  }

  private static String wireContent(MimeMessage message) throws Exception {
    message.saveChanges();
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    message.writeTo(output);
    return output.toString(StandardCharsets.UTF_8);
  }

  @Test
  void welcomeMailUsesConfiguredSenderAndRecipient() throws Exception {
    MailFixture fixture = fixture();
    AuthUserEntity user = new AuthUserEntity();
    user.firstName = "Alice";
    user.email = "alice@example.test";

    fixture.service().sendVerification(user, "sample-token");

    MimeMessage message = fixture.sentMessage();
    assertThat(message.getFrom()[0].toString()).isEqualTo("apache.desktop@gmail.com");
    assertThat(message.getRecipients(Message.RecipientType.TO)[0].toString()).isEqualTo("alice@example.test");
    assertThat(message.getSubject()).contains("Welcome");
    assertThat(wireContent(message)).contains("/?verify=sample-token", "Alice");
  }

  @Test
  void invitationUsesCurrentPublicUrlFile() throws Exception {
    MailFixture fixture = fixture();
    Path urlFile = directory.resolve("public-url.txt");
    Files.writeString(urlFile, "https://nightfall.example.test/\n");
    ReflectionTestUtils.setField(fixture.service(), "publicUrlFile", urlFile.toString());

    fixture.service().sendInvitation("bob@example.test", "Alice", "friend code");

    MimeMessage message = fixture.sentMessage();
    assertThat(message.getFrom()[0].toString()).isEqualTo("apache.desktop@gmail.com");
    assertThat(message.getRecipients(Message.RecipientType.TO)[0].toString()).isEqualTo("bob@example.test");
    assertThat(message.getSubject()).contains("invited");
    assertThat(wireContent(message)).contains("https://nightfall.example.test/#invite=friend+code");
  }

  @Test
  void passwordResetUsesConfiguredSender() throws Exception {
    MailFixture fixture = fixture();
    AuthUserEntity user = new AuthUserEntity();
    user.email = "alice@example.test";

    fixture.service().sendPasswordReset(user, "reset-token");

    MimeMessage message = fixture.sentMessage();
    assertThat(message.getFrom()[0].toString()).isEqualTo("apache.desktop@gmail.com");
    assertThat(message.getRecipients(Message.RecipientType.TO)[0].toString()).isEqualTo("alice@example.test");
    assertThat(wireContent(message)).contains("/reset-password?token=reset-token");
  }
}
