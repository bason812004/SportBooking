import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sports Booking System API",
      version: "1.0.0"
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    },
    paths: {
      "/auth/register": { post: { tags: ["Auth"], summary: "Register with email and password" } },
      "/auth/login": { post: { tags: ["Auth"], summary: "Login with email and password" } },
      "/auth/google": { post: { tags: ["Auth"], summary: "Login or register with Google ID token" } },
      "/auth/refresh-token": { post: { tags: ["Auth"], summary: "Rotate refresh token and issue a new access token" } },
      "/auth/me": { get: { tags: ["Auth"], security: [{ bearerAuth: [] }], summary: "Get current user" } },
      "/users/me": {
        get: { tags: ["Users"], security: [{ bearerAuth: [] }], summary: "Get my profile" },
        put: { tags: ["Users"], security: [{ bearerAuth: [] }], summary: "Update my profile" }
      },
      "/courts": { get: { tags: ["Courts"], summary: "List public courts with pagination and filters" } },
      "/courts/{id}": { get: { tags: ["Courts"], summary: "Get court detail" } },
      "/courts/{id}/availability": { get: { tags: ["Courts"], summary: "Get court availability slots by date" } },
      "/bookings": { post: { tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "Create a booking" } },
      "/users/me/bookings": { get: { tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "List my bookings" } },
      "/users/me/bookings/{id}": { get: { tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "Get my booking detail" } },
      "/users/me/bookings/{id}/cancel": { put: { tags: ["Bookings"], security: [{ bearerAuth: [] }], summary: "Cancel my booking" } },
      "/courts/{courtId}/reviews": { get: { tags: ["Reviews"], summary: "List court reviews" } },
      "/reviews": { post: { tags: ["Reviews"], security: [{ bearerAuth: [] }], summary: "Create a review" } },
      "/users/me/notifications": { get: { tags: ["Notifications"], security: [{ bearerAuth: [] }], summary: "List my notifications" } },
      "/users/me/notifications/{id}/read": { put: { tags: ["Notifications"], security: [{ bearerAuth: [] }], summary: "Mark notification as read" } },
      "/users/me/notifications/read-all": { put: { tags: ["Notifications"], security: [{ bearerAuth: [] }], summary: "Mark all notifications as read" } }
    }
  },
  apis: ["./src/modules/**/*.ts", "./src/app.ts"]
});
