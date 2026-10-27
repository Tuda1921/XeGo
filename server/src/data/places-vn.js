/**
 * Bộ dữ liệu địa điểm nội bộ dùng khi không có kết nối tới dịch vụ bản đồ.
 * Đây là dữ liệu MÔ PHỎNG phục vụ chế độ demo/offline, không phải dữ liệu bản đồ thật.
 */
export const LOCAL_PLACES = [
  // TP. Hồ Chí Minh
  { name: 'Chợ Bến Thành', address: 'Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh', lat: 10.7725, lng: 106.698, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Nhà thờ Đức Bà', address: '01 Công xã Paris, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', lat: 10.7797, lng: 106.699, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Bưu điện Trung tâm Sài Gòn', address: '02 Công xã Paris, Quận 1, TP. Hồ Chí Minh', lat: 10.7798, lng: 106.6999, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Dinh Độc Lập', address: '135 Nam Kỳ Khởi Nghĩa, Quận 1, TP. Hồ Chí Minh', lat: 10.7772, lng: 106.6958, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Phố đi bộ Nguyễn Huệ', address: 'Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', lat: 10.7743, lng: 106.7038, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Sân bay Tân Sơn Nhất - Ga Quốc nội', address: 'Trường Sơn, Phường 2, Tân Bình, TP. Hồ Chí Minh', lat: 10.8142, lng: 106.6653, city: 'Hồ Chí Minh', kind: 'airport' },
  { name: 'Sân bay Tân Sơn Nhất - Ga Quốc tế', address: 'Trường Sơn, Tân Bình, TP. Hồ Chí Minh', lat: 10.8188, lng: 106.6588, city: 'Hồ Chí Minh', kind: 'airport' },
  { name: 'Bến xe Miền Đông', address: '292 Đinh Bộ Lĩnh, Bình Thạnh, TP. Hồ Chí Minh', lat: 10.8147, lng: 106.7106, city: 'Hồ Chí Minh', kind: 'station' },
  { name: 'Bến xe Miền Tây', address: '395 Kinh Dương Vương, Bình Tân, TP. Hồ Chí Minh', lat: 10.7385, lng: 106.6185, city: 'Hồ Chí Minh', kind: 'station' },
  { name: 'Vincom Center Đồng Khởi', address: '72 Lê Thánh Tôn, Quận 1, TP. Hồ Chí Minh', lat: 10.7781, lng: 106.7019, city: 'Hồ Chí Minh', kind: 'mall' },
  { name: 'Landmark 81', address: '720A Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', lat: 10.7951, lng: 106.7218, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Đại học Quốc gia TP.HCM', address: 'Linh Trung, Thủ Đức, TP. Hồ Chí Minh', lat: 10.87, lng: 106.8031, city: 'Hồ Chí Minh', kind: 'school' },
  { name: 'Khu công nghệ cao Sài Gòn', address: 'Tân Phú Trung, Củ Chi, TP. Hồ Chí Minh', lat: 10.8567, lng: 106.6267, city: 'Hồ Chí Minh', kind: 'office' },
  { name: 'Bệnh viện Chợ Rẫy', address: '201B Nguyễn Chí Thanh, Quận 5, TP. Hồ Chí Minh', lat: 10.754, lng: 106.659, city: 'Hồ Chí Minh', kind: 'hospital' },
  { name: 'Chợ Lớn - Bình Tây', address: '57 Tháp Mười, Quận 6, TP. Hồ Chí Minh', lat: 10.7497, lng: 106.651, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Crescent Mall Quận 7', address: '101 Tôn Dật Tiên, Quận 7, TP. Hồ Chí Minh', lat: 10.729, lng: 106.721, city: 'Hồ Chí Minh', kind: 'mall' },
  { name: 'Đại học RMIT Sài Gòn', address: '702 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', lat: 10.7295, lng: 106.6955, city: 'Hồ Chí Minh', kind: 'school' },
  { name: 'Suối Tiên', address: '120 Xa lộ Hà Nội, Thủ Đức, TP. Hồ Chí Minh', lat: 10.866, lng: 106.803, city: 'Hồ Chí Minh', kind: 'landmark' },
  { name: 'Vinhomes Central Park', address: '208 Nguyễn Hữu Cảnh, Bình Thạnh, TP. Hồ Chí Minh', lat: 10.794, lng: 106.722, city: 'Hồ Chí Minh', kind: 'residential' },
  { name: 'Phú Mỹ Hưng', address: 'Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', lat: 10.73, lng: 106.72, city: 'Hồ Chí Minh', kind: 'residential' },

  // Hà Nội
  { name: 'Hồ Hoàn Kiếm', address: 'Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội', lat: 21.0287, lng: 105.8524, city: 'Hà Nội', kind: 'landmark' },
  { name: 'Lăng Chủ tịch Hồ Chí Minh', address: 'Hùng Vương, Ba Đình, Hà Nội', lat: 21.0368, lng: 105.8347, city: 'Hà Nội', kind: 'landmark' },
  { name: 'Văn Miếu Quốc Tử Giám', address: '58 Quốc Tử Giám, Đống Đa, Hà Nội', lat: 21.0273, lng: 105.8355, city: 'Hà Nội', kind: 'landmark' },
  { name: 'Sân bay Nội Bài - Ga Quốc nội', address: 'Phú Minh, Sóc Sơn, Hà Nội', lat: 21.2187, lng: 105.8042, city: 'Hà Nội', kind: 'airport' },
  { name: 'Sân bay Nội Bài - Ga Quốc tế', address: 'Phú Minh, Sóc Sơn, Hà Nội', lat: 21.2212, lng: 105.8072, city: 'Hà Nội', kind: 'airport' },
  { name: 'Bến xe Giáp Bát', address: 'Giải Phóng, Hoàng Mai, Hà Nội', lat: 20.9757, lng: 105.8412, city: 'Hà Nội', kind: 'station' },
  { name: 'Bến xe Mỹ Đình', address: '20 Phạm Hùng, Nam Từ Liêm, Hà Nội', lat: 21.0285, lng: 105.7785, city: 'Hà Nội', kind: 'station' },
  { name: 'Vincom Bà Triệu', address: '191 Bà Triệu, Hai Bà Trưng, Hà Nội', lat: 21.0117, lng: 105.849, city: 'Hà Nội', kind: 'mall' },
  { name: 'Keangnam Landmark 72', address: 'Phạm Hùng, Nam Từ Liêm, Hà Nội', lat: 21.0175, lng: 105.7838, city: 'Hà Nội', kind: 'office' },
  { name: 'Đại học Bách khoa Hà Nội', address: '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', lat: 21.0049, lng: 105.8433, city: 'Hà Nội', kind: 'school' },
  { name: 'Hồ Tây', address: 'Đường Thanh Niên, Tây Hồ, Hà Nội', lat: 21.055, lng: 105.823, city: 'Hà Nội', kind: 'landmark' },
  { name: 'Times City', address: '458 Minh Khai, Hai Bà Trưng, Hà Nội', lat: 20.9945, lng: 105.868, city: 'Hà Nội', kind: 'mall' },
  { name: 'Royal City', address: '72A Nguyễn Trãi, Thanh Xuân, Hà Nội', lat: 20.996, lng: 105.8155, city: 'Hà Nội', kind: 'mall' },
  { name: 'Bệnh viện Bạch Mai', address: '78 Giải Phóng, Hai Bà Trưng, Hà Nội', lat: 20.9985, lng: 105.841, city: 'Hà Nội', kind: 'hospital' },

  // Đà Nẵng
  { name: 'Cầu Rồng', address: 'Nguyễn Văn Linh, Hải Châu, Đà Nẵng', lat: 16.0614, lng: 108.227, city: 'Đà Nẵng', kind: 'landmark' },
  { name: 'Sân bay Đà Nẵng', address: 'Nguyễn Văn Linh, Hải Châu, Đà Nẵng', lat: 16.0439, lng: 108.1994, city: 'Đà Nẵng', kind: 'airport' },
  { name: 'Bãi biển Mỹ Khê', address: 'Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', lat: 16.0544, lng: 108.247, city: 'Đà Nẵng', kind: 'landmark' },
  { name: 'Bà Nà Hills', address: 'Hòa Ninh, Hòa Vang, Đà Nẵng', lat: 15.9977, lng: 107.988, city: 'Đà Nẵng', kind: 'landmark' },
  { name: 'Phố cổ Hội An', address: 'Minh An, Hội An, Quảng Nam', lat: 15.8801, lng: 108.338, city: 'Quảng Nam', kind: 'landmark' },

  // Cần Thơ / Hải Phòng / Nha Trang / Đà Lạt
  { name: 'Bến Ninh Kiều', address: 'Hai Bà Trưng, Ninh Kiều, Cần Thơ', lat: 10.034, lng: 105.788, city: 'Cần Thơ', kind: 'landmark' },
  { name: 'Sân bay Cần Thơ', address: 'Lê Hồng Phong, Bình Thủy, Cần Thơ', lat: 10.0851, lng: 105.7119, city: 'Cần Thơ', kind: 'airport' },
  { name: 'Nhà hát lớn Hải Phòng', address: 'Hoàng Văn Thụ, Hồng Bàng, Hải Phòng', lat: 20.865, lng: 106.683, city: 'Hải Phòng', kind: 'landmark' },
  { name: 'Sân bay Cát Bi', address: 'Cát Bi, Hải An, Hải Phòng', lat: 20.8194, lng: 106.7249, city: 'Hải Phòng', kind: 'airport' },
  { name: 'Vinpearl Nha Trang', address: 'Đảo Hòn Tre, Nha Trang, Khánh Hòa', lat: 12.218, lng: 109.24, city: 'Khánh Hòa', kind: 'landmark' },
  { name: 'Sân bay Cam Ranh', address: 'Cam Ranh, Khánh Hòa', lat: 11.9982, lng: 109.2194, city: 'Khánh Hòa', kind: 'airport' },
  { name: 'Hồ Xuân Hương', address: 'Trần Quốc Toản, Đà Lạt, Lâm Đồng', lat: 11.941, lng: 108.442, city: 'Lâm Đồng', kind: 'landmark' },
  { name: 'Sân bay Liên Khương', address: 'Đức Trọng, Lâm Đồng', lat: 11.75, lng: 108.373, city: 'Lâm Đồng', kind: 'airport' },
];

const normalize = (text = '') =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function searchLocalPlaces(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  return LOCAL_PLACES.map((place) => {
    const haystack = normalize(`${place.name} ${place.address} ${place.city}`);
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length;
    }
    if (normalize(place.name).startsWith(q)) score += 20;
    return { place, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ place }) => ({
      id: `local:${place.lat},${place.lng}`,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      city: place.city,
      kind: place.kind,
      source: 'local',
      simulated: true,
    }));
}

export function nearestLocalPlace(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const place of LOCAL_PLACES) {
    const d = (place.lat - lat) ** 2 + (place.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = place;
    }
  }
  return best;
}
