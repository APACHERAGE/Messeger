package com.nightfall.messenger.people;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface FollowRepository extends JpaRepository<FollowEntity,String>{
 List<FollowEntity> findByUserId(String userId);
 void deleteByUserIdAndTargetUserId(String userId,String targetUserId);
}
