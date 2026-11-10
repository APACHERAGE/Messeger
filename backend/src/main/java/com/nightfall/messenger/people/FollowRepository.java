package com.nightfall.messenger.people;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface FollowRepository extends JpaRepository<FollowEntity,String>{
 List<FollowEntity> findByUserId(String userId);
 List<FollowEntity> findByUserId(String userId, Pageable pageable);
 void deleteByUserIdAndTargetUserId(String userId,String targetUserId);
}
