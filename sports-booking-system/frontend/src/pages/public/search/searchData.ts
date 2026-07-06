export const heatmapHours: Array<{ time: string; level: number }> = [
  { time: "06:00", level: 35 },
  { time: "07:00", level: 42 },
  { time: "08:00", level: 48 },
  { time: "09:00", level: 40 },
  { time: "10:00", level: 32 },
  { time: "16:00", level: 58 },
  { time: "17:00", level: 72 },
  { time: "18:00", level: 88 },
  { time: "19:00", level: 94 },
  { time: "20:00", level: 86 }
];

export const recentlyViewedCourts: Array<{ id: string; name: string; price: number; image: string }> = [
  {
    id: "c0001",
    name: "Sân thể thao Quận 1",
    price: 180000,
    image: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "c0002",
    name: "Cụm sân Cầu Giấy",
    price: 220000,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "c0003",
    name: "Tennis Riverside",
    price: 260000,
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=600&q=80"
  }
];

export const recommendationCourts: Array<{ id: string; name: string; category: string; distance: string; rating: number; image: string }> = [
  {
    id: "c0004",
    name: "Pickleball Thủ Đức",
    category: "Pickleball",
    distance: "3.2 km",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "c0005",
    name: "Sân bóng Sala",
    category: "Bóng đá",
    distance: "4.6 km",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "c0006",
    name: "Cầu lông Phú Nhuận",
    category: "Cầu lông",
    distance: "5.1 km",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80"
  }
];
