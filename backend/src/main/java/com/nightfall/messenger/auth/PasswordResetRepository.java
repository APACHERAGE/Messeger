package com.nightfall.messenger.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetRepository extends JpaRepository<PasswordResetEntity, String> {
  Optional<PasswordResetEntity> findByTokenHash(String tokenHash);
  List<PasswordResetEntity> findByUserId(String userId);
}
