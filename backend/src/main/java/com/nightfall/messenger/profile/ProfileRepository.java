package com.nightfall.messenger.profile;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRepository extends JpaRepository<ProfileEntity, String> {
  java.util.List<ProfileEntity> findByDisplayNameContainingIgnoreCase(String displayName);
}
