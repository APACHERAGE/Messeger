package com.nightfall.messenger.channels;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelPostRepository extends JpaRepository<ChannelPostEntity, String> {
  void deleteByChannelId(String channelId);
  List<ChannelPostEntity> findTop30ByChannelIdOrderByCreatedAtDesc(String channelId);
  List<ChannelPostEntity> findByChannelIdOrderByCreatedAtDesc(String channelId, Pageable pageable);
  List<ChannelPostEntity> findByChannelIdAndCreatedAtLessThanOrderByCreatedAtDesc(String channelId, Instant before, Pageable pageable);
}
