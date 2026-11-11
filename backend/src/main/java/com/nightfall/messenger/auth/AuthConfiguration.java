package com.nightfall.messenger.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

@Configuration
public class AuthConfiguration {
  @Bean
  public UserDetailsService userDetailsService(AuthUserRepository users) {
    return identifier -> users.findByEmailIgnoreCase(identifier)
      .or(() -> users.findByUsernameIgnoreCase(identifier))
      .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
    return configuration.getAuthenticationManager();
  }

  @Bean
  public SecurityContextRepository securityContextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  public CsrfTokenRepository csrfTokenRepository() {
    return CookieCsrfTokenRepository.withHttpOnlyFalse();
  }

  @Bean
  public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    SecurityContextRepository securityContextRepository,
    CsrfTokenRepository csrfTokenRepository,
    AuthSessionVersionFilter authSessionVersionFilter
  ) throws Exception {
    http
      .headers(headers -> headers
        .contentSecurityPolicy(csp -> csp.policyDirectives(
          "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; "
            + "form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; "
            + "connect-src 'self'; worker-src 'self' blob:"))
        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
        .permissionsPolicy(permissions -> permissions.policy(
          "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")))
      .csrf(csrf -> csrf
        .csrfTokenRepository(csrfTokenRepository)
        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
      .securityContext(context -> context.securityContextRepository(securityContextRepository))
      .addFilterAfter(authSessionVersionFilter, SecurityContextHolderFilter.class)
      .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
      .authorizeHttpRequests(authorize -> authorize
        .requestMatchers(HttpMethod.GET, "/api/health", "/api/auth/csrf", "/api/auth/session", "/api/auth/config").permitAll()
        .requestMatchers(
          HttpMethod.POST,
          "/api/auth/register",
          "/api/auth/login",
          "/api/auth/verify",
          "/api/auth/resend-verification",
          "/api/auth/password-reset/request",
          "/api/auth/password-reset/confirm"
        ).permitAll()
        .requestMatchers("/error").permitAll()
        // API routes stay private; hashed frontend assets and the SPA shell are public.
        .requestMatchers("/api/**").authenticated()
        .anyRequest().permitAll())
      .exceptionHandling(exceptions -> exceptions
        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
      .formLogin(AbstractHttpConfigurer::disable)
      .httpBasic(AbstractHttpConfigurer::disable)
      .logout(AbstractHttpConfigurer::disable);
    return http.build();
  }
}
