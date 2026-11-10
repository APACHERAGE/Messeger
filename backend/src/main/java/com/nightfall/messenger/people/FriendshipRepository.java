package com.nightfall.messenger.people;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface FriendshipRepository extends JpaRepository<FriendshipEntity, String> {
  List<FriendshipEntity> findByRequesterIdOrRecipientId(String requesterId, String recipientId);
}
