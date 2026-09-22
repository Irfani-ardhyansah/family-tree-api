export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'session_start',
  'click',
  'outbound_click',
  'section_view',
  'scroll_depth',
  'engagement_heartbeat',
  'intro_shown',
  'intro_skipped',
  'intro_completed',
  'work_card_view',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_PAGE_IDS = ['home', 'work'] as const;
export type AnalyticsPageId = (typeof ANALYTICS_PAGE_IDS)[number];

export const HOME_SECTION_IDS = [
  'hero',
  'about',
  'work',
  'reviews',
  'beyond',
  'services',
  'process',
  'faq',
  'contact',
] as const;

export const WORK_SECTION_IDS = ['career', 'professional', 'freelance', 'personal'] as const;

export const SECTION_IDS = [...HOME_SECTION_IDS, ...WORK_SECTION_IDS] as const;

export const SCROLL_PERCENTS = [25, 50, 75, 90, 100] as const;

export const OUTBOUND_CHANNELS = ['email', 'whatsapp', 'instagram'] as const;
export type OutboundChannel = (typeof OUTBOUND_CHANNELS)[number];

export const HOME_ELEMENT_IDS = [
  'nav_logo',
  'nav_toggle',
  'nav_about',
  'nav_work',
  'nav_reviews',
  'nav_services',
  'nav_contact',
  'nav_all_work',
  'cta_view_projects',
  'cta_start_project',
  'cta_all_work',
  'faq_item',
  'intro_skip',
  'contact_email_cta',
  'contact_wa_cta',
  'contact_email_link',
  'contact_wa_link',
  'social_instagram',
] as const;

export const WORK_ELEMENT_IDS = ['work_back_home', 'career_step', 'catalog_item'] as const;

export const CLICK_ELEMENT_IDS = [...HOME_ELEMENT_IDS, ...WORK_ELEMENT_IDS] as const;

export const CLICK_LABELS: Record<string, string> = {
  nav_logo: 'Logo (~/irfan)',
  nav_toggle: 'Menu mobile',
  nav_about: 'Nav About',
  nav_work: 'Nav Work',
  nav_reviews: 'Nav Reviews',
  nav_services: 'Nav Services',
  nav_contact: 'Nav Contact',
  nav_all_work: 'Nav All work',
  cta_view_projects: 'CTA View projects (hero)',
  cta_start_project: 'CTA Start a project',
  cta_all_work: 'View all work',
  faq_item: 'FAQ',
  intro_skip: 'Skip intro',
  contact_email_cta: 'Contact email CTA',
  contact_wa_cta: 'Contact WhatsApp CTA',
  contact_email_link: 'Link email',
  contact_wa_link: 'Link WhatsApp',
  social_instagram: 'Instagram',
  work_back_home: 'Back to home',
  career_step: 'Career step',
  catalog_item: 'Catalog item',
};

export const COUNTRY_NAMES: Record<string, string> = {
  ID: 'Indonesia',
  SG: 'Singapore',
  MY: 'Malaysia',
  AU: 'Australia',
  US: 'United States',
  GB: 'United Kingdom',
  NL: 'Netherlands',
  DE: 'Germany',
  JP: 'Japan',
  KR: 'South Korea',
  IN: 'India',
  PH: 'Philippines',
  TH: 'Thailand',
  VN: 'Vietnam',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  CA: 'Canada',
  FR: 'France',
  HK: 'Hong Kong',
  TW: 'Taiwan',
};

export const JAKARTA_TZ = 'Asia/Jakarta';
export const ROLLUP_PAGE_ALL = '_all';

export const BOT_UA_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /googlebot/i,
  /bingbot/i,
  /baiduspider/i,
  /yandex/i,
  /duckduckbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /slackbot/i,
  /linkedinbot/i,
  /applebot/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /gptbot/i,
  /ccbot/i,
  /chatgpt/i,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /go-http-client/i,
  /httpie/i,
  /axios\//i,
];
