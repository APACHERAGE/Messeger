package com.nightfall.messenger.people;

import com.nightfall.messenger.auth.AuthUserEntity;
import com.nightfall.messenger.auth.AuthUserRepository;
import com.nightfall.messenger.profile.ProfileRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class PeopleController {
  private final ContactRepository contacts;
  private final AuthUserRepository users;
  private final ProfileRepository profiles;
  private final PeopleService people;
  public PeopleController(ContactRepository contacts, AuthUserRepository users, ProfileRepository profiles, PeopleService people) {
    this.contacts=contacts; this.users=users; this.profiles=profiles; this.people=people;
  }
  private String normalize(String value) { return value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", ""); }
  @GetMapping("/api/people")
  public List<PeopleService.Person> search(
    @RequestParam(defaultValue="") String query,
    @RequestParam(defaultValue="50") int limit,
    @AuthenticationPrincipal AuthUserEntity viewer
  ) {
    String needle=normalize(query.trim());
    int size=Math.max(1,Math.min(limit,100));
    int fetchSize=Math.min(size*2,200);
    java.util.Map<String,AuthUserEntity> matches=new java.util.LinkedHashMap<>();
    users.findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(
      query.trim(),query.trim(),query.trim(),PageRequest.of(0,fetchSize,Sort.by("username")))
      .forEach(account -> matches.put(account.id,account));
    profiles.findByDisplayNameContainingIgnoreCase(query.trim(),PageRequest.of(0,fetchSize,Sort.by("displayName")))
      .forEach(profile -> users.findById(profile.id).ifPresent(account -> matches.put(account.id,account)));
    return matches.values().stream().filter(account -> !account.id.equals(viewer.id)).map(account -> people.person(account,viewer))
      .filter(person -> needle.isEmpty() || java.util.stream.Stream.of(person.username(),person.displayName(),person.firstName(),person.lastName()).anyMatch(value -> normalize(value).contains(needle)))
      .limit(size).toList();
  }
  @GetMapping("/api/people/{id}")
  public PeopleService.Person person(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) { return people.get(id,user); }
  @GetMapping("/api/contacts")
  public List<PeopleService.Person> contacts(
    @RequestParam(defaultValue="200") int limit,
    @AuthenticationPrincipal AuthUserEntity user
  ) {
    return contactList(user, limit);
  }
  private List<PeopleService.Person> contactList(AuthUserEntity user, int limit) {
    int size=Math.max(1,Math.min(limit,500));
    return contacts.findByOwnerId(user.id,PageRequest.of(0,size)).stream().filter(contact -> users.existsById(contact.personId)).map(contact -> people.get(contact.personId,user)).toList();
  }
  @PostMapping("/api/contacts/{id}")
  public PeopleService.Person add(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) {
    if (id.equals(user.id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"You cannot add yourself as a contact.");
    PeopleService.Person person=people.get(id,user); contacts.save(new ContactEntity(user.id,id)); return person;
  }
  @DeleteMapping("/api/contacts/{id}")
  @Transactional
  public List<PeopleService.Person> remove(@PathVariable String id,@AuthenticationPrincipal AuthUserEntity user) {
    contacts.deleteByOwnerIdAndPersonId(user.id,id); return contactList(user,200);
  }
}
