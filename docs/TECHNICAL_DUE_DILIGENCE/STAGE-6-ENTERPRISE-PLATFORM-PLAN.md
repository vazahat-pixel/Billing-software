# Stage 6 — Enterprise Productivity Platform Plan

## Objective

Transform the Textile ERP into an Enterprise Productivity & Smart Automation Platform without redesigning existing modules.

## Package

| Layer | Path |
|---|---|
| Routes | `backend/routes/stage6Enterprise.routes.js` |
| Controller | `backend/controllers/stage6EnterpriseController.js` |
| Services | `backend/services/{globalSearch,enterprise*,automationRule*,approval*,offline*,communication*,bi*,productivity*}Service.js` |
| FE API | `frontend/src/api/stage6.api.js` |
| FE UI | CommandPalette, NotificationCenter, EnterprisePlatformModal |

## Feature flags

`enterprise.search`, `enterprise.command_palette`, `enterprise.notifications`, `enterprise.automation`, `enterprise.approvals`, `enterprise.offline`, `enterprise.communication`, `enterprise.documents`, `enterprise.bi`, `enterprise.productivity`

## Certification gate

Overall Enterprise Score ≥ **85**
