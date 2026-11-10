package com.nightfall.messenger.people;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/people")
public class ModerationController {
  private final UserBlockRepository blocks;
  private final FriendshipRepository friendships;
  private final FollowRepository follows;
  private final UserReportRepository reports;
  private final AuthUserRepository users;

  public ModerationController(UserBlockRepository blocks, UserReportRepository reports, AuthUserRepository users, FriendshipRepository friendships,FollowRepository follows) {
    this.blocks = blocks;
    this.friendships = friendships;this.follows=follows;
    this.reports = reports;
    this.users = users;
  }

  public record ReportRequest(@NotBlank @Size(min = 5, max = 500) String reason) {}
  public record ReportResponse(String status) {}

  private void validateOtherAccount(String id, AuthUserEntity user) {
    if (user.id.equals(id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot moderate your own account.");
    if (!users.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
  }

  @GetMapping("/blocked")
  public List<String> blocked(@AuthenticationPrincipal AuthUserEntity user) {
    return blocks.findByOwnerId(user.id).stream().map(block -> block.blockedUserId).limit(500).toList();
  }

  @PostMapping("/{id}/block")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void block(@PathVariable String id, @AuthenticationPrincipal AuthUserEntity user) {
    validateOtherAccount(id, user);
    follows.deleteByUserIdAndTargetUserId(user.id,id);follows.deleteByUserIdAndTargetUserId(id,user.id);
    friendships.findById(FriendshipEntity.pair(user.id,id)).ifPresent(friendships::delete);
    if (!blocks.existsByOwnerIdAndBlockedUserId(user.id, id)) blocks.save(new UserBlockEntity(user.id, id));
  }

  @DeleteMapping("/{id}/block")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void unblock(@PathVariable String id, @AuthenticationPrincipal AuthUserEntity user) {
    blocks.deleteByOwnerIdAndBlockedUserId(user.id, id);
  }

  @PostMapping("/{id}/report")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public ReportResponse report(
    @PathVariable String id,
    @Valid @RequestBody ReportRequest input,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    validateOtherAccount(id, user);
    reports.save(new UserReportEntity(user.id, id, input.reason().trim()));
    return new ReportResponse("Report submitted for review.");
  }
}
