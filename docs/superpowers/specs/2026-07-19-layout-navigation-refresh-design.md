# SHB layout and navigation refresh

## Goal

Refresh the Angular portal shell so pages use normal Angular routing, content has responsive breathing room, navigation is grouped meaningfully, and the supplied SHB logo appears in the Core UI sidebar.

## Scope

- Replace the shell-level `SdTabRouterOutletComponent` with Angular `RouterOutlet`.
- Remove page-level `SdTabComponent` decorators, `SD_TAB` injection, and tab-title update effects that become obsolete.
- Preserve all existing URLs, route guards, permissions, lazy loading, page actions, and API contracts.
- Add responsive shell padding: 24px on desktop and 16px on mobile.
- Configure the sidebar with `/logo.png`, SHB orange brand colors, and the title `SHB StartFlow`.
- Keep the user-provided `frontend/public/logo.png` unchanged.

## Navigation model

The sidebar has two root groups:

1. **Nghiệp vụ**
   - Tổng quan (`/dashboard`)
   - Hồ sơ tín dụng (`/cases`)
2. **AI & Dữ liệu**
   - So sánh mô hình (`/comparisons`)
   - Kho tri thức (`/knowledge`)

Leaf permissions remain the existing `STARTFLOW_PERMISSIONS` values. Parameterized routes such as case detail and run workspace remain reachable from their owning pages and do not become standalone menu items.

## Layout behavior

`MainLayoutComponent` retains the semantic focus target and route announcements. Its `main` content region fills the available Core UI layout height, scrolls when page content is taller than the viewport, and applies responsive padding around the routed page. The router renders one active page at a time; there is no tab persistence or tab-close behavior.

## Error handling and accessibility

Existing forbidden/not-found routes and route permission guards remain unchanged. Focus moves to the semantic `main` element after navigation, and the live announcer continues to announce the active route title. The SHB logo is decorative branding supplied through Core UI's existing `logoUrl` configuration.

## Verification

Use RED-first regression tests to prove:

- the shell renders `router-outlet` and no `sd-tab-router-outlet`;
- the two menu groups expose the expected permission-aware leaf routes;
- the sidebar configuration points to `/logo.png` and the SHB palette/title;
- the shell content has the responsive padding hook;
- existing navigation focus behavior still works.

Then run frontend lint, the complete Angular unit suite, and a production build. No backend, API, authentication, or deployment configuration changes are included.
