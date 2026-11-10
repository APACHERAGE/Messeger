package com.nightfall.messenger.people;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ContactRepository extends JpaRepository<ContactEntity, String> {
  List<ContactEntity> findByOwnerId(String ownerId);
  void deleteByOwnerIdAndPersonId(String ownerId, String personId);
}
