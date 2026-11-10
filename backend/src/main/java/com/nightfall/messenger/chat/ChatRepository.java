package com.nightfall.messenger.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<ChatEntity, String> {
  List<ChatEntity> findByOwnerId(String ownerId);
  List<ChatEntity> findByOwnerIdOrPeerId(String ownerId, String peerId);
  Optional<ChatEntity> findByIdAndOwnerId(String id, String ownerId);
  Optional<ChatEntity> findByPeerIdAndOwnerId(String peerId, String ownerId);
}
