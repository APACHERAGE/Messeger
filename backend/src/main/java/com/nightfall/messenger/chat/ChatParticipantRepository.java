package com.nightfall.messenger.chat;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipantEntity, String> {
  List<ChatParticipantEntity> findByUserId(String userId);
  Optional<ChatParticipantEntity> findByChatIdAndUserId(String chatId, String userId);
}
