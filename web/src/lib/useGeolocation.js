import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lấy vị trí hiện tại của người dùng. Trả về trạng thái rõ ràng để UI
 * không hiển thị vị trí giả khi GPS chưa sẵn sàng hoặc bị từ chối.
 */
export default function useGeolocation({ auto = false } = {}) {
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | denied | unavailable | timeout
  const [error, setError] = useState(null);
  const watchId = useRef(null);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      setError('Thiết bị không hỗ trợ định vị.');
      return;
    }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: new Date().toISOString(),
        });
        setStatus('granted');
        setError(null);
      },
      (err) => {
        setStatus(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable');
        setError(
          err.code === 1
            ? 'Bạn đã từ chối quyền truy cập vị trí.'
            : err.code === 3
              ? 'Hết thời gian lấy vị trí.'
              : 'Không lấy được vị trí hiện tại.',
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }, []);

  const watch = useCallback(() => {
    if (!('geolocation' in navigator) || watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: new Date().toISOString(),
        });
        setStatus('granted');
      },
      () => setStatus('unavailable'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, []);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => {
    if (auto) request();
    return () => stopWatch();
  }, [auto, request, stopWatch]);

  return { position, status, error, request, watch, stopWatch };
}
