package com.nightfall.messenger.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Revokes sessions created before a password reset or other credential change. */
@Component
public class AuthSessionVersionFilter extends OncePerRequestFilter {
  static final String SESSION_ATTRIBUTE = "nightfall.auth.session-version";

  private final AuthUserRepository users;

  public AuthSessionVersionFilter(AuthUserRepository users) {
    this.users = users;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
    throws ServletException, IOException {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null && authentication.isAuthenticated()
      && authentication.getPrincipal() instanceof AuthUserEntity principal) {
      AuthUserEntity current = users.findById(principal.id).orElse(null);
      var session = request.getSession(false);
      if (current == null || session == null) {
        reject(request, response);
        return;
      }
      Object stored = session.getAttribute(SESSION_ATTRIBUTE);
      if (stored == null) {
        // Sessions created before this guard was introduced are adopted once;
        // future password changes still revoke them through the version.
        session.setAttribute(SESSION_ATTRIBUTE, current.sessionVersion);
      } else if (!(stored instanceof Number version) || version.longValue() != current.sessionVersion) {
        reject(request, response);
        return;
      }
    }
    chain.doFilter(request, response);
  }

  private static void reject(HttpServletRequest request, HttpServletResponse response) {
    SecurityContextHolder.clearContext();
    var session = request.getSession(false);
    if (session != null) session.invalidate();
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }
}
