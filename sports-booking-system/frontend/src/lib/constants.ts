export const APP_NAME = "SportBooking";
export const TOKEN_KEY = "sports_booking_token";
export const REFRESH_TOKEN_KEY = "sports_booking_refresh_token";
export const USER_KEY = "sports_booking_user";

/**
 * The 34 provinces and centrally-run cities after the 2025 merger (Resolution 202/2025/QH15).
 * `value` is what a court stores in `city`; Ho Chi Minh City keeps "TP.HCM", the spelling most
 * existing courts already use, so searches and groupings stay consistent.
 */
export const VIETNAM_PROVINCES: Array<{ value: string; label: string }> = [
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "TP.HCM", label: "TP. Hồ Chí Minh" },
  { value: "Hải Phòng", label: "Hải Phòng" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
  { value: "Huế", label: "Huế" },
  { value: "Cần Thơ", label: "Cần Thơ" },
  ...[
    "An Giang", "Bắc Ninh", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai",
    "Hà Tĩnh", "Hưng Yên", "Khánh Hòa", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Nghệ An", "Ninh Bình",
    "Phú Thọ", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sơn La", "Tây Ninh", "Thái Nguyên", "Thanh Hóa",
    "Tuyên Quang", "Vĩnh Long"
  ].map((name) => ({ value: name, label: name }))
];
