package com.nightfall.messenger.people;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ContactRepository extends JpaRepository<ContactEntity, String> {
  List<ContactEntity> findByOwnerId(String ownerId);
  List<ContactEntity> findByOwnerId(String ownerId, Pageable pageable);
  void deleteByOwnerIdAndPersonId(String ownerId, String personId);
}
