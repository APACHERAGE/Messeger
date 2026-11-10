package com.nightfall.messenger.people;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/friends")
public class FriendsController {
  public record Friends(List<PeopleService.Person> friends,List<PeopleService.Person> incoming,List<PeopleService.Person> outgoing) {}
  private final FriendshipRepository friendships;
  private final SocialAccess access;
  private final PeopleService people;
  private final AuthUserRepository users;
  public FriendsController(FriendshipRepository friendships,SocialAccess access,PeopleService people,AuthUserRepository users) {
    this.friendships=friendships; this.access=access; this.people=people; this.users=users;
  }
  @GetMapping
  public Friends list(@RequestParam(defaultValue="200") int limit,@AuthenticationPrincipal AuthUserEntity user) {
    return friends(user,limit);
  }
  private Friends friends(AuthUserEntity user,int limit) {
    int size=Math.max(1,Math.min(limit,500));
    var links=friendships.findByRequesterIdOrRecipientId(user.id,user.id).stream()
      .filter(link -> users.existsById(link.other(user.id)) && !access.blocked(user.id,link.other(user.id))).toList();
    return new Friends(links.stream().filter(link -> "accepted".equals(link.status)).map(link -> people.get(link.other(user.id),user)).limit(size).toList(),
      links.stream().filter(link -> "pending".equals(link.status) && link.recipientId.equals(user.id)).map(link -> people.get(link.requesterId,user)).limit(size).toList(),
      links.stream().filter(link -> "pending".equals(link.status) && link.requesterId.equals(user.id)).map(link -> people.get(link.recipientId,user)).limit(size).toList());
  }
  private void validate(String id,AuthUserEntity user) {
    if (id.equals(user.id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"You cannot send yourself a friend request.");
    if (!users.existsById(id) || access.blocked(id,user.id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"This account is unavailable.");
  }
  @PostMapping("/requests/{id}") @Transactional
  public Friends request(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) {
    validate(id,user);
    if (!friendships.existsById(FriendshipEntity.pair(id,user.id))) friendships.save(new FriendshipEntity(user.id,id));
    return friends(user,200);
  }
  @PostMapping("/requests/{id}/accept") @Transactional
  public Friends accept(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) {
    validate(id,user);
    var link=friendships.findById(FriendshipEntity.pair(id,user.id)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Friend request not found."));
    if (!link.recipientId.equals(user.id) || !"pending".equals(link.status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Only the recipient can accept a pending request.");
    link.status="accepted"; friendships.save(link); return friends(user,200);
  }
  @DeleteMapping("/requests/{id}") @Transactional
  public Friends dismiss(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) {
    var link=friendships.findById(FriendshipEntity.pair(id,user.id)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Friend request not found."));
    if (!"pending".equals(link.status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"This request is already accepted.");
    friendships.delete(link); return friends(user,200);
  }
  @DeleteMapping("/{id}") @Transactional
  public Friends remove(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) {
    var link=friendships.findById(FriendshipEntity.pair(id,user.id)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Friendship not found."));
    if (!"accepted".equals(link.status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Cancel a pending request instead.");
    friendships.delete(link); return friends(user,200);
  }
}
