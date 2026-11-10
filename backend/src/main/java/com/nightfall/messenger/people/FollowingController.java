package com.nightfall.messenger.people;
import com.nightfall.messenger.auth.AuthUserEntity;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
@RestController
public class FollowingController {
 private final FollowRepository follows;private final PeopleService people;private final SocialAccess access;
 public FollowingController(FollowRepository follows,PeopleService people,SocialAccess access){this.follows=follows;this.people=people;this.access=access;}
 @GetMapping("/api/following") public List<PeopleService.Person> list(@RequestParam(defaultValue="200") int limit,@AuthenticationPrincipal AuthUserEntity user){return following(user,limit);}
 private List<PeopleService.Person> following(AuthUserEntity user,int limit){int size=Math.max(1,Math.min(limit,500));return follows.findByUserId(user.id,PageRequest.of(0,size)).stream().filter(link->!access.blocked(user.id,link.targetUserId)).map(link->people.get(link.targetUserId,user)).toList();}
 @PostMapping("/api/people/{id}/follow") @Transactional public List<PeopleService.Person> follow(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user){
  if(id.equals(user.id)||access.blocked(id,user.id))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"You cannot follow this account.");
  people.get(id,user);follows.save(new FollowEntity(user.id,id));return following(user,200);
 }
 @DeleteMapping("/api/people/{id}/follow") @Transactional public List<PeopleService.Person> unfollow(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user){follows.deleteByUserIdAndTargetUserId(user.id,id);return following(user,200);}
}
