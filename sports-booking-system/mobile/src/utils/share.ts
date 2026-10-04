import { Share } from "react-native";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, "");

// Opens the system share sheet for a page that lives under the same path on web and in the app,
// e.g. "blogs/my-post". Without EXPO_PUBLIC_WEB_URL the link only opens on phones that have the app.
export async function shareLink(title: string, path: string) {
  const url = WEB_URL ? `${WEB_URL}/${path}` : `sportbooking://${path}`;
  try {
    await Share.share({ title, message: `${title}\n${url}` });
  } catch {
    // Dismissing the share sheet, or a platform without one, is not an error worth surfacing.
  }
}
