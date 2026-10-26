# Stock & Sales Tracker — MVP Product Specification

## Goal
Give a small business a simple way to record sales and returned goods, manage a product catalogue, and produce monthly sales reports.

## Users and access
- MVP users are employees who create an account and manage their own business workspace.
- A manager role and shared multi-employee access are not in the initial release.
- Each sale records the employee name shown in reports.

## Core workflows
1. Register or sign in.
2. Create a business workspace.
3. Add products with a name, category, unit label, and default price.
4. Record a sale with product, quantity, sale date, employee, and the actual unit price used.
5. Record returned goods in a separate return log, with date, quantity, and optional reason/condition.
6. Select a month and review sales by date, product, employee, units, and value.
7. Copy report text or download TXT and DOCX files.

## Reporting rules
- Total units are summed from recorded sale quantities (e.g. 500 bottles sold reports 500 bottles/units).
- Each sale preserves its unit price and total at the time it was recorded; changing the product's default price must not rewrite past sales.
- Returned goods are reported separately and are not automatically deducted from sales totals.
- Do not calculate stock on hand because opening stock and stock received may be unknown.
- Yearly reports and commission calculations are out of MVP scope.

## Data model
- profiles: employee display name and account identifier.
- businesses: owner, business name, currency.
- products: business catalogue and default price.
- sales: product, employee, quantity, sale-time unit price, total, date.
- returns: product, employee, quantity, date, reason/condition.

## Security
- Supabase Auth identifies users.
- Row Level Security policies scope data to the owning user/business.
- The browser may contain only the Supabase URL and publishable key; never expose a service-role or secret key.

## Current implementation status
The current branch contains a front-end prototype with sample in-memory records and report exports, plus the initial database migration. Authentication and persistent database integration are still to be implemented. Prototype changes reset when the page reloads.
