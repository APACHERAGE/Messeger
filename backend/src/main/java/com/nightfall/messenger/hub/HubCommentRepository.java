package com.nightfall.messenger.hub;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HubCommentRepository extends JpaRepository<HubCommentEntity, String> {
  List<HubCommentEntity> findByPostIdOrderByCreatedAtAscIdAsc(String postId);
  List<HubCommentEntity> findByPostIdOrderByCreatedAtAscIdAsc(String postId, Pageable pageable);
  long countByPostId(String postId);
  void deleteByPostId(String postId);
}