package com.nightfall.messenger.hub;
import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.people.FollowRepository;
import com.nightfall.messenger.people.SocialAccess;
import com.nightfall.messenger.channels.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
@RestController @RequestMapping("/api/hub/feed")
public class FeedController {
 public record ChannelItem(String id,String title,String handle,String postId,String body,Instant createdAt,String link){}
 public record Entry(String id,String kind,String reason,Instant createdAt,HubPostView post,ChannelItem channel){}
 private final HubPostRepository posts;private final HubPostPresenter presenter;private final HubAccess access;private final SocialAccess social;
 private final FollowRepository follows;private final ChannelFollowRepository channelFollows;private final ChannelPostRepository channelPosts;private final ChannelRepository channels;
 public FeedController(HubPostRepository posts,HubPostPresenter presenter,HubAccess access,SocialAccess social,FollowRepository follows,ChannelFollowRepository channelFollows,ChannelPostRepository channelPosts,ChannelRepository channels){this.posts=posts;this.presenter=presenter;this.access=access;this.social=social;this.follows=follows;this.channelFollows=channelFollows;this.channelPosts=channelPosts;this.channels=channels;}
 @GetMapping @Transactional(readOnly=true)
 public List<Entry> feed(@RequestParam(defaultValue="for-you") String tab,@AuthenticationPrincipal AuthUserEntity user){
  if(!Set.of("for-you","following").contains(tab))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown feed tab.");
  Set<String> friends=social.friendIds(user.id),followed=new HashSet<>();
  follows.findByUserId(user.id,PageRequest.of(0,200)).forEach(link->followed.add(link.targetUserId));
  Set<String> ids=new HashSet<>(friends);ids.addAll(followed);ids.add(user.id);
  List<Entry> timeline=new ArrayList<>();
  for(var post:posts.findTimeline(ids,PageRequest.of(0,100)))if(access.read(post,user.id)){
   var view=presenter.view(post,user.id);String reason=post.authorId.equals(user.id)?"you":friends.contains(access.owner(post))?"friend":"following";
   timeline.add(new Entry(post.id,"post",reason,post.createdAt,view,null));
  }
  for(var link:channelFollows.findByUserId(user.id,PageRequest.of(0,100)))channels.findById(link.channelId).ifPresent(channel->{
   for(var post:channelPosts.findTop30ByChannelIdOrderByCreatedAtDesc(channel.id))if(!social.blocked(user.id,post.authorId))timeline.add(new Entry("channel:"+post.id,"channel","channel",post.createdAt,null,new ChannelItem(channel.id,channel.title,channel.handle,post.id,post.body,post.createdAt,post.link)));
  });
  timeline.sort(Comparator.comparing(Entry::createdAt).reversed());
  if(tab.equals("following"))return timeline.stream().limit(100).toList();
  long day=java.time.LocalDate.now(java.time.ZoneOffset.UTC).toEpochDay();
  List<Entry> recommendations=posts.findTop80ByAudienceOrderByCreatedAtDesc("public").stream()
   .filter(post->!ids.contains(post.authorId)&&access.read(post,user.id)).map(post->new Entry(post.id,"post","recommended",post.createdAt,presenter.view(post,user.id),null))
   .sorted(Comparator.<Entry>comparingDouble(entry->score(entry,Objects.hash(user.id,day,entry.id))).reversed()).limit(20).toList();
  List<Entry> result=new ArrayList<>();int index=0;
  for(Entry item:timeline){result.add(item);if(result.size()%4==3&&index<recommendations.size())result.add(recommendations.get(index++));if(result.size()>=100)break;}
  while(index<recommendations.size()&&result.size()<100)result.add(recommendations.get(index++));
  return result;
 }
 private double score(Entry entry,int seed){double hours=Math.max(0,java.time.Duration.between(entry.createdAt,Instant.now()).toMinutes()/60.0);return (1+entry.post.likes()*3+entry.post.comments()*4)/Math.pow(1+hours,.65)+Math.floorMod(seed,100)/500.0;}
}
