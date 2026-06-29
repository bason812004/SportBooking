import { useEffect, useState } from "react";

export type UserLocation = {
  latitude: number;
  longitude: number;
};

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
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
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setPermissionState("granted");
        setLoading(false);
      },
      (geoError) => {
        setError(geoError.code === geoError.PERMISSION_DENIED ? "location.denied" : "location.unavailable");
        if (geoError.code === geoError.PERMISSION_DENIED) setPermissionState("denied");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  function clearLocation() {
    setLocation(null);
    setError(null);
  }

  return { location, error, loading, permissionState, secureContext, requestLocation, clearLocation };
}
