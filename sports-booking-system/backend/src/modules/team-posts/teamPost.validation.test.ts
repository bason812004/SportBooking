import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { teamPostMessageSchema } from "./teamPost.validation.js";

describe("teamPost validation", () => {
  it("rejects empty text messages", () => {
    const result = teamPostMessageSchema.safeParse({
      params: { id: "tp0001" },
      body: { content: "   ", messageType: "TEXT" }
    });
    assert.equal(result.success, false);
  });

  it("requires attachmentUrl for media messages", () => {
    const result = teamPostMessageSchema.safeParse({
      params: { id: "tp0001" },
      body: { content: "Photo", messageType: "IMAGE" }
    });
    assert.equal(result.success, false);
  });

  it("accepts text messages with content", () => {
    const result = teamPostMessageSchema.safeParse({
      params: { id: "tp0001" },
      body: { content: "Hello", messageType: "TEXT" }
    });
    assert.equal(result.success, true);
  });

  it("accepts image messages with attachmentUrl", () => {
    const result = teamPostMessageSchema.safeParse({
      params: { id: "tp0001" },
      body: {
        content: "Look at this",
        messageType: "IMAGE",
        attachmentUrl: "https://cdn.example.com/x.png"
      }
    });
    assert.equal(result.success, true);
  });

  it("accepts image-only messages without text content", () => {
    const result = teamPostMessageSchema.safeParse({
      params: { id: "tp0001" },
      body: {
        messageType: "IMAGE",
        attachmentUrl: "https://cdn.example.com/x.png"
      }
    });
    assert.equal(result.success, true);
  });

  it("accepts video-only messages without text content", () => {
    const result = teamPostMessageSchema.safeParse({
      params: { id: "tp0001" },
      body: {
        messageType: "VIDEO",
        attachmentUrl: "https://cdn.example.com/x.mp4",
        mimeType: "video/mp4"
      }
    });
    assert.equal(result.success, true);
  });
});
