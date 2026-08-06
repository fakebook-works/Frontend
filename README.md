# Fakebook Frontend

React + TypeScript frontend cho Fakebook, được xây dựng bằng Vite. Kiến trúc dự án được phân tách rõ ràng thành các module giao tiếp thông qua Gateway GraphQL.

## 🗺️ Cấu trúc dự án (Graphify Insights)

Dự án này sử dụng kiến trúc phân tầng. Dưới đây là các cụm (communities) chính trong codebase:

- `src/api/`: Chứa các GraphQL client và REST client giao tiếp với Gateway (e.g., `social.ts`, `messenger.ts`, `search.ts`).
- `src/pages/`: Các trang giao diện chính (Routing) như `ProfilePage`, `GroupProfilePage`, `MessengerPage`, v.v. Các trang này chịu trách nhiệm fetch dữ liệu và render layout.
- `src/components/`: Các UI component có thể tái sử dụng (như `Avatar`, `Icon`, `PostContent`, `VerifiedBadge`).
- `src/lib/`: Các tiện ích, hook và logic dùng chung (như `useI18n`, `format.ts`, `useImageAmbientColor`).
- `src/theme.tsx` & `App.css`: Quản lý design system và responsive layout.

### 🕸️ Khám phá mã nguồn với Graphify

Dự án này đã được tích hợp **Graphify** để phân tích kiến trúc và mối liên hệ giữa các file. Graphify giúp tạo ra một Knowledge Graph trực quan để theo dõi luồng dữ liệu (Data Flow) và sự phụ thuộc (Dependencies).

**Cách xem bản đồ kiến trúc:**
1. Mở file `graphify-out/graph.html` bằng bất kỳ trình duyệt nào (không cần server).
2. Tại đây bạn có thể xem các Node (đại diện cho file/thành phần) và Edge (đại diện cho sự phụ thuộc).
3. Sử dụng tính năng tìm kiếm trong Graphify HTML để tìm một Component hoặc API cụ thể và xem nó được gọi từ đâu.

**Cách cập nhật Graphify khi có code mới:**
Bạn có thể cập nhật bản đồ trực tiếp bằng lệnh:
```sh
graphify . --update
```
Hoặc xuất lại bản đồ HTML:
```sh
graphify export html
```

---

## 🚀 Setup & Cài đặt

### Yêu cầu hệ thống
- Node.js 20 hoặc mới hơn
- npm

### Cài đặt dependencies
```sh
npm install
```

### Cấu hình Môi trường (.env)
Tạo hoặc cập nhật các biến môi trường:
```sh
VITE_API_GATEWAY_URL=/api
VITE_GRAPHQL_GATEWAY_URL=/graphql
VITE_UPLOAD_SERVER_URL=/media
VITE_GRAPHQL_TIMEOUT_MS=20000
VITE_IP_GEOLOCATION_URL=https://ipwho.is/
```

Đối với phát triển local (Local Development), cấu hình Vite proxies:
```sh
VITE_DEV_GATEWAY_TARGET=http://localhost:2001
VITE_DEV_UPLOAD_TARGET=http://localhost:4001
VITE_DEV_ALLOWED_HOST=fakebook.example.ts.net
```

---

## 📡 Media Flow & Upload
Frontend tải trực tiếp file lên Upload Server thông qua xác thực `POST /media/upload`. Upload Server trả về một media URL. URL này sau đó được gửi qua Gateway (`createFeedPost` hoặc `createNormalStory`). SocialGraph lưu trữ URL và trả về cho UI để hiển thị.

Proxy dùng cho môi trường Dev:
```sh
VITE_UPLOAD_SERVER_URL=/media
VITE_DEV_UPLOAD_TARGET=http://localhost:4001
```

---

## 📜 Lệnh khởi chạy (Scripts)

Khởi chạy môi trường phát triển (Development):
```sh
npm run dev
```

Build ứng dụng cho Production:
```sh
npm run build
```

Chạy kiểm tra cú pháp (Linting):
```sh
npm run lint
```

Chạy Unit Tests (đã phủ xanh 100%):
```sh
npm test
```

Preview bản build production ở local:
```sh
npm run preview
```
