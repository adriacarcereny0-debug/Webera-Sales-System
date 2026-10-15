# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel.
Database: standard PostgreSQL (any provider: Neon, Railway, Vercel Postgres, self-hosted) with Row Level Security per company. The owner explicitly declined Supabase.
Auth: own server-side auth (hashed passwords, httpOnly session cookies), no third-party auth provider.
Email: provider adapter with Resend and generic SMTP, selected by environment variable.

## Users

- **Primary:** owners and office staff of small and medium Spanish installers of air conditioning, climate control, aerothermal heat pumps and solar panels. Often non-technical, working between the office, the phone and site visits; frequently on a phone or tablet in a van.
- **Secondary:** sales technicians who visit homes and businesses to measure and quote.
- **Seller:** Webera, the agency that sells, configures and supports the product for each installer.

## Product Purpose

Help installers stop losing work: capture every request, know which quotes are waiting, follow up on time, organise site visits, and see real commercial results. Success is fewer forgotten opportunities and less admin time.

## Positioning

A sales system built around the installer's actual cycle (request, call, site visit, quote, follow-up, won/lost), configurable per company (brand, services, templates) without new development, with automations that log real delivery status instead of pretending.

## Operating Context

- Leads arrive by web form, phone, WhatsApp, referrals, fairs and portals.
- A visit is usually needed before a quote. Quotes carry IVA (21% general; other rates configurable) and are reviewed before sending.
- Sales demos are shown by Webera to prospective installers in a few minutes.
- Spanish language UI, EUR currency, Spanish date formats, Spanish data protection (RGPD/LOPDGDD).

## Capabilities and Constraints

- Multi-tenant: each company sees only its own data, enforced in the server and in PostgreSQL RLS.
- No invented credentials, integrations, prices, customers or statistics. Demo data must be clearly labelled and removable.
- WhatsApp only via official API if ever added; not part of the first release.
- Messages are never shown as delivered without provider confirmation.

## Brand Commitments

- Seller brand: "Webera Sales System". Inside each workspace the installer's logo and accent colour lead.
- Premium, sober, professional enterprise software. No emojis as icons, no exaggerated gradients, no template-like repetitive cards.

## Evidence on Hand

None. No real customers, testimonials, logos, metrics or prices exist. Everything demonstrative is synthetic and must be labelled as demo data.

## Product Principles

1. Never lose a lead: every request becomes a contact with an owner and a next action.
2. Honest numbers: every metric is computed from the database; empty means empty.
3. Understandable in one glance by a non-technical owner.
4. Configurable per installer, not rebuilt per installer.
5. Safe by default: tenant isolation, review before sending, logged automations.

## Accessibility & Inclusion

WCAG 2.2 AA target: keyboard navigation, visible focus, sufficient contrast, labelled form controls; usable on phone and tablet.
