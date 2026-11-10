package com.nightfall.messenger.mail;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MailMessageRepository extends JpaRepository<MailMessageEntity, String> {
  List<MailMessageEntity> findByRecipientIdOrderBySentAtDescIdDesc(String recipientId, Pageable pageable);
  List<MailMessageEntity> findByRecipientIdAndSentAtLessThanOrderBySentAtDescIdDesc(String recipientId, Instant before, Pageable pageable);
  List<MailMessageEntity> findBySenderIdOrderBySentAtDescIdDesc(String senderId, Pageable pageable);
  List<MailMessageEntity> findBySenderIdAndSentAtLessThanOrderBySentAtDescIdDesc(String senderId, Instant before, Pageable pageable);
}
