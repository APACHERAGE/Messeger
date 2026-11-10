package com.nightfall.messenger.discussions;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscussionCommentRepository extends JpaRepository<DiscussionCommentEntity, String> {
  List<DiscussionCommentEntity> findByThreadIdOrderByCreatedAtAscIdAsc(String threadId);
  List<DiscussionCommentEntity> findByThreadIdOrderByCreatedAtAscIdAsc(String threadId, Pageable pageable);
  long countByThreadId(String threadId);
}
