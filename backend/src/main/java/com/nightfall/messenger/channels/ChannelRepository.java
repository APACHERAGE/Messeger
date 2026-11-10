package com.nightfall.messenger.channels;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelRepository extends JpaRepository<ChannelEntity, String> {
  List<ChannelEntity> findAllByOrderByCreatedAtDesc();
  Optional<ChannelEntity> findByIdAndOwnerId(String id, String ownerId);
  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query("select c from ChannelEntity c where c.id = :id")
  Optional<ChannelEntity> findLockedById(@org.springframework.data.repository.query.Param("id") String id);
  boolean existsByHandleIgnoreCase(String handle);
}
