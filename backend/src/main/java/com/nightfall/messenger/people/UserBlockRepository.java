package com.nightfall.messenger.people;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBlockRepository extends JpaRepository<UserBlockEntity, String> {
  List<UserBlockEntity> findByOwnerId(String ownerId);
  boolean existsByOwnerIdAndBlockedUserId(String ownerId, String blockedUserId);
  void deleteByOwnerIdAndBlockedUserId(String ownerId, String blockedUserId);
}
