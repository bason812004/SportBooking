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
  Creates the venue and its default active sub-court (`code: "S01"`, `name: "<venue name> - Sân 01"`) in one transaction. The response includes `surfaces`; failure rolls back both records.
- `GET /partner/courts/:id`
- `GET /partner/courts/:id/surfaces`: list the owner's sub-courts.
- `POST /partner/courts/:id/surfaces`: create a sub-court with `code`, `name`, optional `capacity`, `surface`, `size`, `openingTime`, `closingTime`.
- `PUT /partner/courts/:id/surfaces/:surfaceId`: update those fields; null hours inherit the venue's hours. Codes must be unique within a venue (case-insensitive).
- `PUT /partner/courts/:id/surfaces/:surfaceId/status`: set `status` to `ACTIVE` or `INACTIVE`; existing bookings are preserved.
- `DELETE /partner/courts/:id/surfaces/:surfaceId`: only unused sub-courts; rejects any booking, booking slot, recurring booking or closure history. At least one sub-court must remain.

Sub-court operations enforce partner ownership, preserve venue approval and synchronize `court_count` on add/delete. Web management: `/partner/courts/:id/surfaces`. No database migration is needed.

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

## Received notifications

`GET /users/me/notifications?page=1&limit=10` returns `{ items, unreadCount, meta }` inside `data`. `unreadCount` is the total unread count for the authenticated account across all pages. Existing read-one/read-all endpoints remain owner-scoped.

The bell loads more pages, scopes its cache by user ID and refreshes after socket connect/reconnect, `notification:new`, focus and every 30 seconds while visible. ADMIN notification links route to the appropriate moderation/report/withdrawal screen. `/admin/notifications` remains the outgoing campaign interface.

Review events are queued transactionally by `admin_notification_outbox.sql`; the worker persists recipient notices exactly once per queued event before emitting realtime. Repeated worker runs do not create duplicate notices. Different business changes are separate events; this does not add request idempotency to business APIs. Older payment/refund notices keep their existing delivery path and now link to the booking screen.

## Court image review

- `POST /partner/courts/:id/images`: multipart `image` (up to 3 MB), optional `replaceImageId` for an existing image of this court. Returns an image request with status `PENDING`, not a published image. Existing URL uploads remain supported.
- `GET /partner/courts/:id/image-requests`: owner-only request history, including review status and rejection reason.
- `POST /partner/image-requests/:id/cancel`: owner cancels a pending request.
- `GET /admin/court-image-requests`: pending image requests, available only to ADMIN.
- `POST /admin/court-image-requests/:id/review`: `{ decision: "APPROVED" | "REJECTED", reason?: string }`; rejection requires a reason.

Images in requests are private to their owner and ADMIN through these APIs; public galleries continue to read only `court_images`. Replacement approval atomically changes the original image URL while retaining its ID/order. Approval of an additional image appends it to the gallery. Rejection/cancellation leaves published images untouched. Court approval and booking availability are unchanged by image submission/review.

Pending replacement requests prevent deletion of their original image and reordering until reviewed/cancelled. Concurrent review/cancellation is guarded by a conditional status update; only one decision succeeds. If a court has no images, it keeps using the existing fallback until the first image is approved. Request records retain review identity/time and previous image URLs; old/rejected cloud assets are retained for review history, not automatically deleted.

Partner: court image management → “Thay ảnh đại diện”. ADMIN: “Tất cả sân” → “Ảnh sân chờ duyệt”. Court approval does not automatically approve pending image requests.

## Team posts

- `GET /team-posts/:id/membership` (requires login): returns `data: { isMember: boolean }` for the current user, using the same owner/active-member check as the members and messages endpoints. Returns 404 when the post does not exist.
- `GET /team-posts/:id/members` and `GET /team-posts/:id/messages` require membership and return 403 for non-members.
- Mobile checks membership before loading members or chat, scopes protected query caches to the current user, and updates membership after joining/leaving. Guests can view the public post without requesting protected data.

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
