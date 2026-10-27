import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import MapView from '../components/MapView';
import PlaceSearch from '../components/PlaceSearch';
import { Alert, Badge, Field, Modal, SectionTitle } from '../components/ui';
import { catalog, places as placesApi, trips as tripsApi } from '../lib/api';
import { useAuth, useSocket, useTheme, useToast } from '../lib/context';
import useGeolocation from '../lib/useGeolocation';
import {
  PAYMENT_LABELS,
  SERVICE_TYPES,
  formatCurrency,
  formatDistance,
  formatDuration,
  toLocalInputValue,
} from '../lib/format';

const DEFAULT_CENTER = { lat: 10.7769, lng: 106.7009 };

const VEHICLE_ICON = {
  sedan4: 'car',
  suv7: 'car',
  van9: 'car',
  van16: 'car',
  bus29: 'car',
  bus35: 'car',
  bus45: 'car',
  premium4: 'sparkles',
};

export default function Booking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { success, error: toastError } = useToast();
  const { socket } = useSocket();
  const geo = useGeolocation();

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [stops, setStops] = useState([]);

  const [serviceType, setServiceType] = useState('ride');
  const [tripMode, setTripMode] = useState('one_way');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60_000)));
  const [returnAt, setReturnAt] = useState(() => toLocalInputValue(new Date(Date.now() + 4 * 60 * 60_000)));
  const [hours, setHours] = useState(4);
  const [days, setDays] = useState(1);

  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(0);
  const [notes, setNotes] = useState('');
  const [specialRequests, setSpecialRequests] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);

  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [options, setOptions] = useState({ specialRequests: [], paymentMethods: [], integrations: null });
  const [quotes, setQuotes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [savePlaceOpen, setSavePlaceOpen] = useState(false);
  const [savePlaceForm, setSavePlaceForm] = useState({ label: '', kind: 'home' });

  const submitLock = useRef(false);

  useEffect(() => {
    catalog.vehicleTypes().then((d) => setVehicleTypes(d.vehicleTypes || [])).catch(() => {});
    catalog.options().then((d) => setOptions(d)).catch(() => {});
    placesApi.list().then((d) => setSavedPlaces(d.places || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (geo.position && !pickup) {
      catalog
        .reverse(geo.position.lat, geo.position.lng)
        .then((data) =>
          setPickup({
            label: data.name || 'Vị trí hiện tại',
            address: data.address,
            lat: geo.position.lat,
            lng: geo.position.lng,
            source: data.source,
          }),
        )
        .catch(() =>
          setPickup({ label: 'Vị trí hiện tại', address: 'Vị trí hiện tại của bạn', lat: geo.position.lat, lng: geo.position.lng }),
        );
    }
  }, [geo.position, pickup]);

  const points = useMemo(() => {
    const list = [];
    if (pickup?.lat) list.push({ lat: pickup.lat, lng: pickup.lng });
    stops.forEach((s) => s?.lat && list.push({ lat: s.lat, lng: s.lng }));
    if (dropoff?.lat) list.push({ lat: dropoff.lat, lng: dropoff.lng });
    return list;
  }, [pickup, dropoff, stops]);

  useEffect(() => {
    if (points.length < 2) {
      setRoute(null);
      setQuotes([]);
      return undefined;
    }
    let cancelled = false;
    setRouteLoading(true);
    catalog
      .route(points)
      .then((data) => {
        if (!cancelled) setRoute(data);
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [points]);

  const quotePayload = useCallback(
    () => ({
      distanceKm: route?.distanceKm || 0,
      durationMin: route?.durationMin || 0,
      serviceType,
      tripMode,
      hours,
      days,
      stops: stops.filter((s) => s?.lat),
      specialRequests,
      promoCode: promoApplied?.code || null,
      scheduledAt: scheduleType === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
      passengers,
      luggage,
    }),
    [route, serviceType, tripMode, hours, days, stops, specialRequests, promoApplied, scheduleType, scheduledAt, passengers, luggage],
  );

  useEffect(() => {
    if (!route || !route.distanceKm) {
      setQuotes([]);
      return undefined;
    }
    let cancelled = false;
    setQuoteLoading(true);
    catalog
      .quote({ ...quotePayload(), allTypes: true })
      .then((data) => {
        if (cancelled) return;
        const list = data.quotes || [];
        setQuotes(list);
        setSelectedTypeId((current) => {
          if (current && list.some((q) => q.vehicleTypeId === current)) return current;
          return list[0]?.vehicleTypeId || null;
        });
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route, quotePayload]);

  const selectedQuote = quotes.find((q) => q.vehicleTypeId === selectedTypeId) || null;
  const selectedType = vehicleTypes.find((t) => t.id === selectedTypeId) || null;

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    try {
      const data = await catalog.promo(code);
      setPromoApplied(data.promo);
      success(`Đã áp dụng mã ${data.promo.code}`);
    } catch (err) {
      setPromoApplied(null);
      toastError(err.message);
    }
  };

  const addStop = () => setStops((prev) => [...prev, { label: '', address: '', lat: null, lng: null }]);
  const updateStop = (index, value) =>
    setStops((prev) => prev.map((stop, i) => (i === index ? { ...stop, ...value } : stop)));
  const removeStop = (index) => setStops((prev) => prev.filter((_, i) => i !== index));

  const swap = () => {
    setPickup(dropoff);
    setDropoff(pickup);
  };

  const onMapClick = async ({ lat, lng }) => {
    try {
      const data = await catalog.reverse(lat, lng);
      const place = { label: data.name || 'Điểm trên bản đồ', address: data.address, lat, lng, source: data.source };
      if (!pickup) setPickup(place);
      else if (!dropoff) setDropoff(place);
      else setDropoff(place);
    } catch {
      const place = { label: 'Điểm trên bản đồ', address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
      if (!pickup) setPickup(place);
      else setDropoff(place);
    }
  };

  const onPickupDrag = async ({ lat, lng }) => {
    try {
      const data = await catalog.reverse(lat, lng);
      setPickup((prev) => ({ ...prev, label: data.name || prev?.label, address: data.address, lat, lng }));
    } catch {
      setPickup((prev) => ({ ...prev, lat, lng }));
    }
  };

  const onDropoffDrag = async ({ lat, lng }) => {
    try {
      const data = await catalog.reverse(lat, lng);
      setDropoff((prev) => ({ ...prev, label: data.name || prev?.label, address: data.address, lat, lng }));
    } catch {
      setDropoff((prev) => ({ ...prev, lat, lng }));
    }
  };

  const toggleRequest = (code) =>
    setSpecialRequests((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const canConfirm = Boolean(pickup?.lat && dropoff?.lat && selectedQuote && route?.distanceKm);

  const submit = async () => {
    if (submitLock.current) return;
    if (!canConfirm) {
      toastError('Vui lòng chọn điểm đón, điểm trả và loại xe');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const payload = {
        vehicleTypeId: selectedTypeId,
        pickup,
        dropoff,
        stops: stops.filter((s) => s?.lat),
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        passengers,
        luggage,
        notes,
        specialRequests,
        paymentMethod,
        serviceType,
        tripMode,
        scheduleType,
        scheduledAt: scheduleType === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
        returnAt: tripMode === 'round_trip' ? new Date(returnAt).toISOString() : null,
        quote: selectedQuote,
      };
      const data = await tripsApi.create(payload);
      success('Đã tạo chuyến, đang tìm tài xế phù hợp');
      navigate(`/chuyen/${data.trip.id}`);
    } catch (err) {
      toastError(err.message);
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = (payload) => {
      if (payload?.trip?.status === 'assigned') {
        success('Tài xế đã nhận chuyến của bạn');
      }
    };
    socket.on('trip:update', onUpdate);
    return () => socket.off('trip:update', onUpdate);
  }, [socket, success]);

  const savePlace = async () => {
    if (!pickup?.lat || !savePlaceForm.label.trim()) return;
    try {
      const data = await placesApi.create({
        label: savePlaceForm.label.trim(),
        address: pickup.address || pickup.label,
        lat: pickup.lat,
        lng: pickup.lng,
        kind: savePlaceForm.kind,
      });
      setSavedPlaces((prev) => [...prev.filter((p) => p.kind !== data.place.kind || p.kind === 'other'), data.place]);
      setSavePlaceOpen(false);
      setSavePlaceForm({ label: '', kind: 'home' });
      success('Đã lưu địa điểm');
    } catch (err) {
      toastError(err.message);
    }
  };

  const integrations = options.integrations;

  return (
    <div className="page page--wide">
      <div className="booking-layout">
        <div className="stack">
          <MapView
            className="booking-map"
            pickup={pickup}
            dropoff={dropoff}
            stops={stops.filter((s) => s?.lat)}
            routeGeometry={route?.geometry}
            theme={theme}
            center={geo.position || DEFAULT_CENTER}
            onMapClick={onMapClick}
            draggablePickup
            draggableDropoff
            onPickupDrag={onPickupDrag}
            onDropoffDrag={onDropoffDrag}
            fitKey={`${pickup?.lat}-${dropoff?.lat}-${stops.length}`}
          />
          <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
            <div className="row-wrap">
              <button type="button" className="btn btn--sm btn--ghost" onClick={geo.request}>
                <Icon name="target" size={15} />
                {geo.status === 'granted' ? 'Cập nhật vị trí' : 'Lấy vị trí hiện tại'}
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={swap} disabled={!pickup || !dropoff}>
                <Icon name="refresh" size={15} />
                Đảo chiều
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSavePlaceOpen(true)} disabled={!pickup?.lat}>
                <Icon name="heart" size={15} />
                Lưu điểm đón
              </button>
            </div>
            {route && (
              <span className="text-sm muted">
                {formatDistance(route.distanceKm)} · {formatDuration(route.durationMin)}
                {route.simulated && ' · ước tính'}
              </span>
            )}
          </div>
          {geo.status === 'denied' && (
            <Alert tone="warning" title="Không có quyền truy cập vị trí">
              Bạn vẫn có thể nhập địa chỉ hoặc chọn trực tiếp trên bản đồ.
            </Alert>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <SectionTitle title="Hành trình" subtitle="Nhập địa chỉ hoặc chạm vào bản đồ để chọn điểm." />

            <div className="route-inputs">
              <div className="route-connector" aria-hidden="true" />
              <div className="route-input-row">
                <span className="route-marker route-marker--pickup">A</span>
                <PlaceSearch
                  value={pickup}
                  onSelect={setPickup}
                  placeholder="Điểm đón"
                  near={geo.position}
                  icon="pin"
                />
              </div>

              {stops.map((stop, index) => (
                <div className="route-input-row" key={index}>
                  <span className="route-marker route-marker--stop">{index + 1}</span>
                  <PlaceSearch
                    value={stop}
                    onSelect={(value) => updateStop(index, value)}
                    placeholder={`Điểm dừng ${index + 1}`}
                    near={geo.position}
                    icon="pin"
                  />
                  <button type="button" className="btn btn--icon btn--ghost" onClick={() => removeStop(index)} aria-label="Xóa điểm dừng">
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}

              <div className="route-input-row">
                <span className="route-marker route-marker--dropoff">B</span>
                <PlaceSearch
                  value={dropoff}
                  onSelect={setDropoff}
                  placeholder="Điểm trả"
                  near={geo.position}
                  icon="flag"
                />
              </div>
            </div>

            <div className="row-wrap">
              <button type="button" className="btn btn--sm btn--ghost" onClick={addStop} disabled={stops.length >= 4}>
                <Icon name="plus" size={15} />
                Thêm điểm dừng
              </button>
              {savedPlaces.length > 0 && (
                <div className="row-wrap">
                  {savedPlaces.slice(0, 4).map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      className="chip chip--button chip--sm"
                      onClick={() => setDropoff({ label: place.label, address: place.address, lat: place.lat, lng: place.lng })}
                    >
                      <Icon name={place.kind === 'home' ? 'heart' : place.kind === 'work' ? 'building' : 'pin'} size={13} />
                      {place.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {routeLoading && (
              <span className="text-xs muted row" style={{ gap: 6 }}>
                <span className="spinner" style={{ width: 13, height: 13 }} />
                Đang tính tuyến đường…
              </span>
            )}
          </div>

          <div className="card stack">
            <SectionTitle title="Dịch vụ" />
            <div className="scroll-x">
              {SERVICE_TYPES.map((service) => (
                <button
                  key={service.code}
                  type="button"
                  className={`chip chip--button ${serviceType === service.code ? 'chip--active' : ''}`}
                  onClick={() => setServiceType(service.code)}
                  title={service.description}
                >
                  {service.label}
                </button>
              ))}
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
              <Field label="Hình thức">
                <select className="select" value={tripMode} onChange={(e) => setTripMode(e.target.value)}>
                  <option value="one_way">Một chiều</option>
                  <option value="round_trip">Khứ hồi</option>
                </select>
              </Field>
              <Field label="Thời gian">
                <select className="select" value={scheduleType} onChange={(e) => setScheduleType(e.target.value)}>
                  <option value="now">Đi ngay</option>
                  <option value="scheduled">Đặt trước</option>
                </select>
              </Field>
            </div>

            {scheduleType === 'scheduled' && (
              <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
                <Field label="Giờ đón">
                  <input
                    type="datetime-local"
                    className="input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </Field>
                {tripMode === 'round_trip' && (
                  <Field label="Giờ chiều về">
                    <input type="datetime-local" className="input" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
                  </Field>
                )}
              </div>
            )}

            {serviceType === 'hourly' && (
              <Field label="Số giờ thuê">
                <input
                  type="number"
                  min={1}
                  max={24}
                  className="input"
                  value={hours}
                  onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
            )}
            {serviceType === 'daily' && (
              <Field label="Số ngày thuê">
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="input"
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
            )}

            <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
              <Field label="Số khách">
                <input
                  type="number"
                  min={1}
                  max={45}
                  className="input"
                  value={passengers}
                  onChange={(e) => setPassengers(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <Field label="Hành lý (kiện)">
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="input"
                  value={luggage}
                  onChange={(e) => setLuggage(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            </div>

            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAdvancedOpen((v) => !v)} style={{ alignSelf: 'flex-start' }}>
              <Icon name={advancedOpen ? 'chevronDown' : 'chevronRight'} size={15} />
              Tùy chọn nâng cao
            </button>

            {advancedOpen && (
              <div className="stack">
                <Field label="Yêu cầu đặc biệt">
                  <div className="row-wrap">
                    {options.specialRequests.map((request) => (
                      <button
                        key={request.code}
                        type="button"
                        className={`chip chip--button chip--sm ${specialRequests.includes(request.code) ? 'chip--active' : ''}`}
                        onClick={() => toggleRequest(request.code)}
                      >
                        {request.label}
                        {request.fee > 0 && <span className="muted">+{formatCurrency(request.fee)}</span>}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Ghi chú cho tài xế" htmlFor="notes">
                  <textarea
                    id="notes"
                    className="textarea"
                    placeholder="Ví dụ: tôi đứng ở cổng số 2, có 2 vali lớn…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                  />
                </Field>
                <Field label="Phương thức thanh toán">
                  <div className="stack-sm">
                    {options.paymentMethods.map((method) => (
                      <label key={method.code} className="checkbox">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === method.code}
                          onChange={() => setPaymentMethod(method.code)}
                        />
                        <span>
                          <strong className="text-sm">{method.label}</strong>
                          <span className="text-xs muted" style={{ display: 'block' }}>
                            {method.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            )}
          </div>

          <div className="card stack">
            <SectionTitle
              title="Chọn loại xe"
              subtitle={quoteLoading ? 'Đang tính giá…' : route ? `${formatDistance(route.distanceKm)} · ${formatDuration(route.durationMin)}` : 'Chọn điểm đón và điểm trả để xem giá'}
            />

            {!route && <Alert tone="info">Chọn điểm đón và điểm trả trên bản đồ để hệ thống tính tuyến đường và báo giá.</Alert>}

            {quotes.map((quote) => {
              const type = vehicleTypes.find((t) => t.id === quote.vehicleTypeId);
              const active = quote.vehicleTypeId === selectedTypeId;
              return (
                <button
                  key={quote.vehicleTypeId}
                  type="button"
                  className={`vehicle-option ${active ? 'vehicle-option--active' : ''}`}
                  onClick={() => setSelectedTypeId(quote.vehicleTypeId)}
                >
                  <span className="vehicle-option__icon">
                    <Icon name={VEHICLE_ICON[type?.code] || 'car'} size={22} />
                  </span>
                  <span className="grow stack-sm" style={{ gap: 2 }}>
                    <span className="row" style={{ gap: 6 }}>
                      <strong className="text-sm">{quote.vehicleTypeName}</strong>
                      {type?.tier === 'premium' && <Badge tone="accent">Cao cấp</Badge>}
                    </span>
                    <span className="text-xs muted">
                      {type?.seats} chỗ · {type?.luggageCapacity} kiện hành lý
                    </span>
                    {quote.surge > 1 && (
                      <span className="text-xs" style={{ color: 'var(--warning)' }}>
                        {quote.surgeLabel} ×{quote.surge}
                      </span>
                    )}
                  </span>
                  <span className="vehicle-option__price">{formatCurrency(quote.total)}</span>
                </button>
              );
            })}

            {route && !quoteLoading && quotes.length === 0 && (
              <Alert tone="warning" title="Không có loại xe phù hợp">
                Số khách vượt sức chứa các loại xe hiện có. Hãy giảm số khách hoặc liên hệ hỗ trợ.
              </Alert>
            )}
          </div>

          {selectedQuote && (
            <div className="card stack">
              <SectionTitle title="Chi tiết giá" subtitle="Giá ước tính, minh bạch từng khoản mục." />
              <div className="price-summary">
                {selectedQuote.items.map((item, index) => (
                  <div
                    key={`${item.code}-${index}`}
                    className={`price-row ${item.amount < 0 ? 'price-row--discount' : ''}`}
                    style={item.warning ? { color: 'var(--warning)' } : undefined}
                  >
                    <span>{item.label}</span>
                    <span className="mono">{item.amount === 0 ? '—' : formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="price-row price-row--total">
                  <span>Tổng cộng</span>
                  <span className="mono">{formatCurrency(selectedQuote.total)}</span>
                </div>
              </div>

              <div className="row-wrap">
                <div className="input-group grow">
                  <span className="input-group__icon">
                    <Icon name="tag" size={16} />
                  </span>
                  <input
                    className="input"
                    placeholder="Nhập mã giảm giá"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  />
                </div>
                <button type="button" className="btn btn--ghost" onClick={applyPromo} disabled={!promoCode.trim()}>
                  Áp dụng
                </button>
              </div>
              {promoApplied && (
                <div className="row-between text-sm">
                  <span className="text-success">
                    <Icon name="check" size={14} /> Đã áp dụng {promoApplied.code}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => {
                      setPromoApplied(null);
                      setPromoCode('');
                    }}
                  >
                    Bỏ mã
                  </button>
                </div>
              )}

              <p className="text-xs subtle">{selectedQuote.note}</p>

              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => setConfirmOpen(true)} disabled={!canConfirm}>
                <Icon name="check" size={18} />
                Xác nhận đặt xe · {formatCurrency(selectedQuote.total)}
              </button>
            </div>
          )}

          {integrations && (
            <div className="card card--soft stack-sm">
              <span className="text-xs strong uppercase muted">Trạng thái tích hợp</span>
              <div className="row-wrap text-xs">
                <Badge tone={integrations.maps?.mode === 'live' ? 'success' : 'warning'}>
                  Bản đồ: {integrations.maps?.mode === 'live' ? 'trực tuyến' : 'mô phỏng'}
                </Badge>
                <Badge tone={integrations.payments?.mode === 'live' ? 'success' : 'warning'}>
                  Thanh toán: {integrations.payments?.mode === 'live' ? 'trực tuyến' : 'mô phỏng'}
                </Badge>
                <Badge tone={integrations.sms?.mode === 'live' ? 'success' : 'warning'}>
                  SMS/OTP: {integrations.sms?.mode === 'live' ? 'trực tuyến' : 'mô phỏng'}
                </Badge>
              </div>
              <span className="text-xs subtle">
                {integrations.payments?.mode === 'live' && integrations.sms?.mode === 'live'
                  ? 'Thanh toán và SMS đã kết nối nhà cung cấp thật.'
                  : 'Chế độ mô phỏng không gửi SMS thật và không trừ tiền thật. Xem tài liệu tích hợp để cấu hình nhà cung cấp.'}
              </span>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận chuyến đi"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmOpen(false)}>
              Quay lại
            </button>
            <button type="button" className="btn btn--primary" onClick={submit} disabled={submitting}>
              {submitting ? <span className="spinner" /> : <Icon name="check" size={17} />}
              Đặt xe
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="stack-sm">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="route-marker route-marker--pickup">A</span>
              <div className="stack-sm" style={{ gap: 1 }}>
                <strong className="text-sm">{pickup?.label}</strong>
                <span className="text-xs muted">{pickup?.address}</span>
              </div>
            </div>
            {stops.filter((s) => s?.lat).map((stop, index) => (
              <div className="row" key={index} style={{ alignItems: 'flex-start' }}>
                <span className="route-marker route-marker--stop">{index + 1}</span>
                <div className="stack-sm" style={{ gap: 1 }}>
                  <strong className="text-sm">{stop.label}</strong>
                  <span className="text-xs muted">{stop.address}</span>
                </div>
              </div>
            ))}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="route-marker route-marker--dropoff">B</span>
              <div className="stack-sm" style={{ gap: 1 }}>
                <strong className="text-sm">{dropoff?.label}</strong>
                <span className="text-xs muted">{dropoff?.address}</span>
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div className="stack-sm">
            <div className="kv">
              <span className="kv__k">Loại xe</span>
              <span className="kv__v">{selectedQuote?.vehicleTypeName}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Quãng đường</span>
              <span className="kv__v">{formatDistance(route?.distanceKm)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Thời gian dự kiến</span>
              <span className="kv__v">{formatDuration(route?.durationMin)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Số khách / hành lý</span>
              <span className="kv__v">
                {passengers} khách · {luggage} kiện
              </span>
            </div>
            <div className="kv">
              <span className="kv__k">Thanh toán</span>
              <span className="kv__v">{PAYMENT_LABELS[paymentMethod]}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Thời gian</span>
              <span className="kv__v">
                {scheduleType === 'now' ? 'Đi ngay' : new Date(scheduledAt).toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="kv">
              <span className="kv__k">Tổng tiền (ước tính)</span>
              <span className="kv__v mono">{formatCurrency(selectedQuote?.total)}</span>
            </div>
          </div>

          <Alert tone="info">
            Giá trên là ước tính dựa trên lộ trình dự kiến. Giá cuối cùng có thể thay đổi nếu bạn thay đổi điểm đến hoặc
            thời gian chờ.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={savePlaceOpen}
        onClose={() => setSavePlaceOpen(false)}
        title="Lưu điểm đón quen thuộc"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSavePlaceOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={savePlace} disabled={!savePlaceForm.label.trim()}>
              Lưu
            </button>
          </>
        }
      >
        <div className="stack">
          <Field label="Tên gợi nhớ" htmlFor="place-label">
            <input
              id="place-label"
              className="input"
              placeholder="Nhà riêng, Công ty…"
              value={savePlaceForm.label}
              onChange={(e) => setSavePlaceForm((prev) => ({ ...prev, label: e.target.value }))}
            />
          </Field>
          <Field label="Loại địa điểm">
            <select
              className="select"
              value={savePlaceForm.kind}
              onChange={(e) => setSavePlaceForm((prev) => ({ ...prev, kind: e.target.value }))}
            >
              <option value="home">Nhà riêng</option>
              <option value="work">Công ty</option>
              <option value="other">Khác</option>
            </select>
          </Field>
          <p className="text-xs muted">Địa chỉ: {pickup?.address || pickup?.label}</p>
        </div>
      </Modal>
    </div>
  );
}
