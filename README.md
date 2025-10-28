<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1M1qY9pr7s9sVz-Vqhscv_aIX4EWRvlN3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Provide your Gemini API key (choose one):
   - Enter it directly inside the app in the **Gemini API Key** field (the key stays in your browser only). Trường này luôn bắt đầu trống, vì vậy bạn cần nhập thủ công trong lần sử dụng đầu tiên.
   - Set `GEMINI_API_KEY` in [.env.local](.env.local) nếu bạn muốn dùng biến môi trường cho các script tự động hoá (giá trị này không được tự động nạp vào giao diện người dùng).
3. Run the app:
   `npm run dev`
4. Khi ứng dụng mở, nhập email và mật khẩu Google Flow của bạn vào khu vực **Tài khoản Google Flow** trước khi chạy tính năng tự động hoá. Thông tin này chỉ tồn tại trong bộ nhớ của tab hiện tại và không được lưu lại.

## Google Flow automation (Puppeteer)

Ứng dụng giờ chỉ tập trung vào quy trình tự động: sau khi sinh prompt, bạn nhập thông tin đăng nhập Google Flow và nhấn nút. Không còn yêu cầu sao chép thủ công giữa các tab.

### Tự động hoá trực tiếp trong giao diện

1. Nhập Gemini API key và thông tin tài khoản Google Flow ở đầu trang.
2. Sinh prompt cho dự án của bạn.
3. Ở phần kết quả, chọn thư mục tải video (nếu muốn) và nhấn **"Tự động hoá trên Google Flow"**.
4. Giữ cửa sổ Chrome mở cho tới khi cả ba video trong từng nhóm được tải xuống; script sẽ tự đăng nhập, dán prompt và tải file 720p.

### Tự động hoá bằng CLI (không cần mở trình duyệt thủ công)

Script `automation/fullAutomation.mjs` vẫn cho phép chạy toàn bộ quy trình bằng một lệnh:

1. Sao chép `automation/config.sample.json` thành `automation/config.json` và cập nhật nội dung.
2. Điền Gemini API key vào `.env.local` để script gọi Gemini.
3. Cập nhật các trường `googleFlowEmail` và `googleFlowPassword` trong file cấu hình để script tự đăng nhập Google Flow.
4. Chạy:

   ```bash
   npm run flow:auto
   ```

   Có thể truyền đường dẫn cấu hình và thư mục tải tùy ý:

   ```bash
   npm run flow:auto ./automation/config.json ./downloads/google-flow
   ```

Các trường quan trọng trong `config.json`:

- `projectName`: tên dự án sẽ hiển thị trong log và file xuất.
- `videoType`: `"story"` hoặc `"live"`.
- `idea` (đối với story) hoặc `liveAtmosphere` / `liveArtistName` / `liveArtist` / `liveArtistImagePath` (đối với live).
- `songMinutes` + `songSeconds`: thời lượng bài hát để tính số cảnh.
- `downloadDirectory`: thư mục lưu video.
- `batchSize`: số prompt chạy mỗi đợt (mặc định 3).
- `googleFlowEmail` + `googleFlowPassword`: thông tin đăng nhập Google Flow để script tự đăng nhập.
- `browserExecutablePath`, `userDataDir`, `headless`: tuỳ chỉnh cho trình duyệt Puppeteer.

### Chạy script với file prompts sẵn có

Nếu bạn đã có file JSON chứa prompt, dùng:

```bash
npm run flow:run ./path/to/prompts.json ./thu-muc-tai-video
```

- Script sẽ đọc biến môi trường `GOOGLE_FLOW_EMAIL` / `GOOGLE_FLOW_PASSWORD` (hoặc `FLOW_EMAIL` / `FLOW_PASSWORD`) để tự đăng nhập. Nếu không đặt, trình duyệt sẽ giữ nguyên phiên đăng nhập hiện có.
- Thư mục tải video mặc định là `google-flow-downloads` nếu không truyền tham số thứ hai.
