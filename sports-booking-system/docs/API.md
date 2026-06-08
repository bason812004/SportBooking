# API Overview

Base URL local: `http://localhost:8080/api`

Tat ca response:

```json
{ "success": true, "data": {} }
```

Loi:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Message", "fieldErrors": {} } }
```

## Auth

- `POST /auth/register`
- `POST /auth/register-partner`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `PUT /auth/change-password`

## Public

- `GET /courts`
- `GET /courts/:id`
- `GET /courts/:id/availability?date=YYYY-MM-DD`
- `GET /categories`
- `GET /courts/:id/reviews`

## User

- `GET /users/me`
- `PUT /users/me`
- `GET /users/me/bookings`
- `POST /bookings`
- `GET /bookings/:id`
- `PUT /bookings/:id/cancel`
- `POST /reviews`
- `POST /reports`

## Partner

- `GET /partner/dashboard`
- `GET /partner/courts`
- `POST /partner/courts`
- `GET /partner/courts/:id`
- `PUT /partner/courts/:id`
- `DELETE /partner/courts/:id`
- `POST /partner/courts/:id/images`
- `POST /partner/courts/:id/prices`
- `PUT /partner/prices/:priceId`
- `DELETE /partner/prices/:priceId`
- `POST /partner/courts/:id/services`
- `PUT /partner/services/:serviceId`
- `DELETE /partner/services/:serviceId`
- `GET /partner/bookings`
- `PUT /partner/bookings/:id/confirm`
- `PUT /partner/bookings/:id/reject`
- `PUT /partner/bookings/:id/complete`
- `PUT /partner/bookings/:id/no-show`
- `GET /partner/statistics/revenue`

## Admin

- `GET /admin/dashboard`
- `GET /admin/users`
- `PUT /admin/users/:id/lock`
- `PUT /admin/users/:id/unlock`
- `GET /admin/partners`
- `PUT /admin/partners/:id/approve`
- `PUT /admin/partners/:id/reject`
- `GET /admin/courts/pending`
- `PUT /admin/courts/:id/approve`
- `PUT /admin/courts/:id/reject`
- `GET /admin/categories`
- `POST /admin/categories`
- `PUT /admin/categories/:id`
- `DELETE /admin/categories/:id`
- `GET /admin/reviews`
- `PUT /admin/reviews/:id/hide`
- `PUT /admin/reviews/:id/show`
- `DELETE /admin/reviews/:id`
- `GET /admin/reports`
- `PUT /admin/reports/:id/resolve`
- `PUT /admin/reports/:id/reject`
- `GET /admin/statistics`
