package com.nightfall.messenger.channels;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChannelCommentRepository extends JpaRepository<ChannelCommentEntity,String> {
  org.springframework.data.domain.Slice<ChannelCommentEntity> findByPostIdOrderByCreatedAtAscIdAsc(String postId, org.springframework.data.domain.Pageable pageable);
  long countByPostIdAndRemovedFalse(String postId);
  void deleteByPostId(String postId);
  void deleteByChannelId(String channelId);
}
