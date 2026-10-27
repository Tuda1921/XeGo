import React, { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, Badge, EmptyState, Field, KV, Modal, Plate, SectionTitle } from '../../components/ui';
import { catalog, driver as driverApi } from '../../lib/api';
import { useAuth, useToast } from '../../lib/context';
import { VERIFICATION_STATUS, formatDate } from '../../lib/format';

const EMPTY_VEHICLE = {
  plate: '',
  brand: '',
  model: '',
  color: '',
  year: '',
  seats: '',
  vehicleTypeId: '',
};

export default function DriverProfile() {
  const { user, driverProfile, vehicles, refresh } = useAuth();
  const { success, error: toastError } = useToast();

  const [form, setForm] = useState({
    licenseNumber: '',
    licenseExpiry: '',
    idCardNumber: '',
    serviceArea: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState([]);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [vehicleSaving, setVehicleSaving] = useState(false);

  useEffect(() => {
    setForm({
      licenseNumber: driverProfile?.licenseNumber || '',
      licenseExpiry: driverProfile?.licenseExpiry ? String(driverProfile.licenseExpiry).slice(0, 10) : '',
      idCardNumber: driverProfile?.idCardNumber || '',
      serviceArea: driverProfile?.serviceArea || '',
      bio: driverProfile?.bio || '',
    });
  }, [driverProfile]);

  useEffect(() => {
    catalog
      .vehicleTypes()
      .then((data) => setTypes(data.vehicleTypes || []))
      .catch(() => setTypes([]));
  }, []);

  const verification = driverProfile?.verificationStatus || 'pending';
  const meta = VERIFICATION_STATUS[verification] || VERIFICATION_STATUS.pending;

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await driverApi.updateProfile({
        licenseNumber: form.licenseNumber || null,
        licenseExpiry: form.licenseExpiry || null,
        idCardNumber: form.idCardNumber || null,
        serviceArea: form.serviceArea || null,
        bio: form.bio || null,
      });
      await refresh();
      success('Đã lưu hồ sơ tài xế');
    } catch (err) {
      toastError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addVehicle = async (event) => {
    event.preventDefault();
    if (!vehicleForm.plate || !vehicleForm.vehicleTypeId) {
      toastError('Vui lòng nhập biển số và chọn loại xe');
      return;
    }
    setVehicleSaving(true);
    try {
      await driverApi.addVehicle({
        plate: vehicleForm.plate,
        brand: vehicleForm.brand || null,
        model: vehicleForm.model || null,
        color: vehicleForm.color || null,
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
        seats: vehicleForm.seats ? Number(vehicleForm.seats) : null,
        vehicleTypeId: Number(vehicleForm.vehicleTypeId),
      });
      await refresh();
      setVehicleOpen(false);
      setVehicleForm(EMPTY_VEHICLE);
      success('Đã thêm phương tiện');
    } catch (err) {
      toastError(err.message);
    } finally {
      setVehicleSaving(false);
    }
  };

  const removeVehicle = async (id) => {
    try {
      await driverApi.removeVehicle(id);
      await refresh();
      success('Đã xóa phương tiện');
    } catch (err) {
      toastError(err.message);
    }
  };

  return (
    <div className="driver-shell">
      <div className="stack">
        <SectionTitle title="Hồ sơ tài xế" subtitle="Thông tin giấy tờ và phương tiện dùng để xác minh tài khoản." />

        <div className="card stack">
          <div className="row-between">
            <div className="stack-sm" style={{ gap: 2 }}>
              <strong>{user?.name}</strong>
              <span className="text-xs muted">{user?.phone}</span>
            </div>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          {verification === 'rejected' && (
            <Alert tone="danger" title="Hồ sơ bị từ chối">
              {driverProfile?.verificationNote || 'Vui lòng kiểm tra lại giấy tờ và gửi lại hồ sơ.'}
            </Alert>
          )}
          {verification === 'pending' && (
            <Alert tone="warning" title="Đang chờ xác minh">
              Quản trị viên sẽ kiểm tra giấy tờ của bạn. Bạn chưa thể nhận chuyến cho tới khi hồ sơ được duyệt.
            </Alert>
          )}
          <div className="stack-sm">
            <KV label="Đánh giá" value={`${Number(driverProfile?.rating || 5).toFixed(1)} (${driverProfile?.ratingCount || 0} lượt)`} />
            <KV label="Chuyến hoàn thành" value={driverProfile?.tripsCompleted || 0} />
            <KV label="Chuyến đã hủy" value={driverProfile?.tripsCancelled || 0} />
          </div>
        </div>

        <form className="card stack" onSubmit={saveProfile}>
          <strong className="text-sm">Giấy tờ</strong>
          <Field label="Số bằng lái xe" htmlFor="licenseNumber">
            <input
              id="licenseNumber"
              className="input"
              value={form.licenseNumber}
              onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))}
              placeholder="VD: 0123456789"
            />
          </Field>
          <Field label="Ngày hết hạn bằng lái" htmlFor="licenseExpiry">
            <input
              id="licenseExpiry"
              className="input"
              type="date"
              value={form.licenseExpiry}
              onChange={(e) => setForm((p) => ({ ...p, licenseExpiry: e.target.value }))}
            />
          </Field>
          <Field label="Số CCCD/CMND" htmlFor="idCardNumber">
            <input
              id="idCardNumber"
              className="input"
              value={form.idCardNumber}
              onChange={(e) => setForm((p) => ({ ...p, idCardNumber: e.target.value }))}
              placeholder="VD: 079123456789"
            />
          </Field>
          <Field label="Khu vực hoạt động" htmlFor="serviceArea" hint="Ví dụ: TP. Hồ Chí Minh và lân cận">
            <input
              id="serviceArea"
              className="input"
              value={form.serviceArea}
              onChange={(e) => setForm((p) => ({ ...p, serviceArea: e.target.value }))}
            />
          </Field>
          <Field label="Giới thiệu" htmlFor="bio" hint="Kinh nghiệm, loại xe bạn có thể chạy, ngôn ngữ…">
            <textarea
              id="bio"
              className="textarea"
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Tài xế 5 năm kinh nghiệm, chạy xe 7 chỗ, thông thạo tuyến sân bay Tân Sơn Nhất."
            />
          </Field>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? <span className="spinner" /> : 'Lưu hồ sơ'}
          </button>
        </form>

        <div className="card stack">
          <div className="row-between">
            <strong className="text-sm">Phương tiện</strong>
            <button type="button" className="btn btn--sm btn--soft" onClick={() => setVehicleOpen(true)}>
              <Icon name="plus" size={15} />
              Thêm xe
            </button>
          </div>

          {vehicles.length === 0 ? (
            <EmptyState
              icon="car"
              title="Chưa có phương tiện"
              description="Thêm xe để hệ thống gửi cuốc phù hợp với loại xe của bạn."
              action={
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setVehicleOpen(true)}>
                  Thêm phương tiện
                </button>
              }
            />
          ) : (
            <div className="stack-sm">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="list-item">
                  <div className="grow stack-sm" style={{ gap: 2 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <Plate>{vehicle.plate}</Plate>
                      <Badge tone={vehicle.status === 'active' ? 'success' : 'default'}>
                        {vehicle.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </Badge>
                    </div>
                    <span className="text-xs muted">
                      {vehicle.brand} {vehicle.model} · {vehicle.typeName} · {vehicle.seats} chỗ
                      {vehicle.color ? ` · ${vehicle.color}` : ''}
                      {vehicle.year ? ` · ${vehicle.year}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--icon btn--ghost"
                    aria-label="Xóa phương tiện"
                    onClick={() => removeVehicle(vehicle.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card--soft stack-sm">
          <span className="text-xs strong uppercase muted">Tham gia từ</span>
          <span className="text-sm">{formatDate(user?.createdAt)}</span>
        </div>
      </div>

      <Modal
        open={vehicleOpen}
        onClose={() => setVehicleOpen(false)}
        title="Thêm phương tiện"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setVehicleOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={addVehicle} disabled={vehicleSaving}>
              {vehicleSaving ? <span className="spinner" /> : 'Thêm xe'}
            </button>
          </>
        }
      >
        <form className="stack" onSubmit={addVehicle}>
          <Field label="Biển số" htmlFor="plate">
            <input
              id="plate"
              className="input"
              value={vehicleForm.plate}
              onChange={(e) => setVehicleForm((p) => ({ ...p, plate: e.target.value.toUpperCase() }))}
              placeholder="51G-123.45"
            />
          </Field>
          <Field label="Loại xe" htmlFor="vehicleTypeId">
            <select
              id="vehicleTypeId"
              className="select"
              value={vehicleForm.vehicleTypeId}
              onChange={(e) => setVehicleForm((p) => ({ ...p, vehicleTypeId: e.target.value }))}
            >
              <option value="">Chọn loại xe</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.seats} chỗ)
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            <Field label="Hãng" htmlFor="brand">
              <input
                id="brand"
                className="input"
                value={vehicleForm.brand}
                onChange={(e) => setVehicleForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="Toyota"
              />
            </Field>
            <Field label="Mẫu" htmlFor="model">
              <input
                id="model"
                className="input"
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))}
                placeholder="Innova"
              />
            </Field>
            <Field label="Màu" htmlFor="color">
              <input
                id="color"
                className="input"
                value={vehicleForm.color}
                onChange={(e) => setVehicleForm((p) => ({ ...p, color: e.target.value }))}
                placeholder="Trắng"
              />
            </Field>
            <Field label="Năm sản xuất" htmlFor="year">
              <input
                id="year"
                className="input"
                type="number"
                min="1990"
                max="2100"
                value={vehicleForm.year}
                onChange={(e) => setVehicleForm((p) => ({ ...p, year: e.target.value }))}
                placeholder="2020"
              />
            </Field>
          </div>
          <Field label="Số ghế" htmlFor="seats" hint="Để trống sẽ dùng số ghế mặc định của loại xe.">
            <input
              id="seats"
              className="input"
              type="number"
              min="2"
              max="60"
              value={vehicleForm.seats}
              onChange={(e) => setVehicleForm((p) => ({ ...p, seats: e.target.value }))}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
