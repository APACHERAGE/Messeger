package com.nightfall.messenger.channels;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChannelCommentReactionRepository extends JpaRepository<ChannelCommentReactionEntity,String> {
  List<ChannelCommentReactionEntity> findByCommentId(String commentId);
  void deleteByCommentId(String commentId);
  void deleteByPostId(String postId);
  void deleteByChannelId(String channelId);
}
