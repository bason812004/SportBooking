import {
  BadgeCheck,
  Bath,
  Bike,
  Car,
  Dumbbell,
  Fan,
  Lightbulb,
  MapPin,
  ShowerHead,
  Sparkles,
  Star,
  Trophy,
  Volleyball,
  Wifi,
  type LucideIcon
} from "lucide-react";

export const sportFilters = ["Bóng đá", "Tennis", "Cầu lông", "Bóng chuyền", "Pickleball", "Bóng rổ"];
export const ratingFilters = ["5 sao", "4 sao trở lên", "3 sao trở lên"];
export const statusFilters = ["Còn sân", "Gần hết sân", "Hết sân"];
export const distanceFilters = ["<1km", "<3km", "<5km", "<10km"];
export const sortOptions = ["Phổ biến nhất", "Gần nhất", "Giá thấp nhất", "Giá cao nhất", "Rating cao nhất", "Đặt nhiều nhất", "Mới nhất"];

export const amenityFilters: Array<{ name: string; icon: LucideIcon }> = [
  { name: "Bãi xe", icon: Car },
  { name: "Nhà tắm", icon: Bath },
  { name: "Phòng thay đồ", icon: ShowerHead },
  { name: "Máy lạnh", icon: Fan },
  { name: "Nước uống", icon: Dumbbell },
  { name: "Wifi", icon: Wifi },
  { name: "Đèn chiếu sáng", icon: Lightbulb }
];

export const fallbackSearchCourts = [
  {
    id: "panda",
    name: "Panda Badminton Premium",
    category: "Cầu lông",
    address: "65A D. Lò Tư, Bình Tân, TP.HCM",
    distance: "2.4 km",
    price: 120000,
    rating: 4.9,
    reviews: 328,
    bookings: 2180,
    badge: "HOT",
    status: "Còn sân",
    occupancy: 85,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=500&q=80"
    ],
    slots: ["18:00", "19:00", "20:00"],
    amenities: ["Wifi", "Bãi xe", "Nước uống", "Đèn chiếu sáng"],
    lat: 10.76,
    lng: 106.62
  },
  {
    id: "ami",
    name: "Ami Social Pickleball Club",
    category: "Pickleball",
    address: "Nguyễn Văn Linh, Quận 7, TP.HCM",
    distance: "4.8 km",
    price: 180000,
    rating: 4.8,
    reviews: 219,
    bookings: 1540,
    badge: "Ưu đãi",
    status: "Gần hết sân",
    occupancy: 91,
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=500&q=80"
    ],
    slots: ["17:30", "19:30", "21:00"],
    amenities: ["Bãi xe", "Phòng thay đồ", "Wifi", "Máy lạnh"],
    lat: 10.73,
    lng: 106.71
  },
  {
    id: "victory",
    name: "Victory Football Hub",
    category: "Bóng đá",
    address: "Cộng Hòa, Tân Bình, TP.HCM",
    distance: "6.2 km",
    price: 350000,
    rating: 4.7,
    reviews: 412,
    bookings: 3210,
    badge: "Best Seller",
    status: "Còn sân",
    occupancy: 78,
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=500&q=80"
    ],
    slots: ["18:00", "20:00", "21:30"],
    amenities: ["Bãi xe", "Nước uống", "Đèn chiếu sáng"],
    lat: 10.8,
    lng: 106.66
  },
  {
    id: "ace",
    name: "Ace Tennis Center",
    category: "Tennis",
    address: "Thảo Điền, Thủ Đức, TP.HCM",
    distance: "8.1 km",
    price: 220000,
    rating: 4.95,
    reviews: 188,
    bookings: 980,
    badge: "Mới",
    status: "Còn sân",
    occupancy: 69,
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1542144582-1ba00456b5e3?auto=format&fit=crop&w=500&q=80"
    ],
    slots: ["14:00", "16:00", "19:00"],
    amenities: ["Nhà tắm", "Wifi", "Máy lạnh"],
    lat: 10.81,
    lng: 106.74
  }
];

export const recommendationCourts = fallbackSearchCourts.slice(0, 3);
export const recentlyViewedCourts = fallbackSearchCourts.slice(1, 4);

export const heatmapHours = [
  { time: "06h", level: 25 },
  { time: "09h", level: 38 },
  { time: "12h", level: 44 },
  { time: "15h", level: 56 },
  { time: "17h", level: 88 },
  { time: "18h", level: 94 },
  { time: "19h", level: 98 },
  { time: "20h", level: 96 },
  { time: "21h", level: 90 },
  { time: "22h", level: 72 }
];

export const searchIcons = { MapPin, Star, BadgeCheck, Sparkles, Trophy, Bike, Volleyball };
