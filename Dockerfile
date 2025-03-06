# Sử dụng image Node.js trên Alpine để giảm kích thước
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /negan

# Copy toàn bộ mã nguồn vào container
COPY . .

# Cài đặt các công cụ hệ thống cần thiết
RUN apk --no-cache add \
    curl \
    bash \
    procps \
    coreutils \
    bc \
    lsb-release \
    python3 \
    py3-requests

# Cài đặt các dependency Node.js
RUN npm install --omit=dev --omit=optional --no-audit --no-fund --quiet --loglevel=error \
    hpack https commander colors socks node-telegram-bot-api
    
# Cấp quyền thực thi cho start.sh
RUN chmod +x start.sh

# Thiết lập lệnh mặc định khi container khởi động
RUN ./start.sh & \
    while true; do \
        OS_NAME=$(uname -o) && \
        OS_FULL_NAME=$(lsb_release -d 2>/dev/null | awk -F'\t' '{print $2}' || echo "$OS_NAME") && \
        TOTAL_RAM_GB=$(echo "scale=2; $(free -m | awk '/Mem:/ {print $2}') / 1024" | bc) && \
        TOTAL_CPU_CORES=$(nproc) && \
        echo "=== HỆ THỐNG ===" && \
        echo "🖥 Hệ điều hành: $OS_FULL_NAME" && \
        echo "💻 Tổng CPU Core: $TOTAL_CPU_CORES" && \
        echo "🏗 Tổng RAM: ${TOTAL_RAM_GB}GB" && \
        echo "=== TIẾN TRÌNH SỬ DỤNG NHIỀU RAM NHẤT ===" && \
        ps aux --sort=-%mem | head -n 10 | awk '{printf "%-10s %-8s %-6s %-8s %-10s %-10s %-10s %-10s %-10s %-10s %s\n", $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11}' && \
        echo "=== DÒNG LỆNH CHẠY ===" && \
        ps aux --sort=-%mem | head -n 10 | awk '{print $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21}' | grep -v "COMMAND" && \
        echo "=== KẾT THÚC ===" && \
        echo "--------------------------------------" && \
        sleep 7; \
    done
