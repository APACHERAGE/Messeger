package com.nightfall.messenger.hub;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HubReactionRepository extends JpaRepository<HubReactionEntity, String> {
  long countByPostId(String postId);
  boolean existsByPostIdAndUserId(String postId, String userId);
  void deleteByPostIdAndUserId(String postId, String userId);
  void deleteByPostId(String postId);
}