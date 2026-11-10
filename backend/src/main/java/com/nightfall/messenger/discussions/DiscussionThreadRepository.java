package com.nightfall.messenger.discussions;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscussionThreadRepository extends JpaRepository<DiscussionThreadEntity, String> {
  List<DiscussionThreadEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
