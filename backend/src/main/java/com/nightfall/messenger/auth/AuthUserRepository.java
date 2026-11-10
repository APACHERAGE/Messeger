package com.nightfall.messenger.auth;

import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthUserRepository extends JpaRepository<AuthUserEntity, String> {
  Optional<AuthUserEntity> findByEmailIgnoreCase(String email);
  Optional<AuthUserEntity> findByUsernameIgnoreCase(String username);
  List<AuthUserEntity> findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(String username, String firstName, String lastName);
  List<AuthUserEntity> findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(String username, String firstName, String lastName, Pageable pageable);
  boolean existsByEmailIgnoreCase(String email);
  boolean existsByUsernameIgnoreCase(String username);
}
