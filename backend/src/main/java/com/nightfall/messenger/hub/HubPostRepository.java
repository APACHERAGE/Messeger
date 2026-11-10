package com.nightfall.messenger.hub;
import java.util.List;
import java.util.Collection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface HubPostRepository extends JpaRepository<HubPostEntity,String> {
  @Query("select p from HubPostEntity p where coalesce(p.wallOwnerId,p.authorId)=:owner order by p.createdAt desc")
  List<HubPostEntity> findWall(@Param("owner") String owner,Pageable page);
  @Query("select p from HubPostEntity p where coalesce(p.wallOwnerId,p.authorId) in :ids or p.authorId in :ids order by p.createdAt desc")
  List<HubPostEntity> findTimeline(@Param("ids") Collection<String> ids,Pageable page);
  List<HubPostEntity> findTop80ByAudienceOrderByCreatedAtDesc(String audience);
}
