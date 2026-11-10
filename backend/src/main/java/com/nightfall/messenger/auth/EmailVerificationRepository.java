package com.nightfall.messenger.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationRepository extends JpaRepository<EmailVerificationEntity, String> {
  Optional<EmailVerificationEntity> findByTokenHash(String tokenHash);
  List<EmailVerificationEntity> findByUserId(String userId);
}
