import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isFallback?: boolean;
};

export type LocationStatus =
  | "INITIALIZING"
  | "FETCHING"
  | "GRANTED"
  | "DENIED"
  | "UNAVAILABLE"
  | "LOW_ACCURACY"
  | "UNSUPPORTED";

const LOCATION_CACHE_KEY = "sportbooking_device_location_cache";
const MAX_ACCURACY_THRESHOLD = 1000; // 1000m threshold
const MOVEMENT_THRESHOLD = 0.001; // ~100m threshold

function getDistanceDelta(a: UserLocation, b: UserLocation): number {
  const dLat = Math.abs(a.latitude - b.latitude);
  const dLng = Math.abs(a.longitude - b.longitude);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function readFallbackCache(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY) || sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserLocation;
    if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
      return { ...parsed, isFallback: true };
    }
  } catch {
    return null;
  }
  return null;
}

function saveFallbackCache(loc: UserLocation) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      timestamp: loc.timestamp
    });
    localStorage.setItem(LOCATION_CACHE_KEY, payload);
    sessionStorage.setItem(LOCATION_CACHE_KEY, payload);
  } catch {
    // Ignore storage errors
  }
}

export type UseUserLocationOptions = {
  autoRequest?: boolean;
  enableRealtimeWatch?: boolean;
};

export function useUserLocation(options: UseUserLocationOptions = {}) {
  const { autoRequest = false, enableRealtimeWatch = false } = options;
  const queryClient = useQueryClient();

  const [location, setLocation] = useState<UserLocation | null>(() => readFallbackCache());
  const [status, setStatus] = useState<LocationStatus>("INITIALIZING");
  const [statusMessage, setStatusMessage] = useState<string>("Đang kiểm tra quyền vị trí...");
  const [loading, setLoading] = useState<boolean>(false);

  const prevLocationRef = useRef<UserLocation | null>(location);
  const watchIdRef = useRef<number | null>(null);

  const applyLocationUpdate = useCallback(
    (newLoc: UserLocation) => {
      const prev = prevLocationRef.current;
      const isSignificantChange = !prev || getDistanceDelta(prev, newLoc) > MOVEMENT_THRESHOLD;

      if (process.env.NODE_ENV !== "production") {
        console.log("[LOCATION]", {
          previous: prev ? { lat: prev.latitude, lng: prev.longitude } : null,
          current: { lat: newLoc.latitude, lng: newLoc.longitude },
          accuracy: `${Math.round(newLoc.accuracy)}m`,
          isSignificantChange
        });
      }

      prevLocationRef.current = newLoc;
      setLocation(newLoc);
      saveFallbackCache(newLoc);

      if (isSignificantChange) {
        queryClient.invalidateQueries({ queryKey: ["courts"] });
        queryClient.invalidateQueries({ queryKey: ["nearby-courts"] });
        queryClient.invalidateQueries({ queryKey: ["court"] });
      }
    },
    [queryClient]
  );

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("UNSUPPORTED");
      setStatusMessage("Trình duyệt của bạn không hỗ trợ định vị vị trí GPS.");
      return;
    }

    setLoading(true);
    setStatus("FETCHING");
    setStatusMessage("Đang xác định vị trí hiện tại của thiết bị...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp || Date.now();

        if (accuracy > MAX_ACCURACY_THRESHOLD) {
          setStatus("LOW_ACCURACY");
          setStatusMessage(`Vị trí hiện tại chưa đủ chính xác (độ tin cậy > ${Math.round(accuracy)}m).`);
          applyLocationUpdate({ latitude, longitude, accuracy, timestamp, isFallback: true });
          return;
        }

        const freshLocation: UserLocation = { latitude, longitude, accuracy, timestamp, isFallback: false };
        setStatus("GRANTED");
        setStatusMessage("Đã xác định vị trí hiện tại");
        applyLocationUpdate(freshLocation);
      },
      (geoError) => {
        setLoading(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus("DENIED");
          setStatusMessage("Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí của trình duyệt để tìm sân gần bạn.");
        } else {
          setStatus("UNAVAILABLE");
          setStatusMessage("Không thể kết nối dịch vụ GPS để lấy vị trí thiết bị.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // maximumAge: 0 forces fresh GPS lookup
    );
  }, [applyLocationUpdate]);

  useEffect(() => {
    if (!autoRequest) return;
    requestLocation();
  }, [autoRequest, requestLocation]);

  useEffect(() => {
    if (!enableRealtimeWatch || typeof window === "undefined" || !navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp || Date.now();

        if (accuracy <= MAX_ACCURACY_THRESHOLD) {
          setStatus("GRANTED");
          setStatusMessage("Đã xác định vị trí hiện tại");
          applyLocationUpdate({ latitude, longitude, accuracy, timestamp, isFallback: false });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("DENIED");
          setStatusMessage("Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí của trình duyệt để tìm sân gần bạn.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enableRealtimeWatch, applyLocationUpdate]);

  return {
    location,
    status,
    statusMessage,
    loading,
    permissionState: status === "GRANTED" ? "granted" : status === "DENIED" ? "denied" : "prompt",
    requestLocation,
    refreshLocation: requestLocation,
    clearLocation: () => {
      setLocation(null);
      localStorage.removeItem(LOCATION_CACHE_KEY);
      sessionStorage.removeItem(LOCATION_CACHE_KEY);
    }
  };
}
