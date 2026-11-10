package com.nightfall.messenger.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.Pattern;

@Embeddable
public class ProfilePreferences {
  @Column(name = "pref_desktopnotifications") public Boolean desktopNotifications = true;
  @Column(name = "pref_notificationpreview") public Boolean notificationPreview = true;
  @Column(name = "pref_notifydirect") public Boolean notifyDirect = true;
  @Column(name = "pref_notifygroups") public Boolean notifyGroups = true;
  @Column(name = "pref_notifychannels") public Boolean notifyChannels = true;
  @Column(name = "pref_mentionsonly") public Boolean mentionsOnly = false;
  @Column(name = "pref_inappnotifications") public Boolean inAppNotifications = true;
  @Column(name = "pref_quiethours") public Boolean quietHours = false;
  @Column(name = "pref_showavatars") public Boolean showAvatars = true;
  @Column(name = "pref_showtimestamps") public Boolean showTimestamps = true;
  @Column(name = "pref_showreactions") public Boolean showReactions = true;
  @Column(name = "pref_showchattimes") public Boolean showChatTimes = true;
  @Column(name = "pref_showonlineindicators") public Boolean showOnlineIndicators = true;
  @Column(name = "pref_showcomposerhints") public Boolean showComposerHints = true;
  @Column(name = "pref_spellcheck") public Boolean spellCheck = true;
  @Column(name = "pref_confirmdelete") public Boolean confirmDelete = true;
  @Column(name = "pref_highcontrast") public Boolean highContrast = false;
  @Column(name = "pref_largecontrols") public Boolean largeControls = false;
  @Column(name = "pref_autoscroll") public Boolean autoScroll = true;
  @Pattern(regexp = "([01][0-9]|2[0-3]):[0-5][0-9]")
  @Column(name = "pref_quietstart", length = 16) public String quietStart = "22:00";
  @Pattern(regexp = "([01][0-9]|2[0-3]):[0-5][0-9]")
  @Column(name = "pref_quietend", length = 16) public String quietEnd = "08:00";
  @Pattern(regexp = "small|medium|large")
  @Column(name = "pref_fontsize", length = 16) public String fontSize = "medium";
  @Pattern(regexp = "green|sage|forest|emerald|mint|teal|turquoise|cyan|ice|sky|blue|cobalt|indigo|violet|lavender|purple|orchid|fuchsia|magenta|pink|rose|cherry|red|coral|salmon|orange|tangerine|peach|amber|gold|yellow|lemon|lime|olive|sand|copper|terracotta|slate|silver|mono|custom")
  @Column(name = "pref_accent", length = 16) public String accent = "green";
  @Pattern(regexp = "dark|light|system") @Column(name="pref_theme", length=12) public String theme="dark";
  @Pattern(regexp = "#[0-9a-fA-F]{6}") @Column(name="pref_customaccent", length=7) public String customAccent="#b2ee97";
  @Pattern(regexp = "forest|terminal|orbit|plain") @Column(name="pref_coverstyle", length=12) public String coverStyle="forest";
  @Pattern(regexp = "comfortable|compact") @Column(name="pref_profiledensity", length=16) public String profileDensity="comfortable";
  @Pattern(regexp = "pixel|ascii|off") @Column(name="pref_artmode", length=8) public String artMode="pixel";
  @Pattern(regexp = "[a-z0-9-]{1,40}") @Column(name="pref_artid", length=40) public String artId="server";
  @Column(name="pref_showdecorations") public Boolean showDecorations=true;
  @Pattern(regexp = "friends|public") @Column(name="pref_defaultpostaudience", length=8) public String defaultPostAudience="friends";
  @Pattern(regexp = "grid|plain|dots")
  @Column(name = "pref_chatbackground", length = 16) public String chatBackground = "grid";
  @Pattern(regexp = "rounded|square")
  @Column(name = "pref_bubblestyle", length = 16) public String bubbleStyle = "rounded";
  @Pattern(regexp = "recent|name|unread")
  @Column(name = "pref_sortchats", length = 16) public String sortChats = "recent";
}
