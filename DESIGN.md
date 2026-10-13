---
version: alpha
name: PCU/NPCU assessment
description: Thai staff assessment tool
colors:
  background: '#f5f6f8'
  text: '#1f2430'
  guide-marker: '#b91c1c'
typography:
  sans:
    fontFamily: "Noto Sans Thai, system-ui, Segoe UI, Roboto, sans-serif"
  mono:
    fontFamily: ui-monospace, monospace
rounded:
  lg: 0.5rem
  xl: 0.75rem
  2xl: 1rem
spacing:
  guide-section: 2.5rem
components:
  guide-link: {}
  guide-number: {}
---

# PCU/NPCU design context

## Overview

Thai health-service staff and assessment committees use the product on phones and desktops. Preserve the existing emerald actions, white panels, slate text and large Thai typography. The guide is a reading surface in the existing product, with numbered red circles as its instructional signature. Avoid extra animation or a marketing-style layout.

## Runtime ownership

The canonical source is `src/index.css` plus Tailwind v4's built-in tokens. This document mirrors it; it does not generate CSS. The existing root font size is 112.5%, with 100% in print. `BrandLogo` owns the logo. `AdminLayout` owns both desktop and mobile administrator navigation; React Router owns route links.

GuideLink → `.guide-link` → Tailwind emerald tokens; guide circles → `.guide-number` → `--guide-marker`. Screenshot annotation circles use the same marker value and must be refreshed if it changes. Scrollbars use `--scroll-thumb`, `--scroll-track`, `--scroll-hover`, `--scroll-active` globally, with system colors under forced-colors.

## Layout and typography

Keep inherited Thai-capable body typography. Headlines use bold, captions use smaller slate text, and sequence labels use bold numbers. The public home/join forms retain their narrow layouts. The guide uses a two-column image/instructions layout on desktop and a single column on phones, with native links to full-size PNGs. Images reserve aspect ratio. The guide remains accessible without signing in and can be printed.

## Components and behavior

AdminLogin uses `.pcu-google-button`, a native full-width button matching the user-selected MSH central-login reference: pale slate background, navy Thai text, 16px corners, a light blue border, a 24px Google mark and a 60px minimum height. The visible button owns its pointer and keyboard hit area; do not add invisible Google controls or offset iframes. It calls Supabase Google OAuth in the current tab and returns to `/pcustandard71/admin/login?callback=google`; Supabase owns session parsing and RequireAdmin retains authorization. AdminLogin owns pending, cancellation/error and browser-Back recovery. Reserve space for feedback and keep the same BrandLogo and VersionFooter as public entry screens.

GuideLink opens a separate tab so the assessor's entered values remain in the original page. Administrator navigation uses the existing Link list and opens the guide in the current tab, from pages without assessment entry. Native anchor links provide chapter navigation; an explicit top anchor provides return navigation. Numbered lists repeat all instructions in text, so users need not interpret color or screenshots alone. Guide controls provide hover, active and visible keyboard focus. Data in screenshots is clearly identified as illustrative.

Existing native select/date controls remain platform-owned; this guide adds neither. Assessment persistence and authorization are defined by the existing application, not by the guide. Do not change those behaviors as part of documentation work.
