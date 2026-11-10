package com.nightfall.messenger.hub;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HubMediaRepository extends JpaRepository<HubMediaEntity, String> {
  // A closed projection keeps file contents out of feed-list queries.
  interface Metadata {
    String getId();
    String getName();
    String getType();
    long getSize();
  }
  List<Metadata> findAllByPostIdOrderByOrdinalAsc(String postId);
  Optional<HubMediaEntity> findByIdAndPostId(String id, String postId);
  boolean existsByPostId(String postId);
  void deleteByPostId(String postId);
}
