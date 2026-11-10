package com.nightfall.messenger.discussions;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscussionBookmarkRepository extends JpaRepository<DiscussionBookmarkEntity, String> {
  Optional<DiscussionBookmarkEntity> findByUserIdAndThreadId(String userId, String threadId);
  List<DiscussionBookmarkEntity> findByUserId(String userId);
}
