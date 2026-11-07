# --- Build stage ---
FROM node:18-alpine AS build

# ใช้ /app เป็นมาตรฐาน
WORKDIR /app

# Copy เฉพาะไฟล์สำคัญสำหรับการลง library
COPY package.json package-lock.json* ./

# ลง library ทั้งหมด (รวม devDependencies สำหรับ build)
RUN npm install

# Copy ไฟล์ที่เหลือทั้งหมดในโปรเจกต์เข้าไป
COPY . .

# สั่ง build โดยใช้ npm run build (ซึ่งจะไปเรียก vite ใน node_modules เองอัตโนมัติ)
RUN npm run build

# --- Production stage ---
FROM nginx:stable-alpine

# สร้างโฟลเดอร์ config
RUN mkdir -p /etc/nginx/conf.d

# Copy nginx config จากโปรเจกต์เราเข้าไป
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy ไฟล์ที่ build เสร็จแล้ว (จาก /app/dist) ไปที่ nginx
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod -R 755 /usr/share/nginx/html

ENV HOST 0.0.0.0
EXPOSE 8765

CMD ["nginx", "-g", "daemon off;"]