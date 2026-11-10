package com.nightfall.messenger.chat;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<MessageEntity, String> {
  List<MessageEntity> findByChatIdOrderByCreatedAtDescIdDesc(String chatId, Pageable pageable);
  List<MessageEntity> findByChatIdAndCreatedAtLessThanOrderByCreatedAtDescIdDesc(String chatId, long createdAt, Pageable pageable);
  Optional<MessageEntity> findTopByChatIdOrderByCreatedAtDescIdDesc(String chatId);
  long countByChatIdAndCreatedAtGreaterThan(String chatId, long createdAt);
  long countByChatIdAndSenderIdNotAndCreatedAtGreaterThan(String chatId, String senderId, long createdAt);
}
