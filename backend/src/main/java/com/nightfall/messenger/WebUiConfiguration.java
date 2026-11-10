package com.nightfall.messenger;

import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built React app from the same origin as the API. History-API routes
 * fall back to index.html, while unknown API and asset paths keep their 404.
 */
@Configuration
public class WebUiConfiguration implements WebMvcConfigurer {
  private final String staticDir;

  public WebUiConfiguration(@Value("${app.web.static-dir:../dist}") String staticDir) {
    this.staticDir = staticDir.replaceAll("/+$", "");
  }

  @Override
  public void addViewControllers(ViewControllerRegistry registry) {
    // The welcome-page mapping does not see custom resource locations, so send
    // the root explicitly through the SPA resource handler.
    registry.addViewController("/").setViewName("forward:/index.html");
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler("/**")
      .addResourceLocations("file:" + staticDir + "/", "classpath:/static/")
      .resourceChain(true)
      .addResolver(new PathResourceResolver() {
        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
          if (!resourcePath.isEmpty()) {
            Resource requested = location.createRelative(resourcePath);
            if (requested.exists() && requested.isReadable()) return requested;
          }
          if (resourcePath.startsWith("api/") || resourcePath.contains(".")) return null;
          Resource index = location.createRelative("index.html");
          return index.exists() && index.isReadable() ? index : null;
        }
      });
  }
}
