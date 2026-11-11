package com.nightfall.messenger.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Entity
@Table(name = "app_users", uniqueConstraints = {
  @UniqueConstraint(name = "uk_app_users_email", columnNames = "email"),
  @UniqueConstraint(name = "uk_app_users_username", columnNames = "username")
})
public class AuthUserEntity implements UserDetails {
  @Id
  @Column(nullable = false, length = 36)
  public String id;

  @Column(nullable = false, length = 48)
  public String firstName;

  @Column(nullable = false, length = 48)
  public String lastName;

  @Column(nullable = false, length = 24)
  public String username;

  @Column(nullable = false, length = 254)
  public String email;

  @Column(nullable = false, length = 100)
  public String passwordHash;

  @Column(nullable = false)
  public boolean emailVerified;

  /** Incremented when credentials change so existing sessions can be revoked. */
  @Column(nullable = false, columnDefinition = "bigint default 0")
  public long sessionVersion = 0;

  protected AuthUserEntity() {}

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_USER"));
  }

  @Override
  public String getPassword() {
    return passwordHash;
  }

  @Override
  public String getUsername() {
    return email;
  }

  @Override
  public boolean isEnabled() {
    return emailVerified;
  }
}
