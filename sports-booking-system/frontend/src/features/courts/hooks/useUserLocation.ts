import { useEffect, useState } from "react";

export type UserLocation = {
  latitude: number;
  longitude: number;
};

const LOCATION_COOKIE = "sportbooking_location";
const LOCATION_REQUEST_COOKIE = "sportbooking_location_requested";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function writeCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readCachedLocation(): UserLocation | null {
  const raw = readCookie(LOCATION_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserLocation;
    if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function useUserLocation({ autoRequest = false }: { autoRequest?: boolean } = {}) {
  const [location, setLocation] = useState<UserLocation | null>(() => readCachedLocation());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | "unsupported">("prompt");
  const secureContext = typeof window === "undefined" ? true : window.isSecureContext;

  useEffect(() => {
    let mounted = true;
    if (!navigator.permissions?.query) {
      setPermissionState("unsupported");
      return;
    }

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (!mounted) return;
        setPermissionState(permission.state);
        permission.onchange = () => setPermissionState(permission.state);
      })
      .catch(() => {
        if (mounted) setPermissionState("unsupported");
      });

    return () => {
      mounted = false;
    };
  }, []);

  function requestLocation() {
    setError(null);
    writeCookie(LOCATION_REQUEST_COOKIE, "1");
    if (!secureContext) {
      setError("location.insecure");
      return;
    }
    if (!navigator.geolocation) {
      setError("location.unsupported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(nextLocation);
        writeCookie(LOCATION_COOKIE, JSON.stringify(nextLocation));
        setPermissionState("granted");
        setLoading(false);
      },
      (geoError) => {
        setError(geoError.code === geoError.PERMISSION_DENIED ? "location.denied" : "location.unavailable");
        if (geoError.code === geoError.PERMISSION_DENIED) setPermissionState("denied");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    if (!autoRequest || location || loading || typeof window === "undefined") return;
    if (permissionState === "granted") {
      requestLocation();
      return;
    }
    if (readCookie(LOCATION_REQUEST_COOKIE)) return;
    requestLocation();
  }, [autoRequest, location, loading, permissionState]);

  function clearLocation() {
    setLocation(null);
    setError(null);
    clearCookie(LOCATION_COOKIE);
    clearCookie(LOCATION_REQUEST_COOKIE);
  }

  return { location, error, loading, permissionState, secureContext, requestLocation, clearLocation };
}
